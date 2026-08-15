import React, { createContext, useContext, useEffect } from "react";
import { useGetCmsSettings, getGetCmsSettingsQueryKey } from "@workspace/api-client-react";

export interface BrandingValues {
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string;
  siteNameAr: string;
  shortName: string;
  appName: string;
  siteSlogan: string;
}

const DEFAULT_BRANDING: BrandingValues = {
  logoUrl: null,
  faviconUrl: null,
  siteName: "Fnashha",
  siteNameAr: "فنشها",
  shortName: "فنشها",
  appName: "فنشها",
  siteSlogan: "صيانة بيتك بضغطة زر",
};

const BrandingContext = createContext<BrandingValues>(DEFAULT_BRANDING);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useGetCmsSettings({ query: { queryKey: getGetCmsSettingsQueryKey() } });
  const s = settings as any;

  const branding: BrandingValues = {
    logoUrl: s?.logoUrl || null,
    faviconUrl: s?.faviconUrl || null,
    siteName: s?.siteName || "Fnashha",
    siteNameAr: s?.siteNameAr || "فنشها",
    shortName: s?.shortName || s?.siteNameAr || "فنشها",
    appName: s?.appName || s?.siteNameAr || "فنشها",
    siteSlogan: s?.siteSlogan || "صيانة بيتك بضغطة زر",
  };

  useEffect(() => {
    if (branding.siteNameAr) {
      document.title = `${branding.siteNameAr} - ${branding.siteSlogan}`;
    }
  }, [branding.siteNameAr, branding.siteSlogan]);

  useEffect(() => {
    const src = branding.faviconUrl;
    if (!src) return;

    const setOrCreate = (rel: string, type?: string) => {
      let el = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.rel = rel;
        if (type) el.type = type;
        document.head.appendChild(el);
      }
      el.href = src;
    };

    setOrCreate("icon");
    setOrCreate("shortcut icon");

    const appleSelectors = [
      "link[rel='apple-touch-icon']",
      "link[rel='apple-touch-icon'][sizes='192x192']",
      "link[rel='apple-touch-icon'][sizes='512x512']",
    ];
    appleSelectors.forEach((sel) => {
      const el = document.querySelector(sel) as HTMLLinkElement | null;
      if (el) el.href = src;
    });

    const msIcon = document.querySelector("meta[name='msapplication-TileImage']") as HTMLMetaElement | null;
    if (msIcon) msIcon.content = src;
  }, [branding.faviconUrl]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
