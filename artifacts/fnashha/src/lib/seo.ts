import { useEffect } from "react";
import { useLocation } from "wouter";

export const SEO_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://fnashha.com";
export const SEO_IMAGE_URL = `${SEO_SITE_URL}/opengraph.jpg`;

export type SeoDefinition = {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const PUBLIC_SEO: Record<string, SeoDefinition> = {
  "/": {
    title: "فنشها | خدمات الصيانة والتشطيب في مصر",
    description:
      "فنشها منصة تربط العملاء بالفنيين لطلب خدمات الصيانة المنزلية والتشطيب ومتابعة الطلبات.",
    canonicalPath: "/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "فنشها",
        url: SEO_SITE_URL,
        logo: SEO_IMAGE_URL,
        description:
          "منصة تربط العملاء بالفنيين لطلب خدمات الصيانة المنزلية والتشطيب.",
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "فنشها",
        url: SEO_SITE_URL,
        inLanguage: "ar",
      },
    ],
  },
  "/services": {
    title: "الخدمات | فنشها",
    description:
      "تصفح خدمات الصيانة المنزلية المتاحة عبر فنشها واختر الخدمة المناسبة لطلبك.",
    canonicalPath: "/services",
  },
  "/how-it-works": {
    title: "كيف تعمل فنشها؟ | فنشها",
    description:
      "تعرّف على خطوات طلب خدمة منزلية عبر فنشها من اختيار الخدمة وحتى التواصل مع الفني.",
    canonicalPath: "/how-it-works",
  },
  "/faq": {
    title: "الأسئلة الشائعة | فنشها",
    description:
      "إجابات عن الأسئلة الشائعة حول طلب خدمات الصيانة المنزلية واستخدام منصة فنشها.",
    canonicalPath: "/faq",
  },
  "/contact": {
    title: "تواصل معنا | فنشها",
    description:
      "تواصل مع فريق فنشها عبر قنوات الدعم المتاحة للاستفسارات والمساعدة.",
    canonicalPath: "/contact",
  },
  "/terms": {
    title: "الشروط والأحكام | فنشها",
    description:
      "اطلع على الشروط والأحكام المنظمة لاستخدام منصة فنشها وخدماتها.",
    canonicalPath: "/terms",
  },
  "/privacy": {
    title: "سياسة الخصوصية | فنشها",
    description:
      "تعرّف على كيفية جمع واستخدام وحماية بياناتك الشخصية عند استخدام منصة فنشها.",
    canonicalPath: "/privacy",
  },
  "/refund-policy": {
    title: "سياسة الاسترداد | فنشها",
    description:
      "اطلع على شروط طلب الاسترداد وطريقة معالجة طلبات الاسترداد المتعلقة بخدمات فنشها.",
    canonicalPath: "/refund-policy",
  },
  "/offers": {
    title: "العروض | فنشها",
    description:
      "اكتشف العروض والخصومات المنشورة على خدمات الصيانة المنزلية عبر فنشها.",
    canonicalPath: "/offers",
  },
};

const PRIVATE_PREFIXES = [
  "/admin",
  "/customer",
  "/technician",
  "/founder",
  "/messages",
  "/requests",
  "/support",
  "/wallet",
  "/r",
];

export function getSeoDefinition(pathname: string): SeoDefinition {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  const publicPage = PUBLIC_SEO[cleanPath];
  if (publicPage) return publicPage;

  const isReferral = cleanPath === "/r" || cleanPath.startsWith("/r/");
  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`),
  );
  if (isReferral || isPrivate) {
    return {
      title: "فنشها",
      description: "صفحة داخلية في منصة فنشها.",
      canonicalPath: "/",
      robots: "noindex, nofollow",
    };
  }

  return {
    title: "الصفحة غير موجودة | فنشها",
    description: "الصفحة التي تبحث عنها غير موجودة في منصة فنشها.",
    canonicalPath: "/",
    robots: "noindex, nofollow",
  };
}

function upsertMeta(
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"]`,
  );
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

export function setStructuredData(
  data: Record<string, unknown> | Record<string, unknown>[] | undefined,
) {
  const existing = document.head.querySelector<HTMLScriptElement>(
    'script[data-fnashha-jsonld="true"]',
  );
  if (!data) {
    existing?.remove();
    return;
  }
  const script = existing || document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.fnashhaJsonld = "true";
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

export function applySeo(
  definition: SeoDefinition,
  preserveExistingJsonLd = false,
) {
  const canonical = `${SEO_SITE_URL}${definition.canonicalPath === "/" ? "/" : definition.canonicalPath}`;
  document.title = definition.title;
  upsertMeta("name", "description", definition.description);
  upsertMeta("name", "robots", definition.robots || "index, follow");
  upsertMeta("property", "og:title", definition.title);
  upsertMeta("property", "og:description", definition.description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:image", SEO_IMAGE_URL);
  upsertMeta("property", "og:type", "website");
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", definition.title);
  upsertMeta("name", "twitter:description", definition.description);
  upsertMeta("name", "twitter:image", SEO_IMAGE_URL);
  upsertLink("canonical", canonical);
  if (!preserveExistingJsonLd) setStructuredData(definition.jsonLd);
}

export function SeoManager() {
  const [location] = useLocation();

  useEffect(() => {
    const definition = getSeoDefinition(location);
    applySeo(definition, location.replace(/\/+$/, "") === "/services");
  }, [location]);

  return null;
}
