import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useLogout, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useUserEvents } from "@/hooks/use-user-events";
import { LayoutDashboard, Search, FileText, Wallet, User, HeadphonesIcon, LogOut, MessageCircle, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardHeader from "@/components/dashboard-header";
import { SiteLogo } from "@/components/site-logo";
import { useBranding } from "@/contexts/branding-context";
import { API_BASE } from "@/lib/api-config";
import NotificationBell from "@/components/notification-bell";
import MessageBell from "@/components/message-bell";
import { TechnicianBottomNav } from "@/components/technician-bottom-nav";
import { useAdminMobileSwipe } from "@/hooks/use-admin-mobile-swipe";

const AVAILABLE_STATUSES = ["pending", "offers_received"];

const TECHNICIAN_NAV_LINKS = [
  { href: "/",          label: "الرئيسية" },
  { href: "/services",  label: "الخدمات" },
  { href: "/offers",    label: "العروض" },
  { href: "/contact",   label: "اتصل بنا" },
];

const BOTTOM_NAV = [
  { href: "/technician",          icon: LayoutDashboard, label: "لوحتي",    badgeKey: "" },
  { href: "/technician/requests", icon: Search,          label: "الطلبات",  badgeKey: "available" },
  { href: "/technician/inbox",    icon: MessageCircle,   label: "الرسائل",  badgeKey: "messages" },
  { href: "/technician/wallet",   icon: Wallet,          label: "محفظتي",   badgeKey: "" },
  { href: "/technician/profile",  icon: User,            label: "حسابي",    badgeKey: "" },
];

export default function TechnicianLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("dashboard-view");
    return () => document.body.classList.remove("dashboard-view");
  }, []);

  const branding = useBranding();
  const { currentUser, logout, token } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const [availableCount, setAvailableCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openSidebar = () => setSidebarOpen(true);

  // Mount SSE event listener — handles request_created, offer_selected, offer_rejected,
  // status_changed, request_cancelled, new_message, wallet_updated, etc. and
  // invalidates React Query caches so all pages update without a manual refresh.
  useUserEvents();
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

  const { data: notifications = [] } = useListNotifications(
    {},
    { query: { refetchInterval: 20_000, queryKey: getListNotificationsQueryKey() } }
  );
  const notifs = notifications as any[];
  const newMessageCount = notifs.filter((n) => !n.isRead && n.type === "new_message").length;

  const handleLogout = () => {
    logoutMutation.mutate(undefined as any);
    logout();
  };

  const navItems = [
    { href: "/technician",          icon: LayoutDashboard, label: "لوحة التحكم" },
    { href: "/technician/requests", icon: Search,          label: "الطلبات المتاحة", badge: availableCount },
    { href: "/technician/inbox",    icon: MessageCircle,   label: "الرسائل",          badge: newMessageCount },
    { href: "/technician/wallet",   icon: Wallet,          label: "المحفظة" },
    { href: "/technician/profile",  icon: User,            label: "الملف الشخصي" },
    { href: "/technician/support",  icon: HeadphonesIcon,  label: "الدعم" },
    { href: "/contact",             icon: Phone,           label: "اتصل بنا" },
  ];

  const closeSidebar = () => setSidebarOpen(false);
  const swipeHandlers = useAdminMobileSwipe({
    isOpen: sidebarOpen,
    onOpen: openSidebar,
    onClose: closeSidebar,
  });

  const getTabBadge = (badgeKey: string) => {
    if (badgeKey === "available") return availableCount;
    if (badgeKey === "messages")  return newMessageCount;
    return 0;
  };

  const isTabActive = (href: string) => {
    if (href === "/technician") return location === "/technician";
    return location.startsWith(href);
  };

  return (
    <div className="dashboard-shell min-h-screen flex bg-background" dir="rtl" {...swipeHandlers}>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar — kept intact for desktop and rollback */}
      <aside className={cn(
        "w-64 bg-sidebar border-l border-sidebar-border flex flex-col fixed h-full right-0 top-0 z-40 transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border flex items-center justify-between">
          <Link href="/" style={{ textDecoration: "none" }} onClick={closeSidebar}>
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div style={{
                width: 36, height: 36, borderRadius: 10, overflow: "hidden",
                border: "1.5px solid rgba(245,197,24,0.5)",
                boxShadow: "0 2px 8px rgba(245,197,24,0.18)", flexShrink: 0,
              }}>
                <SiteLogo size={36} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div>
                <p className="font-black text-lg text-sidebar-foreground leading-none">{branding.siteNameAr}</p>
                <p className="text-xs text-muted-foreground">بوابة الفني</p>
              </div>
            </div>
          </Link>
          <button
            className="md:hidden p-1 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            onClick={closeSidebar}
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-sidebar-border">
          <Link href="/technician/profile" style={{ textDecoration: "none" }} onClick={closeSidebar}>
            <div className="flex items-center gap-3 cursor-pointer hover:bg-sidebar-accent rounded-lg px-1 py-1 transition-colors">
              {(currentUser as any)?.profileImage ? (
                <img
                  src={(currentUser as any).profileImage}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="overflow-hidden flex-1">
                <p className="font-semibold text-sm text-sidebar-foreground truncate">{currentUser?.fullName}</p>
                <p className="text-xs text-muted-foreground">فني</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map(({ href, icon: Icon, label, badge }) => {
              const isActive = location === href;
              return (
                <li key={`${href}-${label}`}>
                  <Link href={href} onClick={closeSidebar}>
                    <div className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )} data-testid={`nav-${href.replace(/\//g, "-")}`}>
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="flex-1">{label}</span>
                      {badge != null && badge > 0 && (
                        <span className="min-w-[20px] h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 md:mr-64 min-h-screen flex flex-col">

        {/* Mobile top bar — compact, no hamburger */}
        <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-background border-b border-border sticky top-0 z-20">
          <Link href="/" style={{ textDecoration: "none" }}>
            <div className="flex items-center gap-2">
              <SiteLogo size={26} style={{ width: 26, height: 26, objectFit: "cover", borderRadius: 6 }} />
              <span className="font-black text-foreground text-sm">{branding.siteNameAr}</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <MessageBell />
            <NotificationBell />
          </div>
        </div>

        {/* Desktop header only */}
        <div className="hidden md:block">
          <DashboardHeader navLinks={TECHNICIAN_NAV_LINKS} profileHref="/technician/profile" />
        </div>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom navigation bar — role-consistent across all routes including "/" */}
        <TechnicianBottomNav />
      </div>
    </div>
  );
}
