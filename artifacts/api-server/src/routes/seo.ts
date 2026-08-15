import { Router } from "express";
import {
  findEligibleSeoLandingPage,
  getEligibleSeoLandingPages,
} from "../lib/seo-landing-pages";
import { authenticate, requirePermission } from "../middlewares/auth";

const router = Router();

// Eligibility changes must be reflected immediately. The inventory query is
// intentionally uncached, and these responses must not be retained by a
// browser or an intermediate proxy either.
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Permission-gated admin view of the same public inventory source. This
// exposes no additional technician data; it only protects the management UI's
// inventory endpoint from employees without seo_pages.view.
router.get(
  "/admin/seo/landing-pages",
  authenticate,
  requirePermission("seo_pages.view"),
  async (req, res) => {
    try {
      return res.json(await getEligibleSeoLandingPages());
    } catch (err) {
      req.log.error({ err }, "Failed to load admin SEO landing pages");
      return res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
  },
);

// Public, read-only SEO inventory. It contains reference data only; no
// technician identity or private profile information is exposed.
router.get("/seo/landing-pages", async (req, res) => {
  try {
    return res.json(await getEligibleSeoLandingPages());
  } catch (err) {
    req.log.error({ err }, "Failed to load SEO landing pages");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/seo/landing-pages/:serviceSlug/:locationSlug", async (req, res) => {
  try {
    const page = await findEligibleSeoLandingPage(
      req.params.serviceSlug,
      req.params.locationSlug,
    );
    if (!page) return res.status(404).json({ error: "الصفحة غير موجودة" });
    return res.json(page);
  } catch (err) {
    req.log.error({ err }, "Failed to load SEO landing page");
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;