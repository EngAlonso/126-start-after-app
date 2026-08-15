import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useLogout, useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey } from "@workspace/api-client-react";
import { useAdminEvents } from "@/hooks/use-admin-events";
import {
  LayoutDashboard, Users, Wrench, ClipboardList, Settings2,
  MapPin, DollarSign, Coins, HeadphonesIcon, BarChart2,
  FileText, Users2, ScrollText, LogOut, Image, Layers, MessageCircle, Tag, Database, Lock, Megaphone, ShieldAlert,
  Monitor, Globe, Palette, Menu, X, QrCode, Gift, Wallet, CreditCard, History, ReceiptText, SearchCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteLogo } from "@/components/site-logo";
import { useBranding } from "@/contexts/branding-context";
import { AdminBackButton } from "@/components/admin-back-button";
import { useAdminMobileSwipe } from "@/hooks/use-admin-mobile-swipe";

interface NavItem {
  href: string;
  icon: any;
  label: string;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "الرئيسي",
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "لوحة التحكم" },
      { href: "/admin/analytics", icon: BarChart2, label: "التحليلات", permission: "analytics.view" },
    ],
  },
  {
    label: "المستخدمون",
    items: [
      { href: "/admin/users", icon: Users, label: "العملاء", permission: "users.view" },
      { href: "/admin/technicians", icon: Wrench, label: "الفنيون", permission: "technicians.view" },
    ],
  },
  {
    label: "الطلبات",
    items: [
      { href: "/admin/requests",  icon: ClipboardList, label: "الطلبات",  permission: "requests.view" },
      { href: "/admin/invoices",  icon: ReceiptText,   label: "الفواتير", permission: "invoices.view_customer" },
    ],
  },
  {
    label: "الإعدادات",
    items: [
      { href: "/admin/services", icon: Settings2, label: "الخدمات", permission: "services.edit" },
      { href: "/admin/locations", icon: MapPin, label: "المناطق", permission: "locations.edit" },
      { href: "/admin/commission-ranges", icon: Layers, label: "نطاقات العمولة", permission: "commissions.view" },
      { href: "/admin/points", icon: Coins, label: "النقاط", permission: "points.view" },
    ],
  },
  {
    label: "إدارة الصفحات",
    items: [
      { href: "/admin/branding", icon: Palette, label: "العلامة التجارية", permission: "cms.settings" },
      { href: "/admin/hero", icon: Monitor, label: "قسم الهيرو", permission: "cms.homepage" },
      { href: "/admin/banners", icon: Image, label: "بانرات الرئيسية", permission: "cms.banners" },
      { href: "/admin/offers", icon: Tag, label: "بانرات العروض", permission: "offers.manage" },
      { href: "/admin/cms", icon: Globe, label: "المحتوى والصفحات", permission: "cms.homepage" },
      { href: "/admin/seo-pages", icon: SearchCheck, label: "صفحات محركات البحث", permission: "seo_pages.view" },
      { href: "/admin/qr-links", icon: QrCode, label: "QR وروابط التواصل", permission: "cms.homepage" },
      { href: "/admin/page-backgrounds", icon: Image, label: "خلفيات الصفحات" },
      { href: "/admin/intro-screens", icon: Layers, label: "شاشات الترحيب", permission: "cms.banners" },
    ],
  },
  {
    label: "الدعم",
    items: [
      { href: "/admin/notifications", icon: Megaphone, label: "مركز الإشعارات", permission: "notifications.manage" },
      { href: "/admin/conversations", icon: MessageCircle, label: "المحادثات", permission: "requests.view" },
      { href: "/admin/support", icon: HeadphonesIcon, label: "تذاكر الدعم", permission: "support.view" },
    ],
  },
  {
    label: "الولاء",
    items: [
      { href: "/admin/loyalty",           icon: LayoutDashboard, label: "لوحة الولاء",       permission: "loyalty.view" },
      { href: "/admin/loyalty/wallets",   icon: Wallet,          label: "محافظ العملاء",     permission: "loyalty.view" },
      { href: "/admin/loyalty/credits",   icon: CreditCard,      label: "ائتمانات المنصة",   permission: "loyalty.view" },
      { href: "/admin/loyalty/referrals", icon: Users,           label: "الإحالات",           permission: "loyalty.view" },
      { href: "/admin/loyalty/campaigns",         icon: Gift,            label: "الحملات الترويجية", permission: "loyalty.manage" },
      { href: "/admin/loyalty/campaigns/history", icon: History,         label: "سجل الحملات",        permission: "loyalty.view"   },
      { href: "/admin/loyalty/reports",           icon: BarChart2,       label: "تقارير الولاء",      permission: "loyalty.view"   },
    ],
  },
  {
    label: "النظام",
    items: [
      { href: "/admin/staff", icon: Users2, label: "الموظفون", permission: "admin.create" },
      { href: "/admin/logs", icon: ScrollText, label: "سجل الأنشطة", permission: "activity_logs.view" },
    ],
  },
];

