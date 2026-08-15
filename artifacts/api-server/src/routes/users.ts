import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  technicianProfilesTable,
  technicianServicesTable,
  technicianAreasTable,
  servicesTable,
  areasTable,
  ratingsTable,
  serviceRequestsTable,
} from "@workspace/db";
import { eq, ne, like, and, or, sql, avg, count, desc, inArray } from "drizzle-orm";
import { authenticate, requireRole, requirePermission, optionalAuth } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { updateUserSchema } from "../validators/schemas";

// ── Founder guard helpers ────────────────────────────────────────────────────
// Returns 404 (not 403) so as not to reveal existence. Used in read endpoints.
function isFounderTarget(user: any): boolean {
  return user?.isFounder === true;
}

// Shorthand: reject a request that targets the Founder account.
// non-Founder callers get 404; Founder can always edit themselves via /founder/settings.
function blockFounderTarget(targetUser: any, res: any): boolean {
  if (isFounderTarget(targetUser)) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return true;
  }
  return false;
}
// ────────────────────────────────────────────────────────────────────────────

const router = Router();

async function attachServicesAndAreas(profiles: { profile: any; user: any }[]) {
  if (profiles.length === 0) return [];
  const profileIds = profiles.map((p) => p.profile.id);
  const [allServices, allAreas] = await Promise.all([
    db
      .select({ technicianId: technicianServicesTable.technicianId, service: servicesTable })
      .from(technicianServicesTable)
      .leftJoin(servicesTable, eq(technicianServicesTable.serviceId, servicesTable.id))
      .where(inArray(technicianServicesTable.technicianId, profileIds)),
    db
      .select({ technicianId: technicianAreasTable.technicianId, area: areasTable })
      .from(technicianAreasTable)
      .leftJoin(areasTable, eq(technicianAreasTable.areaId, areasTable.id))
      .where(inArray(technicianAreasTable.technicianId, profileIds)),
  ]);
  const servicesByTechId = new Map<number, any[]>();
  for (const row of allServices) {
    if (!servicesByTechId.has(row.technicianId)) servicesByTechId.set(row.technicianId, []);
    if (row.service) servicesByTechId.get(row.technicianId)!.push(row.service);
  }
  const areasByTechId = new Map<number, any[]>();
  for (const row of allAreas) {
    if (!areasByTechId.has(row.technicianId)) areasByTechId.set(row.technicianId, []);
    if (row.area) areasByTechId.get(row.technicianId)!.push(row.area);
  }
  return profiles.map(({ profile, user }) => ({
    ...profile,
    user: user ? formatUser(user) : null,
    services: servicesByTechId.get(profile.id) || [],
    areas: areasByTechId.get(profile.id) || [],
  }));
}

function formatUser(user: any, profile?: any) {
  return {
    id: user.id,
    fullName: user.fullName,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    status: user.status,
    profileImage: user.profileImage,
    jobTitle: user.jobTitle,
    createdAt: user.createdAt,
    suspensionReason: user.suspensionReason,
    bannedUntil: user.bannedUntil,
    technicianProfile: profile || null,
  };
}

