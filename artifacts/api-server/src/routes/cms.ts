import { Router } from "express";
import { db } from "@workspace/db";
import { cmsSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

const CMS_KEYS = [
  "siteName", "siteNameAr", "shortName", "appName", "siteSlogan", "logoUrl", "faviconUrl",
  "heroTitle", "heroTitleAr", "heroSubtitle", "heroSubtitleAr",
  "aboutUs", "aboutUsAr", "termsConditions", "termsConditionsAr",
  "privacyPolicy", "privacyPolicyAr",
  "contactEmail", "contactPhone", "contactAddress",
  "facebookUrl", "twitterUrl", "instagramUrl", "youtubeUrl", "whatsappNumber", "tiktokUrl", "hotlineSchedule",
  "statsCustomers", "statsTechnicians", "statsRequests", "statsGovernorates", "statsUseCustom",
  "footerAboutUs", "footerFaq",
  "offersAdTitle", "offersAdDescription", "offersAdButtonText", "offersAdButtonUrl", "offersAdShow",
  "heroBackgroundImage", "heroMobileImage", "heroVideoUrl", "heroVideoEnabled",
  "heroDescription", "heroAndroidAppUrl", "heroIosAppUrl",
  "heroAndroidEnabled", "heroIosEnabled", "heroAndroidText", "heroIosText",
  "heroOverlayOpacity", "heroTextAlign", "heroTitleColor", "heroSubtitleColor",
  "heroHighlightWord", "heroHighlightColor",
  "heroBtnBgColor", "heroBtnTextColor", "heroBtnBorderRadius", "heroPaddingTop",
  "statsBackgroundImage",
  "heroBadgeText", "heroBadgeShow", "heroBadgeIcon", "heroBadgeColor", "heroBadgeFontSize", "heroBadgeSpacing",
  "heroFeaturesJson", "heroFeaturesShow", "heroFeaturesSpacing",
  "heroHighlightsJson",
  "heroElementsConfig", "heroElementsConfigMobile",
  "heroAndroidIconUrl", "heroIosIconUrl",
  "heroBtnShadow", "heroBtnPaddingX", "heroBtnPaddingY",
  "heroStoreBtnMinWidth", "heroStoreBtnFontSize", "heroStoreBtnIconSize", "heroStoreBtnGap",
  "heroStoreBtnBorderRadius", "heroStoreBtnPaddingX", "heroStoreBtnPaddingY", "heroStoreBtnSpacingBelow",
  "refundPolicy", "faqContent",
  "androidIconUrl", "iosIconUrl", "splashLogoUrl", "pwaIconUrl",
  "qrPageTitle", "qrPageWelcome", "qrPageDescription", "qrPageBgImage",
  "qrAndroidUrl", "qrIosUrl", "qrFacebookUrl", "qrWhatsappUrl",
  "qrInstagramUrl", "qrTiktokUrl", "qrTwitterUrl",
  // ── Loyalty system ────────────────────────────────────────────────────────
  "loyaltyEnabled",        // "true"/"false" — master on/off switch
  "coinName",              // Arabic display name for coins, e.g. "عملات فنشها"
  "coinNameEn",            // English display name for coins, e.g. "Fnashha Currency"
  // Earning formula: every coinEarnX EGP = coinEarnY coins
  "coinEarnX",             // number string — EGP per formula period, e.g. "10"
  "coinEarnY",             // number string — coins per formula period, e.g. "1"
  // Redemption formula: every coinRedeemX coins = coinRedeemY EGP discount
  "coinRedeemX",           // number string — coins per formula period, e.g. "1"
  "coinRedeemY",           // number string — EGP discount per formula period, e.g. "0.5"
  "maxCoinsPerRequest",    // number string — max coins redeemable per request, e.g. "500"
  "minRequestValue",       // number string — minimum agreedPrice to allow earn/redeem, e.g. "100"
  "pendingCoinDays",       // number string — days before earned coins become available (0 = immediate)
  "allowCoinsPlusCoupons", // "true"/"false" — allow stacking coins + other discount types
  "earnCoinsOnDiscount",   // "true"/"false" — earn coins even when has_discount = true
  "referralReferrerCoins", // number string — coins granted to referrer on qualifying request
  "referralRefereeCoins",  // number string — coins granted to referee on qualifying request
  "referralEnabled",       // "true"/"false" — enable referral rewards
  "coinExpiryDays",        // number string — days before available coins expire (0 = never)
  // Legacy keys kept so existing DB rows are still read/written if present
  "coinEarnRatio",         // DEPRECATED — replaced by coinEarnX/coinEarnY
  "coinConversionRatio",   // DEPRECATED — replaced by coinRedeemX/coinRedeemY
  // ── Intro slideshow ───────────────────────────────────────────────────────
  "introBackgroundUrl",      // URL of the fixed background image for the intro slideshow
  "introCharacterSize",      // Character height as % of screen (integer string, e.g. "40"). Default 40.
  "introCharacterPosition",  // Character vertical position 0–100 (0=top, 50=center, 100=bottom). Default 50.
];

async function getSettings() {
  const rows = await db.select().from(cmsSettingsTable);
  const map: Record<string, string | null> = {};
  CMS_KEYS.forEach((k) => (map[k] = null));
  rows.forEach((r) => (map[r.key] = r.value ?? null));
  return map;
}

router.get("/cms/settings", async (_req, res) => {
  try {
    const settings = await getSettings();
    return res.json(settings);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.get("/pwa-manifest.json", async (_req, res) => {
  try {
    const settings = await getSettings();
    const siteName = (settings.siteNameAr || settings.siteName || "فنشها") as string;
    const shortName = (settings.shortName || siteName) as string;

    const defaultIcons = [
      { src: "/assets/icon-48.png?v=3",  sizes: "48x48",   type: "image/png", purpose: "any" },
      { src: "/assets/icon-72.png?v=3",  sizes: "72x72",   type: "image/png", purpose: "any" },
      { src: "/assets/icon-96.png?v=3",  sizes: "96x96",   type: "image/png", purpose: "any" },
      { src: "/assets/icon-128.png?v=3", sizes: "128x128", type: "image/png", purpose: "any" },
      { src: "/assets/icon-144.png?v=3", sizes: "144x144", type: "image/png", purpose: "any" },
      { src: "/assets/icon-152.png?v=3", sizes: "152x152", type: "image/png", purpose: "any" },
      { src: "/assets/icon-167.png?v=3", sizes: "167x167", type: "image/png", purpose: "any" },
      { src: "/assets/icon-180.png?v=3", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/assets/icon-192.png?v=3", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/assets/icon-256.png?v=3", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/assets/icon-384.png?v=3", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/assets/icon-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/assets/icon-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ];

    const icons = settings.pwaIconUrl
      ? [
          { src: settings.pwaIconUrl, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: settings.pwaIconUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ]
      : defaultIcons;

    const manifest = {
      name: siteName,
      short_name: shortName,
      description: "منصة الخدمات المنزلية الأولى في مصر",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#f5c518",
      theme_color: "#f5c518",
      lang: "ar",
      dir: "rtl",
      categories: ["business", "home-services"],
      icons,
      screenshots: [],
      prefer_related_applications: false,
    };

    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.json(manifest);
  } catch {
    return res.status(500).json({ error: "حدث خطأ" });
  }
});

router.patch("/cms/settings", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      if (!CMS_KEYS.includes(key)) continue;
      const existing = await db.select().from(cmsSettingsTable).where(eq(cmsSettingsTable.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(cmsSettingsTable).set({ value, updatedAt: new Date() }).where(eq(cmsSettingsTable.key, key));
      } else {
        await db.insert(cmsSettingsTable).values({ key, value });
      }
    }
    const settings = await getSettings();
    return res.json(settings);
  } catch {
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
