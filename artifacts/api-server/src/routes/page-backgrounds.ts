import { Router } from "express";
import { db } from "@workspace/db";
import { pageBackgroundsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requirePermission } from "../middlewares/auth";

const router = Router();

const PAGE_SLUGS: { slug: string; label: string }[] = [
  { slug: "login",               label: "تسجيل الدخول" },
  { slug: "register",            label: "إنشاء حساب" },
  { slug: "register-customer",   label: "تسجيل عميل" },
  { slug: "register-technician", label: "تسجيل فني" },
  { slug: "qr",                  label: "صفحة QR" },
  { slug: "contact",             label: "اتصل بنا" },
  { slug: "how-it-works",        label: "كيف يعمل" },
  { slug: "faq",                 label: "الأسئلة الشائعة" },
  { slug: "terms",               label: "الشروط والأحكام" },
  { slug: "privacy",             label: "سياسة الخصوصية" },
  { slug: "refund-policy",       label: "سياسة الاسترداد" },
];

router.get("/cms/page-backgrounds", async (_req, res) => {
  try {
    const rows = await db.select().from(pageBackgroundsTable);
    const map: Record<string, any> = {};
    for (const r of rows) map[r.slug] = r;
    const result = PAGE_SLUGS.map((p) => {
      if (map[p.slug]) return map[p.slug];
      return {
        slug: p.slug,
        label: p.label,
        imageUrl: null,
        enabled: true,
        overlayOpacity: 48,
        position: "center",
        size: "cover",
        repeat: "no-repeat",
        attachment: "scroll",
      };
    });
    return res.json(result);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/admin/page-backgrounds", authenticate, requirePermission("cms.banners"), async (_req, res) => {
  try {
    const rows = await db.select().from(pageBackgroundsTable);
    const map: Record<string, any> = {};
    for (const r of rows) map[r.slug] = r;
    const result = PAGE_SLUGS.map((p) => {
      if (map[p.slug]) return map[p.slug];
      return {
        slug: p.slug,
        label: p.label,
        imageUrl: null,
        enabled: true,
        overlayOpacity: 48,
        position: "center",
        size: "cover",
        repeat: "no-repeat",
        attachment: "scroll",
      };
    });
    return res.json(result);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.patch("/admin/page-backgrounds/:slug", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const { slug } = req.params as { slug: string };
    const { imageUrl, enabled, overlayOpacity, position, size, repeat, attachment, label } = req.body;

    const page = PAGE_SLUGS.find((p) => p.slug === slug);
    const defaultLabel = page?.label || slug;

    const existing = await db.select().from(pageBackgroundsTable).where(eq(pageBackgroundsTable.slug, slug));

    if (existing.length === 0) {
      const [row] = await db
        .insert(pageBackgroundsTable)
        .values({
          slug,
          label: label || defaultLabel,
          imageUrl: imageUrl !== undefined ? imageUrl : null,
          enabled: enabled !== undefined ? enabled : true,
          overlayOpacity: overlayOpacity !== undefined ? parseInt(String(overlayOpacity)) : 48,
          position: position || "center",
          size: size || "cover",
          repeat: repeat || "no-repeat",
          attachment: attachment || "scroll",
          updatedAt: new Date(),
        })
        .returning();
      return res.json(row);
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (label !== undefined) updateData.label = label;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (overlayOpacity !== undefined) updateData.overlayOpacity = parseInt(String(overlayOpacity));
    if (position !== undefined) updateData.position = position;
    if (size !== undefined) updateData.size = size;
    if (repeat !== undefined) updateData.repeat = repeat;
    if (attachment !== undefined) updateData.attachment = attachment;

    const [row] = await db
      .update(pageBackgroundsTable)
      .set(updateData)
      .where(eq(pageBackgroundsTable.slug, slug))
      .returning();
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.delete("/admin/page-backgrounds/:slug/image", authenticate, requirePermission("cms.banners"), async (req, res) => {
  try {
    const { slug } = req.params as { slug: string };
    const existing = await db.select().from(pageBackgroundsTable).where(eq(pageBackgroundsTable.slug, slug));
    const page = PAGE_SLUGS.find((p) => p.slug === slug);

    if (existing.length === 0) {
      const [row] = await db
        .insert(pageBackgroundsTable)
        .values({
          slug,
          label: page?.label || slug,
          imageUrl: null,
          enabled: true,
          overlayOpacity: 48,
          position: "center",
          size: "cover",
          repeat: "no-repeat",
          attachment: "scroll",
          updatedAt: new Date(),
        })
        .returning();
      return res.json(row);
    }

    const [row] = await db
      .update(pageBackgroundsTable)
      .set({ imageUrl: null, updatedAt: new Date() })
      .where(eq(pageBackgroundsTable.slug, slug))
      .returning();
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
