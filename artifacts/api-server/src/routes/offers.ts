import { Router } from "express";
import { db } from "@workspace/db";
import {
  offersTable, serviceRequestsTable, usersTable,
  technicianProfilesTable, commissionRangesTable, areasTable, pointTransactionsTable,
  notificationsTable, ratingsTable, auditTrailTable, servicesTable, adminPermissionsTable,
} from "@workspace/db";
import { eq, and, avg, count, desc, ne, isNull, sql } from "drizzle-orm";
import { authenticate, requirePermission, getEffectivePermissions } from "../middlewares/auth";
import { NotificationService } from "../lib/notification-service";

const router = Router();

// ─── Helper: typed error used to unwind a db.transaction() with an HTTP status ─
// Thrown inside a transaction callback to abort it (Drizzle rolls back on any
// thrown error) while still carrying the status code + Arabic message needed
// for the response.
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ─── Helper: release reserved points and log the release ──────────────────────
async function releaseReservedForOffers(
  offers: Array<{ id: number; technicianId: number | null; reservedPoints: number; requestId?: number }>,
  reason = "استرداد نقاط محجوزة"
) {
  for (const offer of offers) {
    if (offer.reservedPoints <= 0 || offer.technicianId === null) continue;

    const [profile] = await db
      .select({ id: technicianProfilesTable.id, reservedPoints: technicianProfilesTable.reservedPoints, pointsBalance: technicianProfilesTable.pointsBalance })
      .from(technicianProfilesTable)
      .where(eq(technicianProfilesTable.userId, offer.technicianId))
      .limit(1);
    if (!profile) continue;

    const newReserved = Math.max(0, profile.reservedPoints - offer.reservedPoints);
    await db.update(technicianProfilesTable)
      .set({ reservedPoints: newReserved, updatedAt: new Date() })
      .where(eq(technicianProfilesTable.id, profile.id));

    // Log the release transaction
    await db.insert(pointTransactionsTable).values({
      technicianId: profile.id,
      amount: offer.reservedPoints,
      type: "release",
      description: `${reason}${offer.requestId ? ` — طلب #${offer.requestId}` : ""}`,
      balanceAfter: profile.pointsBalance, // balance doesn't change on release, only reserved
      requestId: offer.requestId || null,
    });
  }
}

// ─── Helper: resolve commission range → total required points ─────────────────
// Priority: service-specific range → global range (service_id IS NULL).
// Only active ranges are considered.
// Commission types:
//   fixed      → commissionValue points (integer)
//   percentage → ceil((laborPrice × commissionValue) / 100) points
// Total = commission result + area.extraPoints.
// Returns null if no matching active range exists for the given price.
// Exported so price-adjustment approval in requests.ts can re-run the same logic.
export async function resolveCommissionRange(
  serviceId: number,
  laborPrice: number,
  areaId: number | null
): Promise<number | null> {
  // 1. Service-specific active range covering this labor price
  const [specific] = await db
    .select()
    .from(commissionRangesTable)
    .where(and(
      eq(commissionRangesTable.serviceId, serviceId),
      eq(commissionRangesTable.isActive, true),
      sql`${commissionRangesTable.minPrice} <= ${laborPrice}`,
      sql`${commissionRangesTable.maxPrice} >= ${laborPrice}`,
    ))
    .limit(1);

  // 2. Global active range (service_id IS NULL) covering this labor price
  const rangeRow = specific ?? await (async () => {
    const [global] = await db
      .select()
      .from(commissionRangesTable)
      .where(and(
        isNull(commissionRangesTable.serviceId),
        eq(commissionRangesTable.isActive, true),
        sql`${commissionRangesTable.minPrice} <= ${laborPrice}`,
        sql`${commissionRangesTable.maxPrice} >= ${laborPrice}`,
      ))
      .limit(1);
    return global ?? null;
  })();

  if (!rangeRow) return null;

  // 3. Calculate commission points based on type
  const commType = rangeRow.commissionType ?? "fixed";
  const commValue = parseFloat(rangeRow.commissionValue as string ?? "0") || rangeRow.requiredPoints;

  let commissionPoints: number;
  if (commType === "percentage") {
    commissionPoints = Math.ceil((laborPrice * commValue) / 100);
  } else {
    commissionPoints = Math.round(commValue) || rangeRow.requiredPoints;
  }

  // 4. Area extra points
  let areaExtra = 0;
  if (areaId) {
    const [area] = await db
      .select({ extraPoints: areasTable.extraPoints })
      .from(areasTable)
      .where(eq(areasTable.id, areaId))
      .limit(1);
    areaExtra = area?.extraPoints ?? 0;
  }

  return commissionPoints + areaExtra;
}

