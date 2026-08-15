import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useLogout, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useUserEvents } from "@/hooks/use-user-events";
import { LayoutDashboard, User, HeadphonesIcon, LogOut, MessageCircle, Phone, X, Coins, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardHeader from "@/components/dashboard-header";
import { SiteLogo } from "@/components/site-logo";
import { useBranding } from "@/contexts/branding-context";
import NotificationBell from "@/components/notification-bell";
import MessageBell from "@/components/message-bell";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { CoinsBadge } from "@/components/coins-badge";
import { useAdminMobileSwipe } from "@/hooks/use-admin-mobile-swipe";

const CUSTOMER_NAV_LINKS: { href: string; label: string; anchor?: boolean }[] = [
  { href: "/",         label: "الرئيسية" },
  { href: "/services", label: "الخدمات" },
  { href: "/offers",   label: "العروض" },
  { href: "/contact",  label: "اتصل بنا" },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("dashboard-view");
    return () => document.body.classList.remove("dashboard-view");
  }, []);

  const branding = useBranding();
  const { currentUser, logout } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openSidebar = () => setSidebarOpen(true);

  // Mount SSE event listener — handles offer_received, status_changed, request_cancelled,
  // price_adjustment_*, new_message, wallet_updated, etc. and invalidates React Query caches.
  useUserEvents();

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
    { href: "/customer",             icon: LayoutDashboard, label: "الرئيسية" },
    { href: "/customer/inbox",       icon: MessageCircle,   label: "الرسائل",       badge: newMessageCount },
    { href: "/customer/wallet",      icon: Coins,           label: "عملات فنشها" },
    { href: "/customer/referral",    icon: Gift,            label: "برنامج الإحالة" },
    { href: "/customer/profile",     icon: User,            label: "الملف الشخصي" },
    { href: "/customer/support",     icon: HeadphonesIcon,  label: "الدعم" },
    { href: "/contact",              icon: Phone,           label: "اتصل بنا" },
  ];

  const closeSidebar = () => setSidebarOpen(false);
  const swipeHandlers = useAdminMobileSwipe({
    isOpen: sidebarOpen,
    onOpen: openSidebar,
    onClose: closeSidebar,
  });

  return (
    <div className="dashboard-shell min-h-screen flex bg-background overflow-x-hidden" dir="rtl" {...swipeHandlers}>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar — kept intact for desktop and rollback */}
      <aside className={cn(
        "w-56 md:w-64 bg-sidebar border-l border-sidebar-border flex flex-col fixed h-full right-0 top-0 z-40 transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        {/* Logo */}
        <div className="p-3 md:p-5 border-b border-sidebar-border flex items-center justify-between">
          <Link href="/" style={{ textDecoration: "none" }} onClick={closeSidebar}>
            <div className="flex items-center gap-2 md:gap-3 cursor-pointer">
              <div style={{
                width: 32, height: 32, borderRadius: 9, overflow: "hidden",
                border: "1.5px solid rgba(245,197,24,0.5)",
                boxShadow: "0 2px 8px rgba(245,197,24,0.18)", flexShrink: 0,
              }}>
                <SiteLogo size={32} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div>
                <p className="font-black text-base md:text-lg text-sidebar-foreground leading-none">{branding.siteNameAr}</p>
                <p className="text-xs text-muted-foreground">منصة الخدمات</p>
              </div>
            </div>
          </Link>
          <button
            className="md:hidden p-1 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            onClick={closeSidebar}
            aria-label="إغلاق القائمة"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="p-3 md:p-4 border-b border-sidebar-border">
          <Link href="/customer/profile" style={{ textDecoration: "none" }} onClick={closeSidebar}>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-sidebar-accent rounded-lg px-1 py-1 transition-colors">
              {(currentUser as any)?.profileImage ? (
                <img
                  src={(currentUser as any).profileImage}
                  alt=""
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-border flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
              )}
              <div className="overflow-hidden flex-1">
                <p className="font-semibold text-sm text-sidebar-foreground truncate">{currentUser?.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{currentUser?.mobile}</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 md:p-3 overflow-y-auto">
          <ul className="space-y-0.5 md:space-y-1">
            {navItems.map(({ href, icon: Icon, label, badge }) => {
              const isActive = location === href;
              return (
                <li key={href}>
                  <Link href={href} onClick={closeSidebar}>
                    <div className={cn(
                      "flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-2 md:py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )} data-testid={`nav-${href.replace(/\//g, "-")}`}>
                      <Icon className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                      <span className="flex-1 truncate">{label}</span>
                      {badge != null && badge > 0 && (
                        <span className="min-w-[18px] h-[18px] md:min-w-[20px] md:h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none flex-shrink-0">
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
        <div className="p-2 md:p-3 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-2 md:py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 min-w-0 md:mr-64 min-h-screen flex flex-col">

        {/* Mobile top bar — compact, no hamburger, notification bell */}
        <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-background border-b border-border sticky top-0 z-20">
          <Link href="/" style={{ textDecoration: "none" }}>
            <div className="flex items-center gap-2">
              <SiteLogo size={26} style={{ width: 26, height: 26, objectFit: "cover", borderRadius: 6 }} />
              <span className="font-black text-foreground text-sm">{branding.siteNameAr}</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <CoinsBadge compact />
            <MessageBell />
            <NotificationBell />
          </div>
        </div>

        {/* Desktop header only */}
        <div className="hidden md:block">
          <DashboardHeader navLinks={CUSTOMER_NAV_LINKS} profileHref="/customer/profile" />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 w-full max-w-full">
          {children}
        </main>

        {/* Mobile bottom navigation bar — role-consistent across all routes including "/" */}
        <CustomerBottomNav />
      </div>
    </div>
  );
}
