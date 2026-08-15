import { Router } from "express";
import { db } from "@workspace/db";
import { technicianProfilesTable, pointTransactionsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { NotificationService } from "../lib/notification-service";

const router = Router();

// ─── Helper: resolve actor fields for point_transactions ──────────────────────
// Super admin (id=0) has no users table row — store as performedBy text instead.
// Regular admins have a real users.id — store in adminId FK.
function resolveActor(userId: number): { adminId: number | null; performedBy: string | null } {
  if (userId === 0) {
    return { adminId: null, performedBy: "Super Admin" };
  }
  return { adminId: userId, performedBy: null };
}

// GET /api/points/balance — returns total, reserved, and available
router.get("/points/balance", authenticate, async (req, res) => {
  try {
    const [profile] = await db
      .select()
      .from(technicianProfilesTable)
      .where(eq(technicianProfilesTable.userId, req.user!.id))
      .limit(1);
    if (!profile) return res.status(404).json({ error: "الفني غير موجود" });

    const available = Math.max(0, profile.pointsBalance - profile.reservedPoints);

    return res.json({
      technicianId: req.user!.id,
      balance: profile.pointsBalance,
      reservedPoints: profile.reservedPoints,
      available,
    });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/points/transactions
router.get("/points/transactions", authenticate, async (req, res) => {
  try {
    const { technicianId, page = "1" } = req.query as any;
    const pageNum = parseInt(page);
    const limit = 50;
    const offset = (pageNum - 1) * limit;

    const isAdmin = req.user!.role === "admin" || req.user!.role === "super_admin";

    // Admin with no technicianId param → return empty list (no profile to look up)
    if (isAdmin && !technicianId) {
      return res.json([]);
    }

    let profileId: number;
    if (technicianId && isAdmin) {
      const [p] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, parseInt(technicianId))).limit(1);
      if (!p) return res.status(404).json({ error: "الفني غير موجود" });
      profileId = p.id;
    } else {
      const [p] = await db.select().from(technicianProfilesTable).where(eq(technicianProfilesTable.userId, req.user!.id)).limit(1);
      if (!p) return res.status(404).json({ error: "الفني غير موجود" });
      profileId = p.id;
    }

    const txns = await db
      .select()
      .from(pointTransactionsTable)
      .where(eq(pointTransactionsTable.technicianId, profileId))
      .orderBy(desc(pointTransactionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json(txns);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/points/transactions/all — admin-only: all transactions across all technicians
router.get("/points/transactions/all", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { page = "1" } = req.query as any;
    const pageNum = parseInt(page);
    const limit = 100;
    const offset = (pageNum - 1) * limit;

    const rows = await db.execute(sql`
      SELECT
        pt.id,
        pt.amount,
        pt.type,
        pt.description,
        pt.balance_after,
        pt.request_id,
        pt.performed_by,
        pt.created_at,
        u.full_name  AS technician_name,
        u.mobile     AS technician_mobile,
        au.full_name AS admin_name
      FROM point_transactions pt
      JOIN technician_profiles tp ON tp.id = pt.technician_id
      JOIN users u ON u.id = tp.user_id
      LEFT JOIN users au ON au.id = pt.admin_id
      ORDER BY pt.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return res.json(rows.rows);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/points/add
router.post("/points/add", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { technicianId, amount, description } = req.body;
    if (!technicianId || !amount) return res.status(400).json({ error: "البيانات مطلوبة" });

    const actor = resolveActor(req.user!.id);

    const result = await db.transaction(async (tx) => {
      const [profile] = await tx
        .select()
        .from(technicianProfilesTable)
        .where(eq(technicianProfilesTable.userId, technicianId))
        .limit(1);
      if (!profile) throw new Error("الفني غير موجود");

      const newBalance = profile.pointsBalance + parseInt(amount);

      await tx
        .update(technicianProfilesTable)
        .set({ pointsBalance: newBalance, updatedAt: new Date() })
        .where(eq(technicianProfilesTable.id, profile.id));

      const [txn] = await tx.insert(pointTransactionsTable).values({
        technicianId: profile.id,
        amount: parseInt(amount),
        type: "credit",
        description: description || "إضافة نقاط من الإدارة",
        balanceAfter: newBalance,
        adminId: actor.adminId,
        performedBy: actor.performedBy,
      }).returning();

      return { profile, newBalance, txn };
    });

    try {
      await NotificationService.notifyAdminPointsAdded(Number(technicianId), parseInt(amount));
      const { broadcastToUser } = await import("../lib/sse-broadcast");
      broadcastToUser(Number(technicianId), "notification", {});
    } catch {}

    return res.json({
      technicianId,
      balance: result.newBalance,
      available: Math.max(0, result.newBalance - result.profile.reservedPoints),
      transaction: result.txn,
    });
  } catch (err: any) {
    if (err.message === "الفني غير موجود") {
      return res.status(404).json({ error: "الفني غير موجود" });
    }
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/points/deduct
router.post("/points/deduct", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { technicianId, amount, description } = req.body;
    if (!technicianId || !amount) return res.status(400).json({ error: "البيانات مطلوبة" });

    const actor = resolveActor(req.user!.id);

    const result = await db.transaction(async (tx) => {
      const [profile] = await tx
        .select()
        .from(technicianProfilesTable)
        .where(eq(technicianProfilesTable.userId, technicianId))
        .limit(1);
      if (!profile) throw new Error("الفني غير موجود");

      const newBalance = Math.max(0, profile.pointsBalance - parseInt(amount));

      await tx
        .update(technicianProfilesTable)
        .set({ pointsBalance: newBalance, updatedAt: new Date() })
        .where(eq(technicianProfilesTable.id, profile.id));

      const [txn] = await tx.insert(pointTransactionsTable).values({
        technicianId: profile.id,
        amount: parseInt(amount),
        type: "debit",
        description: description || "خصم نقاط من الإدارة",
        balanceAfter: newBalance,
        adminId: actor.adminId,
        performedBy: actor.performedBy,
      }).returning();

      return { profile, newBalance, txn };
    });

    return res.json({
      technicianId,
      balance: result.newBalance,
      available: Math.max(0, result.newBalance - result.profile.reservedPoints),
      transaction: result.txn,
    });
  } catch (err: any) {
    if (err.message === "الفني غير موجود") {
      return res.status(404).json({ error: "الفني غير موجود" });
    }
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
