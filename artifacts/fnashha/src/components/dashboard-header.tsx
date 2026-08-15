import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import MessageBell from "@/components/message-bell";
import { useAuth } from "@/contexts/auth-context";
import { useBranding } from "@/contexts/branding-context";
import { SiteLogo } from "@/components/site-logo";
import { CldImg } from "@/components/ui/cld-img";

interface NavLink {
  href: string;
  label: string;
  anchor?: boolean;
}

interface DashboardHeaderProps {
  navLinks: NavLink[];
  profileHref: string;
}

export default function DashboardHeader({ navLinks, profileHref }: DashboardHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentUser } = useAuth();
  const u = currentUser as any;
  const branding = useBranding();

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/97 backdrop-blur border-b border-border shadow-sm" dir="rtl">
        <div className="container mx-auto px-4 py-2.5 grid grid-cols-3 items-center">

          {/* Right column — Logo */}
          <div className="flex items-center justify-start">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0" style={{ textDecoration: "none" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, overflow: "hidden",
                border: "1.5px solid rgba(245,197,24,0.5)",
                boxShadow: "0 2px 8px rgba(245,197,24,0.18)", flexShrink: 0,
              }}>
                <SiteLogo size={34} />
              </div>
              <span className="text-base font-bold text-foreground hidden sm:block">{branding.siteNameAr}</span>
            </Link>
          </div>

          {/* Center column — Navigation (true center of viewport) */}
          <nav className="hidden md:flex items-center justify-center gap-0">
            {navLinks.map((link) =>
              link.anchor ? (
                <a key={link.href} href={link.href}>
                  <Button variant="ghost" className="font-semibold text-sm px-3 h-9">{link.label}</Button>
                </a>
              ) : (
                <Link key={link.href} href={link.href}>
                  <Button variant="ghost" className="font-semibold text-sm px-3 h-9">{link.label}</Button>
                </Link>
              )
            )}
          </nav>
          {/* Mobile: empty center placeholder to keep grid balanced */}
          <div className="md:hidden" />

          {/* Left column — Bell + Profile + Mobile menu toggle */}
          <div className="flex items-center justify-end gap-1.5">
            <MessageBell />
            <NotificationBell />
            <Link
              href={profileHref}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors cursor-pointer"
              style={{ textDecoration: "none" }}
            >
              {u?.profileImage ? (
                <CldImg
                  src={u.profileImage}
                  alt=""
                  width={64}
                  eager
                  className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
              <span className="text-sm font-semibold text-foreground hidden sm:block max-w-[130px] truncate">
                {u?.fullName}
              </span>
            </Link>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="القائمة"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden sticky top-[57px] z-20 bg-white border-b border-border shadow-lg" dir="rtl">
          <nav className="px-3 py-2 flex flex-col">
            {navLinks.map((link) =>
              link.anchor ? (
                <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start font-semibold text-sm">{link.label}</Button>
                </a>
              ) : (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start font-semibold text-sm">{link.label}</Button>
                </Link>
              )
            )}
          </nav>
        </div>
      )}
    </>
  );
}
