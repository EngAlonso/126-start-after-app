/**
 * Firebase Web Config Routes
 * ==========================
 * Serves the PUBLIC Firebase Web SDK config (apiKey, appId, VAPID key, etc.)
 * to the browser at runtime.
 *
 * Why an API route instead of baking values into the frontend bundle:
 *  - public/firebase-messaging-sw.js is a STATIC file served as-is (Vite does
 *    not process files in /public), so it cannot read import.meta.env.
 *  - Fetching config from the backend means both the main-thread app AND the
 *    service worker read the exact same values from one source of truth
 *    (server env vars), with no rebuild required when they change.
 *  - Firebase Web config values are not secret — they identify the Firebase
 *    project, not credentials — so serving them unauthenticated is safe and
 *    is Firebase's own recommended pattern.
 *
 * GET /firebase-web-config     — JSON, consumed by the browser main thread.
 * GET /firebase-web-config.js  — same data as a JS snippet, consumed via
 *                                  importScripts() inside the service worker
 *                                  (service workers cannot use fetch() at
 *                                  top-level synchronously the way
 *                                  importScripts() can).
 */

import { Router } from "express";

const router = Router();

function getWebConfig() {
  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const apiKey = process.env["FIREBASE_WEB_API_KEY"];
  const appId = process.env["FIREBASE_WEB_APP_ID"];
  const messagingSenderId = process.env["FIREBASE_WEB_MESSAGING_SENDER_ID"];
  const vapidKey = process.env["FIREBASE_WEB_VAPID_KEY"];

  const supported = Boolean(projectId && apiKey && appId && messagingSenderId && vapidKey);

  if (!supported) {
    return { supported: false as const };
  }

  return {
    supported: true as const,
    apiKey,
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId,
    appId,
    vapidKey,
  };
}

router.get("/firebase-web-config", (_req, res) => {
  res.json(getWebConfig());
});

router.get("/firebase-web-config.js", (_req, res) => {
  const config = getWebConfig();
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(`self.__FNASHHA_FIREBASE_CONFIG__ = ${JSON.stringify(config)};`);
});

export default router;
