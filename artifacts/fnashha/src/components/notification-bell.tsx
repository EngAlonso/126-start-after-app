import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Bell, CheckCheck, Megaphone, Star, MessageSquare, Package, CheckCircle2, Headphones, Receipt, X, Coins, TrendingDown, Wallet } from "lucide-react";
import {
  useListNotifications, getListNotificationsQueryKey,
  useMarkAllNotificationsRead, useMarkNotificationRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ReactNode> = {
  new_request:         <Package       className="w-4 h-4 text-blue-500" />,
  new_offer:           <CheckCircle2  className="w-4 h-4 text-green-500" />,
  technician_selected: <CheckCircle2  className="w-4 h-4 text-green-600" />,
  review_received:     <Star          className="w-4 h-4 text-yellow-500 fill-yellow-400" />,
  new_message:         <MessageSquare className="w-4 h-4 text-indigo-500" />,
  announcement:        <Megaphone     className="w-4 h-4 text-purple-500" />,
  status_change:       <CheckCircle2  className="w-4 h-4 text-blue-500" />,
  price_adjustment:    <Receipt       className="w-4 h-4 text-orange-500" />,
  support_reply:       <Headphones    className="w-4 h-4 text-cyan-500" />,
  points_added:        <Coins         className="w-4 h-4 text-green-500" />,
  points_deducted:     <TrendingDown  className="w-4 h-4 text-red-500" />,
  platform_credit_added: <Wallet      className="w-4 h-4 text-purple-500" />,
  platform_credit_paid:  <Wallet      className="w-4 h-4 text-green-600" />,
};

function getNotifPath(type: string, relatedId: number | null, role: string): string | null {
  if (!relatedId) return null;
  const isAdmin = role === "admin" || role === "super_admin";
  switch (type) {
    case "new_request":
      if (isAdmin) return `/admin/requests/${relatedId}`;
      if (role === "technician") return `/technician/requests/${relatedId}`;
      return null;
    case "technician_selected":
      if (isAdmin) return `/admin/requests/${relatedId}`;
      if (role === "technician") return `/technician/requests/${relatedId}`;
      if (role === "customer") return `/customer/requests/${relatedId}`;
      return null;
    case "status_change":
    case "price_adjustment":
      if (isAdmin) return `/admin/requests/${relatedId}`;
      if (role === "technician") return `/technician/requests/${relatedId}`;
      if (role === "customer") return `/customer/requests/${relatedId}`;
      return null;
    case "new_offer":
      if (isAdmin) return `/admin/requests/${relatedId}`;
      return `/customer/requests/${relatedId}`;
    case "new_message":
      if (role === "technician") return `/technician/chat/${relatedId}`;
      if (role === "customer")   return `/customer/chat/${relatedId}`;
      return null;
    case "support_reply":
      if (role === "technician") return `/technician/support`;
      if (role === "customer")   return `/customer/support`;
      return null;
    case "platform_credit_added":
    case "platform_credit_paid":
      if (role === "technician") return `/technician/requests/${relatedId}`;
      if (isAdmin) return `/admin/loyalty/credits`;
      return null;
    default:
      return null;
  }
}

function getAllNotifPath(role: string): string {
  if (role === "admin" || role === "super_admin") return "/admin/notifications";
  if (role === "technician") return "/technician/notifications";
  return "/customer/notifications";
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "الآن";
  if (diff < 3600)  return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function NotifList({
  notifs,
  role,
  onClickNotif,
}: {
  notifs: any[];
  role: string;
  onClickNotif: (n: any) => void;
}) {
  if (notifs.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <Bell className="w-9 h-9 mx-auto mb-2 opacity-25" />
        لا توجد إشعارات
      </div>
    );
  }
  return (
    <>
      {notifs.slice(0, 25).map((n) => {
        const path = getNotifPath(n.type, n.relatedId, role);
        return (
          <div
            key={n.id}
            onClick={() => onClickNotif(n)}
            className={cn(
              "flex gap-3 px-4 py-3.5 border-b border-border/60 transition-colors",
              !n.isRead ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40",
              path ? "cursor-pointer" : "cursor-default",
            )}
          >
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              {TYPE_ICON[n.type] ?? <Bell className="w-4 h-4 text-muted-foreground" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm leading-snug",
                !n.isRead ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
              )}>
                {n.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
            </div>

            {!n.isRead && (
              <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const role = (currentUser as any)?.role ?? "";
  const isMobile = useIsMobile();

  const { data: notifications = [] } = useListNotifications(
    {},
    { query: { refetchInterval: 20_000, queryKey: getListNotificationsQueryKey() } }
  );

  const markAllMutation = useMarkAllNotificationsRead();
  const markOneMutation  = useMarkNotificationRead();

  const notifs = notifications as any[];
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (isMobile) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile]);

  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, isMobile]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });

  const handleMarkAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAllMutation.mutate(undefined as any, { onSuccess: invalidate });
  };

  const handleClickNotif = (n: any) => {
    if (!n.isRead) {
      markOneMutation.mutate({ id: n.id } as any, { onSuccess: invalidate });
    }
    const path = getNotifPath(n.type, n.relatedId, role);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate(getAllNotifPath(role));
  };

  const DropdownHeader = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <span className="font-bold text-sm">
        الإشعارات
        {unreadCount > 0 && (
          <span className="ms-1.5 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 font-bold">
            {unreadCount}
          </span>
        )}
      </span>
      <div className="flex items-center gap-2">
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            قراءة الكل
          </button>
        )}
        {isMobile && (
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  const DropdownFooter = (
    <div className="p-3 border-t border-border">
      <button
        onClick={handleViewAll}
        className="w-full text-center text-sm font-semibold text-primary hover:bg-primary/5 rounded-lg py-2 transition-colors"
      >
        عرض كل الإشعارات
      </button>
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
        aria-label="الإشعارات"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-sidebar-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Desktop dropdown */}
      {open && !isMobile && (
        <div
          className="absolute left-0 top-full mt-2 w-[460px] max-w-[calc(100vw-2rem)] bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          dir="rtl"
        >
          {DropdownHeader}
          <div className="max-h-[420px] overflow-y-auto">
            <NotifList notifs={notifs} role={role} onClickNotif={handleClickNotif} />
          </div>
          {DropdownFooter}
        </div>
      )}

      {/* Mobile full-screen overlay */}
      {open && isMobile && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background"
          dir="rtl"
        >
          {DropdownHeader}
          <div className="flex-1 overflow-y-auto">
            <NotifList notifs={notifs} role={role} onClickNotif={handleClickNotif} />
          </div>
          {DropdownFooter}
        </div>
      )}
    </div>
  );
}
