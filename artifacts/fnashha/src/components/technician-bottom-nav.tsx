/**
 * TechnicianBottomNav — self-contained mobile bottom nav for the technician role.
 * Used both inside TechnicianLayout (while on /technician/* routes) and by
 * landing.tsx (when an authenticated technician visits /).
 */
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useBranding } from "@/contexts/branding-context";
import { LayoutDashboard, Search, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-config";

const AVAILABLE_STATUSES = ["pending", "offers_received"];

const BOTTOM_NAV = [
  { href: "/technician",          icon: LayoutDashboard, label: "لوحتي",   badgeKey: "" },
  { href: "/technician/requests", icon: Search,          label: "الطلبات", badgeKey: "available" },
  { href: "/technician/wallet",   icon: Wallet,          label: "محفظتي",  badgeKey: "" },
  { href: "/technician/profile",  icon: User,            label: "حسابي",   badgeKey: "" },
];

export function TechnicianBottomNav() {
  const branding = useBranding();
  const { token } = useAuth();
  const [location] = useLocation();
  const [availableCount, setAvailableCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAvailableCount = () => {
    if (!token) return;
    fetch(`${API_BASE}/api/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const all: any[] = data?.data || [];
        setAvailableCount(all.filter((r) => AVAILABLE_STATUSES.includes(r.status)).length);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAvailableCount();
    intervalRef.current = setInterval(fetchAvailableCount, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const logoActive = location === "/";

  const getTabBadge = (badgeKey: string) => {
    if (badgeKey === "available") return availableCount;
    return 0;
  };

  const isTabActive = (href: string) => {
    if (href === "/technician") return location === "/technician";
    return location.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 right-0 left-0 z-30 bg-background/95 backdrop-blur border-t border-border">
      <div
        className="flex items-stretch px-1 pt-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
      >
        {/* فنشها logo tab */}
        <Link href="/" className="flex-1" style={{ textDecoration: "none" }}>
          <div className="flex flex-col items-center gap-0.5 py-1.5 relative">
            {logoActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-primary" />
            )}
            <img
              src={branding.logoUrl || "/assets/logo.png"}
              alt={branding.siteNameAr}
              style={{
                width: 22, height: 22, objectFit: "cover", borderRadius: 5,
                opacity: logoActive ? 1 : 0.55,
                transition: "opacity 0.15s",
              }}
            />
            <span className={cn(
              "text-[10px] font-medium leading-none transition-colors",
              logoActive ? "text-primary" : "text-muted-foreground"
            )}>
              {branding.siteNameAr}
            </span>
          </div>
        </Link>

        {BOTTOM_NAV.map(({ href, icon: Icon, label, badgeKey }) => {
          const active = isTabActive(href);
          const badge = getTabBadge(badgeKey);
          return (
            <Link key={href} href={href} className="flex-1" style={{ textDecoration: "none" }}>
              <div className="flex flex-col items-center gap-0.5 py-1.5 relative">
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-primary" />
                )}
                <div className="relative">
                  <Icon
                    className={cn("w-[22px] h-[22px] transition-colors", active ? "text-primary" : "text-muted-foreground")}
                    strokeWidth={active ? 2.5 : 1.75}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 min-w-[15px] h-[15px] bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] font-medium transition-colors leading-none", active ? "text-primary" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
