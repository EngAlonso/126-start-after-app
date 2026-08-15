import { Router } from "express";
import { db } from "@workspace/db";
import {
  serviceRequestsTable, usersTable, servicesTable,
  governoratesTable, areasTable, offersTable,
  technicianProfilesTable, technicianServicesTable, technicianAreasTable,
  notificationsTable, auditTrailTable, priceAdjustmentsTable,
  pointTransactionsTable, coinRedemptionsTable, platformCreditsTable,
} from "@workspace/db";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { authenticate } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { createRequestSchema } from "../validators/schemas";
import { resolveCommissionRange } from "./offers";
import { NotificationService } from "../lib/notification-service";
import { getQualifiedTechnicianUserIds } from "../lib/technician-matching";
import { earnCoins, triggerReferralReward, getLoyaltyConfig, settleRedemption, releaseReservedCoins, cancelPendingCoins } from "../lib/loyaltyEngine";

const router = Router();

// ─── Helper: release reserved points for all pending offers on a request ──────
async function releaseAllPendingOfferReservations(requestId: number) {
  const pendingOffers = await db
    .select({
      id: offersTable.id,
      technicianId: offersTable.technicianId,
      reservedPoints: offersTable.reservedPoints,
    })
    .from(offersTable)
    .where(and(eq(offersTable.requestId, requestId), eq(offersTable.status, "pending")));

  for (const offer of pendingOffers) {
    if (offer.reservedPoints <= 0 || offer.technicianId === null) continue;
    const [profile] = await db
      .select()
      .from(technicianProfilesTable)
      .where(eq(technicianProfilesTable.userId, offer.technicianId))
      .limit(1);
    if (!profile) continue;
    await db.update(technicianProfilesTable).set({
      reservedPoints: Math.max(0, profile.reservedPoints - offer.reservedPoints),
      updatedAt: new Date(),
    }).where(eq(technicianProfilesTable.id, profile.id));
  }

  if (pendingOffers.length > 0) {
    await db.update(offersTable).set({ status: "rejected", updatedAt: new Date() })
      .where(and(eq(offersTable.requestId, requestId), eq(offersTable.status, "pending")));
  }
}

// ─── Helper: find all active, approved technicians qualified to see a request ──
// (matching service + area). Reused by request creation and request edits so
// every eligible technician gets instant SSE updates.
async function findQualifiedTechnicianUserIds(serviceId: number, areaId: number): Promise<number[]> {
  return getQualifiedTechnicianUserIds(serviceId, areaId);
}

