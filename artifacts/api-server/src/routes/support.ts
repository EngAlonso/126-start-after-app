import { Router } from "express";
import { db } from "@workspace/db";
import { supportTicketsTable, ticketRepliesTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, desc, and, SQL } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { NotificationService } from "../lib/notification-service";

const router = Router();

router.get("/support/tickets", authenticate, async (req, res) => {
  try {
    const { status, page = "1" } = req.query as any;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const offset = (pageNum - 1) * 20;

    const user = req.user!;
    const isAdmin = user.role === "admin" || user.role === "super_admin";

    // Build WHERE conditions in the DB query so that pagination (LIMIT/OFFSET)
    // operates on the already-filtered set — doing JS .filter() after a paginated
    // query would return fewer than 20 results per page even when more exist.
    const whereClause: SQL | undefined = !isAdmin && status
      ? and(eq(supportTicketsTable.userId, user.id), eq(supportTicketsTable.status, status as any))
      : !isAdmin
      ? eq(supportTicketsTable.userId, user.id)
      : status
      ? eq(supportTicketsTable.status, status as any)
      : undefined;

    const rows = await db
      .select({ ticket: supportTicketsTable, user: usersTable })
      .from(supportTicketsTable)
      .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(20)
      .offset(offset);

    return res.json(rows.map(({ ticket, user: u }) => ({
      ...ticket,
      user: u ? { id: u.id, fullName: u.fullName, mobile: u.mobile } : null,
    })));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/support/tickets", authenticate, async (req, res) => {
  try {
    const { subject, message, images } = req.body;
    if (!subject || !message) return res.status(400).json({ error: "الموضوع والرسالة مطلوبان" });
    const [ticket] = await db
      .insert(supportTicketsTable)
      .values({ userId: req.user!.id, subject, message, images: images || [], status: "open" })
      .returning();

    try {
      const { broadcastAdminEvent } = await import("../lib/sse-broadcast");
      broadcastAdminEvent("new_support_ticket", { id: ticket.id });
    } catch {}

    return res.status(201).json(ticket);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/support/tickets/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });

    const user = req.user!;
    // When an admin or super_admin opens a ticket, clear the unread flag
    if ((user.role === "admin" || user.role === "super_admin") && (ticket as any).adminUnread) {
      await db.update(supportTicketsTable)
        .set({ adminUnread: false, updatedAt: new Date() })
        .where(eq(supportTicketsTable.id, id));
    }

    const replies = await db
      .select({ reply: ticketRepliesTable, sender: usersTable })
      .from(ticketRepliesTable)
      .leftJoin(usersTable, eq(ticketRepliesTable.senderId, usersTable.id))
      .where(eq(ticketRepliesTable.ticketId, id))
      .orderBy(ticketRepliesTable.createdAt);

    return res.json({
      ...ticket,
      adminUnread: false,
      replies: replies.map(({ reply, sender }) => ({
        ...reply,
        sender: sender ? { id: sender.id, fullName: sender.fullName } : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.patch("/support/tickets/:id", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { status, priority } = req.body;
    const [ticket] = await db
      .update(supportTicketsTable)
      .set({ status, priority, updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, id))
      .returning();

    res.json(ticket);

    try {
      if (ticket?.userId) {
        await db.insert(notificationsTable).values({
          userId: ticket.userId,
          title: "تحديث حالة التذكرة",
          body: `تم تحديث حالة تذكرتك #${id}`,
          type: "support_reply",
          relatedId: id,
        });
      }
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      if (ticket?.userId) broadcastToUser(ticket.userId, "support_ticket_updated", { id, status, priority });
      broadcastAdminEvent("support_ticket_updated", { id, status, priority });
    } catch (secErr) {
      req.log.error({ err: secErr }, "support ticket update secondary ops failed — update was saved successfully");
    }
    return;
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
    return;
  }
});

router.post("/support/tickets/:id/reply", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "الرد فارغ" });

    const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });

    // senderId may be null for the super-admin (id=0, no DB record)
    const senderId = req.user!.id || null;

    const [reply] = await db
      .insert(ticketRepliesTable)
      .values({ ticketId: id, senderId, message })
      .returning();

    // Update ticket status; if the sender is a customer (not admin), mark ticket as admin-unread
    const isAdminSender = req.user!.role === "admin" || req.user!.role === "super_admin";
    await db.update(supportTicketsTable)
      .set({ status: "in_progress", adminUnread: !isAdminSender, updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, id));

    // Notify the ticket owner (skip if admin is replying to their own ticket)
    const notifyUserId = req.user!.id === ticket.userId ? undefined : ticket.userId;
    if (notifyUserId) {
      await db.insert(notificationsTable).values({
        userId: notifyUserId,
        title: "رد على تذكرتك",
        body: message.substring(0, 100),
        type: "support_reply",
        relatedId: id,
      });

      // Push notification for the ticket owner — non-blocking, fail silently
      try {
        await NotificationService.notifySupportReply(notifyUserId, id, message.substring(0, 80));
      } catch {}
    }

    try {
      const { broadcastAdminEvent, broadcastToUser } = await import("../lib/sse-broadcast");
      if (!isAdminSender) {
        // Customer replied — notify admins so they see the new reply immediately
        broadcastAdminEvent("new_support_reply", { ticketId: id });
      } else if (notifyUserId) {
        // Admin replied — push the user's notification bell in real time
        broadcastToUser(notifyUserId, "new_notification", {});
      }
    } catch {}

    return res.status(201).json(reply);
  } catch (err) {
    req.log.error({ err }, "support reply error");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
