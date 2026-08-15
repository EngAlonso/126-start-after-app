import { Router } from "express";
import { db } from "@workspace/db";
import { introScreensTable, cmsSettingsTable } from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";
import { authenticate, requirePermission } from "../middlewares/auth";

const router = Router();

// ── Cloudinary transparency helper ───────────────────────────────────────────
//
// Character images may be uploaded as Indexed PNG (color type 3) without an
// alpha channel — the "transparent" areas in the designer's tool are saved as
// literal checkerboard pixel data (alternating white ~#FFF and light-gray
// ~#C0C0C0 squares).
//
// Cloudinary's `e_make_transparent:<threshold>` effect flood-fills from the
// image edges, replacing all pixels within <threshold>% color similarity of
// the detected background color with true alpha-0 transparency.
//
// Threshold 30 rationale:
//   • White (#FFF) → Gray (#C0C0C0):  ~25% distance  → REMOVED ✓
//   • White (#FFF) → Orange (#FF7800): ~50% distance  → PRESERVED ✓
//   • White (#FFF) → Yellow (#F5C518): ~42% distance  → PRESERVED ✓
//
// `f_png` forces PNG output so the alpha channel is retained on delivery.
// The admin GET endpoint skips this transform so raw uploads remain unchanged.
//
function applyCharacterTransparency(url: string): string {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  return url.replace(
    "/image/upload/",
    "/image/upload/e_make_transparent:30,f_png/"
  );
}

// ── Public: get intro settings (background URL + character size) ──────────────
// No auth required — called at mobile/PWA startup before login.
// characterSize: integer percentage (10–100), default 40.
router.get("/intro-background", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(cmsSettingsTable)
      .where(inArray(cmsSettingsTable.key, [
        "introBackgroundUrl",
        "introCharacterSize",
        "introCharacterPosition",
      ]));

    const byKey: Record<string, string | null> = {};
    rows.forEach((r) => { byKey[r.key] = r.value ?? null; });

    const backgroundUrl     = byKey["introBackgroundUrl"] || null;
    const sizeRaw           = byKey["introCharacterSize"];
    const posRaw            = byKey["introCharacterPosition"];
    const characterSize     = sizeRaw ? Math.max(10, Math.min(100, parseInt(sizeRaw, 10))) : 40;
    const characterPosition = posRaw  ? Math.max(0,  Math.min(100, parseInt(posRaw,  10))) : 50;

    return res.json({ backgroundUrl, characterSize, characterPosition });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ── Public: get enabled intro screens (mobile app startup) ───────────────────
// imageUrl is transformed to strip the baked-in checkerboard background so
// clients receive a true RGBA PNG regardless of what was originally uploaded.
router.get("/intro-screens", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(introScreensTable)
      .where(eq(introScreensTable.enabled, true))
      .orderBy(asc(introScreensTable.displayOrder));
    const transformed = rows.map((r) => ({
      ...r,
      imageUrl: applyCharacterTransparency(r.imageUrl),
    }));
    return res.json(transformed);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ── Admin: get all intro screens (including disabled) ────────────────────────
router.get("/admin/intro-screens", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(introScreensTable)
      .orderBy(asc(introScreensTable.displayOrder));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ── Admin: create new intro screen ───────────────────────────────────────────
router.post("/admin/intro-screens", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const { imageUrl, displayOrder, enabled } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "رابط الصورة مطلوب" });

    // Auto-assign display order if not provided
    let order = displayOrder;
    if (order === undefined || order === null) {
      const rows = await db.select().from(introScreensTable).orderBy(asc(introScreensTable.displayOrder));
      order = rows.length > 0 ? rows[rows.length - 1].displayOrder + 1 : 0;
    }

    const [screen] = await db
      .insert(introScreensTable)
      .values({
        imageUrl,
        displayOrder: order,
        enabled: enabled !== undefined ? enabled : true,
      })
      .returning();
    return res.status(201).json(screen);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ── Admin: bulk reorder ───────────────────────────────────────────────────────
// Body: { items: [{ id, displayOrder }] }
router.patch("/admin/intro-screens/reorder", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const { items } = req.body as { items: { id: number; displayOrder: number }[] };
    if (!Array.isArray(items)) return res.status(400).json({ error: "items مطلوب" });

    await Promise.all(
      items.map(({ id, displayOrder }) =>
        db
          .update(introScreensTable)
          .set({ displayOrder, updatedAt: new Date() })
          .where(eq(introScreensTable.id, id))
      )
    );

    const rows = await db
      .select()
      .from(introScreensTable)
      .orderBy(asc(introScreensTable.displayOrder));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ── Admin: update single intro screen ────────────────────────────────────────
router.patch("/admin/intro-screens/:id", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { imageUrl, displayOrder, enabled } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (enabled !== undefined) updateData.enabled = enabled;

    const [screen] = await db
      .update(introScreensTable)
      .set(updateData)
      .where(eq(introScreensTable.id, id))
      .returning();

    if (!screen) return res.status(404).json({ error: "الشاشة غير موجودة" });
    return res.json(screen);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ── Admin: delete intro screen ────────────────────────────────────────────────
router.delete("/admin/intro-screens/:id", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(introScreensTable).where(eq(introScreensTable.id, id));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