// ─── Helper: notify admins ─────────────────────────────────────────────────────
async function notifyAdmins(title: string, body: string, relatedId: number) {
  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.role} IN ('admin', 'super_admin')`);
  if (admins.length > 0) {
    await db.insert(notificationsTable).values(
      admins.map((a) => ({
        userId: a.id,
        title,
        body,
        type: "status_change" as const,
        relatedId,
      }))
    );
  }
}

// ─── GET /api/requests ────────────────────────────────────────────────────────
router.get("/requests", authenticate, async (req, res) => {
  try {
    const { status, serviceId, governorateId, areaId, customerId, technicianId, page = "1", limit = "20" } = req.query as any;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let conditions: any[] = [];
    const user = req.user!;

    if (user.role === "customer") {
      conditions.push(eq(serviceRequestsTable.customerId, user.id));
    } else if (user.role === "technician") {
      const [profile] = await db
        .select()
        .from(technicianProfilesTable)
        .where(eq(technicianProfilesTable.userId, user.id))
        .limit(1);

      if (!profile || profile.approvalStatus !== "approved") {
        return res.json({ data: [], total: 0, page: pageNum, limit: limitNum });
      }

      const techAreas = await db
        .select({ areaId: technicianAreasTable.areaId })
        .from(technicianAreasTable)
        .where(eq(technicianAreasTable.technicianId, profile.id));
      const techServices = await db
        .select({ serviceId: technicianServicesTable.serviceId })
        .from(technicianServicesTable)
        .where(eq(technicianServicesTable.technicianId, profile.id));

      const areaIds    = techAreas.map((a) => a.areaId);
      const serviceIds = techServices.map((s) => s.serviceId);

      // ── Data-isolation fix ────────────────────────────────────────────────────
      //
      // A request must only be visible to a technician in one of two cases:
      //
      //   1. DISCOVERABLE  — status is "pending" or "offers_received" AND the
      //      request is within the technician's registered areas/services.
      //      These are requests the technician can still bid on.
      //
      //   2. ASSIGNED      — the technician IS the selectedTechnician, regardless
      //      of area/service.  These are their own active jobs.
      //
      // Without this split, any request in an active status (technician_selected,
      // in_progress, …) that happens to share the same area/service leaks to
      // every other technician in that area — exposing another technician's work.

      const discoverableCondition = and(
        inArray(serviceRequestsTable.status, ["pending", "offers_received"]),
        areaIds.length    > 0 ? inArray(serviceRequestsTable.areaId,    areaIds)    : sql`false`,
        serviceIds.length > 0 ? inArray(serviceRequestsTable.serviceId, serviceIds) : sql`false`,
      );

      const assignedCondition = eq(serviceRequestsTable.selectedTechnicianId, user.id);

      conditions.push(or(discoverableCondition, assignedCondition)!);
    }

    if (status) {
      // Support comma-separated status values (e.g. "technician_selected,in_progress").
      // A single value uses eq() for type safety; multiple values use inArray().
      const statusValues = (status as string).split(',').map((s: string) => s.trim()).filter(Boolean);
      if (statusValues.length === 1) {
        conditions.push(eq(serviceRequestsTable.status, statusValues[0] as any));
      } else if (statusValues.length > 1) {
        conditions.push(inArray(serviceRequestsTable.status, statusValues as any[]));
      }
    }
    if (serviceId) conditions.push(eq(serviceRequestsTable.serviceId, parseInt(serviceId)));
    if (governorateId) conditions.push(eq(serviceRequestsTable.governorateId, parseInt(governorateId)));
    if (areaId) conditions.push(eq(serviceRequestsTable.areaId, parseInt(areaId)));
    if (customerId && (user.role === "admin" || user.role === "super_admin")) conditions.push(eq(serviceRequestsTable.customerId, parseInt(customerId)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(serviceRequestsTable)
      .where(where);

    const requests = await db
      .select()
      .from(serviceRequestsTable)
      .where(where)
      .orderBy(desc(serviceRequestsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    const offerCounts = await db
      .select({ requestId: offersTable.requestId, count: sql<number>`count(*)::int` })
      .from(offersTable)
      .groupBy(offersTable.requestId);

    const offerCountMap: Record<number, number> = {};
    offerCounts.forEach((o) => { offerCountMap[o.requestId] = o.count; });

    const data = requests.map((r) => ({ ...r, offersCount: offerCountMap[r.id] || 0 }));

    return res.json({ data, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── POST /api/requests ───────────────────────────────────────────────────────
router.post("/requests", authenticate, validateBody(createRequestSchema), async (req, res) => {
  try {
    if (req.user!.role !== "customer") return res.status(403).json({ error: "العملاء فقط يمكنهم إنشاء طلبات" });

    const { serviceId, fullName, mobile, governorateId, areaId, address, description, images, audioUrl } = req.body;
    if (!serviceId || !fullName || !mobile || !governorateId || !areaId || !address || !description) {
      return res.status(400).json({ error: "جميع الحقول الأساسية مطلوبة" });
    }

    const [request] = await db
      .insert(serviceRequestsTable)
      .values({
        customerId: req.user!.id,
        serviceId: parseInt(serviceId),
        fullName, mobile,
        governorateId: parseInt(governorateId),
        areaId: parseInt(areaId),
        address, description,
        images: images || [],
        audioUrl: audioUrl || null,
        status: "pending",
      })
      .returning();

    // Notify connected admin browsers in real time
    try {
      const { broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastAdminEvent("new_request", { id: request.id });
    } catch {}

    try {
      const qualifiedUserIds = await findQualifiedTechnicianUserIds(
        parseInt(serviceId),
        parseInt(areaId),
      );

      if (qualifiedUserIds.length > 0) {
        await db.insert(notificationsTable).values(
          qualifiedUserIds.map((userId) => ({
            userId,
            title: "طلب خدمة جديد",
            body: `طلب جديد في منطقتك — ${description.slice(0, 80)}`,
            type: "new_request" as const,
            relatedId: request.id,
          })),
        );

        // Push notifications — non-blocking, fail silently
        try {
          const [svc] = await db
            .select({ name: servicesTable.name })
            .from(servicesTable)
            .where(eq(servicesTable.id, parseInt(serviceId)))
            .limit(1);
          const [areaRow] = await db
            .select({ nameAr: areasTable.nameAr })
            .from(areasTable)
            .where(eq(areasTable.id, parseInt(areaId)))
            .limit(1);
          await NotificationService.dispatchPush(
            qualifiedUserIds,
            {
              title: "طلب خدمة جديد 🔔",
              body: `طلب ${svc?.name ?? "خدمة"} في ${areaRow?.nameAr ?? "منطقتك"} — قدّم عرضك الآن`,
              type: "new_request",
              data: { requestId: String(request.id) },
            },
          );
        } catch {}

        // SSE: push to all qualified connected technicians instantly
        try {
          const { broadcastToUsers } = await import("../lib/sse-broadcast");
          broadcastToUsers(qualifiedUserIds, "request_created", { id: request.id });
        } catch {}
      }
    } catch (notifErr) {
      req.log.error({ notifErr }, "failed to send new_request notifications");
    }

    return res.status(201).json(request);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── GET /api/requests/my-completed ─────────────────────────────────────────
// Returns completed/in-progress requests where the logged-in technician was selected
// Returns only fully-completed requests assigned to the logged-in technician.
// Do NOT add in_progress / price_change_requested / waiting_approval here —
// those are active statuses sourced from GET /requests in the dashboard.
// Including them caused the Completed page to show active jobs and inflated the badge count.
router.get("/requests/my-completed", authenticate, async (req, res) => {
  try {
    if (req.user!.role !== "technician") {
      return res.status(403).json({ error: "الفنيون فقط يمكنهم الوصول لهذا المسار" });
    }

    const { page = "1", limit = "20" } = req.query as any;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(serviceRequestsTable)
      .where(and(
        eq(serviceRequestsTable.selectedTechnicianId, req.user!.id),
        eq(serviceRequestsTable.status, "completed"),
      ));

    const requests = await db
      .select()
      .from(serviceRequestsTable)
      .where(and(
        eq(serviceRequestsTable.selectedTechnicianId, req.user!.id),
        eq(serviceRequestsTable.status, "completed"),
      ))
      .orderBy(desc(serviceRequestsTable.updatedAt))
      .limit(limitNum)
      .offset(offset);

    // Enrich with customer and service
    const enriched = await Promise.all(requests.map(async (r) => {
      const [customer] = await db
        .select({ id: usersTable.id, fullName: usersTable.fullName, mobile: usersTable.mobile })
        .from(usersTable)
        .where(eq(usersTable.id, r.customerId))
        .limit(1);

      const [service] = await db
        .select({ id: servicesTable.id, name: servicesTable.name })
        .from(servicesTable)
        .where(eq(servicesTable.id, r.serviceId))
        .limit(1);

      return { ...r, customer: customer || null, service: service || null };
    }));

    return res.json({ data: enriched, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── GET /api/requests/:id ────────────────────────────────────────────────────
router.get("/requests/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    // ── Authorization gate ────────────────────────────────────────────────────
    // Apply the same visibility model used by GET /api/requests (list endpoint):
    //
    //   admin / super_admin — always allowed
    //   customer            — only their own requests
    //   technician          — (a) request is discoverable: pending/offers_received
    //                             AND matches technician's registered areas/services
    //                         OR (b) technician is the selectedTechnician
    //
    // Any other combination → 403.
    const reqUser = req.user!;
    if (reqUser.role === "customer") {
      if (request.customerId !== reqUser.id) {
        return res.status(403).json({ error: "غير مسموح بالوصول إلى هذا الطلب" });
      }
    } else if (reqUser.role === "technician") {
      const isAssigned = request.selectedTechnicianId === reqUser.id;
      if (!isAssigned) {
        // Only allow if request is still discoverable in the technician's area/service
        const isDiscoverableStatus = ["pending", "offers_received"].includes(request.status);
        if (!isDiscoverableStatus) {
          return res.status(403).json({ error: "غير مسموح بالوصول إلى هذا الطلب" });
        }
        // Check area + service membership
        const [profile] = await db
          .select({ id: technicianProfilesTable.id, approvalStatus: technicianProfilesTable.approvalStatus })
          .from(technicianProfilesTable)
          .where(eq(technicianProfilesTable.userId, reqUser.id))
          .limit(1);
        if (!profile || profile.approvalStatus !== "approved") {
          return res.status(403).json({ error: "غير مسموح بالوصول إلى هذا الطلب" });
        }
        const [areaMatch] = await db
          .select({ areaId: technicianAreasTable.areaId })
          .from(technicianAreasTable)
          .where(and(eq(technicianAreasTable.technicianId, profile.id), eq(technicianAreasTable.areaId, request.areaId)))
          .limit(1);
        const [serviceMatch] = await db
          .select({ serviceId: technicianServicesTable.serviceId })
          .from(technicianServicesTable)
          .where(and(eq(technicianServicesTable.technicianId, profile.id), eq(technicianServicesTable.serviceId, request.serviceId)))
          .limit(1);
        if (!areaMatch || !serviceMatch) {
          return res.status(403).json({ error: "غير مسموح بالوصول إلى هذا الطلب" });
        }
      }
    }
    // admin / super_admin: fall through (no restriction)

    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, request.serviceId)).limit(1);
    const [governorate] = await db.select().from(governoratesTable).where(eq(governoratesTable.id, request.governorateId)).limit(1);
    const [area] = await db.select().from(areasTable).where(eq(areasTable.id, request.areaId)).limit(1);
    const [customer] = await db
      .select({ id: usersTable.id, fullName: usersTable.fullName, mobile: usersTable.mobile, profileImage: usersTable.profileImage })
      .from(usersTable)
      .where(eq(usersTable.id, request.customerId))
      .limit(1);
    const [offerCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(offersTable)
      .where(eq(offersTable.requestId, id));

    // Mark as admin-seen when an admin views the request detail
    if ((req.user?.role === "admin" || req.user?.role === "super_admin") && !(request as any).adminSeen) {
      await db.update(serviceRequestsTable).set({ adminSeen: true }).where(eq(serviceRequestsTable.id, id));
    }

    // ── Phone visibility: reveal contact info only after technician selection ──
    const viewer = req.user!;
    // Strip customer mobile from non-selected technicians
    const customerOut: Omit<typeof customer, "mobile"> & { mobile?: string } = { ...customer };
    if (viewer.role === "technician" && viewer.id !== request.selectedTechnicianId) {
      customerOut.mobile = undefined;
    }

    // Expose selected technician phone only to the customer party
    let selectedTechnician: { id: number; fullName: string; mobile: string; profileImage: string | null } | null = null;
    if (request.selectedTechnicianId && viewer.role === "customer" && viewer.id === request.customerId) {
      const [tech] = await db
        .select({ id: usersTable.id, fullName: usersTable.fullName, mobile: usersTable.mobile, profileImage: usersTable.profileImage })
        .from(usersTable)
        .where(eq(usersTable.id, request.selectedTechnicianId))
        .limit(1);
      selectedTechnician = tech ?? null;
    }

    // Coin-redemption flag: true only when a coin_redemptions row exists for this request.
    // This is distinct from hasDiscount (which can also be set by coupons).
    const [coinRedemption] = await db
      .select({ id: coinRedemptionsTable.id })
      .from(coinRedemptionsTable)
      .where(eq(coinRedemptionsTable.requestId, id))
      .limit(1);
    const hasCoinRedemption = !!coinRedemption;

    return res.json({ ...request, service, governorate, area, customer: customerOut, selectedTechnician, offersCount: offerCount?.count || 0, hasCoinRedemption });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── PATCH /api/requests/:id/edit ─────────────────────────────────────────────
// Customer-only: edit their own request while it is still awaiting offers.
router.patch("/requests/:id/edit", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const user = req.user!;

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    if (user.role !== "customer" || request.customerId !== user.id) {
      return res.status(403).json({ error: "غير مسموح" });
    }

    if (!["pending", "offers_received"].includes(request.status)) {
      return res.status(400).json({ error: "لا يمكن تعديل الطلب بعد بدء استلام العروض المتقدمة" });
    }

    const { address, description, images, audioUrl } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (address !== undefined) updates["address"] = address;
    if (description !== undefined) updates["description"] = description;
    if (images !== undefined) updates["images"] = images;
    if (audioUrl !== undefined) updates["audioUrl"] = audioUrl;

    const [updated] = await db
      .update(serviceRequestsTable)
      .set(updates)
      .where(eq(serviceRequestsTable.id, id))
      .returning();

    res.json(updated);

    // Secondary ops: audit + instant SSE to admin + selected technician + every
    // qualified technician who can currently see this request — must not block response.
    try {
      await db.insert(auditTrailTable).values({
        requestId: id,
        changedBy: user.id,
        fieldName: "request_edited",
        oldValue: request.description,
        newValue: description ?? request.description,
      });

      const { broadcastToUser, broadcastToUsers, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastAdminEvent("request_updated", { id });

      if (request.selectedTechnicianId) {
        broadcastToUser(request.selectedTechnicianId, "request_updated", { id });
      } else if (request.status === "pending" || request.status === "offers_received") {
        const qualifiedUserIds = await findQualifiedTechnicianUserIds(request.serviceId, request.areaId);
        if (qualifiedUserIds.length > 0) {
          broadcastToUsers(qualifiedUserIds, "request_updated", { id });
        }
      }
    } catch (secErr) {
      req.log.error({ err: secErr }, "request edit secondary ops failed — edit was saved successfully");
    }
    return;
  } catch (err) {
    req.log.error({ err });
    if (!res.headersSent) {
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

// ─── PATCH /api/requests/:id ──────────────────────────────────────────────────
router.patch("/requests/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { status, adminNote } = req.body;

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    if (req.user!.role !== "admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "غير مسموح" });
    }

    const oldStatus = request.status;
    const [updated] = await db
      .update(serviceRequestsTable)
      .set({ status, adminNote, updatedAt: new Date() })
      .where(eq(serviceRequestsTable.id, id))
      .returning();

    res.json(updated);

    // Secondary ops: audit log + SSE — must not block the primary response
    try {
      if (oldStatus !== status) {
        // super_admin has no DB record (id=0); use null for changedBy FK
        const actorId = req.user!.id === 0 ? null : req.user!.id;
        await db.insert(auditTrailTable).values({
          requestId: id,
          changedBy: actorId,
          fieldName: "status",
          oldValue: oldStatus,
          newValue: status,
        });
      }
      // SSE: notify customer + selected technician of status change
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(request.customerId, "status_changed", { id, status });
      if (request.selectedTechnicianId) broadcastToUser(request.selectedTechnicianId, "status_changed", { id, status });
      broadcastAdminEvent("status_changed", { id, status });
    } catch (secErr) {
      req.log.error({ err: secErr }, "admin status-update audit failed");
    }
    return;
  } catch (err) {
    req.log.error({ err });
    if (!res.headersSent) {
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

// ─── POST /api/requests/:id/cancel ───────────────────────────────────────────
router.post("/requests/:id/cancel", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { reason } = req.body;
    const user = req.user!;

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    // ── Determine cancellation actor from actual request relationship, not just role ──
    const isRequestOwner = request.customerId === user.id;
    const isAssignedTechnician = request.selectedTechnicianId === user.id && user.role === "technician";
    const isAdmin = user.role === "admin" || user.role === "super_admin";

    if (!isRequestOwner && !isAssignedTechnician && !isAdmin) {
      return res.status(403).json({ error: "غير مسموح بإلغاء هذا الطلب" });
    }

    if (isRequestOwner) {
      if (!["pending", "offers_received"].includes(request.status)) {
        return res.status(403).json({
          error: "لا يمكن إلغاء الطلب بعد اختيار الفني. يرجى التواصل مع الدعم الفني لإلغاء الطلب عبر الإدارة.",
        });
      }
    }

    await releaseAllPendingOfferReservations(id);

    if (isAdmin && request.selectedTechnicianId) {
      const [selectedOffer] = await db
        .select()
        .from(offersTable)
        .where(and(eq(offersTable.requestId, id), eq(offersTable.status, "selected")))
        .limit(1);

      if (selectedOffer && selectedOffer.reservedPoints > 0) {
        const [profile] = await db
          .select()
          .from(technicianProfilesTable)
          .where(eq(technicianProfilesTable.userId, selectedOffer.technicianId!))
          .limit(1);
        if (profile) {
          await db.update(technicianProfilesTable).set({
            reservedPoints: Math.max(0, profile.reservedPoints - selectedOffer.reservedPoints),
            updatedAt: new Date(),
          }).where(eq(technicianProfilesTable.id, profile.id));
        }
      }
    }

    // Actor is determined by the actual relationship to the request — not just token role
    let status: string;
    if (isRequestOwner) status = "cancelled_by_customer";
    else if (isAssignedTechnician) status = "cancelled_by_technician";
    else status = "cancelled_by_admin";

    await db
      .update(serviceRequestsTable)
      .set({ status: status as any, cancelReason: reason, updatedAt: new Date() })
      .where(eq(serviceRequestsTable.id, id));

    // ── Loyalty: reverse any active coin redemption + cancel pending coins ──
    // Independent failure domains — a failure here must not prevent the
    // cancellation itself from succeeding (it already committed above).
    try {
      const agreedPrice = parseFloat(request.agreedPrice ?? "0");
      await releaseReservedCoins({ requestId: id, agreedPrice });
    } catch (releaseErr: any) {
      if (releaseErr?.message !== "REDEMPTION_NOT_ACTIVE") {
        req.log.error({ err: releaseErr }, "releaseReservedCoins failed during cancellation");
      }
    }
    try {
      await cancelPendingCoins(id);
    } catch (pendingErr) {
      req.log.error({ err: pendingErr }, "cancelPendingCoins failed during cancellation");
    }

    // Build the same affected-user set used by the SSE cancellation event so
    // every technician who submitted an offer also gets the in-app record.
    const offerTechIds: number[] = [];
    try {
      const offerRows = await db
        .select({ technicianId: offersTable.technicianId })
        .from(offersTable)
        .where(eq(offersTable.requestId, id));
      for (const row of offerRows) {
        if (row.technicianId !== null && !offerTechIds.includes(row.technicianId)) {
          offerTechIds.push(row.technicianId);
        }
      }
    } catch {}
    const cancellationTargets = Array.from(new Set([
      request.customerId,
      request.selectedTechnicianId,
      ...offerTechIds,
    ].filter((value): value is number => value !== null)));

    // SSE: notify all parties of cancellation
    try {
      const { broadcastToUser, broadcastToUsers, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(request.customerId, "request_cancelled", { id });
      if (request.selectedTechnicianId) broadcastToUser(request.selectedTechnicianId, "request_cancelled", { id });
      broadcastAdminEvent("status_changed", { id, status });

      // Also notify every technician who submitted an offer on this request
      // (they may have it in their "offers_received" list and need an instant update)
      const otherOfferTechIds = offerTechIds.filter((technicianId) => technicianId !== request.selectedTechnicianId);
      if (otherOfferTechIds.length > 0) {
        broadcastToUsers(otherOfferTechIds, "request_cancelled", { id });
      }
      if (cancellationTargets.length > 0) {
        broadcastToUsers(cancellationTargets, "notification", {});
      }
    } catch {}

    // In-app + push notifications for cancellation — non-blocking, fail silently
    try {
      await NotificationService.notifyRequestCancelled(cancellationTargets, id);
    } catch {}

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── GET /api/requests/:id/price-adjustment (latest pending) ──────────────────
router.get("/requests/:id/price-adjustment", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [adj] = await db
      .select()
      .from(priceAdjustmentsTable)
      .where(and(eq(priceAdjustmentsTable.requestId, id), eq(priceAdjustmentsTable.status, "pending")))
      .orderBy(desc(priceAdjustmentsTable.createdAt))
      .limit(1);
    if (!adj) return res.status(404).json({ error: "لا يوجد طلب تعديل معلق" });

    // Join technician name
    let technicianName: string | null = null;
    if (adj.technicianId) {
      const [techUser] = await db
        .select({ fullName: usersTable.fullName })
        .from(usersTable)
        .where(eq(usersTable.id, adj.technicianId))
        .limit(1);
      technicianName = techUser?.fullName || null;
    }

    return res.json({ ...adj, technicianName });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── GET /api/requests/:id/price-adjustments (full history) ───────────────────
router.get("/requests/:id/price-adjustments", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const adjustments = await db
      .select()
      .from(priceAdjustmentsTable)
      .where(eq(priceAdjustmentsTable.requestId, id))
      .orderBy(desc(priceAdjustmentsTable.createdAt));

    const result = await Promise.all(
      adjustments.map(async (adj) => {
        let technicianName: string | null = null;
        if (adj.technicianId) {
          const [techUser] = await db
            .select({ fullName: usersTable.fullName })
            .from(usersTable)
            .where(eq(usersTable.id, adj.technicianId))
            .limit(1);
          technicianName = techUser?.fullName || null;
        }
        return { ...adj, technicianName };
      })
    );

    return res.json(result);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── POST /api/requests/:id/price-adjustment ──────────────────────────────────
router.post("/requests/:id/price-adjustment", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const user = req.user!;

    if (user.role !== "technician") {
      return res.status(403).json({ error: "الفنيون فقط يمكنهم طلب تعديل السعر" });
    }

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    if (request.selectedTechnicianId !== user.id) {
      return res.status(403).json({ error: "أنت لست الفني المختار لهذا الطلب" });
    }

    if (!["technician_selected", "in_progress"].includes(request.status)) {
      return res.status(400).json({ error: "لا يمكن طلب تعديل السعر في هذه المرحلة" });
    }

    // Block if pending adjustment already exists
    const [existingPending] = await db
      .select({ id: priceAdjustmentsTable.id })
      .from(priceAdjustmentsTable)
      .where(and(
        eq(priceAdjustmentsTable.requestId, id),
        eq(priceAdjustmentsTable.status, "pending"),
      ))
      .limit(1);

    if (existingPending) {
      return res.status(400).json({ error: "يوجد طلب تعديل سعر قيد المراجعة. يرجى انتظار رد العميل." });
    }

    const { newPrice, newSpareParts, newDescription, supportingImage } = req.body;
    if (!newPrice || parseFloat(newPrice) <= 0) {
      return res.status(400).json({ error: "السعر الجديد مطلوب ويجب أن يكون أكبر من صفر" });
    }

    // Get old offer prices
    const [selectedOffer] = await db
      .select()
      .from(offersTable)
      .where(and(eq(offersTable.requestId, id), eq(offersTable.status, "selected")))
      .limit(1);

    const oldPrice = selectedOffer ? parseFloat(selectedOffer.price as string) : null;
    const oldSpareParts = selectedOffer?.spareParts ? parseFloat(selectedOffer.spareParts as string) : null;

    const [adj] = await db.insert(priceAdjustmentsTable).values({
      requestId: id,
      technicianId: user.id,
      oldPrice: oldPrice !== null ? oldPrice.toString() : null,
      oldSpareParts: oldSpareParts !== null ? oldSpareParts.toString() : null,
      newPrice: parseFloat(newPrice).toString(),
      newSpareParts: newSpareParts ? parseFloat(newSpareParts).toString() : null,
      newDescription: newDescription || null,
      supportingImage: supportingImage || null,
      status: "pending",
    }).returning();

    await db
      .update(serviceRequestsTable)
      .set({ status: "price_change_requested", updatedAt: new Date() })
      .where(eq(serviceRequestsTable.id, id));

    // Notify customer
    await db.insert(notificationsTable).values({
      userId: request.customerId,
      title: "طلب تعديل السعر",
      body: `الفني طلب تعديل السعر للطلب رقم #${id}. السعر الجديد: ${parseFloat(newPrice)} جنيه`,
      type: "status_change" as const,
      relatedId: id,
    });

    // Audit log
    await db.insert(auditTrailTable).values({
      requestId: id,
      changedBy: user.id,
      fieldName: "price_adjustment_requested",
      oldValue: `${oldPrice || 0}`,
      newValue: `${parseFloat(newPrice)}`,
    });

    // SSE: notify customer instantly of price adjustment request
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(request.customerId, "price_adjustment_requested", { requestId: id });
      broadcastAdminEvent("price_adjustment_requested", { requestId: id });
    } catch {}

    // Push notification for customer — non-blocking, fail silently
    try {
      await NotificationService.notifyPriceChangeRequested(
        request.customerId,
        id,
        parseFloat(newPrice),
      );
    } catch {}

    return res.json({ success: true, adjustment: adj });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── POST /api/requests/:id/price-adjustment/respond ─────────────────────────
