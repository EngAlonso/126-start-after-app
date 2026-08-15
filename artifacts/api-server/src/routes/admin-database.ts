import { Router } from "express";
import { pool } from "@workspace/db";
import * as schema from "@workspace/db/schema";
import { getTableConfig } from "drizzle-orm/pg-core";
import { synchronizeSchema } from "../lib/bootstrap";
import { createRequire } from "module";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { authenticate, requireRole, requirePermission, logActivity } from "../middlewares/auth";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { getFilePath, UPLOADS_DIR } from "../lib/local-storage";

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = _require("adm-zip") as typeof import("adm-zip");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer = _require("multer") as typeof import("multer");

const router = Router();
// Super admin only — browse, overview, reset, full exports
const authSA = [authenticate, requireRole("super_admin")] as any[];
// Granular backup permissions — super_admin always passes, admins need explicit grant
const authBackupCreate   = [authenticate, requirePermission("backup.create")]   as any[];
const authBackupDownload = [authenticate, requirePermission("backup.download")] as any[];
const authBackupRestore  = [authenticate, requirePermission("backup.restore")]  as any[];
const authBackupDelete   = [authenticate, requirePermission("backup.delete")]   as any[];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// BACKUPS_DIR is configurable via env var so it works outside Replit.
// Default falls back to a "backups" directory relative to the process working
// directory (which is artifacts/api-server/ when started via pnpm, or wherever
// the operator sets CWD on a VPS).
const BACKUPS_DIR =
  process.env["BACKUPS_DIR"] ||
  path.resolve(process.cwd(), "backups");
const MANIFEST_FILE = path.join(BACKUPS_DIR, "manifest.json");

const ALL_TABLES = [
  "governorates", "services", "cms_settings", "page_backgrounds", "users", "areas",
  "technician_profiles", "admin_permissions", "technician_services",
  "technician_areas", "service_requests", "offers", "messages", "ratings",
  "point_transactions", "price_adjustments", "support_tickets", "ticket_replies",
  "notifications", "banners", "commission_ranges", "activity_logs", "audit_trail",
  "push_tokens",
  // Loyalty system
  "customer_wallets", "coin_transactions", "coin_redemptions",
  "credit_settlement_batches", "platform_credits", "referrals", "campaigns",
  "campaign_distributions", "campaign_execution_logs",
  // Intro screens
  "intro_screens",
  // Invoice system
  "invoices",
  "invoice_activity_logs",
  // Technician modification requests
  "tech_service_modification_requests",
];

interface BackupMeta {
  id: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
  type: string;
  tableCount: number;
  totalRecords: number;
  totalUploadFiles: number;
  totalUploadsBytes: number;
  appVersion: string;
}

async function ensureBackupsDir() {
  try { await fsp.mkdir(BACKUPS_DIR, { recursive: true }); } catch {}
}

function walkUploads(dir: string, base: string): { relPath: string; absPath: string; size: number }[] {
  const results: { relPath: string; absPath: string; size: number }[] = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      const relPath = path.relative(base, absPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        results.push(...walkUploads(absPath, base));
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(absPath);
          results.push({ relPath, absPath, size: stats.size });
        } catch {}
      }
    }
  } catch {}
  return results;
}

async function readManifest(): Promise<{ backups: BackupMeta[] }> {
  try {
    const data = await fsp.readFile(MANIFEST_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { backups: [] };
  }
}

async function writeManifest(manifest: { backups: BackupMeta[] }) {
  await fsp.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

async function createBackupFile(): Promise<{ meta: BackupMeta; filePath: string }> {
  await ensureBackupsDir();
  const timestamp = Date.now();
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `backup_${dateStr}.zip`;
  const filePath = path.join(BACKUPS_DIR, fileName);

  // Read app version
  let appVersion = "0.0.0";
  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    appVersion = pkg.version || "0.0.0";
  } catch {}

  // Export database tables
  const tableData: Record<string, any[]> = {};
  let totalRecords = 0;
  for (const table of ALL_TABLES) {
    try {
      const rows = await pool.query(`SELECT * FROM "${table}" ORDER BY 1 ASC`);
      tableData[table] = rows.rows;
      totalRecords += rows.rows.length;
    } catch { tableData[table] = []; }
  }

  // Scan uploads directory
  const uploadFiles = walkUploads(UPLOADS_DIR, UPLOADS_DIR);
  const totalUploadsBytes = uploadFiles.reduce((s, f) => s + f.size, 0);

  // Build ZIP
  const zip = new AdmZip();

  // Manifest
  zip.addFile("manifest.json", Buffer.from(JSON.stringify({
    version: 2,
    createdAt: new Date().toISOString(),
    appVersion,
    tables: ALL_TABLES,
    totalRecords,
    totalUploadFiles: uploadFiles.length,
    totalUploadsBytes,
  }, null, 2)));

  // Database JSON (at root for backward-compat)
  for (const [table, rows] of Object.entries(tableData)) {
    zip.addFile(`${table}.json`, Buffer.from(JSON.stringify(rows, null, 2)));
  }

  // Uploads — stored under uploads/ prefix preserving full directory structure
  for (const { relPath, absPath } of uploadFiles) {
    try {
      const buffer = fs.readFileSync(absPath);
      zip.addFile(`uploads/${relPath}`, buffer);
    } catch {} // skip unreadable files silently
  }

  await fsp.writeFile(filePath, zip.toBuffer());

  const stats = await fsp.stat(filePath);
  const meta: BackupMeta = {
    id: String(timestamp),
    fileName,
    createdAt: new Date().toISOString(),
    sizeBytes: stats.size,
    type: "full",
    tableCount: ALL_TABLES.length,
    totalRecords,
    totalUploadFiles: uploadFiles.length,
    totalUploadsBytes,
    appVersion,
  };

  const manifest = await readManifest();
  manifest.backups.unshift(meta);
  await writeManifest(manifest);
  return { meta, filePath };
}

// ─── BACKUP ──────────────────────────────────────────────────────────────────

router.post("/admin/db/backup", ...authBackupCreate, async (_req, res) => {
  try {
    const { meta } = await createBackupFile();
    return res.json(meta);
  } catch (err) {
    console.error("Backup error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء إنشاء النسخة الاحتياطية" });
  }
});

