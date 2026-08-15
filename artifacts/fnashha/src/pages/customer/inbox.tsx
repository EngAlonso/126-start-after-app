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

export default function CustomerInbox() {
  const [, navigate] = useLocation();

  const { data: conversations = [], isLoading, isError } = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey(),
      refetchInterval: 15_000,
    },
  });

  const threads = conversations as any[];

  return (
    <div className="p-3 md:p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="mb-3 md:mb-6">
        <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          الرسائل
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">محادثاتك مع الفنيين</p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-10 text-destructive text-sm">
          تعذّر تحميل المحادثات
        </div>
      )}

      {!isLoading && !isError && threads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 md:py-24 text-muted-foreground text-center">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-muted flex items-center justify-center mb-3">
            <Inbox className="w-7 h-7 md:w-8 md:h-8 opacity-40" />
          </div>
          <p className="font-medium text-sm">لا توجد محادثات بعد</p>
          <p className="text-xs mt-1 max-w-[220px] leading-relaxed">ستظهر هنا محادثاتك مع الفنيين بعد قبول عروضهم</p>
        </div>
      )}

      {!isLoading && threads.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-card shadow-sm">
          {threads.map((t: any) => {
            const hasUnread = t.unread_count > 0;
            return (
              <button
                key={t.request_id}
                onClick={() => navigate(`/customer/chat/${t.request_id}`)}
                className={cn(
                  "w-full text-right flex items-center gap-3 px-3 md:px-5 py-3 md:py-4 transition-colors",
                  hasUnread
                    ? "bg-primary/5 hover:bg-primary/10"
                    : "hover:bg-muted/50"
                )}
                data-testid={`conversation-${t.request_id}`}
              >
                <div className="relative w-9 h-9 md:w-10 md:h-10 flex-shrink-0">
                  <div className="w-full h-full rounded-full bg-primary/15 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  </div>
                  {hasUnread && (
                    <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {t.unread_count > 9 ? "9+" : t.unread_count}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-xs md:text-sm truncate", hasUnread ? "font-bold text-foreground" : "font-semibold")}>
                      {t.technician_name ?? "فني غير محدد"}
                    </span>
                    <span className={cn("text-[10px] md:text-xs flex-shrink-0", hasUnread ? "text-primary font-semibold" : "text-muted-foreground")}>
                      {formatTime(t.last_message_at)}
                    </span>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate mt-0.5">
                    {t.service_name} · طلب #{t.request_id}
                  </p>
                  <p className={cn("text-xs md:text-sm mt-0.5 truncate", hasUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {t.last_message_type === "image" ? "📷 صورة" : t.last_message}
                  </p>
                </div>

                <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
