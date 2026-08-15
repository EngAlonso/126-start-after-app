import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Middleware: only the authenticated Founder may access these routes
function requireFounder(req: any, res: any, next: any) {
  if (!req.user?.isFounder) {
    return res.status(403).json({ error: "غير مسموح" });
  }
  next();
}

// PATCH /api/founder/settings
// Founder-only: change own password and/or phone number.
// • To change password: send { currentPassword, newPassword }
// • To change phone:    send { newPhone, currentPassword }
// • To change both:     send all three fields
// The account remains the Founder account after any change.
router.patch("/founder/settings", authenticate, requireFounder, async (req, res) => {
  try {
    const founderId = req.user!.id;
    const { currentPassword, newPassword, newPhone } = req.body;

    // Double-check the DB record has is_founder = TRUE (defence-in-depth)
    const [founder] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, founderId))
      .limit(1);

    if (!founder || !founder.isFounder) {
      return res.status(403).json({ error: "غير مسموح" });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };

    // ── Password change ────────────────────────────────────────────────────
    if (newPassword && newPassword.trim().length >= 6) {
      if (!currentPassword) {
        return res.status(400).json({ error: "كلمة المرور الحالية مطلوبة" });
      }
      const valid = await bcrypt.compare(currentPassword, founder.passwordHash);
      if (!valid) {
        return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // ── Phone number change ────────────────────────────────────────────────
    if (newPhone && newPhone.trim()) {
      const phone = newPhone.trim();
      // Always require password verification when changing phone
      if (!currentPassword) {
        return res.status(400).json({ error: "كلمة المرور الحالية مطلوبة لتغيير رقم الهاتف" });
      }
      const validForPhone = await bcrypt.compare(currentPassword, founder.passwordHash);
      if (!validForPhone) {
        return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      }
      // Ensure no other non-deleted user already has this number
      const conflict = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.mobile, phone), ne(usersTable.id, founderId), ne(usersTable.status, "deleted")))
        .limit(1);
      if (conflict.length > 0) {
        return res.status(400).json({ error: "رقم الهاتف مستخدم مسبقاً" });
      }
      updates.mobile = phone;
    }

    // No-op check: only updatedAt was added
    if (Object.keys(updates).length <= 1) {
      return res.status(400).json({ error: "لم يتم تقديم أي تغييرات" });
    }

    // Always guarantee is_founder stays TRUE regardless of anything in updates
    updates.isFounder = true;

    await db.update(usersTable).set(updates as any).where(eq(usersTable.id, founderId));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
