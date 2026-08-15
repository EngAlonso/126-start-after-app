import { useListConversations, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { MessageCircle, ChevronLeft, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isToday) return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  if (isYesterday) return "أمس";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export default function TechnicianInbox() {
  const [, navigate] = useLocation();

  const { data: conversations = [], isLoading, isError } = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey(),
      refetchInterval: 15_000,
    },
  });

  const threads = conversations as any[];

  return (
    <div className="p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          الرسائل
        </h1>
        <p className="text-sm text-muted-foreground mt-1">محادثاتك مع العملاء</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {isError && (
        <div className="text-center py-16 text-destructive text-sm">
          تعذّر تحميل المحادثات
        </div>
      )}

      {!isLoading && !isError && threads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Inbox className="w-14 h-14 mb-4 opacity-25" />
          <p className="font-medium">لا توجد محادثات بعد</p>
          <p className="text-sm mt-1">ستظهر هنا محادثاتك مع العملاء عند بدء أي محادثة</p>
        </div>
      )}

      {!isLoading && threads.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-card shadow-sm">
          {threads.map((t: any) => {
            const hasUnread = t.unread_count > 0;
            return (
              <button
                key={t.request_id}
                onClick={() => navigate(`/technician/chat/${t.request_id}`)}
                className={cn(
                  "w-full text-right flex items-center gap-4 px-5 py-4 transition-colors",
                  hasUnread
                    ? "bg-primary/5 hover:bg-primary/10"
                    : "hover:bg-muted/50"
                )}
                data-testid={`conversation-${t.request_id}`}
              >
                <div className="relative w-10 h-10 flex-shrink-0">
                  <div className="w-full h-full rounded-full bg-primary/15 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  {hasUnread && (
                    <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {t.unread_count > 9 ? "9+" : t.unread_count}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm truncate", hasUnread ? "font-bold text-foreground" : "font-semibold")}>
                      {t.customer_name ?? "عميل"}
                    </span>
                    <span className={cn("text-xs flex-shrink-0", hasUnread ? "text-primary font-semibold" : "text-muted-foreground")}>
                      {formatTime(t.last_message_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {t.service_name} · طلب #{t.request_id}
                  </p>
                  <p className={cn("text-sm mt-1 truncate", hasUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {t.last_message_type === "image" ? "📷 صورة" : t.last_message}
                  </p>
                </div>

                <ChevronLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