// ─── GET /api/offers/my ───────────────────────────────────────────────────────
// Returns all offers submitted by the logged-in technician
router.get("/offers/my", authenticate, async (req, res) => {
  try {
    if (req.user!.role !== "technician") {
      return res.status(403).json({ error: "الفنيون فقط يمكنهم الوصول لهذا المسار" });
    }

    const offers = await db
      .select()
      .from(offersTable)
      .where(eq(offersTable.technicianId, req.user!.id))
      .orderBy(desc(offersTable.createdAt));

    // Enrich each offer with service name from the request
    const enriched = await Promise.all(
      offers.map(async (offer) => {
        const [request] = await db
          .select({ id: serviceRequestsTable.id, status: serviceRequestsTable.status, serviceId: serviceRequestsTable.serviceId })
          .from(serviceRequestsTable)
          .where(eq(serviceRequestsTable.id, offer.requestId))
          .limit(1);

        const service = request
          ? await db
              .select({ id: servicesTable.id, name: servicesTable.name })
              .from(servicesTable)
              .where(eq(servicesTable.id, request.serviceId))
              .limit(1)
              .then((r) => r[0] ?? null)
          : null;

        return {
          ...offer,
          price: parseFloat(offer.price as string),
          spareParts: offer.spareParts ? parseFloat(offer.spareParts as string) : 0,
          requestStatus: request?.status ?? null,
          service: service ?? null,
        };
      })
    );

    return res.json(enriched);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── GET /api/requests/:requestId/offers ──────────────────────────────────────
router.get("/requests/:requestId/offers", authenticate, async (req, res) => {
  try {
    const requestId = parseInt(req.params["requestId"] as string);
    const user = req.user!;

    // Ownership check: only the request owner, the assigned technician, or an
    // admin/super_admin may list offers for a specific request. This prevents
    // leaking competitor bids to other technicians.
    //
    // Exception: a technician who has submitted an offer may also retrieve the
    // list — but only their own offer is returned, so competitor bids stay hidden.
    const isAdminOrSuperAdmin = user.role === "admin" || user.role === "super_admin";
    let filterToOwnOffer = false; // when true: return only this technician's offer

    if (!isAdminOrSuperAdmin) {
      const [request] = await db
        .select({ customerId: serviceRequestsTable.customerId, selectedTechnicianId: serviceRequestsTable.selectedTechnicianId })
        .from(serviceRequestsTable)
        .where(eq(serviceRequestsTable.id, requestId))
        .limit(1);
      if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

      if (request.customerId !== user.id && request.selectedTechnicianId !== user.id) {
        // Allow a technician who has submitted an offer to see only their own
        if (user.role === "technician") {
          const [mySubmittedOffer] = await db
            .select({ id: offersTable.id })
            .from(offersTable)
            .where(and(eq(offersTable.requestId, requestId), eq(offersTable.technicianId, user.id)))
            .limit(1);
          if (!mySubmittedOffer) {
            return res.status(403).json({ error: "غير مسموح بالوصول إلى هذه العروض" });
          }
          filterToOwnOffer = true;
        } else {
          return res.status(403).json({ error: "غير مسموح بالوصول إلى هذه العروض" });
        }
      }
    }

    const offers = await db
      .select()
      .from(offersTable)
      .where(
        filterToOwnOffer
          ? and(eq(offersTable.requestId, requestId), eq(offersTable.technicianId, user.id))
          : eq(offersTable.requestId, requestId)
      )
      .orderBy(offersTable.createdAt);

    const result = await Promise.all(
      offers.map(async (offer) => {
        if (offer.technicianId === null) {
          return {
            ...offer,
            price: parseFloat(offer.price as string),
            spareParts: offer.spareParts ? parseFloat(offer.spareParts as string) : 0,
            totalPrice: parseFloat(offer.price as string) + (offer.spareParts ? parseFloat(offer.spareParts as string) : 0),
            technician: null,
          };
        }
        const [tech] = await db
          .select({
            id: usersTable.id,
            fullName: usersTable.fullName,
            profileImage: usersTable.profileImage,
            mobile: usersTable.mobile,
          })
          .from(usersTable)
          .where(eq(usersTable.id, offer.technicianId))
          .limit(1);

        const ratingStats = await db
          .select({ avg: avg(ratingsTable.stars), count: count() })
          .from(ratingsTable)
          .where(eq(ratingsTable.technicianId, offer.technicianId));

        const laborPrice = parseFloat(offer.price as string);
        const sparePartsPrice = offer.spareParts ? parseFloat(offer.spareParts as string) : 0;

        return {
          ...offer,
          price: laborPrice,
          spareParts: sparePartsPrice,
          totalPrice: laborPrice + sparePartsPrice,
          technician: tech
            ? {
                ...tech,
                averageRating: parseFloat(ratingStats[0]?.avg ?? "0"),
                reviewCount: ratingStats[0]?.count ?? 0,
              }
            : null,
        };
      })
    );

    return res.json(result);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── POST /api/requests/:requestId/offers ─────────────────────────────────────
router.post("/requests/:requestId/offers", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === "admin" || user.role === "super_admin";
    const isTechnician = user.role === "technician";

    if (!isAdmin && !isTechnician) {
      return res.status(403).json({ error: "غير مسموح" });
    }

    // Admin: check offers.submit_on_behalf permission (super_admin always allowed)
    if (isAdmin && user.role !== "super_admin") {
      const perms = await getEffectivePermissions(user);
      if (!perms.includes("offers.submit_on_behalf")) {
        return res.status(403).json({ error: "لا تملك صلاحية تقديم عروض بالنيابة" });
      }
    }

    // Technician-specific: profile + approval check
    let profile: (typeof technicianProfilesTable.$inferSelect) | null = null;
    if (isTechnician) {
      const [prof] = await db
        .select()
        .from(technicianProfilesTable)
        .where(eq(technicianProfilesTable.userId, user.id))
        .limit(1);
      if (!prof) return res.status(404).json({ error: "الفني غير موجود" });
      if (prof.approvalStatus !== "approved") {
        return res.status(403).json({ error: "حسابك لم يتم الموافقة عليه بعد. لا يمكنك تقديم عروض حتى تتم مراجعة طلبك." });
      }
      profile = prof;
    }

    const requestId = parseInt(req.params["requestId"] as string);
    const { price, spareParts, notes } = req.body;
    if (!price) return res.status(400).json({ error: "سعر الخدمة مطلوب" });

    const laborPrice = parseFloat(price);
    if (isNaN(laborPrice) || laborPrice <= 0) {
      return res.status(400).json({ error: "سعر الخدمة يجب أن يكون أكبر من صفر" });
    }

    // Prevent duplicate offer — technicians only (admins may submit multiple or re-submit)
    if (isTechnician) {
      const existing = await db
        .select()
        .from(offersTable)
        .where(and(eq(offersTable.requestId, requestId), eq(offersTable.technicianId, user.id)))
        .limit(1);
      if (existing.length > 0) return res.status(400).json({ error: "لقد قدمت عرضاً لهذا الطلب مسبقاً" });
    }

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, requestId)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    if (!["pending", "offers_received"].includes(request.status)) {
      return res.status(400).json({ error: "لا يمكن تقديم عرض على هذا الطلب بعد الآن" });
    }

    // Technician: commission range check + point reservation
    let requiredPoints = 0;
    if (isTechnician && profile) {
      const points = await resolveCommissionRange(request.serviceId, laborPrice, request.areaId ?? null);
      if (points === null) {
        req.log.warn({ serviceId: request.serviceId, laborPrice, requestId }, "offer submission blocked: no commission range");
        return res.status(400).json({ error: "لا يوجد نطاق عمولة محدد لهذا السعر، يرجى التواصل مع الإدارة" });
      }
      requiredPoints = points;

      const availableBalance = profile.pointsBalance - profile.reservedPoints;
      if (availableBalance < requiredPoints) {
        return res.status(400).json({ error: "رصيد النقاط الحالي غير كافٍ لتقديم عرض على هذه الخدمة" });
      }

      // Reserve points immediately
      await db
        .update(technicianProfilesTable)
        .set({ reservedPoints: profile.reservedPoints + requiredPoints, updatedAt: new Date() })
        .where(eq(technicianProfilesTable.id, profile.id));
    }

    const [offer] = await db
      .insert(offersTable)
      .values({
        requestId,
        // Admins (especially super_admin, id=0) have no DB user record — use null to avoid FK violation
        technicianId: isAdmin ? null : user.id,
        price: laborPrice.toString(),
        spareParts: spareParts ? parseFloat(spareParts).toString() : null,
        notes,
        status: "pending",
        reservedPoints: requiredPoints,
      })
      .returning();

    // Update request status to offers_received
    await db
      .update(serviceRequestsTable)
      .set({ status: "offers_received", updatedAt: new Date() })
      .where(eq(serviceRequestsTable.id, requestId));

    // Send response — secondary operations (audit + notify) must not block or error the response
    res.status(201).json(offer);

    try {
      if (user.id !== 0) {
        await db.insert(auditTrailTable).values({
          requestId,
          changedBy: user.id,
          fieldName: "offer_submitted",
          oldValue: "0",
          newValue: laborPrice.toString(),
        });
      }
      await db.insert(notificationsTable).values({
        userId: request.customerId,
        title: "عرض سعر جديد",
        body: `قدّم ${isAdmin ? "الإدارة" : "فني"} عرض سعر جديد على طلبك بقيمة ${laborPrice} جنيه${spareParts ? ` + ${parseFloat(spareParts)} جنيه قطع غيار` : ""}`,
        type: "new_offer",
        relatedId: requestId,
      });

      // Push notification for customer — non-blocking, fail silently
      try {
        let techName = "فني";
        if (!isAdmin && user.id) {
          const [techUser] = await db
            .select({ fullName: usersTable.fullName })
            .from(usersTable)
            .where(eq(usersTable.id, user.id))
            .limit(1);
          techName = techUser?.fullName ?? "فني";
        }
        await NotificationService.dispatchPush(
          [request.customerId],
          {
            title: "عرض سعر جديد 💼",
            body: `${techName} قدّم عرضاً بسعر ${laborPrice} جنيه`,
            type: "new_offer",
            data: { requestId: String(requestId), price: String(laborPrice) },
          }
        );
      } catch {}

      // SSE: push new offer to customer instantly + notify admin
      try {
        const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
        broadcastToUser(request.customerId, "offer_received", { requestId, offerId: offer.id });
        broadcastAdminEvent("new_offer", { requestId, offerId: offer.id });
      } catch {}
    } catch (secErr) {
      req.log.error({ err: secErr }, "offer audit/notification failed — offer was created successfully");
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

// ─── PATCH /api/requests/:requestId/offers/:offerId ───────────────────────────
router.patch("/requests/:requestId/offers/:offerId", authenticate, async (req, res) => {
  try {
    const requestId = parseInt(req.params["requestId"] as string);
    const offerId = parseInt(req.params["offerId"] as string);
    const { price, spareParts, notes } = req.body;

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, requestId)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    if (!["pending", "offers_received"].includes(request.status)) {
      return res.status(403).json({ error: "لا يمكن تعديل العرض بعد اختيار الفني" });
    }

    const [offer] = await db
      .select()
      .from(offersTable)
      .where(and(eq(offersTable.id, offerId), eq(offersTable.technicianId, req.user!.id)))
      .limit(1);
    if (!offer) return res.status(404).json({ error: "العرض غير موجود" });

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (notes !== undefined) updates.notes = notes;
    if (spareParts !== undefined) updates.spareParts = spareParts ? parseFloat(spareParts).toString() : null;

    // If price changed, recalculate point reservation
    if (price !== undefined) {
      const newLaborPrice = parseFloat(price);
      if (isNaN(newLaborPrice) || newLaborPrice <= 0) {
        return res.status(400).json({ error: "سعر الخدمة يجب أن يكون أكبر من صفر" });
      }

      const newRequired = await resolveCommissionRange(request.serviceId, newLaborPrice, request.areaId ?? null);
      if (newRequired === null) {
        return res.status(400).json({ error: "لا يوجد نطاق عمولة محدد لهذا السعر" });
      }
      const oldRequired = offer.reservedPoints;
      const diff = newRequired - oldRequired;

      if (diff !== 0) {
        const [profile] = await db
          .select()
          .from(technicianProfilesTable)
          .where(eq(technicianProfilesTable.userId, req.user!.id))
          .limit(1);

        if (!profile) return res.status(404).json({ error: "الفني غير موجود" });

        if (diff > 0) {
          const available = profile.pointsBalance - profile.reservedPoints;
          if (available < diff) {
            return res.status(400).json({ error: `رصيد النقاط غير كافٍ لزيادة السعر. مطلوب ${diff} نقطة إضافية، المتاح: ${available}` });
          }
        }

        await db
          .update(technicianProfilesTable)
          .set({ reservedPoints: profile.reservedPoints + diff, updatedAt: new Date() })
          .where(eq(technicianProfilesTable.id, profile.id));

        // Reservation adjustment: only locked amount changes; actual balance unchanged.

        updates.reservedPoints = newRequired;
      }

      updates.price = newLaborPrice.toString();
    }

    const [updated] = await db
      .update(offersTable)
      .set(updates as any)
      .where(eq(offersTable.id, offerId))
      .returning();

    // SSE: notify customer and admin instantly of offer edit
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(request.customerId, "offer_updated", { requestId, offerId });
      broadcastAdminEvent("offer_updated", { requestId, offerId });
    } catch {}

    return res.json(updated);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── PATCH /api/requests/:requestId/offers/:offerId/admin — admin edits admin offer ───
router.patch("/requests/:requestId/offers/:offerId/admin", authenticate, requirePermission("offers.manage"), async (req, res) => {
  try {
    const requestId = parseInt(req.params["requestId"] as string);
    const offerId = parseInt(req.params["offerId"] as string);
    const { price, spareParts, notes } = req.body;

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, requestId)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    if (!["pending", "offers_received"].includes(request.status)) {
      return res.status(403).json({ error: "لا يمكن تعديل العرض بعد اختيار الفني" });
    }

    const [offer] = await db
      .select()
      .from(offersTable)
      .where(and(eq(offersTable.id, offerId), eq(offersTable.requestId, requestId), isNull(offersTable.technicianId)))
      .limit(1);
    if (!offer) return res.status(404).json({ error: "عرض الإدارة غير موجود" });

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (notes !== undefined) updates.notes = notes;
    if (spareParts !== undefined) updates.spareParts = spareParts ? parseFloat(spareParts).toString() : null;
    if (price !== undefined) {
      const newLaborPrice = parseFloat(price);
      if (isNaN(newLaborPrice) || newLaborPrice <= 0) {
        return res.status(400).json({ error: "سعر الخدمة يجب أن يكون أكبر من صفر" });
      }
      updates.price = newLaborPrice.toString();
    }

    const [updated] = await db
      .update(offersTable)
      .set(updates as any)
      .where(eq(offersTable.id, offerId))
      .returning();

    res.json(updated);

    // SSE: notify customer and admin that admin offer was updated
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(request.customerId, "offer_updated", { requestId, offerId });
      broadcastAdminEvent("offer_updated", { requestId, offerId });
    } catch {}
    return;
  } catch (err) {
    req.log.error({ err });
    if (!res.headersSent) {
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

// ─── POST /api/requests/:requestId/offers/:offerId/withdraw ───────────────────
// Technician-only: withdraw their own pending offer before it is selected/rejected.
router.post("/requests/:requestId/offers/:offerId/withdraw", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "technician") {
      return res.status(403).json({ error: "الفنيون فقط يمكنهم سحب عروضهم" });
    }

    const requestId = parseInt(req.params["requestId"] as string);
    const offerId = parseInt(req.params["offerId"] as string);

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, requestId)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    const [offer] = await db
      .select()
      .from(offersTable)
      .where(and(eq(offersTable.id, offerId), eq(offersTable.requestId, requestId), eq(offersTable.technicianId, user.id)))
      .limit(1);
    if (!offer) return res.status(404).json({ error: "العرض غير موجود" });

    if (offer.status !== "pending") {
      return res.status(400).json({ error: "لا يمكن سحب هذا العرض في حالته الحالية" });
    }

    await db.update(offersTable)
      .set({ status: "withdrawn", updatedAt: new Date() })
      .where(eq(offersTable.id, offerId));

    // Release reserved points for this withdrawn offer
    if (offer.reservedPoints > 0) {
      await releaseReservedForOffers(
        [{ id: offer.id, technicianId: user.id, reservedPoints: offer.reservedPoints, requestId }],
        "سحب العرض من قبل الفني"
      );
    }

    // If no other active offers remain, revert request back to "pending"
    const [remaining] = await db
      .select({ cnt: count() })
      .from(offersTable)
      .where(and(
        eq(offersTable.requestId, requestId),
        sql`${offersTable.status} IN ('pending','selected')`,
      ));

    if ((remaining?.cnt || 0) === 0 && request.status === "offers_received") {
      await db.update(serviceRequestsTable)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(serviceRequestsTable.id, requestId));
    }

    res.json({ success: true });

    try {
      await db.insert(auditTrailTable).values({
        requestId,
        changedBy: user.id,
        fieldName: "offer_withdrawn",
        oldValue: offer.price?.toString() || "0",
        newValue: "withdrawn",
      });

      await db.insert(notificationsTable).values({
        userId: request.customerId,
        title: "تم سحب عرض",
        body: `قام الفني بسحب عرضه على طلبك رقم #${requestId}`,
        type: "status_change" as const,
        relatedId: requestId,
      });

      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(request.customerId, "offer_withdrawn", { requestId, offerId });
      broadcastAdminEvent("offer_withdrawn", { requestId, offerId });
    } catch (secErr) {
      req.log.error({ err: secErr }, "offer withdrawal secondary ops failed — withdrawal was recorded successfully");
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

// ─── POST /api/requests/:requestId/offers/:offerId/select ─────────────────────
router.post("/requests/:requestId/offers/:offerId/select", authenticate, async (req, res) => {
  try {
    if (req.user!.role !== "customer") return res.status(403).json({ error: "العملاء فقط يمكنهم اختيار الفني" });

    const requestId = parseInt(req.params["requestId"] as string);
    const offerId = parseInt(req.params["offerId"] as string);

    // ── Atomic offer selection ──────────────────────────────────────────────
    // The whole read-check-write sequence runs inside a single DB transaction
    // with row-level locking (SELECT ... FOR UPDATE) on both the request and
    // the offer. This prevents races where two concurrent selection requests
    // (e.g. double-click, retry) could both "win" and each reject/select
    // offers based on stale reads.
    const { request, offer, pendingOthers, totalAgreedPrice } = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(serviceRequestsTable)
        .where(eq(serviceRequestsTable.id, requestId))
        .for("update");
      if (!request) throw new HttpError(404, "الطلب غير موجود");
      if (request.customerId !== req.user!.id) throw new HttpError(403, "غير مسموح");
      if (!["pending", "offers_received"].includes(request.status)) {
        throw new HttpError(409, "تم اختيار فني بالفعل لهذا الطلب أو تغيرت حالته");
      }

      const [offer] = await tx
        .select()
        .from(offersTable)
        .where(eq(offersTable.id, offerId))
        .for("update");
      if (!offer) throw new HttpError(404, "العرض غير موجود");
      if (offer.requestId !== requestId) throw new HttpError(400, "هذا العرض لا ينتمي لهذا الطلب");
      if (offer.status !== "pending") throw new HttpError(409, "هذا العرض لم يعد متاحاً للاختيار");

      // Get all other pending offers to reject + release their reserved points
      const pendingOthers = await tx
        .select({
          id: offersTable.id,
          technicianId: offersTable.technicianId,
          reservedPoints: offersTable.reservedPoints,
          requestId: offersTable.requestId,
        })
        .from(offersTable)
        .where(and(
          eq(offersTable.requestId, requestId),
          eq(offersTable.status, "pending"),
          ne(offersTable.id, offerId),
        ));

      // Reject other offers
      if (pendingOthers.length > 0) {
        await tx
          .update(offersTable)
          .set({ status: "rejected", updatedAt: new Date() })
          .where(and(
            eq(offersTable.requestId, requestId),
            eq(offersTable.status, "pending"),
            ne(offersTable.id, offerId),
          ));

        // Point release is handled after the response (secondary ops) to avoid blocking selection
      }

      // Select the winning offer (do NOT deduct yet — deducted at completion)
      await tx.update(offersTable)
        .set({ status: "selected", updatedAt: new Date() })
        .where(eq(offersTable.id, offerId));

      const totalAgreedPrice = parseFloat(offer.price as string) + (offer.spareParts ? parseFloat(offer.spareParts as string) : 0);

      await tx.update(serviceRequestsTable).set({
        status: "technician_selected",
        selectedTechnicianId: offer.technicianId,
        agreedPrice: totalAgreedPrice.toString(),
        // Per loyalty business rule: customer_payable_amount is always written
        // together with agreedPrice — never left NULL. No discount applies yet
        // at offer acceptance, so it starts equal to agreedPrice.
        customerPayableAmount: totalAgreedPrice.toString(),
        updatedAt: new Date(),
      }).where(eq(serviceRequestsTable.id, requestId));

      return { request, offer, pendingOthers, totalAgreedPrice };
    });

    // Send response — secondary operations must not block or error the response
    res.json({ success: true });

    try {
      if (pendingOthers.length > 0) {
        await releaseReservedForOffers(pendingOthers, "اختار العميل فنياً آخر — استرداد نقاط محجوزة");
      }
      await db.insert(auditTrailTable).values({
        requestId,
        changedBy: req.user!.id,
        fieldName: "technician_selected",
        oldValue: "offers_received",
        newValue: String(offer.technicianId),
      });

      if (offer.technicianId !== null) {
        await db.insert(notificationsTable).values({
          userId: offer.technicianId,
          title: "🎉 تم اختيارك!",
          body: "تم قبول عرضك من قبل العميل. يرجى التواصل مع العميل لبدء تنفيذ الطلب",
          type: "technician_selected",
          relatedId: requestId,
        });
      }

      // Push notification for selected technician — non-blocking, fail silently
      try {
        if (offer.technicianId) {
          const [custUser] = await db
            .select({ fullName: usersTable.fullName })
            .from(usersTable)
            .where(eq(usersTable.id, req.user!.id))
            .limit(1);
          await NotificationService.dispatchPush(
            [offer.technicianId],
            {
              title: "تم قبول عرضك ✅",
              body: `${custUser?.fullName ?? "العميل"} قبل عرضك — انطلق إلى الطلب الآن`,
              type: "offer_accepted",
              data: { requestId: String(requestId) },
            }
          );
        }
      } catch {}

      if (pendingOthers.length > 0) {
        const technicianNotifications = pendingOthers
          .filter((o): o is typeof o & { technicianId: number } => o.technicianId !== null)
          .map((o) => ({
            userId: o.technicianId,
            title: "تم اختيار فني آخر",
            body: "للأسف، اختار العميل فنياً آخر لهذا الطلب. تم استرداد نقاطك المحجوزة.",
            type: "status_change" as const,
            relatedId: requestId,
          }));
        if (technicianNotifications.length > 0) {
          await db.insert(notificationsTable).values(technicianNotifications);
        }
      }

      // SSE: notify selected technician, rejected technicians, and admin instantly
      try {
        const { broadcastToUser, broadcastToUsers, broadcastAdminEvent } = await import("../lib/sse-broadcast");
        if (offer.technicianId) broadcastToUser(offer.technicianId, "offer_selected", { requestId });
        const rejectedIds = pendingOthers.map((o) => o.technicianId).filter((id): id is number => id !== null);
        if (rejectedIds.length > 0) broadcastToUsers(rejectedIds, "offer_rejected", { requestId });
        broadcastAdminEvent("offer_selected", { requestId, technicianId: offer.technicianId });
      } catch {}
    } catch (secErr) {
      req.log.error({ err: secErr }, "select-offer audit/notification failed — selection was recorded successfully");
    }
    return;
  } catch (err) {
    if (!res.headersSent) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      req.log.error({ err });
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    req.log.error({ err });
    return;
  }
});

export default router;
