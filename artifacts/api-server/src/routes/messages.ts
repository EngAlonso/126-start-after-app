import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, serviceRequestsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, asc, and, ne, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { NotificationService } from "../lib/notification-service";

const router = Router();

// ─── Ownership helper ─────────────────────────────────────────────────────────
// Verifies that the calling user is a party to the conversation (request
// owner or assigned technician). Admins and super_admins bypass this check.
// Returns the service request row on success, or sends a 403/404 and returns
// null so the caller can early-return.
async function assertMessageAccess(
  requestId: number,
  userId: number,
  role: string,
  res: any
): Promise<{ customerId: number; selectedTechnicianId: number | null } | null> {
  if (role === "admin" || role === "super_admin") return { customerId: 0, selectedTechnicianId: null }; // bypass
  const [request] = await db
    .select({ customerId: serviceRequestsTable.customerId, selectedTechnicianId: serviceRequestsTable.selectedTechnicianId })
    .from(serviceRequestsTable)
    .where(eq(serviceRequestsTable.id, requestId))
    .limit(1);
  if (!request) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return null;
  }
  if (request.customerId !== userId && request.selectedTechnicianId !== userId) {
    res.status(403).json({ error: "غير مسموح بالوصول إلى هذه الرسائل" });
    return null;
  }
  return request;
}

// GET /api/conversations — conversation list for the logged-in user
router.get("/conversations", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await db.execute(sql`
      WITH last_messages AS (
        SELECT DISTINCT ON (request_id)
          request_id,
          content    AS last_message,
          created_at AS last_message_at,
          type       AS last_message_type
        FROM messages
        ORDER BY request_id, created_at DESC
      ),
      message_counts AS (
        SELECT request_id, COUNT(*) AS message_count
        FROM messages
        GROUP BY request_id
      ),
      unread_counts AS (
        SELECT request_id, COUNT(*) AS unread_count
        FROM messages
        WHERE is_read = FALSE AND sender_id != ${userId}
        GROUP BY request_id
      )
      SELECT
        sr.id           AS request_id,
        sr.status,
        s.name_ar       AS service_name,
        cu.id           AS customer_id,
        cu.full_name    AS customer_name,
        tu.id           AS technician_id,
        tu.full_name    AS technician_name,
        lm.last_message,
        lm.last_message_at,
        lm.last_message_type,
        mc.message_count::int,
        COALESCE(uc.unread_count, 0)::int AS unread_count
      FROM service_requests sr
      JOIN services s        ON s.id  = sr.service_id
      JOIN users cu          ON cu.id = sr.customer_id
      LEFT JOIN users tu     ON tu.id = sr.selected_technician_id
      JOIN last_messages lm  ON lm.request_id = sr.id
      JOIN message_counts mc ON mc.request_id = sr.id
      LEFT JOIN unread_counts uc ON uc.request_id = sr.id
      WHERE sr.customer_id = ${userId}
         OR sr.selected_technician_id = ${userId}
      ORDER BY lm.last_message_at DESC
    `);
    return res.json(result.rows);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/admin/conversations — all conversations (admin only)
router.get(
  "/admin/conversations",
  authenticate,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await db.execute(sql`
        WITH last_messages AS (
          SELECT DISTINCT ON (request_id)
            request_id,
            content    AS last_message,
            created_at AS last_message_at,
            type       AS last_message_type
          FROM messages
          ORDER BY request_id, created_at DESC
        ),
        message_counts AS (
          SELECT request_id, COUNT(*) AS message_count
          FROM messages
          GROUP BY request_id
        )
        SELECT
          sr.id           AS request_id,
          sr.status,
          s.name_ar       AS service_name,
          cu.id           AS customer_id,
          cu.full_name    AS customer_name,
          tu.id           AS technician_id,
          tu.full_name    AS technician_name,
          lm.last_message,
          lm.last_message_at,
          lm.last_message_type,
          mc.message_count::int
        FROM service_requests sr
        JOIN services s        ON s.id  = sr.service_id
        JOIN users cu          ON cu.id = sr.customer_id
        LEFT JOIN users tu     ON tu.id = sr.selected_technician_id
        JOIN last_messages lm  ON lm.request_id = sr.id
        JOIN message_counts mc ON mc.request_id = sr.id
        ORDER BY lm.last_message_at DESC
      `);
      return res.json(result.rows);
    } catch (err) {
      req.log.error({ err });
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
  }
);

