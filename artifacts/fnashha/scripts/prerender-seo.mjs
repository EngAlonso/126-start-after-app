import fs from "node:fs";
import path from "node:path";
import { getEligibleSeoLandingPages } from "../../api-server/src/lib/seo-landing-pages.ts";
import { pool } from "@workspace/db";

const outDir = path.resolve(import.meta.dirname, "..", "dist", "public");
const basePath = process.env.BASE_PATH || "/";
const siteUrl = (process.env.VITE_PUBLIC_SITE_URL || "https://fnashha.com").replace(/\/+$/, "");
const imageUrl = `${siteUrl}/opengraph.jpg`;
const source = fs.readFileSync(path.join(outDir, "index.html"), "utf8");

const pages = {
  "/": {
    title: "فنشها | خدمات الصيانة والتشطيب في مصر",
    description:
      "فنشها منصة تربط العملاء بالفنيين لطلب خدمات الصيانة المنزلية والتشطيب ومتابعة الطلبات.",
    heading: "احصل على خدمة احترافية مع فنشها",
    content:
      "منصة فنشها تساعدك على الوصول إلى خدمات الصيانة المنزلية والتشطيب والتواصل مع الفني المناسب.",
    links: [
      ["الخدمات", "/services"],
      ["كيف تعمل فنشها؟", "/how-it-works"],
      ["العروض", "/offers"],
      ["الأسئلة الشائعة", "/faq"],
      ["تواصل معنا", "/contact"],
    ],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "فنشها",
        url: siteUrl,
        logo: imageUrl,
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "فنشها",
        url: siteUrl,
        inLanguage: "ar",
      },
    ],
  },
  "/services": {
    title: "الخدمات | فنشها",
    description:
      "تصفح خدمات الصيانة المنزلية المتاحة عبر فنشها واختر الخدمة المناسبة لطلبك.",
    heading: "كل خدمة تحتاجها في مكان واحد",
    content:
      "تصفح خدمات الصيانة المنزلية المتاحة عبر فنشها، ثم استخدم المنصة لإنشاء طلب يناسب احتياجك.",
    links: [
      ["الرئيسية", "/"],
      ["كيف تعمل فنشها؟", "/how-it-works"],
      ["تواصل معنا", "/contact"],
    ],
  },
  "/how-it-works": {
    title: "كيف تعمل فنشها؟ | فنشها",
    description:
      "تعرّف على خطوات طلب خدمة منزلية عبر فنشها من اختيار الخدمة وحتى التواصل مع الفني.",
    heading: "كيف تعمل فنشها؟",
    content:
      "اختر الخدمة المناسبة، اشرح احتياجك، ثم تابع العروض والتواصل مع الفني من خلال المنصة.",
    links: [
      ["الخدمات", "/services"],
      ["الأسئلة الشائعة", "/faq"],
      ["ابدأ الآن", "/register/customer"],
    ],
  },
  "/faq": {
    title: "الأسئلة الشائعة | فنشها",
    description:
      "إجابات عن الأسئلة الشائعة حول طلب خدمات الصيانة المنزلية واستخدام منصة فنشها.",
    heading: "الأسئلة الشائعة",
    content:
      "إجابات عن ماهية فنشها، طريقة طلب الخدمة، التسجيل، التواصل مع الدعم، وسياسات المنصة.",
    links: [
      ["الخدمات", "/services"],
      ["تواصل معنا", "/contact"],
      ["سياسة الخصوصية", "/privacy"],
    ],
  },
  "/contact": {
    title: "تواصل معنا | فنشها",
    description:
      "تواصل مع فريق فنشها عبر قنوات الدعم المتاحة للاستفسارات والمساعدة.",
    heading: "اتصل بنا",
    content:
      "تواصل مع فريق فنشها عبر قنوات الدعم المتاحة للاستفسارات والمساعدة المتعلقة بالمنصة.",
    links: [
      ["الرئيسية", "/"],
      ["الأسئلة الشائعة", "/faq"],
      ["سياسة الخصوصية", "/privacy"],
    ],
  },
  "/terms": {
    title: "الشروط والأحكام | فنشها",
    description:
      "اطلع على الشروط والأحكام المنظمة لاستخدام منصة فنشها وخدماتها.",
    heading: "الشروط والأحكام",
    content:
      "توضح هذه الصفحة القواعد المنظمة لاستخدام منصة فنشها، الحسابات، الطلبات، والمدفوعات.",
    links: [
      ["سياسة الخصوصية", "/privacy"],
      ["سياسة الاسترداد", "/refund-policy"],
      ["تواصل معنا", "/contact"],
    ],
  },
  "/privacy": {
    title: "سياسة الخصوصية | فنشها",
    description:
      "تعرّف على كيفية جمع واستخدام وحماية بياناتك الشخصية عند استخدام منصة فنشها.",
    heading: "سياسة الخصوصية",
    content:
      "توضح سياسة الخصوصية أنواع البيانات التي قد تجمعها فنشها وكيفية استخدامها وحمايتها.",
    links: [
      ["الشروط والأحكام", "/terms"],
      ["تواصل معنا", "/contact"],
      ["الرئيسية", "/"],
    ],
  },
  "/refund-policy": {
    title: "سياسة الاسترداد | فنشها",
    description:
      "اطلع على شروط طلب الاسترداد وطريقة معالجة طلبات الاسترداد المتعلقة بخدمات فنشها.",
    heading: "سياسة الاسترداد",
    content:
      "توضح هذه الصفحة شروط تقديم طلبات الاسترداد وطريقة مراجعتها ومعالجتها.",
    links: [
      ["الشروط والأحكام", "/terms"],
      ["تواصل معنا", "/contact"],
      ["الرئيسية", "/"],
    ],
  },
  "/offers": {
    title: "العروض | فنشها",
    description:
      "اكتشف العروض والخصومات المنشورة على خدمات الصيانة المنزلية عبر فنشها.",
    heading: "عروض فنشها",
    content:
      "اكتشف العروض والخصومات المنشورة على خدمات الصيانة المنزلية عبر فنشها.",
    links: [
      ["الخدمات", "/services"],
      ["الرئيسية", "/"],
      ["تواصل معنا", "/contact"],
    ],
  },
};

