import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, usersTable, adminPermissionsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { authenticate, getEffectivePermissions } from "../middlewares/auth";
import { NotificationService } from "../lib/notification-service";

const router = Router();

router.get("/notifications", authenticate, async (req, res) => {
  try {
    const { unread, page = "1", limit = "50" } = req.query as any;
    // Pagination: default 50 per page, max 100 per request
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    if (unread === "true") rows = rows.filter((n) => !n.isRead);

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/notifications/read-all", authenticate, async (req, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.user!.id));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/notifications/read-related", authenticate, async (req, res) => {
  try {
    const { relatedId, types } = req.body as { relatedId?: number; types?: string[] };
    const conditions: ReturnType<typeof eq>[] = [eq(notificationsTable.userId, req.user!.id)];
    if (typeof relatedId === "number") {
      conditions.push(eq(notificationsTable.relatedId, relatedId));
    }
    if (Array.isArray(types) && types.length > 0) {
      conditions.push(inArray(notificationsTable.type, types as any));
    }
    await db.update(notificationsTable).set({ isRead: true }).where(and(...conditions));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/notifications/:id/read", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.id)));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/notifications/broadcast", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ error: "غير مسموح" });
    }

    if (user.role === "admin" && user.id !== 0) {
      const perms = await getEffectivePermissions(user);
      if (!perms.includes("notifications.manage")) {
        return res.status(403).json({ error: "لا تملك صلاحية إرسال الإشعارات" });
      }
    }

    const { title, body, type = "announcement", target, userId: targetUserId } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "العنوان والمحتوى مطلوبان" });
    }

    // Always exclude the Founder from broadcast targets
    const allUsers = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.isFounder, false));

    let userIds: number[];
    if (target === "specific" && targetUserId) {
      userIds = [parseInt(targetUserId)];
    } else if (target === "customers") {
      userIds = allUsers.filter((u) => u.role === "customer").map((u) => u.id);
    } else if (target === "technicians") {
      userIds = allUsers.filter((u) => u.role === "technician").map((u) => u.id);
    } else {
      userIds = allUsers.map((u) => u.id);
    }

    if (userIds.length === 0) {
      return res.status(400).json({ error: "لا يوجد مستخدمون لإرسال الإشعار إليهم" });
    }

    await db.insert(notificationsTable).values(
      userIds.map((uid) => ({ userId: uid, title, body, type: type as any, relatedId: null }))
    );

    // Push notifications — non-blocking, fail silently
    try {
      await NotificationService.dispatchPush(userIds, {
        title,
        body,
        type: "announcement",
      });
    } catch {}

    // SSE: instantly refresh every recipient's notification list/bell
    try {
      const { broadcastToUsers } = await import("../lib/sse-broadcast");
      broadcastToUsers(userIds, "new_notification", {});
    } catch {}

    return res.json({ success: true, count: userIds.length });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