// GET /api/users
// Founder is ALWAYS excluded from management queries — completely invisible to admins
router.get("/users", authenticate, requirePermission("users.view"), async (req, res) => {
  try {
    const { role, status, search, page = "1", limit = "20" } = req.query as any;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Validate search length to prevent expensive LIKE scans on huge strings
    if (search && String(search).length > 100) {
      return res.status(400).json({ error: "نص البحث طويل جداً (الحد الأقصى 100 حرف)" });
    }

    // Permanently exclude the Founder from all management queries
    let conditions: any[] = [eq(usersTable.isFounder, false)];
    if (role) conditions.push(eq(usersTable.role, role));
    if (status) conditions.push(eq(usersTable.status, status));
    if (search) {
      conditions.push(or(like(usersTable.fullName, `%${search}%`), like(usersTable.mobile, `%${search}%`)));
    }
    const where = and(...conditions);

    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(usersTable).where(where);
    const users = await db.select().from(usersTable).where(where).limit(limitNum).offset(offset).orderBy(usersTable.createdAt);

    return res.json({ data: users.map((u) => formatUser(u)), total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/technicians/:userId/public-profile — public profile accessible to authenticated users
router.get("/technicians/:userId/public-profile", authenticate, async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"] as string);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user || user.role !== "technician") return res.status(404).json({ error: "الفني غير موجود" });

    const [profile] = await db
      .select()
      .from(technicianProfilesTable)
      .where(eq(technicianProfilesTable.userId, userId))
      .limit(1);

    const reviews = await db
      .select({
        id: ratingsTable.id,
        stars: ratingsTable.stars,
        review: ratingsTable.review,
        createdAt: ratingsTable.createdAt,
        customerName: usersTable.fullName,
      })
      .from(ratingsTable)
      .leftJoin(usersTable, eq(ratingsTable.customerId, usersTable.id))
      .where(eq(ratingsTable.technicianId, userId))
      .orderBy(desc(ratingsTable.createdAt))
      .limit(50);

    const [ratingStats] = await db
      .select({
        avg: avg(ratingsTable.stars),
        total: count(ratingsTable.id),
      })
      .from(ratingsTable)
      .where(eq(ratingsTable.technicianId, userId));

    const [completedStats] = await db
      .select({ total: count(serviceRequestsTable.id) })
      .from(serviceRequestsTable)
      .where(
        and(
          eq(serviceRequestsTable.selectedTechnicianId, userId),
          eq(serviceRequestsTable.status, "completed")
        )
      );

    return res.json({
      id: user.id,
      fullName: user.fullName,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
      averageRating: ratingStats?.avg ? parseFloat(String(ratingStats.avg)).toFixed(1) : "0",
      reviewCount: ratingStats?.total ?? 0,
      completedJobs: completedStats?.total ?? 0,
      reviews,
    });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/users/:id
router.get("/users/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    if (req.user!.role === "customer" && req.user!.id !== id) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
    // Founder is invisible to everyone except themselves
    if (user.isFounder && !req.user!.isFounder) {
      return res.status(404).json({ error: "المستخدم غير موجود" });
    }
    return res.json(formatUser(user));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/users/:id (self-edit)
router.patch("/users/:id", authenticate, validateBody(updateUserSchema), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    if (req.user!.role !== "admin" && req.user!.role !== "super_admin" && req.user!.id !== id) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    // Founder must use /api/founder/settings to change their own data
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) {
      return res.status(404).json({ error: "المستخدم غير موجود" });
    }
    const { fullName, email, profileImage, jobTitle, currentPassword, newPassword, areaIds, serviceIds, yearsOfExperience } = req.body;

    // Validate profileImage if provided: max 2 MB base64, recognised MIME type.
    if (profileImage !== undefined && profileImage !== null) {
      const BASE64_MAX_CHARS = 2_800_000;
      const VALID_IMAGE_PREFIXES = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"];
      if (typeof profileImage !== "string" || profileImage.length > BASE64_MAX_CHARS) {
        return res.status(400).json({ error: "حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت)" });
      }
      if (!VALID_IMAGE_PREFIXES.some((pfx) => profileImage.startsWith(pfx))) {
        return res.status(400).json({ error: "نوع ملف الصورة غير مدعوم (يُسمح بـ JPEG و PNG و WebP فقط)" });
      }
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (fullName     !== undefined) updates.fullName     = fullName;
    if (email        !== undefined) updates.email        = email;
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (jobTitle     !== undefined) updates.jobTitle     = jobTitle;

    if (newPassword && newPassword.trim().length >= 6) {
      if (currentPassword) {
        const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
        if (!existing) return res.status(404).json({ error: "المستخدم غير موجود" });
        const valid = await bcrypt.compare(currentPassword, existing.passwordHash || "");
        if (!valid) return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const [user] = await db.update(usersTable).set(updates as any).where(eq(usersTable.id, id)).returning();
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

    if (Array.isArray(areaIds) && (req.user!.role === "technician" || req.user!.id === id)) {
      const [techProfile] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, id));
      if (techProfile) {
        await db.delete(technicianAreasTable).where(eq(technicianAreasTable.technicianId, techProfile.id));
        if (areaIds.length > 0) {
          await db.insert(technicianAreasTable).values(
            areaIds.map((areaId: number) => ({ technicianId: techProfile.id, areaId }))
          );
        }
      }
    }

    if (Array.isArray(serviceIds) && (req.user!.role === "technician" || req.user!.id === id)) {
      const [techProfile] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, id));
      if (techProfile) {
        await db.delete(technicianServicesTable).where(eq(technicianServicesTable.technicianId, techProfile.id));
        if (serviceIds.length > 0) {
          await db.insert(technicianServicesTable).values(
            serviceIds.map((serviceId: number) => ({ technicianId: techProfile.id, serviceId }))
          );
        }
      }
    }

    if (yearsOfExperience !== undefined) {
      const [techProfile] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, id));
      if (techProfile) {
        await db.update(technicianProfilesTable)
          .set({ yearsOfExperience: yearsOfExperience !== null ? parseInt(yearsOfExperience) : null, updatedAt: new Date() })
          .where(eq(technicianProfilesTable.id, techProfile.id));
      }
    }

    return res.json(formatUser(user));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/users/:id/admin-edit (admin full edit)
router.patch("/users/:id/admin-edit", authenticate, requirePermission("users.edit"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) {
      return res.status(404).json({ error: "المستخدم غير موجود" });
    }
    const { fullName, mobile, email, newPassword } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (fullName) updates.fullName = fullName;
    if (mobile) updates.mobile = mobile;
    if (email !== undefined) updates.email = email;
    if (newPassword && newPassword.trim().length >= 6) {
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }
    const [user] = await db.update(usersTable).set(updates as any).where(eq(usersTable.id, id)).returning();
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
    return res.json(formatUser(user));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/users/:id/ban
router.post("/users/:id/ban", authenticate, requirePermission("users.ban"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "المستخدم غير موجود" });
    const { type, days, reason } = req.body;
    const updates: Record<string, any> = {
      suspensionReason: reason || null,
      bannedByAdminId: req.user!.id,
      updatedAt: new Date(),
    };
    if (type === "permanent") {
      updates.status = "banned";
      updates.bannedUntil = null;
    } else {
      updates.status = "suspended";
      const bannedUntil = new Date();
      bannedUntil.setDate(bannedUntil.getDate() + (parseInt(days) || 1));
      updates.bannedUntil = bannedUntil;
    }
    await db.update(usersTable).set(updates as any).where(eq(usersTable.id, id));
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(id, "account_status_changed", { status: updates.status });
      broadcastAdminEvent("account_status_changed", { id, status: updates.status });
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/users/:id/unban
router.post("/users/:id/unban", authenticate, requirePermission("users.ban"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "المستخدم غير موجود" });
    await db.update(usersTable).set({ status: "active", suspensionReason: null, bannedUntil: null, updatedAt: new Date() } as any).where(eq(usersTable.id, id));
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(id, "account_status_changed", { status: "active" });
      broadcastAdminEvent("account_status_changed", { id, status: "active" });
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/users/:id/suspend (legacy)
router.post("/users/:id/suspend", authenticate, requirePermission("users.ban"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "المستخدم غير موجود" });
    const { reason } = req.body;
    await db.update(usersTable).set({ status: "suspended", suspensionReason: reason, updatedAt: new Date() }).where(eq(usersTable.id, id));
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(id, "account_status_changed", { status: "suspended" });
      broadcastAdminEvent("account_status_changed", { id, status: "suspended" });
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// DELETE /api/users/:id (admin soft-delete)
router.delete("/users/:id", authenticate, requirePermission("delete_users"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "المستخدم غير موجود" });
    const scrambledMobile = `del_${id}`;
    const scrambledEmail = `del_${id}@deleted.local`;
    await db.update(usersTable)
      .set({
        status: "deleted",
        passwordHash: "DELETED_ACCOUNT",
        mobile: scrambledMobile,
        email: scrambledEmail,
        updatedAt: new Date(),
      } as any)
      .where(eq(usersTable.id, id));
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(id, "account_status_changed", { status: "deleted" });
      broadcastAdminEvent("account_status_changed", { id, status: "deleted" });
    } catch {}
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/users/:id/activate
router.post("/users/:id/activate", authenticate, requirePermission("users.edit"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "المستخدم غير موجود" });
    await db.update(usersTable).set({ status: "active", suspensionReason: null, bannedUntil: null, updatedAt: new Date() } as any).where(eq(usersTable.id, id));
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(id, "account_status_changed", { status: "active" });
      broadcastAdminEvent("account_status_changed", { id, status: "active" });
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/technicians/:id/admin-experience
router.patch("/technicians/:id/admin-experience", authenticate, requirePermission("technicians.edit_experience"), async (req, res) => {
  try {
    const userId = parseInt(req.params["id"] as string);
    const { yearsOfExperience } = req.body as { yearsOfExperience: number | null };
    const [profile] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, userId)).limit(1);
    if (!profile) return res.status(404).json({ error: "الفني غير موجود" });
    await db.update(technicianProfilesTable)
      .set({ yearsOfExperience: yearsOfExperience !== null ? yearsOfExperience : null, updatedAt: new Date() })
      .where(eq(technicianProfilesTable.id, profile.id));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/technicians/:id/admin-services
router.patch("/technicians/:id/admin-services", authenticate, requirePermission("technicians.edit_services"), async (req, res) => {
  try {
    const userId = parseInt(req.params["id"] as string);
    const { serviceIds } = req.body as { serviceIds: number[] };
    const [profile] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, userId)).limit(1);
    if (!profile) return res.status(404).json({ error: "الفني غير موجود" });
    await db.delete(technicianServicesTable).where(eq(technicianServicesTable.technicianId, profile.id));
    if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      await db.insert(technicianServicesTable).values(serviceIds.map((sid: number) => ({ technicianId: profile.id, serviceId: sid })));
    }
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/technicians/:id/admin-areas
router.patch("/technicians/:id/admin-areas", authenticate, requirePermission("technicians.edit_areas"), async (req, res) => {
  try {
    const userId = parseInt(req.params["id"] as string);
    const { areaIds } = req.body as { areaIds: number[] };
    const [profile] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, userId)).limit(1);
    if (!profile) return res.status(404).json({ error: "الفني غير موجود" });
    await db.delete(technicianAreasTable).where(eq(technicianAreasTable.technicianId, profile.id));
    if (Array.isArray(areaIds) && areaIds.length > 0) {
      await db.insert(technicianAreasTable).values(areaIds.map((aid: number) => ({ technicianId: profile.id, areaId: aid })));
    }
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/technicians/pending
router.get("/technicians/pending", authenticate, requirePermission("technicians.view"), async (_req, res) => {
  try {
    const profiles = await db
      .select({ profile: technicianProfilesTable, user: usersTable })
      .from(technicianProfilesTable)
      .leftJoin(usersTable, eq(technicianProfilesTable.userId, usersTable.id))
      .where(eq(technicianProfilesTable.approvalStatus, "pending"));
    return res.json(await attachServicesAndAreas(profiles));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/technicians/:id/approve
router.post("/technicians/:id/approve", authenticate, requirePermission("technicians.approve"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "الفني غير موجود" });
    // Both updates must succeed or both must roll back — a partial update (profile
    // approved but user status still "pending") would break auth checks.
    await db.transaction(async (tx) => {
      const rows = await tx
        .update(technicianProfilesTable)
        .set({ approvalStatus: "approved", updatedAt: new Date() })
        .where(eq(technicianProfilesTable.userId, id))
        .returning({ id: technicianProfilesTable.id });
      if (rows.length === 0) throw Object.assign(new Error("TECH_NOT_FOUND"), { status: 404 });
      await tx.update(usersTable).set({ status: "active", updatedAt: new Date() }).where(eq(usersTable.id, id));
    });
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(id, "technician_status_changed", { approvalStatus: "approved" });
      broadcastAdminEvent("technician_status_changed", { id, approvalStatus: "approved" });
    } catch {}
    return res.json({ success: true });
  } catch (err: any) {
    if (err?.message === "TECH_NOT_FOUND") return res.status(404).json({ error: "الفني غير موجود" });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/technicians/:id/reject
router.post("/technicians/:id/reject", authenticate, requirePermission("technicians.reject"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "الفني غير موجود" });
    const { reason } = req.body;
    await db.transaction(async (tx) => {
      await tx.update(technicianProfilesTable).set({
        approvalStatus: "rejected",
        rejectionReason: reason || "لم يستوف الشروط",
        rejectedByAdminId: req.user!.id,
        rejectedAt: new Date(),
        updatedAt: new Date(),
      } as any).where(eq(technicianProfilesTable.userId, id));
      await tx.update(usersTable).set({ status: "rejected", updatedAt: new Date() }).where(eq(usersTable.id, id));
    });
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastToUser(id, "technician_status_changed", { approvalStatus: "rejected" });
      broadcastAdminEvent("technician_status_changed", { id, approvalStatus: "rejected" });
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/technicians/approved
router.get("/technicians/approved", authenticate, requirePermission("technicians.view"), async (_req, res) => {
  try {
    const profiles = await db
      .select({ profile: technicianProfilesTable, user: usersTable })
      .from(technicianProfilesTable)
      .leftJoin(usersTable, eq(technicianProfilesTable.userId, usersTable.id))
      .where(eq(technicianProfilesTable.approvalStatus, "approved"))
      .orderBy(desc(technicianProfilesTable.updatedAt));
    return res.json(await attachServicesAndAreas(profiles));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/technicians/rejected
router.get("/technicians/rejected", authenticate, requirePermission("technicians.view"), async (_req, res) => {
  try {
    const profiles = await db
      .select({ profile: technicianProfilesTable, user: usersTable })
      .from(technicianProfilesTable)
      .leftJoin(usersTable, eq(technicianProfilesTable.userId, usersTable.id))
      .where(eq(technicianProfilesTable.approvalStatus, "rejected"))
      .orderBy(desc(technicianProfilesTable.updatedAt));
    return res.json(await attachServicesAndAreas(profiles));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/technicians/:id/restore
router.post("/technicians/:id/restore", authenticate, requirePermission("technicians.approve"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "الفني غير موجود" });
    await db.transaction(async (tx) => {
      await tx.update(technicianProfilesTable).set({
        approvalStatus: "pending",
        rejectionReason: null,
        rejectedByAdminId: null,
        rejectedAt: null,
        updatedAt: new Date(),
      } as any).where(eq(technicianProfilesTable.userId, id));
      await tx.update(usersTable).set({ status: "pending", updatedAt: new Date() }).where(eq(usersTable.id, id));
    });
    try {
      const { broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastAdminEvent("technician_status_changed", { id, approvalStatus: "pending" });
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// DELETE /api/technicians/:id/permanent-delete
router.delete("/technicians/:id/permanent-delete", authenticate, requirePermission("technicians.delete"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [targetCheck] = await db.select({ isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (targetCheck?.isFounder) return res.status(404).json({ error: "الفني غير موجود" });
    // Hard-delete: cascade will handle profile
    await db.delete(usersTable).where(eq(usersTable.id, id));
    try {
      const { broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastAdminEvent("technician_status_changed", { id, approvalStatus: "deleted" });
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/technicians/:id/mark-seen — admin marks a pending technician registration as read
router.patch("/technicians/:id/mark-seen", authenticate, requirePermission("technicians.view"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.update(technicianProfilesTable)
      .set({ adminSeen: true } as any)
      .where(eq(technicianProfilesTable.userId, id));
    try {
      const { broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastAdminEvent("technician_status_changed", { id, adminSeen: true });
    } catch {}
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/technicians/:id/profile
// Public endpoint — safe for unauthenticated callers.
// When called by an admin or super_admin the sensitive identity fields
// (nationalId, nationalIdFront, nationalIdBack) are included so the
// admin approval panel can display ID-card images for review.
router.get("/technicians/:id/profile", optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [profileRow] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, id)).limit(1);
    if (!profileRow) return res.status(404).json({ error: "الفني غير موجود" });

    const techServices = await db.select({ service: servicesTable }).from(technicianServicesTable).leftJoin(servicesTable, eq(technicianServicesTable.serviceId, servicesTable.id)).where(eq(technicianServicesTable.technicianId, profileRow.id));
    const techAreas = await db.select({ area: areasTable }).from(technicianAreasTable).leftJoin(areasTable, eq(technicianAreasTable.areaId, areasTable.id)).where(eq(technicianAreasTable.technicianId, profileRow.id));
    const ratingStats = await db.select({ avg: avg(ratingsTable.stars), count: count() }).from(ratingsTable).where(eq(ratingsTable.technicianId, id));

    const callerRole = req.user?.role;
    const isAdmin = callerRole === "admin" || callerRole === "super_admin";

    if (isAdmin) {
      // Admins receive the full profile including identity documents for approval.
      return res.json({
        ...profileRow,
        services: techServices.map((r) => r.service).filter(Boolean),
        areas: techAreas.map((r) => r.area).filter(Boolean),
        averageRating: parseFloat(ratingStats[0]?.avg ?? "0"),
        reviewCount: ratingStats[0]?.count ?? 0,
      });
    }

    // Non-admin callers — strip sensitive identity fields.
    const {
      nationalId: _nationalId,
      nationalIdFront: _nationalIdFront,
      nationalIdBack: _nationalIdBack,
      ...publicProfile
    } = profileRow;

    return res.json({
      ...publicProfile,
      services: techServices.map((r) => r.service).filter(Boolean),
      areas: techAreas.map((r) => r.area).filter(Boolean),
      averageRating: parseFloat(ratingStats[0]?.avg ?? "0"),
      reviewCount: ratingStats[0]?.count ?? 0,
    });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