router.get("/admin/db/backups", ...authBackupDownload, async (_req, res) => {
  try {
    const manifest = await readManifest();
    return res.json(manifest.backups);
  } catch {
    return res.json([]);
  }
});

router.get("/admin/db/backups/:id/download", ...authBackupDownload, async (req, res) => {
  try {
    const manifest = await readManifest();
    const meta = manifest.backups.find(b => b.id === req.params["id"]);
    if (!meta) return res.status(404).json({ error: "النسخة الاحتياطية غير موجودة" });
    const filePath = path.join(BACKUPS_DIR, meta.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "الملف غير موجود على القرص" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${meta.fileName}"`);
    fs.createReadStream(filePath).pipe(res);
    return;
  } catch {
    return res.status(500).json({ error: "حدث خطأ في التنزيل" });
  }
});

router.delete("/admin/db/backups/:id", ...authBackupDelete, async (req, res) => {
  try {
    const manifest = await readManifest();
    const idx = manifest.backups.findIndex(b => b.id === req.params["id"]);
    if (idx === -1) return res.status(404).json({ error: "النسخة غير موجودة" });
    const meta = manifest.backups[idx];
    const filePath = path.join(BACKUPS_DIR, meta.fileName);
    try { await fsp.unlink(filePath); } catch {}
    manifest.backups.splice(idx, 1);
    await writeManifest(manifest);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الحذف" });
  }
});

// ─── RESTORE ─────────────────────────────────────────────────────────────────

router.post("/admin/db/restore/validate", ...authBackupRestore, upload.single("backup"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم رفع ملف" });
    const zip = new AdmZip(req.file.buffer);
    const manifestEntry = zip.getEntry("manifest.json");
    if (!manifestEntry) return res.status(400).json({ error: "الملف غير صالح — لا يوجد manifest.json" });
    const manifest = JSON.parse(manifestEntry.getData().toString("utf-8"));
    if (!manifest.version) return res.status(400).json({ error: "تنسيق الملف غير معروف" });
    const summary: { table: string; count: number }[] = [];
    for (const table of ALL_TABLES) {
      const entry = zip.getEntry(`${table}.json`);
      if (entry) {
        try {
          const rows = JSON.parse(entry.getData().toString("utf-8"));
          summary.push({ table, count: Array.isArray(rows) ? rows.length : 0 });
        } catch { summary.push({ table, count: 0 }); }
      }
    }
    const totalRecords = summary.reduce((s, x) => s + x.count, 0);
    const uploadEntries = zip.getEntries().filter((e) => e.entryName.startsWith("uploads/") && !e.isDirectory);
    return res.json({
      valid: true,
      backupDate: manifest.createdAt,
      appVersion: manifest.appVersion || null,
      summary,
      totalRecords,
      totalUploadFiles: uploadEntries.length,
      totalUploadsBytes: manifest.totalUploadsBytes || 0,
    });
  } catch {
    return res.status(400).json({ error: "الملف تالف أو غير صالح" });
  }
});

// Dependency-ordered restore sequence — each table must come after all tables it references via FK
const RESTORE_ORDER = [
  "governorates",       // no deps
  "services",           // no deps
  "cms_settings",       // no deps
  "page_backgrounds",   // no deps, slug PK
  "banners",            // no deps
  "commission_ranges",  // no deps
  "users",              // no deps
  "areas",              // → governorates
  "technician_profiles",// → users, areas
  "admin_permissions",  // → users
  "technician_services",// → technician_profiles, services
  "technician_areas",   // → technician_profiles, areas
  "service_requests",   // → users, areas, services
  "price_adjustments",  // → service_requests
  "offers",             // → service_requests, technician_profiles
  "messages",           // → service_requests, users
  "ratings",            // → service_requests, users
  "point_transactions", // → users, technician_profiles
  "support_tickets",             // → users
  "ticket_replies",              // → support_tickets, users
  "notifications",               // → users
  "push_tokens",                 // → users
  "activity_logs",               // → users
  "audit_trail",                 // → users
  // ── Loyalty system ──────────────────────────────────
  "customer_wallets",            // → users
  "coin_transactions",           // → customer_wallets, users, service_requests
  "coin_redemptions",            // → service_requests, users
  "credit_settlement_batches",   // → users
  "platform_credits",            // → service_requests, users, credit_settlement_batches
  "referrals",                   // → users, service_requests
  "campaigns",                   // → users
  "campaign_execution_logs",     // → campaigns, users
  "campaign_distributions",      // → campaigns, customer_wallets, users, campaign_execution_logs
  // ── Intro screens ──────────────────────────────────
  "intro_screens",               // no deps
  // ── Invoice system ─────────────────────────────────
  "invoices",                    // → service_requests, users
  "invoice_activity_logs",       // → invoices, users
  // ── Technician modification requests ───────────────
  "tech_service_modification_requests", // → users
];

const RESTORE_SCHEMA_TABLES = [...new Set([...RESTORE_ORDER, ...ALL_TABLES])];

interface RestoreSchemaCheck {
  table: string;
  missingColumns: string[];
}

