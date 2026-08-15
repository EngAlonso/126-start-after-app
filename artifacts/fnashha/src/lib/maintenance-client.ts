/**
 * System Maintenance — client-side operations
 * ============================================
 * Backs the "System Maintenance" super-admin page. These functions perform
 * REAL browser operations (Cache Storage, IndexedDB, Service Worker
 * lifecycle, React Query cache) — nothing here is a placeholder.
 *
 * Each function reports its outcome to POST /api/admin/maintenance/log so it
 * shows up in the Maintenance Log, matching the pattern used by
 * /api/admin/maintenance/deploy on the server (which handles its own
 * logging directly since it's a server-side action).
 */

import type { QueryClient } from "@tanstack/react-query";
import { getGetCmsSettingsQueryKey } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const getToken = () => {
  try {
    return localStorage.getItem("fnashha_token") || "";
  } catch {
    return "";
  }
};

async function reportLog(action: "clear_frontend_cache" | "force_pwa_update" | "reload_config", result: "success" | "failed", details?: string) {
  try {
    await fetch(`${API_BASE}/api/admin/maintenance/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action, result, details }),
    });
  } catch {
    // Logging is best-effort — never block the actual maintenance action on it.
  }
}

/**
 * Clears every frontend-only cache:
 *  - Cache Storage (the PWA/offline cache written by the service worker)
 *  - IndexedDB databases (Firebase Messaging's internal DB, etc.)
 *  - React Query's in-memory cache
 * Does NOT touch localStorage auth token, user accounts, the database, or
 * uploaded files — those live on the server or are needed to stay logged in.
 */
export async function clearFrontendCache(queryClient: QueryClient): Promise<{ success: boolean; details: string }> {
  const cleared: string[] = [];
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      cleared.push(`Cache Storage (${keys.length} cache${keys.length === 1 ? "" : "s"})`);
    }

    if ("indexedDB" in window && "databases" in indexedDB) {
      try {
        const dbs = await (indexedDB as any).databases();
        await Promise.all(
          (dbs || [])
            .filter((d: any) => d?.name)
            .map(
              (d: any) =>
                new Promise<void>((resolve) => {
                  const req = indexedDB.deleteDatabase(d.name);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                })
            )
        );
        cleared.push(`IndexedDB (${(dbs || []).length} database${(dbs || []).length === 1 ? "" : "s"})`);
      } catch {
        // Some browsers (older Safari) lack indexedDB.databases() — skip silently.
      }
    }

    queryClient.clear();
    cleared.push("React Query cache");

    const details = cleared.join("، ");
    await reportLog("clear_frontend_cache", "success", details);
    return { success: true, details };
  } catch (err: any) {
    const details = err?.message || "خطأ غير معروف";
    await reportLog("clear_frontend_cache", "failed", details);
    return { success: false, details };
  }
}

/**
 * Forces the PWA's service worker to update immediately:
 *  1. Asks the browser to check for a new SW script.
 *  2. If a new worker is already installed and waiting, tells it to skip
 *     waiting and activate now (via postMessage — see the SW's "message"
 *     listener).
 *  3. Reloads once the new worker takes control.
 *
 * Browser limitation: browsers only re-fetch the SW script when it differs
 * byte-for-byte from the currently installed one (or on their own ~24h
 * cache heuristic). If the SW file itself hasn't changed, `update()` will
 * correctly report "no update found" — that isn't a bug, it's the standard
 * Service Worker spec behavior with no client-side workaround.
 */
export async function forcePwaUpdate(): Promise<{ success: boolean; details: string }> {
  try {
    if (!("serviceWorker" in navigator)) {
      const details = "المتصفح الحالي لا يدعم Service Workers";
      await reportLog("force_pwa_update", "failed", details);
      return { success: false, details };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      const details = "لا يوجد Service Worker مسجل حالياً";
      await reportLog("force_pwa_update", "failed", details);
      return { success: false, details };
    }

    await registration.update();

    const waiting = registration.waiting;
    if (waiting) {
      await new Promise<void>((resolve) => {
        const onControllerChange = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        waiting.postMessage({ type: "SKIP_WAITING" });
        // Fail-safe in case controllerchange never fires (e.g. single tab, no other controller yet)
        setTimeout(resolve, 3000);
      });
      await reportLog("force_pwa_update", "success", "تم تفعيل نسخة جديدة من Service Worker");
      window.location.reload();
      return { success: true, details: "تم تفعيل نسخة جديدة وسيتم تحديث الصفحة" };
    }

    await reportLog("force_pwa_update", "success", "تم التحقق من التحديثات، لا يوجد نسخة جديدة بانتظار التفعيل");
    return { success: true, details: "تم التحقق — لا توجد نسخة جديدة بانتظار التفعيل حالياً" };
  } catch (err: any) {
    const details = err?.message || "خطأ غير معروف";
    await reportLog("force_pwa_update", "failed", details);
    return { success: false, details };
  }
}

/**
 * Reloads CMS/branding/application-settings data without a backend restart —
 * simply invalidates & refetches the relevant React Query caches so every
 * component reading them (BrandingProvider, homepage sections, etc.)
 * re-renders with fresh data from the database.
 */
export async function reloadAppConfiguration(queryClient: QueryClient): Promise<{ success: boolean; details: string }> {
  try {
    await queryClient.invalidateQueries({ queryKey: getGetCmsSettingsQueryKey() });
    // Broad refresh so any other config-shaped query (banners, page backgrounds,
    // hero content, etc., all backed by the same cms_settings/banners tables)
    // also reflects the latest values without a full page reload.
    await queryClient.invalidateQueries();
    await reportLog("reload_config", "success", "تم إعادة تحميل إعدادات CMS والعلامة التجارية والإعدادات العامة");
    return { success: true, details: "تم إعادة تحميل الإعدادات بنجاح" };
  } catch (err: any) {
    const details = err?.message || "خطأ غير معروف";
    await reportLog("reload_config", "failed", details);
    return { success: false, details };
  }
}

/**
 * Applies an incoming "sw_update_available" broadcast (see
 * use-admin-events.ts / use-user-events.ts): checks for the new worker,
 * activates it, and reloads — so connected clients pick up a newly deployed
 * frontend without any manual cache clearing.
 */
export async function applyIncomingUpdate(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) {
      window.location.reload();
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      window.location.reload();
      return;
    }
    await registration.update();
    const waiting = registration.waiting;
    if (waiting) {
      await new Promise<void>((resolve) => {
        const onControllerChange = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        waiting.postMessage({ type: "SKIP_WAITING" });
        setTimeout(resolve, 3000);
      });
    }
    window.location.reload();
  } catch {
    window.location.reload();
  }
}
