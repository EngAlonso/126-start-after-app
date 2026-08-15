import { useLocation } from "wouter";
import { Bell, CheckCheck, Megaphone, Star, MessageSquare, Package, CheckCircle2, Headphones, Receipt, Coins, TrendingDown, Wallet } from "lucide-react";
import {
  useListNotifications, getListNotificationsQueryKey,
  useMarkAllNotificationsRead, useMarkNotificationRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ReactNode> = {
  new_request:         <Package       className="w-5 h-5 text-blue-500" />,
  new_offer:           <CheckCircle2  className="w-5 h-5 text-green-500" />,
  technician_selected: <CheckCircle2  className="w-5 h-5 text-green-600" />,
  review_received:     <Star          className="w-5 h-5 text-yellow-500 fill-yellow-400" />,
  new_message:         <MessageSquare className="w-5 h-5 text-indigo-500" />,
  announcement:        <Megaphone     className="w-5 h-5 text-purple-500" />,
  status_change:       <CheckCircle2  className="w-5 h-5 text-blue-500" />,
  price_adjustment:    <Receipt       className="w-5 h-5 text-orange-500" />,
  support_reply:       <Headphones    className="w-5 h-5 text-cyan-500" />,
  points_added:        <Coins         className="w-5 h-5 text-green-500" />,
  points_deducted:     <TrendingDown  className="w-5 h-5 text-red-500" />,
  platform_credit_added: <Wallet      className="w-5 h-5 text-purple-500" />,
  platform_credit_paid:  <Wallet      className="w-5 h-5 text-green-600" />,
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

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "الآن";
  if (diff < 3600)  return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

export default function NotificationsPage() {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const role = (currentUser as any)?.role ?? "";

  const { data: notifications = [], isLoading } = useListNotifications(
    {},
    { query: { refetchInterval: 30_000, queryKey: getListNotificationsQueryKey() } }
  );

  const markAllMutation = useMarkAllNotificationsRead();
  const markOneMutation  = useMarkNotificationRead();

  const notifs = notifications as any[];
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });

  const handleMarkAll = () => {
    markAllMutation.mutate(undefined as any, { onSuccess: invalidate });
  };

  const handleClickNotif = (n: any) => {
    if (!n.isRead) {
      markOneMutation.mutate({ id: n.id } as any, { onSuccess: invalidate });
    }
    const path = getNotifPath(n.type, n.relatedId, role);
    if (path) navigate(path);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">الإشعارات</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">{unreadCount} غير مقروء</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={markAllMutation.isPending}
            className="flex items-center gap-1.5 text-sm"
          >
            <CheckCheck className="w-4 h-4" />
            قراءة الكل
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notifs.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-25" />
          <p className="font-medium">لا توجد إشعارات</p>
          <p className="text-sm mt-1">ستظهر هنا إشعاراتك عند وصولها</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => {
            const path = getNotifPath(n.type, n.relatedId, role);
            return (
              <div
                key={n.id}
                onClick={() => handleClickNotif(n)}
                className={cn(
                  "flex gap-4 p-4 rounded-xl border transition-colors",
                  !n.isRead
                    ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                    : "bg-background border-border hover:bg-muted/40",
                  path ? "cursor-pointer" : "cursor-default"
                )}
                data-testid={`notif-${n.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {TYPE_ICON[n.type] ?? <Bell className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm leading-snug",
                    !n.isRead ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  )}>
                    {n.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1.5">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