console.log("[LAYOUT_DEBUG] page-backgrounds entry:", navGroups.find(g => g.label === "إدارة الصفحات")?.items.find(i => i.href === "/admin/page-backgrounds"));

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("dashboard-view");
    return () => document.body.classList.remove("dashboard-view");
  }, []);

  const branding = useBranding();
  const { currentUser, logout, hasPermission, isSuperAdmin, isFounder } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);
  const swipeHandlers = useAdminMobileSwipe({
    isOpen: sidebarOpen,
    onOpen: openSidebar,
    onClose: closeSidebar,
  });

  useAdminEvents();

  const { data: overview } = useGetAnalyticsOverview({
    query: { queryKey: getGetAnalyticsOverviewQueryKey(), refetchInterval: 60_000 },
  });
  const ov = overview as any;
  const badgeCounts: Record<string, number> = {
    "/admin/technicians":    ov?.unreadTechnicians      ?? 0,
    "/admin/requests":       ov?.newRequests            ?? 0,
    "/admin/support":        ov?.unreadSupportTickets   ?? 0,
    "/admin/loyalty/credits": ov?.pendingPlatformCredits ?? 0,
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined as any);
    logout();
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex-shrink-0 flex items-center justify-between">
        <Link href="/" style={{ textDecoration: "none" }} onClick={closeSidebar}>
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-primary/20" style={{ boxShadow: "0 1px 4px rgba(245,197,24,0.2)" }}>
              <SiteLogo size={32} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <p className="font-black text-sm text-sidebar-foreground leading-none">{branding.siteNameAr}</p>
              <p className="text-xs text-muted-foreground">لوحة الإدارة</p>
            </div>
          </div>
        </Link>
        <button
          className="md:hidden p-1 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          onClick={closeSidebar}
          aria-label="إغلاق القائمة"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* User */}
      <div className="p-3 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Users2 className="w-4 h-4 text-primary" />
          </div>
          <div className="overflow-hidden">
            <p className="font-semibold text-xs text-sidebar-foreground truncate">{currentUser?.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {isSuperAdmin ? "مدير عام" : "مدير"}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 overflow-y-auto">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            ({ permission }) => !permission || hasPermission(permission)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-3">
              <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">{group.label}</p>
              <ul className="space-y-0.5">
                {visibleItems.map(({ href, icon: Icon, label }) => {
                  const isActive = location === href;
                  const badge = isActive ? 0 : (badgeCounts[href] ?? 0);
                  return (
                    <li key={href}>
                      <Link href={href} onClick={closeSidebar}>
                        <div className={cn(
                          "flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        )} data-testid={`nav-admin-${href.replace(/\//g, "-")}`}>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">{label}</span>
                          {badge > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1 py-px rounded-full min-w-[16px] text-center leading-tight">
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* Database — Super Admin only */}
        {(isSuperAdmin || hasPermission("backup.create") || hasPermission("backup.download") || hasPermission("backup.restore") || hasPermission("backup.delete")) && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">الداتا بيز</p>
            <ul className="space-y-0.5">
              {[{ href: "/admin/database", icon: Database, label: "إدارة قاعدة البيانات" }].map(({ href, icon: Icon, label }) => {
                const isActive = location === href;
                return (
                  <li key={href}>
                    <Link href={href} onClick={closeSidebar}>
                      <div className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )} data-testid="nav-admin---admin-database">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Founder Settings — Founder only, invisible to everyone else */}
        {isFounder && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">الأمان والخصوصية</p>
            <ul className="space-y-0.5">
              {[{ href: "/founder/settings", icon: Lock, label: "إعدادات الحساب" }].map(({ href, icon: Icon, label }) => {
                const isActive = location === href;
                return (
                  <li key={href}>
                    <Link href={href} onClick={closeSidebar}>
                      <div className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )}>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* System Maintenance — Super Admin only */}
        {isSuperAdmin && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground px-2 mb-1">النظام</p>
            <ul className="space-y-0.5">
              {[{ href: "/admin/system-maintenance", icon: ShieldAlert, label: "صيانة النظام" }].map(({ href, icon: Icon, label }) => {
                const isActive = location === href;
                return (
                  <li key={href}>
                    <Link href={href} onClick={closeSidebar}>
                      <div className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )} data-testid="nav-admin---admin-system-maintenance">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-sidebar-border flex-shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <div className="dashboard-shell min-h-screen flex bg-background" dir="rtl" {...swipeHandlers}>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-60 bg-sidebar border-l border-sidebar-border flex flex-col fixed h-full right-0 top-0 z-40 transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 md:mr-60 min-h-screen flex flex-col bg-background">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="فتح القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <SiteLogo size={24} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 5 }} />
            <span className="font-black text-sidebar-foreground text-sm">{branding.siteNameAr}</span>
          </Link>
          <div className="w-9" />
        </div>

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {location !== "/admin" && (
            <div className="px-4 pt-4 md:px-6">
              <AdminBackButton />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