router.post("/requests/:id/price-adjustment/respond", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const user = req.user!;
    const { approved } = req.body;

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    if (user.role !== "customer" || request.customerId !== user.id) {
      return res.status(403).json({ error: "غير مسموح" });
    }

    // Customer responding to a price adjustment requires admin attention — mark unseen
    await db.update(serviceRequestsTable).set({ adminSeen: false }).where(eq(serviceRequestsTable.id, id));

    const [adj] = await db
      .select()
      .from(priceAdjustmentsTable)
      .where(and(eq(priceAdjustmentsTable.requestId, id), eq(priceAdjustmentsTable.status, "pending")))
      .orderBy(desc(priceAdjustmentsTable.createdAt))
      .limit(1);

    if (!adj) {
      return res.status(404).json({ error: "لا يوجد طلب تعديل معلق" });
    }

    const now = new Date();

    if (approved) {
      // Update request agreed price to new total
      const newTotal = parseFloat(adj.newPrice as string) + (adj.newSpareParts ? parseFloat(adj.newSpareParts as string) : 0);

      // Per loyalty business rule: customer_payable_amount is always written
      // together with agreedPrice — never left NULL. If an active coin
      // redemption exists, preserve its discount against the new total;
      // otherwise customer_payable_amount simply follows agreedPrice.
      let newCustomerPayable = newTotal;
      if (request.hasDiscount) {
        const [activeRedemption] = await db
          .select({ discountValue: coinRedemptionsTable.discountValue })
          .from(coinRedemptionsTable)
          .where(and(eq(coinRedemptionsTable.requestId, id), eq(coinRedemptionsTable.status, "active")))
          .limit(1);
        if (activeRedemption) {
          newCustomerPayable = Math.max(0, newTotal - parseFloat(activeRedemption.discountValue as string));
        }
      }

      await db.update(serviceRequestsTable).set({
        agreedPrice: newTotal.toString(),
        customerPayableAmount: newCustomerPayable.toString(),
        status: "in_progress",
        updatedAt: now,
      }).where(eq(serviceRequestsTable.id, id));

      // Also update the selected offer prices to match new agreed price
      if (request.selectedTechnicianId) {
        await db.update(offersTable).set({
          price: adj.newPrice as string,
          spareParts: adj.newSpareParts ? adj.newSpareParts as string : null,
          updatedAt: now,
        }).where(and(
          eq(offersTable.requestId, id),
          eq(offersTable.status, "selected"),
        ));
      }

      // ── Recalculate commission based on the newly accepted labor price ────────
      // resolveCommissionRange runs the same logic used at offer submission:
      // service-specific → global range, fixed or percentage, plus area extra points.
      if (request.serviceId) {
        const [selectedOffer] = await db
          .select()
          .from(offersTable)
          .where(and(eq(offersTable.requestId, id), eq(offersTable.status, "selected")))
          .limit(1);

        if (selectedOffer) {
          const [profile] = await db
            .select()
            .from(technicianProfilesTable)
            .where(eq(technicianProfilesTable.userId, selectedOffer.technicianId!))
            .limit(1);

          if (profile) {
            const newLaborPrice = parseFloat(adj.newPrice as string);
            const newRequiredPoints = await resolveCommissionRange(
              request.serviceId,
              newLaborPrice,
              request.areaId ?? null,
            );

            if (newRequiredPoints !== null) {
              const oldReserved = selectedOffer.reservedPoints;
              const diff = newRequiredPoints - oldReserved;

              if (diff > 0) {
                // New commission is higher → reserve the extra difference.
                // Cap at available balance so we never go negative.
                const available = Math.max(0, profile.pointsBalance - profile.reservedPoints);
                const toReserve = Math.min(diff, available);
                const newProfileReserved = profile.reservedPoints + toReserve;
                const finalOfferReserved = oldReserved + toReserve;

                await db.update(technicianProfilesTable)
                  .set({ reservedPoints: newProfileReserved, updatedAt: now })
                  .where(eq(technicianProfilesTable.id, profile.id));

                if (toReserve > 0) {
                  await db.insert(pointTransactionsTable).values({
                    technicianId: profile.id,
                    amount: toReserve,
                    type: "debit",
                    description: `حجز إضافي بسبب تعديل السعر — طلب #${id}`,
                    balanceAfter: profile.pointsBalance,
                    requestId: id,
                  });
                }

                await db.update(offersTable)
                  .set({ reservedPoints: finalOfferReserved, updatedAt: now })
                  .where(eq(offersTable.id, selectedOffer.id));

              } else if (diff < 0) {
                // New commission is lower → release the surplus back to available.
                const toRelease = Math.abs(diff);
                const newProfileReserved = Math.max(0, profile.reservedPoints - toRelease);

                await db.update(technicianProfilesTable)
                  .set({ reservedPoints: newProfileReserved, updatedAt: now })
                  .where(eq(technicianProfilesTable.id, profile.id));

                await db.insert(pointTransactionsTable).values({
                  technicianId: profile.id,
                  amount: toRelease,
                  type: "release",
                  description: `استرداد نقاط بسبب تعديل السعر — طلب #${id}`,
                  balanceAfter: profile.pointsBalance,
                  requestId: id,
                });

                await db.update(offersTable)
                  .set({ reservedPoints: newRequiredPoints, updatedAt: now })
                  .where(eq(offersTable.id, selectedOffer.id));
              }
              // diff === 0: same commission — no balance changes needed
            }
          }
        }
      }
      // ── End commission recalculation ──────────────────────────────────────────

      await db.update(priceAdjustmentsTable).set({
        status: "approved",
        decisionDate: now,
      }).where(eq(priceAdjustmentsTable.id, adj.id));

      // Notify technician
      if (request.selectedTechnicianId) {
        await db.insert(notificationsTable).values({
          userId: request.selectedTechnicianId,
          title: "تم قبول تعديل السعر",
          body: `وافق العميل على السعر الجديد للطلب #${id}: ${newTotal} جنيه`,
          type: "status_change" as const,
          relatedId: id,
        });
        // Push notification for technician — non-blocking, fail silently
        try {
          await NotificationService.notifyPriceApproved(
            request.selectedTechnicianId,
            id,
            newTotal,
          );
        } catch {}
      }

      // Notify admins
      await notifyAdmins(
        "تعديل سعر مقبول",
        `تم قبول تعديل السعر للطلب #${id}. السعر الجديد: ${newTotal} جنيه`,
        id
      );

      // Audit
      await db.insert(auditTrailTable).values({
        requestId: id,
        changedBy: user.id,
        fieldName: "price_adjustment_approved",
        oldValue: adj.oldPrice?.toString() || "0",
        newValue: newTotal.toString(),
      });
    } else {
      // Reject — keep original pricing, move back to in_progress
      await db.update(serviceRequestsTable).set({
        status: "in_progress",
        updatedAt: now,
      }).where(eq(serviceRequestsTable.id, id));

      await db.update(priceAdjustmentsTable).set({
        status: "rejected",
        decisionDate: now,
      }).where(eq(priceAdjustmentsTable.id, adj.id));

      // Notify technician
      if (request.selectedTechnicianId) {
        await db.insert(notificationsTable).values({
          userId: request.selectedTechnicianId,
          title: "تم رفض تعديل السعر",
          body: `رفض العميل السعر الجديد للطلب #${id}. يستمر العمل بالسعر الأصلي.`,
          type: "status_change" as const,
          relatedId: id,
        });
        // Push notification for technician — non-blocking, fail silently
        try {
          await NotificationService.notifyPriceRejected(
            request.selectedTechnicianId,
            id,
          );
        } catch {}
      }

      // Audit
      await db.insert(auditTrailTable).values({
        requestId: id,
        changedBy: user.id,
        fieldName: "price_adjustment_rejected",
        oldValue: adj.oldPrice?.toString() || "0",
        newValue: adj.newPrice?.toString() || "0",
      });
    }

    // SSE: notify technician of customer's response to price adjustment
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      if (request.selectedTechnicianId) {
        broadcastToUser(request.selectedTechnicianId, "price_adjustment_responded", { requestId: id, approved });
      }
      broadcastAdminEvent("price_adjustment_responded", { requestId: id, approved });
    } catch {}

    return res.json({ success: true, approved });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── POST /api/requests/:id/request-completion ────────────────────────────────
