/**
 * Invoice Management Routes
 * Admin-only endpoints for generating and managing invoices.
 * One public endpoint for QR verification (no auth required).
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helper: Format invoice number ────────────────────────────────────────────
function padInvoiceNumber(seq: number, year: number): string {
  return `FNS-${year}-${String(seq).padStart(8, "0")}`;
}

// ─── Helper: Format mobile for WhatsApp ───────────────────────────────────────
export function formatPhoneForWhatsApp(mobile: string): string {
  let digits = mobile.replace(/\D/g, "");
  // Egyptian numbers: 01XXXXXXXXX (11 digits) → 201XXXXXXXXX
  if (digits.startsWith("0") && digits.length === 11) {
    digits = "20" + digits.slice(1);
  } else if (!digits.startsWith("20") && digits.length === 10 && digits.startsWith("1")) {
    digits = "20" + digits;
  }
  return digits;
}

// ─── Core: Generate invoices for a completed request ─────────────────────────
export async function generateInvoicesForRequest(
  requestId: number,
  createdBy: number | null
): Promise<any[]> {
  // Idempotency: if both invoices already exist, return them
  const existing = await pool.query<{ cnt: string }>(
    "SELECT COUNT(*) AS cnt FROM invoices WHERE request_id = $1",
    [requestId]
  );
  const cnt = parseInt(existing.rows[0]?.cnt ?? "0");
  if (cnt >= 2) {
    const rows = await pool.query(
      "SELECT * FROM invoices WHERE request_id = $1 ORDER BY invoice_type",
      [requestId]
    );
    return rows.rows;
  }

  // Gather all snapshot data in one query
  const dataRes = await pool.query<any>(
    `
    SELECT
      sr.id                                    AS request_id,
      sr.agreed_price,
      sr.customer_payable_amount,
      sr.has_discount,
      sr.created_at                            AS request_date,
      sr.updated_at                            AS completion_date,
      cu.full_name                             AS customer_name,
      cu.mobile                                AS customer_mobile,
      tu.full_name                             AS technician_name,
      tu.mobile                                AS technician_mobile,
      s.name                                   AS service_name,
      g.name                                   AS governorate_name,
      a.name                                   AS area_name,
      pt.amount                                AS points_deducted,
      (COALESCE(pt.balance_after,0) + COALESCE(pt.amount,0)) AS points_before,
      COALESCE(pt.balance_after,0)             AS points_after
    FROM service_requests sr
    JOIN users cu ON cu.id = sr.customer_id
    LEFT JOIN users tu ON tu.id = sr.selected_technician_id
    LEFT JOIN services s ON s.id = sr.service_id
    LEFT JOIN governorates g ON g.id = sr.governorate_id
    LEFT JOIN areas a ON a.id = sr.area_id
    LEFT JOIN (
      SELECT DISTINCT ON (request_id) *
      FROM point_transactions
      WHERE type = 'commission'
      ORDER BY request_id, id DESC
    ) pt ON pt.request_id = sr.id
    WHERE sr.id = $1
    `,
    [requestId]
  );

  if (dataRes.rows.length === 0) {
    throw new Error(`Request ${requestId} not found`);
  }
  const d = dataRes.rows[0];
  const year = new Date().getFullYear();
  const createdByVal = !createdBy || createdBy === 0 ? null : createdBy;

  // Get two sequential invoice numbers atomically
  const seqRes = await pool.query<{ n1: string; n2: string }>(
    "SELECT nextval('invoice_number_seq') AS n1, nextval('invoice_number_seq') AS n2"
  );
  const custNum  = padInvoiceNumber(parseInt(seqRes.rows[0].n1), year);
  const techNum  = padInvoiceNumber(parseInt(seqRes.rows[0].n2), year);

  const customerSnapshot = {
    invoiceNumber:         custNum,
    requestId:             d.request_id,
    customerName:          d.customer_name    ?? "",
    customerMobile:        d.customer_mobile  ?? "",
    technicianName:        d.technician_name  ?? "",
    serviceName:           d.service_name     ?? "",
    governorateName:       d.governorate_name ?? "",
    areaName:              d.area_name        ?? "",
    requestDate:           d.request_date,
    completionDate:        d.completion_date,
    paymentMethod:         "كاش",
    agreedPrice:           d.agreed_price,
    customerPayableAmount: d.customer_payable_amount,
  };

  const technicianSnapshot = {
    settlementNumber:  techNum,
    requestId:         d.request_id,
    technicianName:    d.technician_name  ?? "",
    technicianMobile:  d.technician_mobile ?? "",
    customerName:      d.customer_name    ?? "",
    serviceName:       d.service_name     ?? "",
    completionDate:    d.completion_date,
    paymentMethod:     "كاش",
    agreedPrice:       d.agreed_price,
    pointsBefore:      d.points_before    ?? 0,
    pointsDeducted:    d.points_deducted  ?? 0,
    pointsAfter:       d.points_after     ?? 0,
  };

  // Insert both invoices
  await pool.query(
    `INSERT INTO invoices
       (invoice_number, request_id, invoice_type, status, snapshot_data, created_by, created_at, updated_at)
     VALUES
       ($1, $2, 'customer',    'active', $3, $5, NOW(), NOW()),
       ($4, $2, 'technician',  'active', $6, $5, NOW(), NOW())`,
    [
      custNum,
      requestId,
      JSON.stringify(customerSnapshot),
      techNum,
      createdByVal,
      JSON.stringify(technicianSnapshot),
    ]
  );

  // Activity log: created
  await pool.query(
    `INSERT INTO invoice_activity_logs
       (invoice_id, action, performed_by, performed_by_name, created_at)
     SELECT id, 'created', $1, 'النظام', NOW()
     FROM invoices WHERE request_id = $2`,
    [createdByVal, requestId]
  );

  const rows = await pool.query(
    "SELECT * FROM invoices WHERE request_id = $1 ORDER BY invoice_type",
    [requestId]
  );
  logger.info({ requestId, custNum, techNum }, "Invoices generated");
  return rows.rows;
}

// ─── PUBLIC: Verify invoice via QR code ──────────────────────────────────────
// Returns only non-sensitive data — no phone numbers, addresses, or PII.
router.get("/invoices/verify/:invoiceNumber", async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const result = await pool.query<any>(
      `SELECT invoice_number, request_id, invoice_type, status, created_at
       FROM invoices WHERE invoice_number = $1`,
      [invoiceNumber]
    );
    if (result.rows.length === 0) {
      return res.json({ valid: false, message: "الفاتورة غير موجودة" });
    }
    const inv = result.rows[0];
    return res.json({
      valid:         inv.status === "active",
      invoiceNumber: inv.invoice_number,
      requestId:     inv.request_id,
      invoiceType:   inv.invoice_type === "customer" ? "فاتورة عميل" : "إشعار تسوية فني",
      status:        inv.status === "active" ? "سارية" : "ملغاة",
      issuedDate:    inv.created_at,
    });
  } catch (err) {
    logger.error({ err }, "invoice verify error");
    return res.status(500).json({ valid: false, message: "خطأ في الخادم" });
  }
});

// ─── ADMIN: List invoices for a request ──────────────────────────────────────
router.get("/invoices/request/:requestId", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    // Only admins/super_admin may access invoices
    if (user.role !== "admin" && user.role !== "super_admin" && !user.isFounder) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const requestId = parseInt(req.params["requestId"] as string);
    const result = await pool.query<any>(
      `SELECT i.*,
              u.full_name AS created_by_name
       FROM invoices i
       LEFT JOIN users u ON u.id = i.created_by
       WHERE i.request_id = $1
       ORDER BY i.invoice_type`,
      [requestId]
    );
    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "list invoices error");
    return res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── ADMIN: Generate invoices for a completed request (idempotent) ───────────
router.post("/invoices/request/:requestId/generate", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "admin" && user.role !== "super_admin" && !user.isFounder) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const requestId = parseInt(req.params["requestId"] as string);

    // Verify the request is completed
    const reqRes = await pool.query<{ status: string }>(
      "SELECT status FROM service_requests WHERE id = $1",
      [requestId]
    );
    if (reqRes.rows.length === 0) return res.status(404).json({ error: "الطلب غير موجود" });
    if (reqRes.rows[0].status !== "completed") {
      return res.status(400).json({ error: "لا يمكن إنشاء الفواتير إلا للطلبات المكتملة" });
    }

    const invoices = await generateInvoicesForRequest(requestId, user.id === 0 ? null : user.id);
    return res.json({ generated: true, invoices });
  } catch (err) {
    logger.error({ err }, "generate invoices error");
    return res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── ADMIN: List all invoices (paginated, filterable) ────────────────────────
// NOTE: Must be declared BEFORE /invoices/:id to avoid Express matching "list"
// as an id parameter.
router.get("/invoices/list", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "admin" && user.role !== "super_admin" && !user.isFounder) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const page   = Math.max(1, parseInt((req.query["page"] as string) ?? "1"));
    const limit  = Math.min(50, Math.max(1, parseInt((req.query["limit"] as string) ?? "20")));
    const type   = req.query["type"] as string; // customer | technician | all
    const search = ((req.query["search"] as string) ?? "").slice(0, 100);

    let where = "";
    const params: any[] = [limit, (page - 1) * limit];
    let p = 3;

    if (type && type !== "all") {
      where += ` AND i.invoice_type = ${p++}`;
      params.push(type);
    }
    if (search) {
      where += ` AND (i.invoice_number ILIKE ${p} OR i.request_id::text = ${p + 1})`;
      params.push(`%${search}%`, search);
      p += 2;
    }

    const result = await pool.query<any>(
      `SELECT i.*, u.full_name AS created_by_name
       FROM invoices i
       LEFT JOIN users u ON u.id = i.created_by
       WHERE 1=1 ${where}
       ORDER BY i.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "list all invoices error");
    return res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── ADMIN: Get single invoice ────────────────────────────────────────────────
router.get("/invoices/:id", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "admin" && user.role !== "super_admin" && !user.isFounder) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const id = parseInt(req.params["id"] as string);
    const result = await pool.query<any>(
      `SELECT i.*, u.full_name AS created_by_name
       FROM invoices i
       LEFT JOIN users u ON u.id = i.created_by
       WHERE i.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "الفاتورة غير موجودة" });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err }, "get invoice error");
    return res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── ADMIN: Log invoice activity ──────────────────────────────────────────────
router.post("/invoices/:id/log", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "admin" && user.role !== "super_admin" && !user.isFounder) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const invoiceId = parseInt(req.params["id"] as string);
    const { action } = req.body as { action: string };
    const validActions = ["viewed", "printed", "downloaded", "whatsapp_opened"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: "نشاط غير صالح" });
    }

    // Update the relevant timestamp column
    const colMap: Record<string, string> = {
      printed:          "last_printed_at",
      downloaded:       "last_download_at",
      whatsapp_opened:  "last_whatsapp_at",
    };
    const col = colMap[action];
    if (col) {
      await pool.query(
        `UPDATE invoices SET ${col} = NOW(), updated_at = NOW() WHERE id = $1`,
        [invoiceId]
      );
    }

    // Insert activity log
    const performedBy = !user.id || user.id === 0 ? null : user.id;
    await pool.query(
      `INSERT INTO invoice_activity_logs
         (invoice_id, action, performed_by, performed_by_name, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [invoiceId, action, performedBy, user.mobile || "مجهول"]
    );

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "log invoice activity error");
    return res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── ADMIN: Get activity logs for an invoice ──────────────────────────────────
router.get("/invoices/:id/logs", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "admin" && user.role !== "super_admin" && !user.isFounder) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const invoiceId = parseInt(req.params["id"] as string);
    const result = await pool.query<any>(
      `SELECT * FROM invoice_activity_logs
       WHERE invoice_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [invoiceId]
    );
    return res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "get invoice logs error");
    return res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