const dynamicPages = await getEligibleSeoLandingPages();
const servicesOutDir = path.join(outDir, "services");
if (fs.existsSync(servicesOutDir)) {
  for (const entry of fs.readdirSync(servicesOutDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      fs.rmSync(path.join(servicesOutDir, entry.name), { recursive: true, force: true });
    }
  }
}

for (const page of dynamicPages) {
  const route = `/services/${page.serviceSlug}/${page.locationSlug}`;
  const requestHref = `/register/customer?serviceId=${page.serviceId}&governorateId=${page.governorateId}&areaId=${page.areaId}`;
  pages[route] = {
    title: `${page.serviceNameAr} في ${page.areaNameAr} | فنشها`,
    description: `اطلب خدمة ${page.serviceNameAr} في ${page.areaNameAr} بمحافظة ${page.governorateNameAr} عبر فنشها، وتابع طلبك من خلال المنصة.`,
    heading: `${page.serviceNameAr} في ${page.areaNameAr}`,
    content: `اطلب ${page.serviceNameAr} في ${page.areaNameAr} التابعة لمحافظة ${page.governorateNameAr} من خلال فنشها، واشرح احتياجك ليصل طلبك إلى الفنيين المؤهلين في منطقتك.`,
    ctaHref: requestHref,
    ctaLabel: "اطلب الخدمة",
    links: [
      ["كل الخدمات", "/services"],
      ["كيف تعمل فنشها؟", "/how-it-works"],
      ["الأسئلة الشائعة", "/faq"],
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${page.serviceNameAr} في ${page.areaNameAr}`,
      serviceType: page.serviceNameAr,
      areaServed: {
        "@type": "AdministrativeArea",
        name: `${page.areaNameAr}، ${page.governorateNameAr}`,
      },
      provider: {
        "@type": "Organization",
        name: "فنشها",
        url: siteUrl,
        logo: imageUrl,
      },
      url: `${siteUrl}${route}`,
    },
  };
}

function esc(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlFor(route, page) {
  const canonical = `${siteUrl}${route === "/" ? "/" : route}`;
  const robots = "index, follow";
  const jsonLd = page.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd)}</script>`
    : "";
  const nav = page.links
    .map(([label, href]) => `<a href="${href}">${esc(label)}</a>`)
    .join(" · ");
  const cta = page.ctaHref
    ? `<p><a href="${page.ctaHref}">${esc(page.ctaLabel || "ابدأ الآن")}</a></p>`
    : "";
  return source
    .replace(/<title>.*?<\/title>/s, `<title>${esc(page.title)}</title>`)
    .replace(
      /<meta name="description" content=".*?"\s*\/?>/s,
      `<meta name="description" content="${esc(page.description)}" />`,
    )
    .replace(
      /<meta name="robots" content=".*?"\s*\/?>/s,
      `<meta name="robots" content="${robots}" />`,
    )
    .replace(
      /<meta property="og:title" content=".*?"\s*\/?>/s,
      `<meta property="og:title" content="${esc(page.title)}" />`,
    )
    .replace(
      /<meta property="og:description" content=".*?"\s*\/?>/s,
      `<meta property="og:description" content="${esc(page.description)}" />`,
    )
    .replace(
      /<meta property="og:image" content=".*?"\s*\/?>/s,
      `<meta property="og:image" content="${imageUrl}" />`,
    )
    .replace(
      /<meta name="twitter:title" content=".*?"\s*\/?>/s,
      `<meta name="twitter:title" content="${esc(page.title)}" />`,
    )
    .replace(
      /<meta name="twitter:description" content=".*?"\s*\/?>/s,
      `<meta name="twitter:description" content="${esc(page.description)}" />`,
    )
    .replace(
      /<meta name="twitter:image" content=".*?"\s*\/?>/s,
      `<meta name="twitter:image" content="${imageUrl}" />`,
    )
    .replace(
      /<link rel="canonical" href=".*?"\s*\/?>/s,
      `<link rel="canonical" href="${canonical}" />`,
    )
    .replace(
      /<meta property="og:url" content=".*?"\s*\/?>/s,
      `<meta property="og:url" content="${canonical}" />`,
    )
    .replace(/<script type="application\/ld\+json">.*?<\/script>/s, "")
    .replace("</head>", `${jsonLd}</head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root"><main id="seo-shell" dir="rtl" lang="ar"><h1>${esc(page.heading)}</h1><p>${esc(page.content)}</p>${cta}<nav aria-label="روابط مفيدة">${nav}</nav></main></div>`,
    );
}

for (const [route, page] of Object.entries(pages)) {
  const destination =
    route === "/"
      ? path.join(outDir, "index.html")
      : path.join(outDir, route.slice(1), "index.html");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, htmlFor(route, page));
}

const xmlEscape = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const sitemapUrls = Object.keys(pages)
  .map((route) => `  <url><loc>${xmlEscape(`${siteUrl}${route === "/" ? "/" : route}`)}</loc></url>`)
  .join("\n");
fs.writeFileSync(
  path.join(outDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>\n`,
);

await pool.end();

console.log(
  `SEO prerendered ${Object.keys(pages).length} public routes (${dynamicPages.length} dynamic) using base ${basePath}`,
);
