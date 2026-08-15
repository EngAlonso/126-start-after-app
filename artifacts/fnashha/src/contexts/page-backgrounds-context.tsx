import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { API_BASE } from "@/lib/api-config";

export interface PageBgSettings {
  slug: string;
  label: string;
  imageUrl: string | null;
  enabled: boolean;
  overlayOpacity: number;
  position: string;
  size: string;
  repeat: string;
  attachment: string;
}

type BgMap = Record<string, PageBgSettings>;

interface PageBgContextValue {
  map: BgMap;
  refresh: () => void;
}

const PageBackgroundsContext = createContext<PageBgContextValue>({ map: {}, refresh: () => {} });

export function PageBackgroundsProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<BgMap>({});

  const fetchBgs = useCallback(() => {
    fetch(`${API_BASE}/api/cms/page-backgrounds`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: PageBgSettings[]) => {
        const m: BgMap = {};
        for (const item of data) m[item.slug] = item;
        setMap(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBgs();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchBgs();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchBgs]);

  return (
    <PageBackgroundsContext.Provider value={{ map, refresh: fetchBgs }}>
      {children}
    </PageBackgroundsContext.Provider>
  );
}

export function usePageBg(slug: string): PageBgSettings | null {
  const { map } = useContext(PageBackgroundsContext);
  return map[slug] ?? null;
}

export function usePageBgRefresh(): () => void {
  return useContext(PageBackgroundsContext).refresh;
}
