import { useState } from "react";
import {
  useListAdminConversations,
  getListAdminConversationsQueryKey,
  useListMessages,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { MessageCircle, X, Inbox, User, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAdminListState } from "@/hooks/use-admin-list-state";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:                  { label: "قيد الانتظار",      color: "bg-yellow-100 text-yellow-800" },
  technician_selected:      { label: "تم اختيار فني",     color: "bg-blue-100 text-blue-800" },
  in_progress:              { label: "جارٍ التنفيذ",      color: "bg-indigo-100 text-indigo-800" },
  price_change_requested:   { label: "تعديل سعر",         color: "bg-orange-100 text-orange-800" },
  waiting_approval:         { label: "بانتظار الموافقة",  color: "bg-purple-100 text-purple-800" },
  completed:                { label: "مكتمل",              color: "bg-green-100 text-green-800" },
  cancelled_by_customer:    { label: "ملغي",               color: "bg-red-100 text-red-800" },
  cancelled_by_technician:  { label: "ملغي",               color: "bg-red-100 text-red-800" },
  cancelled_by_admin:       { label: "ملغي",               color: "bg-red-100 text-red-800" },
  disputed:                 { label: "متنازع عليه",        color: "bg-rose-100 text-rose-800" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}

function ConversationPanel({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const { data: messages = [], isLoading } = useListMessages(requestId, {
    query: {
      queryKey: getListMessagesQueryKey(requestId),
      refetchInterval: 10_000,
    },
  });

  const msgs = messages as any[];

  return (
    <div className="flex flex-col h-full" dir="rtl">
      <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
        <div>
          <h3 className="font-bold text-sm">المحادثة — طلب #{requestId}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{msgs.length} رسالة · للاطلاع فقط</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        )}

        {!isLoading && msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
            <MessageCircle className="w-10 h-10 mb-2 opacity-25" />
            <p className="text-sm">لا توجد رسائل</p>
          </div>
        )}

        {msgs.map((msg: any) => (
          <div key={msg.id} className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              {msg.sender?.profileImage ? (
                <img
                  src={msg.sender.profileImage}
                  className="w-7 h-7 rounded-full object-cover"
                  alt=""
                />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-semibold text-foreground">
                  {msg.sender?.fullName ?? "مجهول"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              <div className="bg-muted/60 rounded-lg px-3 py-2 text-sm inline-block max-w-full">
                {msg.type === "image" && msg.imageUrl ? (
                  <img
                    src={msg.imageUrl}
                    className="max-w-xs rounded"
                    alt="صورة"
                  />
                ) : (
                  <p className="break-words">{msg.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border flex-shrink-0">
        <p className="text-center text-xs text-muted-foreground">
          وضع القراءة فقط — لا يمكن للمشرف إرسال رسائل
        </p>
      </div>
    </div>
  );
}

export default function AdminConversations() {
  const { params, updateQuery } = useAdminListState();
  const search = params.get("search") || "";
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: conversations = [], isLoading, isError } = useListAdminConversations({
    query: {
      queryKey: getListAdminConversationsQueryKey(),
      refetchInterval: 30_000,
    },
  });

  const threads = (conversations as any[]).filter((t: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(t.request_id).includes(q) ||
      (t.customer_name ?? "").toLowerCase().includes(q) ||
      (t.technician_name ?? "").toLowerCase().includes(q) ||
      (t.service_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl">
      {/* List panel */}
      <div className={cn("flex flex-col border-l border-border bg-background transition-all", selectedId ? "w-[420px] flex-shrink-0" : "flex-1")}>
        <div className="p-5 border-b border-border flex-shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-primary" />
            مراقب المحادثات
          </h1>
          <Input
            placeholder="بحث باسم العميل أو الفني أو رقم الطلب..."
            value={search}
            onChange={(e) => updateQuery({ search: e.target.value || null }, { replace: true })}
            className="text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
            </div>
          )}

          {isError && (
            <p className="text-center py-12 text-destructive text-sm">تعذّر تحميل البيانات</p>
          )}

          {!isLoading && !isError && threads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Inbox className="w-12 h-12 mb-3 opacity-25" />
              <p className="text-sm">{search ? "لا نتائج مطابقة" : "لا توجد محادثات"}</p>
            </div>
          )}

          {threads.map((t: any) => {
            const status = STATUS_LABELS[t.status] ?? { label: t.status, color: "bg-gray-100 text-gray-700" };
            const isSelected = selectedId === t.request_id;
            return (
              <button
                key={t.request_id}
                onClick={() => setSelectedId(isSelected ? null : t.request_id)}
                className={cn(
                  "w-full text-right flex flex-col gap-1 px-5 py-3.5 border-b border-border hover:bg-muted/40 transition-colors",
                  isSelected && "bg-primary/5 border-l-2 border-l-primary"
                )}
                data-testid={`admin-conversation-${t.request_id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary">طلب #{t.request_id}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", status.color)}>
                      {status.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(t.last_message_at)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{t.service_name}</p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {t.customer_name ?? "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    {t.technician_name ?? "—"}
                  </span>
                  <span className="me-auto bg-muted text-muted-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {t.message_count} رسالة
                  </span>
                </div>

                <p className="text-xs text-foreground/70 truncate mt-0.5">
                  {t.last_message_type === "image" ? "📷 صورة" : t.last_message}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Message detail panel */}
      {selectedId && (
        <div className="flex-1 border-r border-border bg-card overflow-hidden">
          <ConversationPanel requestId={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {!selectedId && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 border-r border-border">
          <MessageCircle className="w-14 h-14 mb-3 opacity-20" />
          <p className="text-sm">اختر محادثة لعرض الرسائل</p>
        </div>
      )}
    </div>
  );
}
