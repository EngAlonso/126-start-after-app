---
name: Fnashha secondary ops pattern
description: Pattern for DB/notification ops after the critical write — send response first, then secondary ops in try-catch so they never block or 500 the primary response.
---

## The rule
Any route that does notifications, audit trail, or other non-critical DB writes should:
1. Complete the critical DB operation (status update, insert, etc.)
2. Call `res.json(...)` **immediately** — before any secondary ops
3. Put notifications and audit inserts in a nested `try { ... } catch (secErr) { req.log.error(...) }` block
4. Outer catch guards with `if (!res.headersSent)` before sending 500

**Why:** If notifications or audit trail inserts fail (e.g., schema mismatch, FK violation), the user should still see success for the critical operation. Returning 500 when the main operation succeeded is misleading and causes bugs like "تم التنفيذ" button appearing to fail even though the status was updated.

**How to apply:**
```typescript
// Critical op
await db.update(...).set({ status: "new_status" });

// Send response FIRST
res.json({ success: true });

// Secondary ops — non-blocking
try {
  await db.insert(notificationsTable).values({...});
  await db.insert(auditTrailTable).values({
    changedBy: user.id === 0 ? null : user.id,  // super_admin guard
    ...
  });
} catch (secErr) {
  req.log.error({ err: secErr }, "secondary ops failed — primary operation succeeded");
}
} catch (err) {
  req.log.error({ err });
  if (!res.headersSent) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
}
```

**Applies to routes:** request-completion, complete, admin PATCH status, offer submission, select technician, ratings.
**Key gotcha:** `changedBy` in audit trail must use `user.id === 0 ? null : user.id` for super_admin.