// GET /api/requests/:requestId/messages
router.get("/requests/:requestId/messages", authenticate, async (req, res) => {
  try {
    const requestId = parseInt(req.params["requestId"] as string);
    const user = req.user!;

    // Ownership check: only the request owner, the assigned technician, or an
    // admin/super_admin may read the conversation for a specific request.
    const access = await assertMessageAccess(requestId, user.id, user.role, res);
    if (access === null) return; // response already sent by helper

    const messages = await db
      .select({ message: messagesTable, sender: usersTable })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
      .where(eq(messagesTable.requestId, requestId))
      .orderBy(asc(messagesTable.createdAt));

    return res.json(messages.map(({ message, sender }) => ({
      ...message,
      sender: sender ? { id: sender.id, fullName: sender.fullName, profileImage: sender.profileImage } : null,
    })));
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/requests/:requestId/messages/read-all — mark all received messages as read
router.patch("/requests/:requestId/messages/read-all", authenticate, async (req, res) => {
  try {
    const requestId = parseInt(req.params["requestId"] as string);
    const user = req.user!;
    const myId = user.id;

    // Ownership check: only parties to the conversation may mark messages as read.
    const access = await assertMessageAccess(requestId, myId, user.role, res);
    if (access === null) return; // response already sent by helper

    // Only mark messages sent by the OTHER party as read
    const unread = await db
      .select({ id: messagesTable.id, senderId: messagesTable.senderId })
      .from(messagesTable)
      .where(and(
        eq(messagesTable.requestId, requestId),
        eq(messagesTable.isRead, false),
        ne(messagesTable.senderId, myId),
      ));

    if (unread.length === 0) return res.json({ marked: 0 });

    await db
      .update(messagesTable)
      .set({ isRead: true })
      .where(and(
        eq(messagesTable.requestId, requestId),
        eq(messagesTable.isRead, false),
        ne(messagesTable.senderId, myId),
      ));

    // Notify the sender(s) that their messages were read via SSE
    const senderIds = [...new Set(unread.map((m) => m.senderId).filter((id): id is number => id !== null && id !== myId))];
    try {
      const { broadcastToUser, broadcastToUsers } = await import("../lib/sse-broadcast");
      if (senderIds.length === 1) {
        broadcastToUser(senderIds[0], "messages_read", { requestId, readBy: myId });
      } else if (senderIds.length > 1) {
        broadcastToUsers(senderIds, "messages_read", { requestId, readBy: myId });
      }
    } catch {}

    return res.json({ marked: unread.length });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/requests/:requestId/messages/deliver-all
// Marks all un-delivered messages sent by the OTHER party as delivered.
// Called by the recipient immediately after fetching the message list.
// Broadcasts a "messages_delivered" SSE event back to the original sender(s)
// so their tick can advance from ✓ (sent) to ✓✓ (delivered).
router.patch("/requests/:requestId/messages/deliver-all", authenticate, async (req, res) => {
  try {
    const requestId = parseInt(req.params["requestId"] as string);
    const myId = req.user!.id;

    const access = await assertMessageAccess(requestId, myId, req.user!.role, res);
    if (access === null) return;

    const undelivered = await db
      .select({ id: messagesTable.id, senderId: messagesTable.senderId })
      .from(messagesTable)
      .where(and(
        eq(messagesTable.requestId, requestId),
        eq(messagesTable.isDelivered, false),
        ne(messagesTable.senderId, myId),
      ));

    if (undelivered.length === 0) return res.json({ marked: 0 });

    await db
      .update(messagesTable)
      .set({ isDelivered: true })
      .where(and(
        eq(messagesTable.requestId, requestId),
        eq(messagesTable.isDelivered, false),
        ne(messagesTable.senderId, myId),
      ));

    // Notify the sender(s) that their messages were delivered via SSE
    const senderIds = [...new Set(
      undelivered.map((m) => m.senderId).filter((id): id is number => id !== null && id !== myId)
    )];
    try {
      const { broadcastToUser, broadcastToUsers } = await import("../lib/sse-broadcast");
      if (senderIds.length === 1) {
        broadcastToUser(senderIds[0], "messages_delivered", { requestId, deliveredTo: myId });
      } else if (senderIds.length > 1) {
        broadcastToUsers(senderIds, "messages_delivered", { requestId, deliveredTo: myId });
      }
    } catch {}

    return res.json({ marked: undelivered.length });
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/requests/:requestId/messages
router.post("/requests/:requestId/messages", authenticate, async (req, res) => {
  try {
    const requestId = parseInt(req.params["requestId"] as string);
    const { content, type, imageUrl } = req.body;

    if (!content) return res.status(400).json({ error: "الرسالة فارغة" });

    const [request] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, requestId)).limit(1);
    if (!request) return res.status(404).json({ error: "الطلب غير موجود" });

    const closedStatuses = ["completed", "cancelled_by_customer", "cancelled_by_technician", "cancelled_by_admin", "disputed"];
    if (closedStatuses.includes(request.status)) {
      return res.status(400).json({ error: "المحادثة مغلقة" });
    }

    // Chat is only allowed after a technician has been selected.
    // Statuses before selection: pending, offers_received.
    const preSelectionStatuses = ["pending", "offers_received"];
    if (preSelectionStatuses.includes(request.status)) {
      return res.status(400).json({ error: "لم يتم اختيار فني بعد" });
    }

    const [message] = await db
      .insert(messagesTable)
      .values({ requestId, senderId: req.user!.id, content, type: type || "text", imageUrl })
      .returning();

    const recipientId =
      req.user!.id === request.customerId ? request.selectedTechnicianId : request.customerId;

    if (recipientId) {
      await db.insert(notificationsTable).values({
        userId: recipientId,
        title: "رسالة جديدة",
        body: content.substring(0, 100),
        type: "new_message",
        relatedId: requestId,
      });
    }

    const [sender] = await db
      .select({ id: usersTable.id, fullName: usersTable.fullName, profileImage: usersTable.profileImage })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    // Send response first — push + SSE are secondary and must not block
    res.status(201).json({ ...message, sender });

    // Push notification for recipient — non-blocking, fail silently
    try {
      if (recipientId) {
        const senderName = sender?.fullName ?? "مستخدم";
        const preview = content.length > 80 ? `${content.slice(0, 77)}...` : content;
        await NotificationService.dispatchPush(
          [recipientId],
          {
            title: `رسالة من ${senderName} 💬`,
            body: preview,
            type: "new_message",
            data: { requestId: String(requestId), senderName },
          }
        );
      }
    } catch {}

    // SSE: deliver message to recipient + admin instantly
    try {
      const { broadcastToUser, broadcastAdminEvent } = await import("../lib/sse-broadcast");
      if (recipientId) {
        broadcastToUser(recipientId, "new_message", { requestId, messageId: message.id });
      }
      broadcastAdminEvent("new_message", { requestId, messageId: message.id });
    } catch {}
    return;
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
