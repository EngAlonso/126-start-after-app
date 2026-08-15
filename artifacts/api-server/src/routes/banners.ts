import { Router } from "express";
import { db } from "@workspace/db";
import { bannersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authenticate, requireRole, requirePermission } from "../middlewares/auth";

const router = Router();

router.get("/banners", async (req, res) => {
  try {
    const location = req.query.location as string | undefined;
    // Cap at 200 banners — CMS-managed content; prevents unbounded payloads
    // while covering any realistic banner count with a wide safety margin.
    const BANNERS_LIMIT = 200;
    let rows;
    if (location) {
      rows = await db
        .select()
        .from(bannersTable)
        .where(eq(bannersTable.location, location as any))
        .orderBy(asc(bannersTable.displayOrder))
        .limit(BANNERS_LIMIT);
    } else {
      rows = await db.select().from(bannersTable).orderBy(asc(bannersTable.displayOrder)).limit(BANNERS_LIMIT);
    }
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/banners", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const {
      title, description, imageUrl, mobileImageUrl, videoUrl,
      buttonText, buttonLink, location, displayOrder, isActive,
      showIn, startDate, endDate,
      overlayEnabled, overlayColor, overlayOpacity,
    } = req.body;
    const [banner] = await db
      .insert(bannersTable)
      .values({
        title: title || "",
        description,
        imageUrl,
        mobileImageUrl: mobileImageUrl || null,
        videoUrl,
        buttonText,
        buttonLink,
        location: location || "hero",
        displayOrder: displayOrder ?? 0,
        isActive: isActive ?? true,
        showIn: showIn || "both",
        startDate: startDate || null,
        endDate: endDate || null,
        overlayEnabled: overlayEnabled !== undefined ? overlayEnabled : true,
        overlayColor: overlayColor || "#000000",
        overlayOpacity: overlayOpacity !== undefined ? parseInt(String(overlayOpacity)) : 45,
      })
      .returning();
    return res.status(201).json(banner);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.patch("/banners/:id", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const {
      title, description, imageUrl, mobileImageUrl, videoUrl,
      buttonText, buttonLink, location, displayOrder, isActive,
      showIn, startDate, endDate,
      overlayEnabled, overlayColor, overlayOpacity,
    } = req.body;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (mobileImageUrl !== undefined) updateData.mobileImageUrl = mobileImageUrl || null;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (buttonText !== undefined) updateData.buttonText = buttonText;
    if (buttonLink !== undefined) updateData.buttonLink = buttonLink;
    if (location !== undefined) updateData.location = location;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (showIn !== undefined) updateData.showIn = showIn || "both";
    if (startDate !== undefined) updateData.startDate = startDate || null;
    if (endDate !== undefined) updateData.endDate = endDate || null;
    if (overlayEnabled !== undefined) updateData.overlayEnabled = overlayEnabled;
    if (overlayColor !== undefined) updateData.overlayColor = overlayColor || "#000000";
    if (overlayOpacity !== undefined) updateData.overlayOpacity = parseInt(String(overlayOpacity));
    const [banner] = await db
      .update(bannersTable)
      .set(updateData)
      .where(eq(bannersTable.id, id))
      .returning();
    if (!banner) return res.status(404).json({ error: "البانر غير موجود" });
    return res.json(banner);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.delete("/banners/:id", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(bannersTable).where(eq(bannersTable.id, id));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
