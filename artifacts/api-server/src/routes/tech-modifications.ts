/**
 * Technician Service Modification Requests
 *
 * Technicians cannot directly change their registered services or coverage
 * areas — instead they submit a modification request that an admin reviews
 * and either approves or rejects.
 *
 * Routes:
 *   POST   /api/technicians/modification-requests          — technician submits
 *   GET    /api/technicians/modification-requests          — admin lists (all) or technician lists (own)
 *   GET    /api/technicians/modification-requests/:id      — detail (owner or admin)
 *   PATCH  /api/technicians/modification-requests/:id      — admin approves / rejects
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

// ── POST /api/technicians/modification-requests ────────────────────────────────
// Technician submits a service modification request.
router.post(
  "/technicians/modification-requests",
  authenticate,
  requireRole("technician"),
  async (req, res) => {
    try {
      const techId = req.user!.id;
      const { requestType, details } = req.body as {
        requestType?: string;
        details?: string;
      };

      if (!requestType || !details?.trim()) {
        return res
          .status(400)
          .json({ error: "نوع الطلب والتفاصيل مطلوبان" });
      }

      const validTypes = [
        "add_service",
        "remove_service",
        "change_areas",
        "other",
      ];
      if (!validTypes.includes(requestType)) {
        return res.status(400).json({ error: "نوع الطلب غير صالح" });
      }

      const { rows } = await pool.query(
        `INSERT INTO tech_service_modification_requests
           (technician_id, request_type, details, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [techId, requestType, details.trim()]
      );

      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error("POST /technicians/modification-requests error:", err);
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
  }
);

// ── GET /api/technicians/modification-requests ─────────────────────────────────
// - Admin: list all requests (paginated, filterable by status).
// - Technician: list their own requests.
router.get(
  "/technicians/modification-requests",
  authenticate,
  async (req, res) => {
    try {
      const user = req.user!;
      const isAdmin =
        user.role === "admin" || user.role === "super_admin";
      const { status, page = "1", limit = "20" } = req.query as any;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const params: any[] = [];

      if (!isAdmin) {
        // Technician can only see their own requests.
        params.push(user.id);
        conditions.push(`r.technician_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`r.status = $${params.length}`);
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const countRes = await pool.query(
        `SELECT COUNT(*) FROM tech_service_modification_requests r ${where}`,
        params
      );
      const total = parseInt(countRes.rows[0].count);

      params.push(limitNum, offset);
      const { rows } = await pool.query(
        `SELECT r.*,
                u.full_name AS technician_name,
                u.mobile    AS technician_mobile
         FROM   tech_service_modification_requests r
         JOIN   users u ON u.id = r.technician_id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return res.json({ data: rows, total, page: pageNum, limit: limitNum });
    } catch (err) {
      console.error("GET /technicians/modification-requests error:", err);
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
  }
);

// ── GET /api/technicians/modification-requests/:id ────────────────────────────
router.get(
  "/technicians/modification-requests/:id",
  authenticate,
  async (req, res) => {
    try {
      const user = req.user!;
      const rawId = req.params.id;
      const id = parseInt(typeof rawId === "string" ? rawId : rawId[0] ?? "");
      if (isNaN(id))
        return res.status(400).json({ error: "معرّف غير صالح" });

      const { rows } = await pool.query(
        `SELECT r.*,
                u.full_name AS technician_name,
                u.mobile    AS technician_mobile
         FROM   tech_service_modification_requests r
         JOIN   users u ON u.id = r.technician_id
         WHERE  r.id = $1`,
        [id]
      );

      if (!rows[0])
        return res.status(404).json({ error: "الطلب غير موجود" });

      const isAdmin =
        user.role === "admin" || user.role === "super_admin";
      if (!isAdmin && rows[0].technician_id !== user.id) {
        return res.status(403).json({ error: "غير مصرح" });
      }

      return res.json(rows[0]);
    } catch (err) {
      console.error("GET /technicians/modification-requests/:id error:", err);
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
  }
);

// ── PATCH /api/technicians/modification-requests/:id ──────────────────────────
// Admin approves or rejects a modification request.
router.patch(
  "/technicians/modification-requests/:id",
  authenticate,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const rawId = req.params.id;
      const id = parseInt(typeof rawId === "string" ? rawId : rawId[0] ?? "");
      if (isNaN(id))
        return res.status(400).json({ error: "معرّف غير صالح" });

      const { status, adminNotes } = req.body as {
        status?: string;
        adminNotes?: string;
      };

      const validStatuses = ["approved", "rejected"];
      if (!status || !validStatuses.includes(status)) {
        return res
          .status(400)
          .json({ error: "الحالة يجب أن تكون approved أو rejected" });
      }

      const { rows } = await pool.query(
        `UPDATE tech_service_modification_requests
         SET    status      = $1,
                admin_notes = $2,
                reviewed_at = NOW(),
                reviewed_by = $3,
                updated_at  = NOW()
         WHERE  id = $4
         RETURNING *`,
        [status, adminNotes?.trim() ?? null, req.user!.id, id]
      );

      if (!rows[0])
        return res.status(404).json({ error: "الطلب غير موجود" });

      return res.json(rows[0]);
    } catch (err) {
      console.error(
        "PATCH /technicians/modification-requests/:id error:",
        err
      );
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
  }
);

export default router;
