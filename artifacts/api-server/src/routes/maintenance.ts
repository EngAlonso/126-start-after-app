import { Router, type Request, type Response } from "express";
import { db, maintenanceStateTable, maintenanceLogTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { readFileSync } from "fs";
import path from "path";
import { authenticate, requireRole } from "../middlewares/auth";
import { broadcastToAll, getConnectedClientsCount } from "../lib/sse-broadcast";

const router = Router();
const authSA = [authenticate, requireRole("super_admin")] as any[];

// Backend process start time — the closest real proxy we have to a "build
// timestamp" in this environment (there is no separate CI build artifact
// with its own embedded build time; the server process starts fresh on
// every deploy/restart).
const SERVER_STARTED_AT = new Date();

function readPkgVersion(pkgPath: string): string {
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    return pkg.version || "0.0.0";
  } catch {
    return "unknown";
  }
}

// Reliably find the api-server package directory regardless of startup method:
//   • Production (node dist/index.mjs from any CWD): the esbuild banner sets
//     globalThis.__dirname to the dist/ directory → we go one level up.
//   • Development / pnpm start: pnpm changes CWD to the package directory
//     (artifacts/api-server) before running scripts → process.cwd() is correct.
//
// Never use a path relative to import.meta.url in this file: esbuild bundles
// everything into dist/index.mjs, making every module's import.meta.url point
// at the same dist file, and relative paths from there only match the bundled
// layout, not the source layout used by pnpm dev.
const _gd = (globalThis as any).__dirname as string | undefined;
const _apiServerDir = _gd
  ? path.resolve(_gd, "..") // dist/ → artifacts/api-server/
  : process.cwd();          // pnpm dev: CWD is already artifacts/api-server/

const BACKEND_PKG = path.resolve(_apiServerDir, "package.json");
const FRONTEND_PKG = path.resolve(_apiServerDir, "../fnashha/package.json");

async function getState() {
  const rows = await db.select().from(maintenanceStateTable).where(eq(maintenanceStateTable.id, 1));
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(maintenanceStateTable).values({ id: 1, swVersion: 1 }).returning();
  return created;
}

async function resolveAdminName(userId: number): Promise<string> {
  if (!userId || userId <= 0) return "مدير عام";
  try {
    const rows = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, userId));
    return rows[0]?.fullName || "مدير";
  } catch {
    return "مدير";
  }
}

async function writeLog(params: {
  action: string;
  adminId: number | null | undefined;
  result: "success" | "failed";
  details?: string;
}) {
  try {
    const adminName = await resolveAdminName(params.adminId ?? 0);
    await db.insert(maintenanceLogTable).values({
      action: params.action,
      adminId: params.adminId && params.adminId > 0 ? params.adminId : null,
      adminName,
      result: params.result,
      details: params.details ?? null,
    });
  } catch {
    // Never let logging failures break the actual maintenance action.
  }
}

// ── GET /admin/maintenance/status ──────────────────────────────────────────
router.get("/admin/maintenance/status", authSA, async (_req: Request, res: Response) => {
  try {
    const state = await getState();
    const clients = getConnectedClientsCount();
    res.json({
      frontendVersion: readPkgVersion(FRONTEND_PKG),
      backendVersion: readPkgVersion(BACKEND_PKG),
      swVersion: state.swVersion,
      buildTimestamp: SERVER_STARTED_AT.toISOString(),
      lastDeploymentAt: state.lastDeploymentAt,
      connectedClients: clients,
    });
  } catch (err: any) {
    res.status(500).json({ error: "فشل تحميل حالة النظام" });
  }
});

// ── GET /admin/maintenance/logs ─────────────────────────────────────────────
router.get("/admin/maintenance/logs", authSA, async (_req: Request, res: Response) => {
  try {
    const logs = await db
      .select()
      .from(maintenanceLogTable)
      .orderBy(desc(maintenanceLogTable.createdAt))
      .limit(50);
    res.json({ logs });
  } catch {
    res.status(500).json({ error: "فشل تحميل سجل الصيانة" });
  }
});

// ── POST /admin/maintenance/deploy ──────────────────────────────────────────
// Publishes a new frontend version: bumps the shared service-worker version
// counter and broadcasts it to every connected client (admin panel + all
// customer/technician sessions) over the existing SSE channels. Each client's
// service-worker update-check listener (see use-sw-update.ts on the frontend)
// reacts by checking for a new SW, activating it, and reloading.
router.post("/admin/maintenance/deploy", authSA, async (req: Request, res: Response) => {
  const user = req.user!;
  try {
    const current = await getState();
    const newVersion = (current.swVersion || 1) + 1;
    const now = new Date();
    await db
      .update(maintenanceStateTable)
      .set({ swVersion: newVersion, lastDeploymentAt: now, updatedAt: now })
      .where(eq(maintenanceStateTable.id, 1));

    broadcastToAll("sw_update_available", { version: newVersion, deployedAt: now.toISOString() });

    await writeLog({
      action: "نشر تحديث للواجهة الأمامية (Frontend Update Published)",
      adminId: user.id,
      result: "success",
      details: `الإصدار الجديد لـ Service Worker: v${newVersion}`,
    });

    res.json({ success: true, swVersion: newVersion, lastDeploymentAt: now.toISOString() });
  } catch (err: any) {
    await writeLog({
      action: "نشر تحديث للواجهة الأمامية (Frontend Update Published)",
      adminId: user.id,
      result: "failed",
      details: err?.message,
    });
    res.status(500).json({ error: "فشل نشر التحديث" });
  }
});

// ── POST /admin/maintenance/log ─────────────────────────────────────────────
// Generic audit endpoint for maintenance actions that are inherently
// client-side (clearing browser Cache Storage / IndexedDB / React Query
// cache, forcing the service worker to skip-waiting, or reloading CMS &
// branding config in the client). The browser performs the real operation
// and then reports the outcome here so it shows up in the Maintenance Log.
const ALLOWED_ACTIONS = new Set([
  "clear_frontend_cache",
  "force_pwa_update",
  "reload_config",
]);

const ACTION_LABELS: Record<string, string> = {
  clear_frontend_cache: "مسح الكاش الأمامي (Frontend Cache Cleared)",
  force_pwa_update: "تحديث PWA إجباري (PWA Updated)",
  reload_config: "إعادة تحميل إعدادات النظام (Configuration Reloaded)",
};

router.post("/admin/maintenance/log", authSA, async (req: Request, res: Response) => {
  const user = req.user!;
  const { action, result, details } = req.body || {};
  if (!ALLOWED_ACTIONS.has(action)) {
    res.status(400).json({ error: "إجراء غير معروف" });
    return;
  }
  const normalizedResult = result === "failed" ? "failed" : "success";
  await writeLog({
    action: ACTION_LABELS[action] || action,
    adminId: user.id,
    result: normalizedResult,
    details,
  });
  res.json({ success: true });
});

export default router;
