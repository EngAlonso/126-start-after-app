import { Router } from "express";
import { db } from "@workspace/db";
import { commissionRangesTable, servicesTable } from "@workspace/db";
import { eq, isNull, asc, and, ne, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

// ─── Helper: check overlapping ranges for same service ────────────────────────
async function hasOverlap(
  serviceId: number | null,
  minPrice: number,
  maxPrice: number,
  excludeId?: number
): Promise<boolean> {
  const conditions: any[] = [
    sql`${commissionRangesTable.minPrice} <= ${maxPrice}`,
    sql`${commissionRangesTable.maxPrice} >= ${minPrice}`,
  ];
  if (serviceId !== null && serviceId !== undefined) {
    conditions.push(eq(commissionRangesTable.serviceId, serviceId));
  } else {
    conditions.push(isNull(commissionRangesTable.serviceId));
  }
  if (excludeId) {
    conditions.push(ne(commissionRangesTable.id, excludeId));
  }
  const rows = await db
    .select({ id: commissionRangesTable.id })
    .from(commissionRangesTable)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

// ─── GET /api/commission-ranges ───────────────────────────────────────────────
router.get("/commission-ranges", authenticate, requireRole("admin", "super_admin"), async (_req, res) => {
  try {
    const rows = await db
      .select({ range: commissionRangesTable, service: servicesTable })
      .from(commissionRangesTable)
      .leftJoin(servicesTable, eq(commissionRangesTable.serviceId, servicesTable.id))
      .orderBy(asc(commissionRangesTable.serviceId), asc(commissionRangesTable.minPrice));

    return res.json(rows.map(({ range, service }) => ({ ...range, service })));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── POST /api/commission-ranges ──────────────────────────────────────────────
router.post("/commission-ranges", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { serviceId, minPrice, maxPrice, type, value } = req.body;

    if (minPrice === undefined || maxPrice === undefined || type === undefined || value === undefined) {
      return res.status(400).json({ error: "الحد الأدنى والأقصى للسعر ونوع العمولة وقيمتها مطلوبة" });
    }
    if (!["fixed", "percentage"].includes(type)) {
      return res.status(400).json({ error: "نوع العمولة يجب أن يكون ثابتة أو نسبة مئوية" });
    }
    const numValue = parseFloat(value);
    if (type === "percentage" && (numValue <= 0 || numValue > 100)) {
      return res.status(400).json({ error: "النسبة المئوية يجب أن تكون بين 0 و 100" });
    }
    if (type === "fixed" && numValue <= 0) {
      return res.status(400).json({ error: "النقاط الثابتة يجب أن تكون أكبر من صفر" });
    }

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (min >= max) {
      return res.status(400).json({ error: "الحد الأدنى يجب أن يكون أقل من الحد الأقصى" });
    }

    const sid = serviceId ? parseInt(serviceId) : null;
    if (await hasOverlap(sid, min, max)) {
      return res.status(400).json({ error: "يتداخل هذا النطاق مع نطاق موجود لنفس الخدمة" });
    }

    const [range] = await db
      .insert(commissionRangesTable)
      .values({
        serviceId: sid,
        minPrice: min.toFixed(2),
        maxPrice: max.toFixed(2),
        commissionType: type,
        commissionValue: numValue.toFixed(2),
        requiredPoints: type === "fixed" ? Math.round(numValue) : 0,
        isActive: true,
      })
      .returning();

    return res.status(201).json(range);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── PATCH /api/commission-ranges/:id ─────────────────────────────────────────
router.patch("/commission-ranges/:id", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { serviceId, minPrice, maxPrice, type, value } = req.body;

    const [existing] = await db
      .select()
      .from(commissionRangesTable)
      .where(eq(commissionRangesTable.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "النطاق غير موجود" });

    const updates: Record<string, any> = { updatedAt: new Date() };

    const resolvedType = type ?? existing.commissionType;
    const resolvedValue = value !== undefined ? parseFloat(value) : parseFloat(existing.commissionValue as string);
    const resolvedMin = minPrice !== undefined ? parseFloat(minPrice) : parseFloat(existing.minPrice as string);
    const resolvedMax = maxPrice !== undefined ? parseFloat(maxPrice) : parseFloat(existing.maxPrice as string);
    const resolvedSid = serviceId !== undefined
      ? (serviceId ? parseInt(serviceId) : null)
      : existing.serviceId;

    if (!["fixed", "percentage"].includes(resolvedType)) {
      return res.status(400).json({ error: "نوع العمولة يجب أن يكون ثابتة أو نسبة مئوية" });
    }
    if (resolvedType === "percentage" && (resolvedValue <= 0 || resolvedValue > 100)) {
      return res.status(400).json({ error: "النسبة المئوية يجب أن تكون بين 0 و 100" });
    }
    if (resolvedType === "fixed" && resolvedValue <= 0) {
      return res.status(400).json({ error: "النقاط الثابتة يجب أن تكون أكبر من صفر" });
    }
    if (resolvedMin >= resolvedMax) {
      return res.status(400).json({ error: "الحد الأدنى يجب أن يكون أقل من الحد الأقصى" });
    }

    if (await hasOverlap(resolvedSid, resolvedMin, resolvedMax, id)) {
      return res.status(400).json({ error: "يتداخل هذا النطاق مع نطاق موجود لنفس الخدمة" });
    }

    updates.serviceId = resolvedSid;
    updates.minPrice = resolvedMin.toFixed(2);
    updates.maxPrice = resolvedMax.toFixed(2);
    updates.commissionType = resolvedType;
    updates.commissionValue = resolvedValue.toFixed(2);
    updates.requiredPoints = resolvedType === "fixed" ? Math.round(resolvedValue) : 0;

    const [range] = await db
      .update(commissionRangesTable)
      .set(updates)
      .where(eq(commissionRangesTable.id, id))
      .returning();

    return res.json(range);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── PATCH /api/commission-ranges/:id/toggle ──────────────────────────────────
router.patch("/commission-ranges/:id/toggle", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [existing] = await db
      .select()
      .from(commissionRangesTable)
      .where(eq(commissionRangesTable.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "النطاق غير موجود" });

    const [range] = await db
      .update(commissionRangesTable)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(commissionRangesTable.id, id))
      .returning();

    return res.json(range);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── DELETE /api/commission-ranges/:id ────────────────────────────────────────
router.delete("/commission-ranges/:id", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(commissionRangesTable).where(eq(commissionRangesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
