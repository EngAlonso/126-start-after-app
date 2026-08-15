import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authenticate, requireRole, requirePermission } from "../middlewares/auth";

const router = Router();

// GET /api/services
router.get("/services", async (req, res) => {
  try {
    let query = db.select().from(servicesTable).orderBy(asc(servicesTable.displayOrder));
    const services = await query;
    const active = req.query.active;
    if (active === "true") {
      return res.json(services.filter((s) => s.isActive));
    }
    return res.json(services);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/services
router.post("/services", authenticate, requirePermission("services.add"), async (req, res) => {
  try {
    const { name, nameAr, icon, image, isActive, displayOrder, iconSize, iconShape, titleSize } = req.body;
    if (!name || !nameAr) return res.status(400).json({ error: "الاسم مطلوب" });
    const [service] = await db
      .insert(servicesTable)
      .values({ name, nameAr, icon, image, isActive: isActive ?? true, displayOrder: displayOrder ?? 0, iconSize: iconSize ?? 100, iconShape: iconShape ?? "square", titleSize: titleSize ?? 100 })
      .returning();
    return res.status(201).json(service);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/services/:id
router.get("/services/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).limit(1);
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة" });
    return res.json(service);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// PATCH /api/services/:id
router.patch("/services/:id", authenticate, requirePermission("services.edit"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, nameAr, icon, image, isActive, displayOrder, iconSize, iconShape, titleSize } = req.body;
    const [service] = await db
      .update(servicesTable)
      .set({ name, nameAr, icon, image, isActive, displayOrder, iconSize, iconShape, titleSize })
      .where(eq(servicesTable.id, id))
      .returning();
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة" });
    return res.json(service);
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// DELETE /api/services/:id
router.delete("/services/:id", authenticate, requirePermission("services.delete"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(servicesTable).where(eq(servicesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err });
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