router.post("/requests/:id/request-completion", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const user = req.user!;

    if (user.role !== "technician") {
      return res.status(403).json({ error: "الفنيون فقط يمكنهم طلب التأكيد" });
    }

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });
    if (request.selectedTechnicianId !== user.id) return res.status(403).json({ error: "أنت لست الفني المختار" });

    // Block if price adjustment is pending
    if (request.status === "price_change_requested") {
      return res.status(400).json({ error: "يوجد طلب تعديل سعر قيد مراجعة العميل. يرجى انتظار رده أولاً." });
    }

    if (!["technician_selected", "in_progress"].includes(request.status)) {
      return res.status(400).json({ error: "لا يمكن طلب التأكيد في هذه المرحلة" });
    }

    await db.update(serviceRequestsTable)
      .set({ status: "waiting_approval", updatedAt: new Date() })
      .where(eq(serviceRequestsTable.id, id));

    // Send response immediately — status is updated, secondary ops must not block response
    res.json({ success: true });

    try {
      await db.insert(notificationsTable).values({
        userId: request.customerId,
        title: "هل تم تنفيذ الخدمة؟",
        body: `أعلن الفني إتمام تنفيذ الطلب #${id}. يرجى تأكيد أو رفض الإنجاز.`,
        type: "status_change" as const,
        relatedId: id,
      });

      await db.insert(auditTrailTable).values({
        requestId: id,
        changedBy: user.id,
        fieldName: "completion_requested",
        oldValue: request.status,
        newValue: "waiting_approval",
      });

      // Push notification for customer — non-blocking, fail silently
      try {
        await NotificationService.notifyWaitingApproval(request.customerId, id);
      } catch {}

      // SSE: notify customer instantly that technician marked job done
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(request.customerId, "status_changed", { id, status: "waiting_approval" });
      broadcastAdminEvent("status_changed", { id, status: "waiting_approval" });
    } catch (secErr) {
      req.log.error({ err: secErr }, "request-completion secondary ops failed — status was updated successfully");
    }
    return;
  } catch (err) {
    req.log.error({ err });
    if (!res.headersSent) {
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

// ─── POST /api/requests/:id/complete ─────────────────────────────────────────
router.post("/requests/:id/complete", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const user = req.user!;

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    // Only the owning customer may confirm completion.
    // Technicians, admins and any other role are explicitly excluded.
    if (user.role !== "customer" || request.customerId !== user.id) {
      return res.status(403).json({ error: "غير مسموح" });
    }

    if (request.status !== "waiting_approval") {
      return res.status(400).json({ error: "لا يمكن تأكيد الإكمال إلا بعد إشعار الفني بالإتمام" });
    }

    // Atomic status transition — WHERE guards against concurrent completion.
    // If another concurrent call already transitioned the status, RETURNING
    // returns zero rows and we surface a 409 before doing anything else.
    const [updated] = await db
      .update(serviceRequestsTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(and(eq(serviceRequestsTable.id, id), eq(serviceRequestsTable.status, "waiting_approval")))
      .returning({ id: serviceRequestsTable.id });

    if (!updated) {
      return res.status(409).json({ error: "الطلب تم إكماله بالفعل أو حالته تغيرت" });
    }

    // Send response immediately — all point deduction and secondary ops happen after
    res.json({ success: true });

    try {
      // Find selected offer to deduct commission points
      const [selectedOffer] = await db
        .select()
        .from(offersTable)
        .where(and(eq(offersTable.requestId, id), eq(offersTable.status, "selected")))
        .limit(1);

      if (selectedOffer && selectedOffer.reservedPoints > 0) {
        // ── Atomic points deduction ─────────────────────────────────────────
        // Lock the technician profile row (SELECT ... FOR UPDATE) inside a
        // transaction before computing the new balance, so a concurrent
        // deduction (e.g. another completion, or an admin points adjustment)
        // can't read the same stale balance and cause a lost update.
        await db.transaction(async (tx) => {
          const [profile] = await tx
            .select()
            .from(technicianProfilesTable)
            .where(eq(technicianProfilesTable.userId, selectedOffer.technicianId!))
            .for("update");

          if (!profile) return;

          const newBalance = Math.max(0, profile.pointsBalance - selectedOffer.reservedPoints);
          const newReserved = Math.max(0, profile.reservedPoints - selectedOffer.reservedPoints);

          await tx.update(technicianProfilesTable).set({
            pointsBalance: newBalance,
            reservedPoints: newReserved,
            updatedAt: new Date(),
          }).where(eq(technicianProfilesTable.id, profile.id));

          await tx.insert(pointTransactionsTable).values({
            technicianId: profile.id,
            amount: selectedOffer.reservedPoints,
            type: "commission",
            description: `عمولة طلب #${id}`,
            balanceAfter: newBalance,
            requestId: id,
          });
        });
      }

      // ── Loyalty: earn coins + trigger referral reward ────────────────────
      // agreedPrice is stored as numeric string in DB; parse to float.
      // Each operation has its own try-catch so a failure in one does not
      // suppress the other (independent failure domains).
      const agreedPrice = parseFloat(request.agreedPrice ?? "0");
      if (agreedPrice > 0) {
        // Load config once; shared by both operations below.
        let loyaltyConfig: Awaited<ReturnType<typeof getLoyaltyConfig>> | null = null;
        try { loyaltyConfig = await getLoyaltyConfig(); } catch (cfgErr) {
          req.log.error({ err: cfgErr }, "loyalty config load failed — skipping loyalty ops");
        }

        if (loyaltyConfig) {
          // 0️⃣ Settle any active coin redemption — independent failure domain.
          // Must run before earnCoins reads request.hasDiscount (unaffected by
          // settlement, but keeping ordering matches the plan's sequencing).
          try {
            await settleRedemption(id);
          } catch (settleErr) {
            req.log.error({ err: settleErr }, "settleRedemption failed — completion was recorded successfully");
          }

          // 1️⃣ Earn coins — independent failure domain
          try {
            const coinsEarned = await earnCoins({
              userId:      request.customerId,
              requestId:   id,
              agreedPrice,
              hasDiscount: request.hasDiscount,
              config:      loyaltyConfig,
            });
            if (coinsEarned > 0) {
              req.log.info({ requestId: id, customerId: request.customerId, coinsEarned }, "loyalty coins earned");
              // SSE: instant wallet balance update for the customer — no page refresh needed
              try {
                const { broadcastToUser } = await import("../lib/sse-broadcast");
                broadcastToUser(request.customerId, "wallet_updated", { type: "coins_earned", coins: coinsEarned, requestId: id });
                broadcastToUser(request.customerId, "notification", {});
              } catch {}
              // In-app + push: notify customer of coins earned
              try {
                await NotificationService.notifyCoinsEarned(request.customerId, id, coinsEarned);
              } catch {}
            }
          } catch (earnErr) {
            req.log.error({ err: earnErr }, "earnCoins failed — completion was recorded successfully");
          }

          // 2️⃣ Referral reward — independent failure domain (runs even if earnCoins failed)
          try {
            const referralResult = await triggerReferralReward(request.customerId, id, request.hasDiscount, loyaltyConfig);
            if (referralResult && referralResult.anyRewarded) {
              // SSE: notify every wallet that was actually updated (referee + referrer, independently)
              try {
                const { broadcastToUser, broadcastToUsers } = await import("../lib/sse-broadcast");
                if (referralResult.refereeRewarded) {
                  broadcastToUser(request.customerId, "wallet_updated", { type: "referral_reward", coins: referralResult.refereeCoins, requestId: id });
                }
                if (referralResult.referrerRewarded) {
                  broadcastToUser(referralResult.referrerId, "wallet_updated", { type: "referral_reward", coins: referralResult.referrerCoins, requestId: id });
                }
                const rewardedUserIds: number[] = [];
                if (referralResult.refereeRewarded) rewardedUserIds.push(request.customerId);
                if (referralResult.referrerRewarded) rewardedUserIds.push(referralResult.referrerId);
                if (rewardedUserIds.length > 0) {
                  broadcastToUsers(rewardedUserIds, "notification", {});
                }
              } catch {}
              // In-app + push: notify all rewarded users — referee and/or referrer
              try {
                const pushTargets: number[] = [];
                if (referralResult.refereeRewarded)  pushTargets.push(request.customerId);
                if (referralResult.referrerRewarded) pushTargets.push(referralResult.referrerId);
                if (pushTargets.length > 0) {
                  await NotificationService.notifyReferralReward(pushTargets, id);
                }
              } catch {}
            }
          } catch (referralErr) {
            req.log.error({ err: referralErr }, "triggerReferralReward failed — completion was recorded successfully");
          }
        }
      }

      if (request.selectedTechnicianId) {
        await db.insert(notificationsTable).values({
          userId: request.selectedTechnicianId,
          title: "تم إكمال الطلب",
          body: `أكد العميل إتمام تنفيذ الطلب #${id} بنجاح`,
          type: "status_change" as const,
          relatedId: id,
        });

        // Push notifications for both parties — non-blocking, fail silently
        try {
          await NotificationService.dispatchPush(
            [request.selectedTechnicianId],
            {
              title: "تم إكمال الطلب ✅",
              body: `أكد العميل إتمام تنفيذ الطلب #${id} بنجاح`,
              type: "request_completed",
              data: { requestId: String(id) },
            }
          );
          await NotificationService.dispatchPush(
            [request.customerId],
            {
              title: "تم إكمال الطلب ✅",
              body: `تم إنهاء الخدمة — يمكنك تقييم الفني الآن`,
              type: "request_completed",
              data: { requestId: String(id) },
            }
          );
        } catch {}
      }
      await db.insert(auditTrailTable).values({
        requestId: id,
        changedBy: user.id,
        fieldName: "completion_confirmed",
        oldValue: "waiting_approval",
        newValue: "completed",
      });

      // Auto-generate invoices for this completed request (idempotent, non-blocking)
      try {
        const { generateInvoicesForRequest } = await import("./invoices");
        await generateInvoicesForRequest(id, null);
      } catch (invoiceErr) {
        req.log.error({ err: invoiceErr }, "invoice generation failed — completion was recorded successfully");
      }

      // SSE: notify both parties that job is completed + admin
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(request.customerId, "status_changed", { id, status: "completed" });
      if (request.selectedTechnicianId) broadcastToUser(request.selectedTechnicianId, "status_changed", { id, status: "completed" });
      broadcastAdminEvent("status_changed", { id, status: "completed" });
    } catch (secErr) {
      req.log.error({ err: secErr }, "complete-request secondary ops failed — completion was recorded successfully");
    }
    return;
  } catch (err) {
    req.log.error({ err });
    if (!res.headersSent) {
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

// ─── GET /api/requests/:id/platform-credit ───────────────────────────────────
// Returns the platform credit record for a completed request (technician only).
// Used by the technician to see the settlement status of a coin-discount request.
router.get("/requests/:id/platform-credit", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const user = req.user!;

    const [request] = await db
      .select({
        customerId:             serviceRequestsTable.customerId,
        selectedTechnicianId:   serviceRequestsTable.selectedTechnicianId,
        agreedPrice:            serviceRequestsTable.agreedPrice,
        customerPayableAmount:  serviceRequestsTable.customerPayableAmount,
        hasDiscount:            serviceRequestsTable.hasDiscount,
        status:                 serviceRequestsTable.status,
      })
      .from(serviceRequestsTable)
      .where(eq(serviceRequestsTable.id, id))
      .limit(1);

    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    // Only the assigned technician (or admin) may access platform credit details
    const isAdmin = ["admin", "super_admin"].includes(user.role);
    if (!isAdmin && request.selectedTechnicianId !== user.id) {
      return res.status(403).json({ error: "غير مسموح" });
    }

    // Only meaningful for completed requests
    if (request.status !== "completed") {
      return res.json({ hasCoinDiscount: false });
    }

    // Determine coin-discount by the existence of an actual platform_credits row,
    // not just hasDiscount (which can also be set by coupons/other discounts).
    const [credit] = await db
      .select()
      .from(platformCreditsTable)
      .where(eq(platformCreditsTable.requestId, id))
      .limit(1);

    if (!credit) {
      return res.json({ hasCoinDiscount: false });
    }

    const agreedPrice           = parseFloat(request.agreedPrice ?? "0");
    const customerPayableAmount = parseFloat(request.customerPayableAmount ?? String(agreedPrice));
    const platformCreditAmount  = parseFloat(String(credit.amount));

    return res.json({
      hasCoinDiscount:        true,
      agreedPrice,
      customerPayableAmount,
      platformCreditAmount,
      status:                 credit.status,
      paymentDate:            credit.paymentDate ?? null,
      paymentReference:       credit.paymentReference ?? null,
    });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