function getRequiredSchemaColumns(): Map<string, Set<string>> {
  const required = new Map<string, Set<string>>();
  for (const table of Object.values(schema)) {
    if (!table || typeof table !== "object") continue;
    try {
      const config = getTableConfig(table as any);
      if (!config?.name || !config.columns?.length) continue;
      required.set(
        config.name,
        new Set(config.columns.map((column) => column.name)),
      );
    } catch {
      // Non-table exports from the schema module are expected here.
    }
  }
  return required;
}

async function findMissingRestoreSchema(): Promise<RestoreSchemaCheck[]> {
  const requiredColumns = getRequiredSchemaColumns();
  const checks: RestoreSchemaCheck[] = [];

  for (const table of RESTORE_SCHEMA_TABLES) {
    const tableResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const actualColumns = new Set<string>(
      tableResult.rows.map((row: { column_name: string }) => row.column_name),
    );
    const missingColumns = [...(requiredColumns.get(table) ?? [])].filter(
      (column) => !actualColumns.has(column),
    );

    if (actualColumns.size === 0 || missingColumns.length > 0) {
      checks.push({
        table,
        missingColumns:
          actualColumns.size === 0
            ? [...(requiredColumns.get(table) ?? [])]
            : missingColumns,
      });
    }
  }

  return checks;
}

async function synchronizeAndVerifyRestoreSchema(): Promise<{
  success: boolean;
  errors: string[];
}> {
  const sync = await synchronizeSchema();
  const errors = [...sync.errors];

  let missing: RestoreSchemaCheck[] = [];
  try {
    missing = await findMissingRestoreSchema();
  } catch (err) {
    errors.push(`Schema verification failed: ${fmtPgErr(err)}`);
  }

  if (missing.length > 0) {
    errors.push(
      ...missing.map(({ table, missingColumns }) =>
        `${table}: missing ${missingColumns.length > 0 ? missingColumns.join(", ") : "table"}`,
      ),
    );
  }

  return { success: errors.length === 0, errors };
}

// ── Helper: format a pg error with full detail ────────────────────────────────
function fmtPgErr(err: unknown, label?: string): string {
  const e = err as any;
  const parts: string[] = [];
  if (label) parts.push(`[${label}]`);
  parts.push(`message: ${e?.message ?? String(err)}`);
  if (e?.code)       parts.push(`SQLSTATE: ${e.code}`);
  if (e?.constraint) parts.push(`constraint: ${e.constraint}`);
  if (e?.detail)     parts.push(`detail: ${e.detail}`);
  if (e?.hint)       parts.push(`hint: ${e.hint}`);
  if (e?.table)      parts.push(`table: ${e.table}`);
  if (e?.column)     parts.push(`column: ${e.column}`);
  if (e?.schema)     parts.push(`schema: ${e.schema}`);
  if (e?.routine)    parts.push(`routine: ${e.routine}`);
  return parts.join(" | ");
}

