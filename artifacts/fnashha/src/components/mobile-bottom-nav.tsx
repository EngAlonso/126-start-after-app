import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useBranding } from "@/contexts/branding-context";
import { LayoutDashboard, ClipboardList, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const { isAuthenticated, isCustomer, isTechnician } = useAuth();
  const branding = useBranding();
  const [location] = useLocation();

  const logoSrc = branding.logoUrl || "/assets/logo.png";
  const logoActive = location === "/";

  const getDest = (customerHref: string, technicianHref: string) => {
    if (!isAuthenticated) return "/login";
    if (isCustomer) return customerHref;
    if (isTechnician) return technicianHref;
    return "/login";
  };

  const tabs = [
    { icon: LayoutDashboard, label: "لوحتي",  href: getDest("/customer", "/technician") },
    { icon: ClipboardList,   label: "طلباتي", href: getDest("/customer/requests", "/technician/requests") },
    { icon: MessageCircle,   label: "رسائل",  href: getDest("/customer/inbox", "/technician/inbox") },
    { icon: User,            label: "حسابي",  href: getDest("/customer/profile", "/technician/profile") },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 right-0 left-0 z-30 bg-background/95 backdrop-blur border-t border-border"
      dir="rtl"
    >
      <div
        className="flex items-stretch px-1 pt-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
      >
        {/* Logo / فنشها tab */}
        <Link href="/" className="flex-1" style={{ textDecoration: "none" }}>
          <div className="flex flex-col items-center gap-0.5 py-1.5 relative">
            {logoActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-primary" />
            )}
            <img
              src={logoSrc}
              alt={branding.siteNameAr}
              style={{
                width: 22,
                height: 22,
                objectFit: "cover",
                borderRadius: 5,
                opacity: logoActive ? 1 : 0.5,
                transition: "opacity 0.15s",
              }}
            />
            <span
              className={cn(
                "text-[10px] font-medium leading-none transition-colors",
                logoActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {branding.siteNameAr}
            </span>
          </div>
        </Link>

        {tabs.map(({ href, icon: Icon, label }) => (
          <Link key={label} href={href} className="flex-1" style={{ textDecoration: "none" }}>
            <div className="flex flex-col items-center gap-0.5 py-1.5 relative">
              <Icon
                className="w-[22px] h-[22px] text-muted-foreground transition-colors"
                strokeWidth={1.75}
              />
              <span className="text-[10px] font-medium leading-none text-muted-foreground">
                {label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </nav>
  );
}
