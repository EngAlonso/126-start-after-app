/**
 * MessageBell — header icon button for unread messages, styled to match
 * NotificationBell. Placed beside the notification bell in the shared
 * header for both Customer and Technician roles.
 */
import { Link } from "wouter";
import { MessageCircle } from "lucide-react";
import { useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";

function getInboxPath(role: string): string {
  if (role === "technician") return "/technician/inbox";
  return "/customer/inbox";
}

export default function MessageBell() {
  const { currentUser } = useAuth();
  const role = (currentUser as any)?.role ?? "";

  const { data: notifications = [] } = useListNotifications(
    {},
    { query: { refetchInterval: 20_000, queryKey: getListNotificationsQueryKey() } }
  );
  const notifs = notifications as any[];
  const unreadCount = notifs.filter((n) => !n.isRead && n.type === "new_message").length;

  return (
    <Link href={getInboxPath(role)} style={{ textDecoration: "none" }}>
      <button
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
        aria-label="الرسائل"
        data-testid="message-bell"
      >
        <MessageCircle className="w-5 h-5 text-sidebar-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </Link>
  );
}