// A full restore can replace users, roles, and permission sets in one
// transaction. It is therefore an owner-level operation, not something a
// regular employee may use to bypass the staff-management authorization rules.
router.post("/admin/db/restore/apply", ...authSA, upload.single("backup"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم رفع ملف" });
  const { confirm } = req.body as any;
  if (confirm !== "أنا متأكد") return res.status(400).json({ error: "عبارة التأكيد غير صحيحة" });

  const step = (msg: string) => console.log(`[RESTORE STEP] ${msg}`);
  const fail = (msg: string, err?: unknown) => {
    if (err !== undefined) console.error(`[RESTORE FAIL] ${msg}`, fmtPgErr(err));
    else console.error(`[RESTORE FAIL] ${msg}`);
  };

  step(`Starting restore — file size: ${req.file.size} bytes, mime: ${req.file.mimetype}`);

  // ── Step 1: Synchronize and verify schema before any destructive work ─────
  step("Synchronizing and verifying database schema before restore...");
  const schemaCheck = await synchronizeAndVerifyRestoreSchema();
  if (!schemaCheck.success) {
    fail("Schema synchronization/preflight failed — restore aborted before safety backup and DELETE");
    return res.status(409).json({
      error: "لا يمكن بدء الاستعادة — مخطط قاعدة البيانات غير مكتمل",
      detail: schemaCheck.errors.join(" | "),
      schemaReady: false,
    });
  }
  step("Database schema ready for restore");

  // ── Step 2: Safety backup ─────────────────────────────────────────────────
  step("Creating safety backup before wiping data...");
  try {
    await createBackupFile();
    step("Safety backup created OK");
  } catch (backupErr) {
    fail("Safety backup failed (continuing anyway)", backupErr);
  }

  // ── Step 3: Open ZIP ──────────────────────────────────────────────────────
  step("Opening ZIP file...");
  let zip: InstanceType<typeof AdmZip>;
  try {
    zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    step(`ZIP opened OK — ${entries.length} entries inside`);
  } catch (zipErr) {
    fail("Failed to open ZIP", zipErr);
    return res.status(400).json({
      error: "الملف تالف أو غير صالح — ZIP open failed",
      detail: fmtPgErr(zipErr, "zip"),
    });
  }

  // ── Step 4: Read manifest ─────────────────────────────────────────────────
  step("Reading manifest.json...");
  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) {
    fail("No manifest.json in ZIP");
    return res.status(400).json({ error: "الملف لا يحتوي على manifest.json" });
  }
  let zipManifest: any;
  try {
    zipManifest = JSON.parse(manifestEntry.getData().toString("utf-8"));
    step(`Manifest OK — version: ${zipManifest.version}, createdAt: ${zipManifest.createdAt}, tables: ${zipManifest.tables?.length ?? "?"}`);
  } catch (mErr) {
    fail("Failed to parse manifest.json", mErr);
    return res.status(400).json({ error: "manifest.json تالف", detail: fmtPgErr(mErr, "manifest") });
  }

  // ── Step 5: Pre-parse all table JSON ─────────────────────────────────────
  step("Validating backup — pre-parsing all table JSON files...");
  const tableRows: Record<string, any[]> = {};
  for (const table of RESTORE_ORDER) {
    const entry = zip.getEntry(`${table}.json`);
    if (!entry) {
      step(`  [${table}] Not found in ZIP — will be empty`);
      tableRows[table] = [];
      continue;
    }
    let raw: string;
    try {
      raw = entry.getData().toString("utf-8");
    } catch (readErr) {
      fail(`  [${table}] Failed to decompress ZIP entry`, readErr);
      tableRows[table] = [];
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      tableRows[table] = Array.isArray(parsed) ? parsed : [];
      step(`  [${table}] Parsed ${tableRows[table].length} records`);
    } catch (parseErr) {
      const pe = parseErr as any;
      fail(`  [${table}] JSON parse error — message: ${pe?.message}, file: ${table}.json`, parseErr);
      tableRows[table] = [];
    }
  }
  step("Pre-parse complete");

  const report: {
    table: string;
    found: number;
    inserted: number;
    skipped: number;
    failed: number;
    errors: string[];
  }[] = [];

  // ── Step 6: Acquire DB client & begin transaction ─────────────────────────
  step("Acquiring DB connection...");
  const client = await pool.connect();
  step("DB connection acquired");

  try {
    step("BEGIN transaction");
    await client.query("BEGIN");

    // ── Step 7: Wipe existing data (reverse FK order) ─────────────────────
    step("Clearing existing data (reverse FK order)...");
    for (const table of [...RESTORE_ORDER].reverse()) {
      try {
        const del = await client.query(`DELETE FROM "${table}"`);
        step(`  Cleared "${table}" — ${del.rowCount} rows deleted`);
      } catch (delErr) {
        fail(`  DELETE FROM "${table}" FAILED`, delErr);
        throw new Error(`Failed to clear table "${table}": ${fmtPgErr(delErr)}`);
      }
    }
    step("All tables cleared OK");

    // ── Step 8: Reset sequences ───────────────────────────────────────────
    // Safe detection: query information_schema.columns first. If the column
    // does not exist the query returns 0 rows — no exception is thrown and
    // the transaction is never aborted. pg_get_serial_sequence() is called
    // inside the SELECT list so it returns NULL (not throws) when the column
    // exists but owns no sequence. setval() is only called when seq IS NOT NULL.
    step("Resetting sequences to 1...");
    for (const table of RESTORE_ORDER) {
      const seqRes = await client.query(
        `SELECT pg_get_serial_sequence(quote_ident($1), 'id') AS seq
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'
         LIMIT 1`,
        [table]
      );
      const seq: string | null = seqRes.rows[0]?.seq ?? null;
      if (seq) {
        await client.query(`SELECT setval($1, 1, false)`, [seq]);
        step(`  "${table}" sequence reset to 1`);
      } else {
        step(`  "${table}" has no serial id sequence — skipping`);
      }
    }
    step("Sequences reset OK");

    let totalInserted = 0;
    let totalFailed = 0;

    // ── Step 9: Insert rows in FK order ──────────────────────────────────
    for (const table of RESTORE_ORDER) {
      const rows = tableRows[table] ?? [];
      const tableReport = { table, found: rows.length, inserted: 0, skipped: 0, failed: 0, errors: [] as string[] };

      if (rows.length === 0) {
        step(`Restoring "${table}" — 0 records, skipping`);
        report.push(tableReport);
        continue;
      }

      step(`Restoring "${table}" — ${rows.length} records...`);

      // ── Schema-aware column filtering ─────────────────────────────────────
      // Fetch the actual columns that exist in the DB right now.  This makes
      // restores backward- and forward-compatible:
      //   • Old backup, new schema  — backup row lacks new columns → they are
      //     omitted from INSERT and PostgreSQL applies their DEFAULT / NULL.
      //   • New backup, old schema  — backup row has extra columns that don't
      //     exist yet → they are stripped so the INSERT doesn't error out.
      const dbColsRes = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      const dbColSet = new Set<string>(dbColsRes.rows.map((r: any) => r.column_name as string));

      if (dbColSet.size === 0) {
        step(`  "${table}" has no columns in DB — skipping`);
        report.push(tableReport);
        continue;
      }

      const sp = `sp_${table.replace(/[^a-z0-9]/g, "_")}`;
      await client.query(`SAVEPOINT ${sp}`);

      let tableFatalError = false;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Only include columns that (a) exist in the backup row and (b) exist
        // in the current DB schema.  Columns in the backup but not in the DB
        // are silently dropped; columns in the DB but not in the backup are
        // omitted, letting PostgreSQL supply their DEFAULT or NULL.
        const cols = Object.keys(row).filter(c => row[c] !== undefined && dbColSet.has(c));
        if (cols.length === 0) {
          tableReport.skipped++;
          continue;
        }
        const vals = cols.map((_, idx) => `$${idx + 1}`);
        const values = cols.map(c => row[c]);
        const sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT DO NOTHING`;

        const rowSp = `${sp}_r${i}`;
        await client.query(`SAVEPOINT ${rowSp}`);
        try {
          const result = await client.query(sql, values);
          await client.query(`RELEASE SAVEPOINT ${rowSp}`);
          if (result.rowCount && result.rowCount > 0) {
            tableReport.inserted++;
          } else {
            tableReport.skipped++;
          }
        } catch (insertErr) {
          await client.query(`ROLLBACK TO SAVEPOINT ${rowSp}`);
          await client.query(`RELEASE SAVEPOINT ${rowSp}`);

          const detail = fmtPgErr(insertErr, table);
          // Log full detail for every row (not capped) so we see the root cause
          console.error(`[RESTORE ROW FAIL] table="${table}" row=${i} id=${row?.id ?? "?"} | ${detail}`);
          console.error(`[RESTORE ROW FAIL]   columns: ${cols.join(", ")}`);
          if (i === 0) {
            console.error(`[RESTORE ROW FAIL]   First row sample: ${JSON.stringify(row).slice(0, 500)}`);
          }

          tableReport.failed++;
          tableReport.errors.push(`Row ${i} (id=${row?.id ?? "?"}): ${detail}`);
          totalFailed++;

          if (tableReport.failed >= 5 && tableReport.inserted === 0 && tableReport.failed === i + 1 - tableReport.skipped) {
            fail(`"${table}" — all ${tableReport.failed} rows failing consecutively, aborting table`);
            tableReport.errors.push(`... table aborted after ${tableReport.failed} consecutive failures`);
            tableFatalError = true;
            break;
          }
        }
      }

      if (tableFatalError) {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        tableReport.inserted = 0;
        tableReport.skipped = 0;
        step(`"${table}" rolled back — schema mismatch, table skipped entirely`);
      }
      await client.query(`RELEASE SAVEPOINT ${sp}`);

      // Same safe detection: only call setval if a sequence is confirmed to exist.
      // This query returns 0 rows (no throw) when the table has no 'id' column,
      // and returns seq=NULL (no throw) when 'id' exists but owns no sequence.
      {
        const advRes = await client.query(
          `SELECT pg_get_serial_sequence(quote_ident($1), 'id') AS seq
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'
           LIMIT 1`,
          [table]
        );
        const advSeq: string | null = advRes.rows[0]?.seq ?? null;
        if (advSeq) {
          await client.query(
            `SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
            [advSeq]
          );
        }
      }

      totalInserted += tableReport.inserted;
      step(`"${table}" done — found:${tableReport.found} inserted:${tableReport.inserted} skipped:${tableReport.skipped} failed:${tableReport.failed}`);
      report.push(tableReport);
    }

    // ── Step 10: COMMIT ───────────────────────────────────────────────────
    step("COMMIT...");
    await client.query("COMMIT");
    step(`COMMIT OK — total inserted: ${totalInserted}, total failed: ${totalFailed}`);

    const tablesRestored = report.filter(r => r.inserted > 0).length;
    const success = totalInserted > 0 || totalFailed === 0;

    // ── Step 11: Restore upload files ─────────────────────────────────────
    let filesRestored = 0;
    let filesFailed = 0;
    const uploadEntries = zip.getEntries().filter(
      (e) => e.entryName.startsWith("uploads/") && !e.isDirectory
    );
    step(`Restoring ${uploadEntries.length} upload file(s) to disk...`);
    for (const entry of uploadEntries) {
      const relPath = entry.entryName.slice("uploads/".length);
      const absPath = path.resolve(UPLOADS_DIR, relPath);
      // Guard against Zip Slip / path traversal: the resolved destination must
      // remain inside UPLOADS_DIR. A malicious entry name like
      // "uploads/../../etc/cron.d/evil" would otherwise escape the directory.
      const uploadsRoot = path.resolve(UPLOADS_DIR);
      if (!absPath.startsWith(uploadsRoot + path.sep) && absPath !== uploadsRoot) {
        console.error(`[RESTORE FILE SKIP] Path traversal attempt blocked: "${relPath}"`);
        filesFailed++;
        continue;
      }
      const dir = path.dirname(absPath);
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(absPath, entry.getData());
        filesRestored++;
      } catch (fileErr) {
        const fe = fileErr as any;
        console.error(`[RESTORE FILE FAIL] filename="${relPath}" dest="${absPath}" error="${fe?.message}" code="${fe?.code}"`);
        filesFailed++;
      }
    }
    step(`Uploads done — restored: ${filesRestored}, failed: ${filesFailed}`);
    step("=== RESTORE COMPLETE ===");

    return res.json({
      success,
      tablesRestored,
      totalInserted,
      totalFailed,
      report,
      filesRestored,
      filesFailed,
      totalUploadFiles: uploadEntries.length,
    });

  } catch (err) {
    const detail = fmtPgErr(err);
    fail(`Fatal error — rolling back. ${detail}`);
    try { await client.query("ROLLBACK"); step("ROLLBACK OK"); } catch (rbErr) { fail("ROLLBACK itself failed", rbErr); }
    return res.status(500).json({
      error: "حدث خطأ أثناء الاستعادة",
      detail,
      report,
    });
  } finally {
    client.release();
    step("DB connection released");
  }
});

