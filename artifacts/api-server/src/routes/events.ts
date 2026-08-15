import { Router } from "express";
import { addAdminClient, addUserClient } from "../lib/sse-broadcast";
import { extractToken, verifyToken } from "../middlewares/auth";

const router = Router();

// ── Admin SSE ─────────────────────────────────────────────────────────────────
// Auth accepts either `Authorization: Bearer <JWT>` (existing PWA behavior,
// unchanged) or `?token=<JWT>` (required for Flutter/mobile EventSource,
// which cannot send custom headers). Both paths run through the exact same
// verifyToken() used by the rest of the API — no duplicated JWT logic.
router.get("/admin/events", (req, res) => {
  const rawToken = extractToken(req, true);
  if (!rawToken) { res.status(401).json({ error: "غير مصرح" }); return; }

  let user: { id: number; role: string; mobile: string; isFounder?: boolean } | null = null;
  try {
    user = verifyToken(rawToken) as any;
  } catch {
    res.status(401).json({ error: "رمز الجلسة غير صالح" }); return;
  }

  // Founder has super_admin role in the JWT — allow through with both checks
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    res.status(403).json({ error: "ليس لديك صلاحية" }); return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(":connected\n\n");

  const ping = setInterval(() => {
    try { res.write(":ping\n\n"); } catch { clearInterval(ping); }
  }, 25_000);

  addAdminClient(res);

  req.on("close", () => clearInterval(ping));
});

// ── User SSE (customers & technicians) ───────────────────────────────────────
// Same dual-auth pattern as /admin/events — see comment above.
router.get("/events", (req, res) => {
  const rawToken = extractToken(req, true);
  if (!rawToken) { res.status(401).json({ error: "غير مصرح" }); return; }

  let user: { id: number; role: string; mobile: string } | null = null;
  try {
    user = verifyToken(rawToken) as any;
  } catch {
    res.status(401).json({ error: "رمز الجلسة غير صالح" }); return;
  }

  if (!user || !user.id) {
    res.status(403).json({ error: "ليس لديك صلاحية" }); return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(":connected\n\n");

  const ping = setInterval(() => {
    try { res.write(":ping\n\n"); } catch { clearInterval(ping); }
  }, 25_000);

  addUserClient(user.id, res);

  req.on("close", () => clearInterval(ping));
});

export default router;
