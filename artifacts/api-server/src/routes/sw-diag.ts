/**
 * Service Worker Diagnostic Phone-Home Endpoint
 * ================================================
 * The firebase-messaging-sw.js fetches this endpoint at each key step of
 * the push delivery chain so we can observe SW runtime behaviour from the
 * server logs without needing access to the user's browser DevTools.
 *
 * This route is intentionally unauthenticated — it only logs, never reads
 * or writes user data.  Remove it once push delivery is fully verified.
 */

import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

router.post("/debug/sw-diag", (req, res) => {
  const { step, detail } = req.body as { step?: string; detail?: unknown };
  logger.info({ step, detail }, "[SW-PHONE-HOME] service worker diagnostic event");
  res.json({ ok: true });
});

export default router;