// ─── DB OVERVIEW ─────────────────────────────────────────────────────────────

router.get("/admin/db/overview", ...authSA, async (_req, res) => {
  try {
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;
    for (const table of ALL_TABLES) {
      try {
        const r = await pool.query(`SELECT COUNT(*)::int as cnt FROM "${table}"`);
        tableCounts[table] = r.rows[0].cnt;
        totalRecords += r.rows[0].cnt;
      } catch { tableCounts[table] = 0; }
    }
    const manifest = await readManifest();
    return res.json({ tableCount: ALL_TABLES.length, totalRecords, tableCounts, lastBackup: manifest.backups[0]?.createdAt || null });
  } catch {
    return res.status(500).json({ error: "حدث خطأ" });
  }
});

router.get("/admin/db/tables/:name", ...authSA, async (req, res) => {
  const tableName = req.params["name"] as string;
  if (!ALL_TABLES.includes(tableName)) return res.status(400).json({ error: "جدول غير صالح" });
  const page = Math.max(1, parseInt(req.query["page"] as string) || 1);
  const limit = Math.min(100, parseInt(req.query["limit"] as string) || 50);
  const offset = (page - 1) * limit;
  try {
    const colsRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`,
      [tableName]
    );
    const columns = colsRes.rows.map(r => r.column_name);
    const countRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM "${tableName}"`);
    const total = countRes.rows[0].cnt;
    const rowsRes = await pool.query(`SELECT * FROM "${tableName}" ORDER BY id DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return res.json({ columns, rows: rowsRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في استرجاع البيانات" });
  }
});

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────

router.get("/admin/db/export/csv/:table", ...authSA, async (req, res) => {
  const tableName = req.params["table"] as string;
  if (!ALL_TABLES.includes(tableName)) return res.status(400).json({ error: "جدول غير صالح" });
  try {
    const rowsRes = await pool.query(`SELECT * FROM "${tableName}" ORDER BY id ASC`);
    if (rowsRes.rows.length === 0) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}.csv"`);
      return res.send("\uFEFF");
    }
    const columns = Object.keys(rowsRes.rows[0]);
    const escape = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [columns.join(","), ...rowsRes.rows.map(row => columns.map(c => escape(row[c])).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${tableName}.csv"`);
    return res.send("\uFEFF" + lines.join("\r\n"));
  } catch {
    return res.status(500).json({ error: "حدث خطأ في التصدير" });
  }
});

