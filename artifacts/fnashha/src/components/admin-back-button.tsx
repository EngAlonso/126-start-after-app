import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ADMIN_HISTORY_KEY = "__fnashha_admin_navigation_history";

function getCurrentUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function readAdminHistory(): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(ADMIN_HISTORY_KEY) || "[]");
    return Array.isArray(value) && value.every((entry) => typeof entry === "string")
      ? value
      : [];
  } catch {
    return [];
  }
}

function writeAdminHistory(history: string[]) {
  try {
    sessionStorage.setItem(ADMIN_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Session storage can be unavailable in privacy-restricted browsers.
  }
}

function isAdminUrl(url: string) {
  return (
    url === "/admin" ||
    url.startsWith("/admin/") ||
    url === "/founder/settings" ||
    url.startsWith("/founder/")
  );
}

/**
 * Tracks the Admin navigation entries separately from the browser's complete
 * history. This lets the back button distinguish a direct Admin URL from an
 * Admin page that was actually reached from another Admin page.
 */
export function AdminNavigationTracker() {
  const [location] = useLocation();
  const search = useSearch();
  const isFirstRender = useRef(true);
  const pendingNavigation = useRef<"pop" | "replace" | "push" | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      pendingNavigation.current = "pop";
    };
    const handlePushState = () => {
      pendingNavigation.current = "push";
    };
    const handleReplaceState = () => {
      pendingNavigation.current = "replace";
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pushState", handlePushState);
    window.addEventListener("replaceState", handleReplaceState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pushState", handlePushState);
      window.removeEventListener("replaceState", handleReplaceState);
    };
  }, []);

  useEffect(() => {
    const currentUrl = getCurrentUrl();

    if (isFirstRender.current) {
      isFirstRender.current = false;
      writeAdminHistory(isAdminUrl(currentUrl) ? [currentUrl] : []);
      return;
    }

    const history = readAdminHistory();

    if (!isAdminUrl(currentUrl)) {
      pendingNavigation.current = null;
      writeAdminHistory([]);
      return;
    }

    if (pendingNavigation.current === "pop") {
      pendingNavigation.current = null;
      const previousIndex = history.lastIndexOf(currentUrl);
      writeAdminHistory(
        previousIndex >= 0 ? history.slice(0, previousIndex + 1) : [currentUrl],
      );
      return;
    }

    if (pendingNavigation.current === "replace") {
      pendingNavigation.current = null;
      writeAdminHistory(
        history.length > 0 ? [...history.slice(0, -1), currentUrl] : [currentUrl],
      );
      return;
    }

    pendingNavigation.current = null;
    if (history[history.length - 1] !== currentUrl) {
      writeAdminHistory([...history, currentUrl]);
    }
  }, [location, search]);

  return null;
}

const FALLBACK_ROUTES: Array<[string, string]> = [
  ["/admin/loyalty/campaigns/history", "/admin/loyalty/campaigns"],
  ["/admin/loyalty/wallets/", "/admin/loyalty/wallets"],
  ["/admin/technicians/", "/admin/technicians"],
  ["/admin/requests/", "/admin/requests"],
  ["/admin/invoices/", "/admin/invoices"],
];

/**
 * Returns a sensible parent route for a direct Admin URL. Known detail
 * routes get their list route; other future nested routes fall back to their
 * immediate Admin parent.
 */
export function getAdminFallbackPath(pathname = window.location.pathname) {
  const exactMatch = FALLBACK_ROUTES.find(([prefix]) => pathname.startsWith(prefix));
  if (exactMatch) return exactMatch[1];

  if (pathname === "/founder/settings") return "/admin";
  if (!pathname.startsWith("/admin/")) return "/admin";

  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "/admin";
}

interface AdminBackButtonProps {
  fallback?: string;
  className?: string;
}

export function AdminBackButton({ fallback, className }: AdminBackButtonProps) {
  const [, navigate] = useLocation();
  const fallbackPath = fallback ?? getAdminFallbackPath();

  const handleBack = () => {
    if (readAdminHistory().length > 1) {
      window.history.back();
      return;
    }

    navigate(fallbackPath);
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleBack}
      className={cn("gap-2", className)}
      aria-label="الرجوع إلى الصفحة السابقة"
      data-testid="admin-back-button"
    >
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
      رجوع
    </Button>
  );
}
