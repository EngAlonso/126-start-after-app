import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, LayoutDashboard, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLogout } from "@workspace/api-client-react";
import { useBranding } from "@/contexts/branding-context";
import { SiteLogo } from "@/components/site-logo";

const NAV_LINKS = [
  { href: "/", label: "الرئيسية", anchor: false },
  { href: "/services", label: "الخدمات", anchor: false },
  { href: "/offers", label: "العروض", anchor: false },
  { href: "/how-it-works", label: "تطلب إزاي", anchor: false },
  { href: "/register/technician", label: "انضم كفني", anchor: false },
  { href: "/contact", label: "اتصل بنا", anchor: false },
];

function getDashboardHref(role: string) {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "technician") return "/technician";
  return "/customer";
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const [, navigate] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined as any);
    logout();
    navigate("/");
    setUserMenuOpen(false);
    setOpen(false);
  };

  const dashboardHref = currentUser ? getDashboardHref((currentUser as any).role) : "/customer";
  const branding = useBranding();

  const AuthButtons = ({ mobile = false }: { mobile?: boolean }) => {
    if (currentUser) {
      return (
        <div className={`flex ${mobile ? "flex-col" : "items-center"} gap-1`} style={mobile ? {} : {}}>
          <div className="relative" style={mobile ? {} : { display: "inline-block" }}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex items-center gap-2 ${mobile ? "w-full justify-start px-3 py-2 rounded-lg hover:bg-muted" : ""}`}
              style={mobile ? { fontFamily: "'Cairo', sans-serif", fontSize: 14, fontWeight: 600, color: "#1a1a1a" } : {
                display: "inline-flex", alignItems: "center", height: 38, gap: 6,
                padding: "0 14px", borderRadius: 10, fontSize: 14,
                fontWeight: 700, fontFamily: "'Cairo', sans-serif",
                color: "#1a1a1a", cursor: "pointer",
                border: "1.5px solid #d4d4c8", background: "transparent",
                transition: "border-color 0.18s, background 0.18s",
              }}
            >
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#F5C518", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>
                {(currentUser as any).fullName?.[0] || "؟"}
              </div>
              <span>{(currentUser as any).fullName?.split(" ")[0]}</span>
              <ChevronDown size={14} />
            </button>

            {userMenuOpen && !mobile && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div
                  className="absolute left-0 top-full mt-2 z-50 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[180px]"
                  dir="rtl"
                >
                  <Link href={dashboardHref} onClick={() => setUserMenuOpen(false)}>
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-muted cursor-pointer transition-colors">
                      <LayoutDashboard className="w-4 h-4 text-primary" />
                      لوحة التحكم
                    </div>
                  </Link>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors w-full text-right"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل الخروج
                  </button>
                </div>
              </>
            )}
          </div>

          {mobile && (
            <>
              <Link href={dashboardHref} onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start font-semibold">
                  <LayoutDashboard className="w-4 h-4 ml-2" />
                  لوحة التحكم
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start font-semibold text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 ml-2" />
                تسجيل الخروج
              </Button>
            </>
          )}
        </div>
      );
    }

    if (mobile) {
      return (
        <>
          <Link href="/login" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-start font-semibold">تسجيل الدخول</Button>
          </Link>
          <Link href="/register" onClick={() => setOpen(false)}>
            <Button className="w-full font-semibold">إنشاء حساب</Button>
          </Link>
        </>
      );
    }

    return (
      <>
        <Link href="/login" data-testid="link-login" style={{
          display: "inline-flex", alignItems: "center", height: 38,
          padding: "0 18px", borderRadius: 10, fontSize: 14,
          fontWeight: 700, fontFamily: "'Cairo', sans-serif",
          color: "#1a1a1a", textDecoration: "none", whiteSpace: "nowrap",
          border: "1.5px solid #d4d4c8", background: "transparent",
          transition: "border-color 0.18s, background 0.18s, box-shadow 0.18s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#F5C518"; (e.currentTarget as HTMLElement).style.background = "#fef9e7"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#d4d4c8"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          تسجيل الدخول
        </Link>
        <Link href="/register" data-testid="link-register" style={{
          display: "inline-flex", alignItems: "center", height: 38,
          padding: "0 20px", borderRadius: 10, fontSize: 14,
          fontWeight: 800, fontFamily: "'Cairo', sans-serif",
          color: "#1a1a1a", textDecoration: "none", whiteSpace: "nowrap",
          background: "#F5C518", border: "1.5px solid #F5C518",
          boxShadow: "0 2px 8px rgba(245,197,24,0.25)",
          transition: "background 0.18s, box-shadow 0.18s, transform 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#e0b000"; (e.currentTarget as HTMLElement).style.borderColor = "#e0b000"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(245,197,24,0.45)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#F5C518"; (e.currentTarget as HTMLElement).style.borderColor = "#F5C518"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(245,197,24,0.25)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
        >
          إنشاء حساب
        </Link>
      </>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border shadow-sm">
        {/* Mobile row */}
        <div className="flex items-center justify-between md:hidden px-4 py-3">
          <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, overflow: "hidden", border: "1.5px solid rgba(245,197,24,0.5)", boxShadow: "0 2px 8px rgba(245,197,24,0.18)", flexShrink: 0 }}>
              <SiteLogo size={38} />
            </div>
            <span className="text-xl font-bold text-foreground">{branding.siteNameAr}</span>
          </Link>

          <button
            onClick={() => setOpen(!open)}
            aria-label="القائمة"
            style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              border: "1.5px solid rgba(245,197,24,0.5)",
              boxShadow: "0 2px 8px rgba(245,197,24,0.18)",
              background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", lineHeight: 0,
              transition: "background 0.18s, box-shadow 0.18s",
            }}
          >
            {open ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </div>

        {/* Desktop row */}
        <div className="hidden md:grid container mx-auto px-4 py-3" style={{ gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
          <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none", justifySelf: "start" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, overflow: "hidden", border: "1.5px solid rgba(245,197,24,0.5)", boxShadow: "0 2px 8px rgba(245,197,24,0.18)", flexShrink: 0 }}>
              <SiteLogo size={38} />
            </div>
            <span className="text-xl font-bold text-foreground">{branding.siteNameAr}</span>
          </Link>

          <nav className="flex items-center gap-0">
            {NAV_LINKS.map((link) =>
              link.anchor ? (
                <a key={link.href} href={link.href}>
                  <Button variant="ghost" className="font-semibold text-sm px-3">{link.label}</Button>
                </a>
              ) : (
                <Link key={link.href} href={link.href}>
                  <Button variant="ghost" className="font-semibold text-sm px-3">{link.label}</Button>
                </Link>
              )
            )}
          </nav>

          <div className="flex items-center gap-2" style={{ justifySelf: "end" }}>
            <AuthButtons />
          </div>
        </div>
      </header>

      {open && (
        <div
          className="md:hidden bg-white border-b border-border shadow-lg"
          dir="rtl"
          style={{ position: "sticky", top: 61, zIndex: 40 }}
        >
          <nav className="container mx-auto px-4 py-3 flex flex-col">
            {NAV_LINKS.map((link) =>
              link.anchor ? (
                <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start font-semibold text-sm py-3">{link.label}</Button>
                </a>
              ) : (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start font-semibold text-sm py-3">{link.label}</Button>
                </Link>
              )
            )}
            <div className="border-t border-border mt-2 pt-2 flex flex-col gap-1">
              <AuthButtons mobile />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