// ─── XLSX REPORTS ─────────────────────────────────────────────────────────────

const AR_TABLE_NAMES: Record<string, string> = {
  users: "المستخدمون", technician_profiles: "ملفات الفنيين", services: "الخدمات",
  governorates: "المحافظات", areas: "المناطق", service_requests: "طلبات الخدمة",
  offers: "العروض (الطلبات)", messages: "الرسائل", ratings: "التقييمات",
  point_transactions: "معاملات النقاط", commission_ranges: "نطاقات العمولة",
  support_tickets: "تذاكر الدعم", notifications: "الإشعارات", banners: "البانرات",
  cms_settings: "إعدادات CMS", activity_logs: "سجل الأنشطة", audit_trail: "مسار التدقيق",
  price_adjustments: "تعديلات السعر", technician_services: "خدمات الفنيين",
  technician_areas: "مناطق الفنيين", admin_permissions: "صلاحيات الإدارة",
  ticket_replies: "ردود التذاكر",
};

router.get("/admin/db/export/xlsx/technicians", ...authSA, async (_req, res) => {
  try {
    const techData = await pool.query(`
      SELECT u.id, u.full_name, u.mobile, u.status, u.created_at,
             tp.approval_status, tp.personal_photo,
             tp.national_id_front, tp.national_id_back,
             g.name_ar as governorate,
             STRING_AGG(DISTINCT s.name_ar, '، ') as services,
             STRING_AGG(DISTINCT a2.name_ar, ' - ') as all_areas
      FROM users u
      JOIN technician_profiles tp ON tp.user_id = u.id
      LEFT JOIN areas a_primary ON a_primary.id = tp.primary_area_id
      LEFT JOIN governorates g ON g.id = a_primary.governorate_id
      LEFT JOIN technician_services ts ON ts.technician_id = tp.id
      LEFT JOIN services s ON s.id = ts.service_id
      LEFT JOIN technician_areas ta ON ta.technician_id = tp.id
      LEFT JOIN areas a2 ON a2.id = ta.area_id
      WHERE u.role = 'technician'
      GROUP BY u.id, u.full_name, u.mobile, u.status, u.created_at,
               tp.approval_status, tp.personal_photo,
               tp.national_id_front, tp.national_id_back, g.name_ar
      ORDER BY u.created_at DESC
    `);

    const STATUS_AR: Record<string, string> = { active: "نشط", pending: "معلق", suspended: "موقوف", banned: "محظور", rejected: "مرفوض" };
    const APPROVAL_AR: Record<string, string> = { pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض" };
    const rows = techData.rows;

    async function fetchImg(url: string | null): Promise<{ buffer: Buffer; extension: string } | null> {
      if (!url) return null;
      try {
        if (url.startsWith("/uploads/")) {
          const fp = getFilePath(url);
          if (!fp) return null;
          const buffer = Buffer.from(await fsp.readFile(fp));
          const ext = path.extname(fp).slice(1).toLowerCase();
          return { buffer, extension: ext === "jpg" ? "jpeg" : (ext || "jpeg") };
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) return null;
        const buffer = Buffer.from(await resp.arrayBuffer());
        const ct = resp.headers.get("content-type") || "";
        const extension = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : "jpeg";
        return { buffer, extension };
      } catch { return null; }
    }

    // Fetch all images in parallel
    const imageResults = await Promise.allSettled(
      rows.flatMap((t: any) => [
        fetchImg(t.personal_photo),
        fetchImg(t.national_id_front),
        fetchImg(t.national_id_back),
      ])
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = "Fnashha Admin";
    wb.created = new Date();

    // Sheet 1: Summary
    const summaryMap = new Map<string, any>();
    for (const t of rows) {
      const key = `${t.services || "—"}__${t.governorate || "—"}__${t.all_areas || "—"}`;
      if (summaryMap.has(key)) summaryMap.get(key)["عدد الفنيين"]++;
      else summaryMap.set(key, { "الخدمة": t.services || "غير محدد", "المحافظة": t.governorate || "غير محدد", "مناطق الخدمة": t.all_areas || "غير محدد", "عدد الفنيين": 1 });
    }
    const ws1 = wb.addWorksheet("ملخص الفنيين");
    ws1.views = [{ rightToLeft: true }];
    ws1.columns = [
      { header: "الخدمة", key: "الخدمة", width: 25 },
      { header: "المحافظة", key: "المحافظة", width: 18 },
      { header: "مناطق الخدمة", key: "مناطق الخدمة", width: 35 },
      { header: "عدد الفنيين", key: "عدد الفنيين", width: 14 },
    ];
    ws1.getRow(1).font = { bold: true };
    ws1.getRow(1).height = 22;
    for (const row of summaryMap.values()) ws1.addRow(row);

    // Sheet 2: Full data with embedded thumbnails
    const ws2 = wb.addWorksheet("بيانات الفنيين");
    ws2.views = [{ rightToLeft: true }];
    ws2.columns = [
      { header: "م", key: "id", width: 8 },
      { header: "الاسم الكامل", key: "name", width: 22 },
      { header: "رقم الهاتف", key: "phone", width: 16 },
      { header: "المحافظة", key: "gov", width: 16 },
      { header: "مناطق الخدمة", key: "areas", width: 30 },
      { header: "الخدمات", key: "services", width: 28 },
      { header: "حالة الحساب", key: "status", width: 14 },
      { header: "حالة الاعتماد", key: "approval", width: 16 },
      { header: "تاريخ التسجيل", key: "reg_date", width: 16 },
      { header: "الصورة الشخصية", key: "photo", width: 16 },
      { header: "صورة البطاقة (الوجه)", key: "id_front", width: 20 },
      { header: "صورة البطاقة (الخلف)", key: "id_back", width: 20 },
    ];
    const hdrRow = ws2.getRow(1);
    hdrRow.font = { bold: true };
    hdrRow.height = 24;
    hdrRow.eachCell((cell) => { cell.alignment = { vertical: "middle", horizontal: "center" }; });

    const THUMB = 100;
    const ROW_PTS = 80;
    const IMG_COLS = [10, 11, 12]; // 1-based column indices for photo, id_front, id_back

    for (let i = 0; i < rows.length; i++) {
      const t = rows[i];
      const rowNum = i + 2;
      const imgOffset = i * 3;

      const row = ws2.addRow({
        id: t.id,
        name: t.full_name,
        phone: t.mobile,
        gov: t.governorate || "—",
        areas: t.all_areas || "—",
        services: t.services || "—",
        status: STATUS_AR[t.status] || t.status,
        approval: APPROVAL_AR[t.approval_status] || t.approval_status,
        reg_date: new Date(t.created_at).toLocaleDateString("ar-EG"),
        photo: "",
        id_front: "",
        id_back: "",
      });
      row.height = ROW_PTS;

      for (let c = 0; c < 9; c++) {
        row.getCell(c + 1).alignment = { vertical: "middle", wrapText: true };
      }

      const imgUrls: (string | null)[] = [t.personal_photo, t.national_id_front, t.national_id_back];
      for (let c = 0; c < 3; c++) {
        const colNum = IMG_COLS[c];
        const cell = row.getCell(colNum);
        const result = imageResults[imgOffset + c];

        if (result.status === "fulfilled" && result.value) {
          const { buffer, extension } = result.value;
          const validExt = ["jpeg", "png", "gif", "bmp"].includes(extension) ? extension : "jpeg";
          const imgId = wb.addImage({
            base64: Buffer.from(buffer).toString("base64"),
            extension: validExt as any,
          });
          ws2.addImage(imgId, {
            tl: { col: colNum - 1, row: rowNum - 1 } as any,
            ext: { width: THUMB, height: THUMB },
            editAs: "oneCell",
          });
          if (imgUrls[c]) {
            cell.value = { text: "فتح الصورة", hyperlink: imgUrls[c]! };
            cell.font = { color: { argb: "FF0066CC" }, underline: true, size: 9 };
          }
        } else {
          cell.value = "لا توجد صورة";
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.font = { color: { argb: "FF9CA3AF" }, size: 9 };
        }
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="technicians_report.xlsx"`);
    return res.send(buf as unknown as Buffer<ArrayBufferLike>);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "حدث خطأ في إنشاء التقرير" });
  }
});

router.get("/admin/db/export/xlsx/customers", ...authSA, async (_req, res) => {
  try {
    const custData = await pool.query(`
      SELECT u.id, u.full_name, u.mobile, u.email, u.status, u.created_at,
             COUNT(DISTINCT sr.id) as request_count,
             g.name_ar as last_governorate, a.name_ar as last_area
      FROM users u
      LEFT JOIN service_requests sr ON sr.customer_id = u.id
      LEFT JOIN (
        SELECT DISTINCT ON (customer_id) customer_id, governorate_id, area_id
        FROM service_requests ORDER BY customer_id, created_at DESC
      ) latest ON latest.customer_id = u.id
      LEFT JOIN governorates g ON g.id = latest.governorate_id
      LEFT JOIN areas a ON a.id = latest.area_id
      WHERE u.role = 'customer'
      GROUP BY u.id, u.full_name, u.mobile, u.email, u.status, u.created_at, g.name_ar, a.name_ar
      ORDER BY u.created_at DESC
    `);

    const wb = XLSX.utils.book_new();
    const summaryMap: Map<string, any> = new Map();
    for (const c of custData.rows) {
      const key = `${c.last_governorate || "غير محدد"}__${c.last_area || "غير محدد"}`;
      if (summaryMap.has(key)) summaryMap.get(key)["عدد العملاء"]++;
      else summaryMap.set(key, { "المحافظة": c.last_governorate || "غير محدد", "المنطقة": c.last_area || "غير محدد", "عدد العملاء": 1 });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...summaryMap.values()]), "ملخص العملاء");

    const details = custData.rows.map(c => ({
      "الاسم": c.full_name, "رقم الهاتف": c.mobile, "البريد الإلكتروني": c.email || "",
      "المحافظة الأخيرة": c.last_governorate || "—", "المنطقة الأخيرة": c.last_area || "—",
      "تاريخ التسجيل": new Date(c.created_at).toLocaleDateString("ar-EG"),
      "عدد الطلبات": Number(c.request_count) || 0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(details), "بيانات العملاء");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="customers_report.xlsx"`);
    return res.send(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "حدث خطأ في إنشاء التقرير" });
  }
});

router.get("/admin/db/export/xlsx/requests", ...authSA, async (_req, res) => {
  try {
    const data = await pool.query(`
      SELECT sr.id, sr.created_at, sr.status, sr.agreed_price,
             cu.full_name as customer_name, cu.mobile as customer_mobile,
             tu.full_name as technician_name,
             s.name_ar as service_name,
             g.name_ar as governorate, a.name_ar as area,
             sr.address, sr.description
      FROM service_requests sr
      JOIN users cu ON cu.id = sr.customer_id
      LEFT JOIN users tu ON tu.id = sr.selected_technician_id
      JOIN services s ON s.id = sr.service_id
      JOIN governorates g ON g.id = sr.governorate_id
      JOIN areas a ON a.id = sr.area_id
      ORDER BY sr.created_at DESC
    `);
    const STATUS_AR: Record<string, string> = {
      pending: "قيد الانتظار", offers_received: "تم استلام عروض", technician_selected: "تم اختيار فني",
      in_progress: "قيد التنفيذ", completed: "مكتمل",
      cancelled_by_customer: "ملغى من العميل", cancelled_by_technician: "ملغى من الفني",
      cancelled_by_admin: "ملغى من الإدارة", disputed: "متنازع عليه",
    };
    const rows = data.rows.map(r => ({
      "رقم الطلب": r.id, "التاريخ": new Date(r.created_at).toLocaleDateString("ar-EG"),
      "الحالة": STATUS_AR[r.status] || r.status, "العميل": r.customer_name,
      "هاتف العميل": r.customer_mobile, "الفني": r.technician_name || "—",
      "الخدمة": r.service_name, "المحافظة": r.governorate, "المنطقة": r.area,
      "السعر المتفق عليه": r.agreed_price || "—", "العنوان": r.address,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "طلبات الخدمة");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="requests_report.xlsx"`);
    return res.send(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "حدث خطأ" });
  }
});

router.get("/admin/db/export/xlsx/services", ...authSA, async (_req, res) => {
  try {
    const data = await pool.query(`
      SELECT s.id, s.name_ar, s.name, s.is_active,
             COUNT(DISTINCT sr.id) as request_count,
             COUNT(DISTINCT ts.technician_id) as technician_count
      FROM services s
      LEFT JOIN service_requests sr ON sr.service_id = s.id
      LEFT JOIN technician_services ts ON ts.service_id = s.id
      GROUP BY s.id ORDER BY s.display_order
    `);
    const rows = data.rows.map(r => ({
      "الخدمة": r.name_ar, "Service": r.name,
      "الحالة": r.is_active ? "مفعّلة" : "معطّلة",
      "عدد الطلبات": Number(r.request_count), "عدد الفنيين": Number(r.technician_count),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "الخدمات");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="services_report.xlsx"`);
    return res.send(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "حدث خطأ" });
  }
});

router.get("/admin/db/export/xlsx/full", ...authSA, async (_req, res) => {
  try {
    const wb = XLSX.utils.book_new();
    for (const table of ALL_TABLES) {
      try {
        const r = await pool.query(`SELECT * FROM "${table}" ORDER BY id ASC LIMIT 5000`);
        if (r.rows.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(r.rows);
          XLSX.utils.book_append_sheet(wb, sheet, (AR_TABLE_NAMES[table] || table).slice(0, 31));
        }
      } catch {}
    }
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="full_system_report.xlsx"`);
    return res.send(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "حدث خطأ في إنشاء التقرير الشامل" });
  }
});

// ─── RESET TOOLS ─────────────────────────────────────────────────────────────

router.post("/admin/db/reset", ...authSA, async (req, res) => {
  try {
    const { action, confirm } = req.body as any;
    if (confirm !== "أنا متأكد") return res.status(400).json({ error: "عبارة التأكيد غير صحيحة. اكتب: أنا متأكد" });
    const validActions = ["requests", "banners", "customers", "technicians", "full"];
    if (!validActions.includes(action)) return res.status(400).json({ error: "إجراء غير صالح" });

    // Safety backup before every reset
    try { await createBackupFile(); } catch {}

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      switch (action) {
        case "requests":
          await client.query(`TRUNCATE service_requests RESTART IDENTITY CASCADE`);
          break;
        case "banners":
          await client.query(`TRUNCATE banners RESTART IDENTITY`);
          break;
        case "customers":
          await client.query(`TRUNCATE service_requests RESTART IDENTITY CASCADE`);
          await client.query(`DELETE FROM users WHERE role = 'customer'`);
          break;
        case "technicians":
          await client.query(`DELETE FROM technician_profiles WHERE user_id IN (SELECT id FROM users WHERE role = 'technician')`);
          await client.query(`DELETE FROM users WHERE role = 'technician'`);
          break;
        case "full":
          await client.query(
            `TRUNCATE ${ALL_TABLES.filter(t => !["users", "admin_permissions"].includes(t)).map(t => `"${t}"`).join(",")} RESTART IDENTITY CASCADE`
          );
          await client.query(`DELETE FROM technician_profiles`);
          await client.query(`DELETE FROM admin_permissions WHERE admin_id IN (SELECT id FROM users WHERE role NOT IN ('admin','super_admin'))`);
          await client.query(`DELETE FROM users WHERE role NOT IN ('admin','super_admin')`);
          break;
      }
      await client.query("COMMIT");
      return res.json({ success: true, action });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Reset error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء التهيئة" });
  }
});

export default router;
