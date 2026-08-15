/**
 * CustomerBottomNav — self-contained mobile bottom nav for the customer role.
 * Used both inside CustomerLayout (while on /customer/* routes) and by
 * landing.tsx (when an authenticated customer visits /).
 */
import { Link, useLocation } from "wouter";
import { useBranding } from "@/contexts/branding-context";
import { useAuth } from "@/contexts/auth-context";
import { LayoutDashboard, ClipboardList, User } from "lucide-react";
import { cn } from "@/lib/utils";

const BOTTOM_NAV = [
  { href: "/customer",          icon: LayoutDashboard, label: "الرئيسية", badgeKey: "" },
  { href: "/customer/requests", icon: ClipboardList,   label: "طلباتي",   badgeKey: "" },
  { href: "/customer/profile",  icon: User,            label: "حسابي",    badgeKey: "" },
];

export function CustomerBottomNav() {
  const branding = useBranding();
  const [location] = useLocation();
  useAuth(); // keep for potential future use

  const logoActive = location === "/";

  const getTabBadge = (_badgeKey: string) => 0;

  const isTabActive = (href: string) => {
    if (href === "/customer") return location === "/customer";
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
