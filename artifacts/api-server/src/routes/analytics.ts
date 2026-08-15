import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, technicianProfilesTable, serviceRequestsTable,
  pointTransactionsTable, servicesTable, ratingsTable, activityLogsTable,
  adminPermissionsTable, supportTicketsTable, platformCreditsTable,
} from "@workspace/db";
import { eq, sql, and, desc, count, avg, sum } from "drizzle-orm";
import {
  authenticate,
  requireRole,
  requirePermission,
  logActivity,
  getEffectivePermissions,
  canManagePermission,
  canManagePermissionSet,
} from "../middlewares/auth";

const router = Router();

router.get("/analytics/overview", authenticate, requireRole("admin", "super_admin"), async (_req, res) => {
  try {
    // Founder (is_founder=TRUE) is explicitly excluded from all counts — defence-in-depth
    const [customers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(and(eq(usersTable.role, "customer"), eq(usersTable.isFounder, false)));
    const [allTechs] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(and(eq(usersTable.role, "technician"), eq(usersTable.isFounder, false)));
    const [pendingApprovals] = await db.select({ count: sql<number>`count(*)::int` }).from(technicianProfilesTable).where(eq(technicianProfilesTable.approvalStatus, "pending"));
    const [unreadTechnicians] = await db.select({ count: sql<number>`count(*)::int` }).from(technicianProfilesTable).where(sql`approval_status = 'pending' AND admin_seen = FALSE`);
    const [activeTechs] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(and(eq(usersTable.role, "technician"), eq(usersTable.status, "active"), eq(usersTable.isFounder, false)));
    const [suspendedTechs] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(and(eq(usersTable.role, "technician"), eq(usersTable.status, "suspended"), eq(usersTable.isFounder, false)));
    const [totalReqs] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable);
    const [openReqs] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(sql`status NOT IN ('completed','cancelled_by_customer','cancelled_by_technician','cancelled_by_admin')`);
    const [completedReqs] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(eq(serviceRequestsTable.status, "completed"));
    const [cancelledReqs] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(sql`status IN ('cancelled_by_customer','cancelled_by_technician','cancelled_by_admin')`);
    const [disputedReqs] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(eq(serviceRequestsTable.status, "disputed"));
    const [waitingForOffers] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(sql`status IN ('pending','offers_received')`);
    const [newRequests] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(sql`admin_seen = FALSE`);
    const [openSupportTickets] = await db.select({ count: sql<number>`count(*)::int` }).from(supportTicketsTable).where(sql`status IN ('open','in_progress')`);
    const [unreadSupportTickets] = await db.select({ count: sql<number>`count(*)::int` }).from(supportTicketsTable).where(sql`admin_unread = TRUE`);
    const [pendingPlatformCredits] = await db.select({ count: sql<number>`count(*)::int` }).from(platformCreditsTable).where(sql`status = 'pending_settlement'`);

    return res.json({
      totalCustomers: customers.count,
      totalTechnicians: allTechs.count,
      pendingApprovals: pendingApprovals.count,
      activeTechnicians: activeTechs.count,
      suspendedTechnicians: suspendedTechs.count,
      totalRequests: totalReqs.count,
      openRequests: openReqs.count,
      completedRequests: completedReqs.count,
      cancelledRequests: cancelledReqs.count,
      disputedRequests: disputedReqs.count,
      waitingForOffers: waitingForOffers.count,
      newRequests: newRequests.count,
      openSupportTickets: openSupportTickets.count,
      unreadSupportTickets: unreadSupportTickets.count,
      unreadTechnicians: unreadTechnicians.count,
      pendingPlatformCredits: pendingPlatformCredits.count,
    });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/analytics/financial", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { period = "month" } = req.query as any;

    const [commissionTotals] = await db
      .select({ total: sql<number>`COALESCE(sum(amount)::numeric, 0)::float` })
      .from(pointTransactionsTable)
      .where(eq(pointTransactionsTable.type, "commission"));

    const [addedTotals] = await db
      .select({ total: sql<number>`COALESCE(sum(amount)::numeric, 0)::int` })
      .from(pointTransactionsTable)
      .where(eq(pointTransactionsTable.type, "credit"));

    const [deductedTotals] = await db
      .select({ total: sql<number>`COALESCE(sum(amount)::numeric, 0)::int` })
      .from(pointTransactionsTable)
      .where(eq(pointTransactionsTable.type, "debit"));

    const truncFn = period === "day" ? "hour" : period === "week" ? "day" : period === "year" ? "month" : "day";
    const revenueByPeriod = await db.execute(
      sql`SELECT date_trunc(${truncFn}, created_at) as label, COALESCE(sum(amount)::numeric, 0)::float as value
          FROM point_transactions WHERE type = 'commission'
          GROUP BY date_trunc(${truncFn}, created_at) ORDER BY label ASC LIMIT 30`
    );

    return res.json({
      totalCommission: commissionTotals.total || 0,
      totalPointsAdded: addedTotals.total || 0,
      totalPointsDeducted: deductedTotals.total || 0,
      revenue: commissionTotals.total || 0,
      revenueByPeriod: (revenueByPeriod.rows as any[]).map((r) => ({
        label: new Date(r.label).toLocaleDateString("ar-EG"),
        value: parseFloat(r.value) || 0,
      })),
    });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/analytics/requests-chart", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { period = "month" } = req.query as any;
    const truncFn = period === "day" ? "hour" : period === "week" ? "day" : period === "year" ? "month" : "day";

    const result = await db.execute(
      sql`SELECT date_trunc(${truncFn}, created_at) as label, count(*)::int as value
          FROM service_requests GROUP BY date_trunc(${truncFn}, created_at) ORDER BY label ASC LIMIT 30`
    );

    return res.json((result.rows as any[]).map((r) => ({
      label: new Date(r.label).toLocaleDateString("ar-EG"),
      value: parseInt(r.value) || 0,
    })));
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/analytics/top-technicians", authenticate, requireRole("admin", "super_admin"), async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT u.id, u.full_name as "fullName", u.profile_image as "profileImage",
             COUNT(sr.id)::int as "completedJobs",
             COALESCE(AVG(r.stars), 0)::float as "averageRating",
             COALESCE(SUM(pt.amount), 0)::float as "totalEarned"
      FROM users u
      LEFT JOIN service_requests sr ON sr.selected_technician_id = u.id AND sr.status = 'completed'
      LEFT JOIN ratings r ON r.technician_id = u.id
      LEFT JOIN technician_profiles tp ON tp.user_id = u.id
      LEFT JOIN point_transactions pt ON pt.technician_id = tp.id AND pt.type = 'commission'
      WHERE u.role = 'technician' AND u.is_founder = FALSE
      GROUP BY u.id, u.full_name, u.profile_image
      ORDER BY "completedJobs" DESC LIMIT 10
    `);

    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/analytics/top-services", authenticate, requireRole("admin", "super_admin"), async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT s.id, s.name_ar as "nameAr",
             COUNT(sr.id)::int as "requestCount",
             COUNT(CASE WHEN sr.status = 'completed' THEN 1 END)::int as "completedCount"
      FROM services s
      LEFT JOIN service_requests sr ON sr.service_id = s.id
      GROUP BY s.id, s.name_ar
      ORDER BY "requestCount" DESC LIMIT 10
    `);

    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/admin/quick-stats", authenticate, requireRole("admin", "super_admin"), async (_req, res) => {
  try {
    const [pendingApprovals] = await db.select({ count: sql<number>`count(*)::int` }).from(technicianProfilesTable).where(eq(technicianProfilesTable.approvalStatus, "pending"));
    const [openRequests] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(sql`status IN ('pending','offers_received','technician_selected','in_progress')`);
    const [disputedRequests] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(eq(serviceRequestsTable.status, "disputed"));
    const [newComplaints] = await db.select({ count: sql<number>`count(*)::int` }).from(activityLogsTable).where(sql`created_at > NOW() - INTERVAL '24 hours'`);
    const [lowBalance] = await db.select({ count: sql<number>`count(*)::int` }).from(technicianProfilesTable).where(sql`points_balance < 50`);
    const [staleReqs] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceRequestsTable).where(sql`status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'`);

    return res.json({
      pendingApprovals: pendingApprovals.count,
      newComplaints: newComplaints.count,
      openRequests: openRequests.count,
      disputedRequests: disputedRequests.count,
      lowBalanceTechnicians: lowBalance.count,
      staleRequests: staleReqs.count,
    });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/admin/activity-logs", authenticate, requirePermission("activity_logs.view"), async (req, res) => {
  try {
    const { page = "1" } = req.query as any;
    const offset = (parseInt(page) - 1) * 50;
    const rows = await db
      .select({ log: activityLogsTable, admin: usersTable })
      .from(activityLogsTable)
      .leftJoin(usersTable, eq(activityLogsTable.adminId, usersTable.id))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(50)
      .offset(offset);

    return res.json(rows.map(({ log, admin }) => ({
      ...log,
      admin: admin ? { id: admin.id, fullName: admin.fullName } : null,
    })));
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── STAFF MANAGEMENT ────────────────────────────────────────────────────────

function rejectPermissionMutation(res: any, message: string): null {
  res.status(403).json({ error: message });
  return null;
}

// Permission updates replace the target's manageable permissions. Permissions
// outside the caller's scope are preserved, so a lower-level manager cannot
// revoke or overwrite a higher-level permission by omission.
async function buildManagedPermissionSet(
  req: any,
  res: any,
  targetId: number,
  requested: unknown,
  existing: string[],
): Promise<string[] | null> {
  if (targetId === req.user!.id) {
    return rejectPermissionMutation(res, "لا يمكنك تعديل صلاحيات حسابك");
  }

  const callerPermissions = await getEffectivePermissions(req.user!);
  if (!canManagePermission(callerPermissions, "admin.permissions")) {
    return rejectPermissionMutation(res, "ليس لديك صلاحية إدارة صلاحيات الموظفين");
  }
  const allowWildcard = req.user!.isFounder === true || req.user!.role === "super_admin";
  if (!canManagePermissionSet(callerPermissions, requested, allowWildcard)) {
    return rejectPermissionMutation(res, "لا يمكنك منح صلاحيات أعلى من صلاحياتك");
  }

  const protectedPermissions = existing.filter(
    (permission) => !canManagePermission(callerPermissions, permission, allowWildcard),
  );
  return [...new Set([...protectedPermissions, ...(requested as string[])])];
}

// List: any admin-level user can view the staff list
// Founder is NEVER included in staff lists — completely invisible to admins
router.get("/admin/staff", authenticate, requireRole("admin", "super_admin"), async (_req, res) => {
  try {
    const staff = await db
      .select({ user: usersTable, perms: adminPermissionsTable })
      .from(usersTable)
      .leftJoin(adminPermissionsTable, eq(adminPermissionsTable.adminId, usersTable.id))
      .where(and(
        sql`${usersTable.role} IN ('admin', 'super_admin')`,
        eq(usersTable.isFounder, false)
      ));
    return res.json(staff.map(({ user: u, perms }) => ({
      id: u.id, fullName: u.fullName, mobile: u.mobile, email: u.email,
      role: u.role, status: u.status, jobTitle: u.jobTitle, createdAt: u.createdAt,
      permissions: u.role === "super_admin"
        ? ["*"]
        : (perms?.permissions || []).filter((permission) => permission !== "*"),
    })));
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// Create: requires admin.create permission
router.post("/admin/staff", authenticate, requirePermission("admin.create"), async (req, res) => {
  try {
    const { fullName, mobile, email, password, jobTitle, permissions } = req.body;
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: "قائمة الصلاحيات غير صالحة" });
      }
      const callerPermissions = await getEffectivePermissions(req.user!);
      if (permissions.length > 0 && !canManagePermission(callerPermissions, "admin.permissions")) {
        return res.status(403).json({ error: "ليس لديك صلاحية إدارة صلاحيات الموظفين" });
      }
      const allowWildcard = req.user!.isFounder === true || req.user!.role === "super_admin";
      if (!canManagePermissionSet(callerPermissions, permissions, allowWildcard)) {
        return res.status(403).json({ error: "لا يمكنك منح صلاحيات أعلى من صلاحياتك" });
      }
    }
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.default.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ fullName, mobile, email, passwordHash, role: "admin", status: "active", jobTitle })
      .returning();
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      await db.insert(adminPermissionsTable).values({ adminId: user.id, permissions });
    }
    await logActivity(
      req.user!.id,
      "إنشاء موظف",
      `تم إنشاء حساب موظف: ${fullName} (${mobile})`,
      req.ip
    );
    return res.status(201).json({
      id: user.id, fullName: user.fullName, mobile: user.mobile, email: user.email,
      role: user.role, status: user.status, permissions: permissions || [],
    });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// Edit: requires admin.edit permission; cannot target super_admin or Founder
router.patch("/admin/staff/:id", authenticate, requirePermission("admin.edit"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const target = await db.select({ role: usersTable.role, fullName: usersTable.fullName, isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (target.length === 0 || target[0].role !== "admin") {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }
    // Founder is completely protected — return 404 (do not reveal existence)
    if (target.length > 0 && target[0].isFounder) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }
    if (target.length > 0 && String(target[0].role) === "super_admin") {
      return res.status(403).json({ error: "لا يمكن تعديل حساب المدير العام" });
    }
    const { fullName, mobile, email, jobTitle, password, permissions } = req.body;
    let permissionsToSave: string[] | undefined;
    if (permissions !== undefined) {
      const existing = await db.select().from(adminPermissionsTable).where(eq(adminPermissionsTable.adminId, id)).limit(1);
      permissionsToSave = await buildManagedPermissionSet(
        req,
        res,
        id,
        permissions,
        existing[0]?.permissions || [],
      ) ?? undefined;
      if (permissionsToSave === undefined && res.headersSent) return;
    }
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (fullName) updates.fullName = fullName;
    if (mobile) updates.mobile = mobile;
    if (email !== undefined) updates.email = email;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle;
    if (password && password.trim().length >= 6) {
      const bcrypt = await import("bcryptjs");
      updates.passwordHash = await bcrypt.default.hash(password, 10);
    }
    await db.update(usersTable).set(updates as any).where(eq(usersTable.id, id));
    if (permissionsToSave !== undefined) {
      const existing = await db.select().from(adminPermissionsTable).where(eq(adminPermissionsTable.adminId, id)).limit(1);
      if (existing.length > 0) {
        await db.update(adminPermissionsTable).set({ permissions: permissionsToSave, updatedAt: new Date() }).where(eq(adminPermissionsTable.adminId, id));
      } else {
        await db.insert(adminPermissionsTable).values({ adminId: id, permissions: permissionsToSave });
      }
    }
    await logActivity(
      req.user!.id,
      "تعديل موظف",
      `تم تعديل بيانات الموظف #${id}`,
      req.ip
    );
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// Update permissions: requires admin.permissions; cannot target super_admin or Founder
router.patch("/admin/staff/:id/permissions", authenticate, requirePermission("admin.permissions"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const target = await db.select({ role: usersTable.role, isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (target.length === 0 || target[0].role !== "admin") {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }
    // Founder permissions can never be changed — return 404 (do not reveal existence)
    if (target.length > 0 && target[0].isFounder) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }
    if (target.length > 0 && String(target[0].role) === "super_admin") {
      return res.status(403).json({ error: "لا يمكن حذف حساب المدير العام" });
    }
    const existing = await db.select().from(adminPermissionsTable).where(eq(adminPermissionsTable.adminId, id)).limit(1);
    const permissions = await buildManagedPermissionSet(
      req,
      res,
      id,
      req.body?.permissions,
      existing[0]?.permissions || [],
    );
    if (permissions === null) return;
    if (existing.length > 0) {
      await db.update(adminPermissionsTable).set({ permissions, updatedAt: new Date() }).where(eq(adminPermissionsTable.adminId, id));
    } else {
      await db.insert(adminPermissionsTable).values({ adminId: id, permissions });
    }
    await logActivity(
      req.user!.id,
      "تغيير صلاحيات",
      `تم تحديث صلاحيات الموظف #${id} — ${permissions.length} صلاحية`,
      req.ip
    );
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// Delete: requires admin.delete permission; cannot target super_admin or Founder
router.delete("/admin/staff/:id", authenticate, requirePermission("admin.delete"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const target = await db.select({ role: usersTable.role, fullName: usersTable.fullName, isFounder: usersTable.isFounder }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (target.length === 0 || target[0].role !== "admin") {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }
    // Founder can never be deleted — return 404 (do not reveal existence)
    if (target.length > 0 && target[0].isFounder) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }
    const targetName = target[0]?.fullName || `#${id}`;
    await db.delete(adminPermissionsTable).where(eq(adminPermissionsTable.adminId, id));
    // Soft-delete: preserve FK references (activity_logs.admin_id is NOT NULL); just
    // clear the password and mark the account deleted so the user cannot log in.
    await db.update(usersTable)
      .set({ status: "deleted", passwordHash: "DELETED_ACCOUNT", updatedAt: new Date() })
      .where(eq(usersTable.id, id));
    await logActivity(
      req.user!.id,
      "حذف موظف",
      `تم حذف الموظف: ${targetName}`,
      req.ip
    );
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
