import { Router } from "express";
import { db } from "@workspace/db";
import { governoratesTable, areasTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authenticate, requireRole, requirePermission } from "../middlewares/auth";

const router = Router();

// ─── GOVERNORATES ────────────────────────────────────────────────────────────

router.get("/governorates", async (_req, res) => {
  try {
    // Cap at 500 — governorates are reference data used in dropdowns; this
    // covers all Egyptian governorates many times over while preventing abuse.
    const rows = await db.select().from(governoratesTable).orderBy(asc(governoratesTable.nameAr)).limit(500);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/governorates", authenticate, requirePermission("locations.add"), async (req, res) => {
  try {
    const { name, nameAr, isActive } = req.body;
    if (!name || !nameAr) return res.status(400).json({ error: "الاسم مطلوب" });
    const [gov] = await db.insert(governoratesTable).values({ name, nameAr, isActive: isActive ?? true }).returning();
    return res.status(201).json(gov);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.patch("/governorates/:id", authenticate, requirePermission("locations.edit"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, nameAr, isActive } = req.body;
    const [gov] = await db
      .update(governoratesTable)
      .set({ name, nameAr, isActive })
      .where(eq(governoratesTable.id, id))
      .returning();
    if (!gov) return res.status(404).json({ error: "المحافظة غير موجودة" });
    return res.json(gov);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.delete("/governorates/:id", authenticate, requirePermission("locations.delete"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(governoratesTable).where(eq(governoratesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ─── AREAS ───────────────────────────────────────────────────────────────────

router.get("/areas", async (req, res) => {
  try {
    // Cap at 2000 — areas are reference data for dropdowns; covers all Egyptian
    // cities/districts with a wide safety margin while preventing abuse.
    let rows = await db
      .select({ area: areasTable, governorate: governoratesTable })
      .from(areasTable)
      .leftJoin(governoratesTable, eq(areasTable.governorateId, governoratesTable.id))
      .orderBy(asc(areasTable.nameAr))
      .limit(2000);

    const govId = req.query.governorateId ? parseInt(req.query.governorateId as string) : null;
    if (govId) rows = rows.filter((r) => r.area.governorateId === govId);

    const active = req.query.active;
    if (active === "true") rows = rows.filter((r) => r.area.isActive);

    return res.json(rows.map((r) => ({ ...r.area, governorate: r.governorate })));
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/areas", authenticate, requirePermission("locations.add"), async (req, res) => {
  try {
    const { name, nameAr, governorateId, isActive, extraPoints } = req.body;
    if (!name || !nameAr || !governorateId) return res.status(400).json({ error: "البيانات مطلوبة" });
    const [area] = await db
      .insert(areasTable)
      .values({ name, nameAr, governorateId, isActive: isActive ?? true, extraPoints: extraPoints ?? 0 })
      .returning();
    return res.status(201).json(area);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.patch("/areas/:id", authenticate, requirePermission("locations.edit"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, nameAr, isActive, extraPoints } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (nameAr !== undefined) updates.nameAr = nameAr;
    if (isActive !== undefined) updates.isActive = isActive;
    if (extraPoints !== undefined) updates.extraPoints = parseInt(extraPoints);
    const [area] = await db
      .update(areasTable)
      .set(updates)
      .where(eq(areasTable.id, id))
      .returning();
    if (!area) return res.status(404).json({ error: "المنطقة غير موجودة" });
    return res.json(area);
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.delete("/areas/:id", authenticate, requirePermission("locations.delete"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(areasTable).where(eq(areasTable.id, id));
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
