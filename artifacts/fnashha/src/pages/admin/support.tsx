import { useState } from "react";
import {
  useListTickets, getListTicketsQueryKey,
  useGetTicket, getGetTicketQueryKey,
  useReplyTicket, useUpdateTicket,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TICKET_STATUS_MAP } from "@/lib/status";
import { HeadphonesIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useAdminUnread } from "@/contexts/admin-unread-context";

export default function AdminSupport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const { markSeen, isSeenLocally } = useAdminUnread();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: tickets = [], isLoading } = useListTickets(
    undefined as any,
    { query: { queryKey: getListTicketsQueryKey() } }
  );

  const { data: ticketDetail } = useGetTicket(
    selectedTicketId!,
    { query: { enabled: !!selectedTicketId, queryKey: getGetTicketQueryKey(selectedTicketId!) } }
  );

  const replyMutation = useReplyTicket();
  const updateMutation = useUpdateTicket();

  const handleSelectTicket = (id: number) => {
    setSelectedTicketId(id);
    const t = allTickets.find((ticket: any) => ticket.id === id);
    // Instantly decrement badge + remove unread indicator — no timer needed
    markSeen("support", id, (t as { adminUnread?: boolean } | undefined)?.adminUnread === true);
  };

  const handleReply = () => {
    if (!replyText.trim() || !selectedTicketId) return;
    replyMutation.mutate(
      { id: selectedTicketId, data: { message: replyText } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(selectedTicketId) });
          setReplyText("");
          toast({ title: "تم إرسال الرد" });
        },
      }
    );
  };

  const handleStatusChange = (status: string) => {
    if (!selectedTicketId) return;
    updateMutation.mutate(
      { id: selectedTicketId, data: { status } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(selectedTicketId) });
          toast({ title: "تم التحديث" });
        },
      }
    );
  };

  const allTickets = Array.isArray(tickets) ? tickets : [];
  const ticket = ticketDetail as any;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">تذاكر الدعم</h1>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Tickets list */}
        <div>
          <h2 className="font-semibold mb-3">{allTickets.length} تذكرة</h2>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : allTickets.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center text-muted-foreground">
                <HeadphonesIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>لا توجد تذاكر</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allTickets.map((t: any) => {
                const status = TICKET_STATUS_MAP[t.status] || { label: t.status, color: "bg-gray-100" };
                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl border cursor-pointer hover:border-primary transition-colors ${selectedTicketId === t.id ? "border-primary bg-primary/5" : (t.adminUnread && !isSeenLocally("support", t.id)) ? "border-primary/50 bg-primary/[0.03]" : "border-border"}`}
                    onClick={() => handleSelectTicket(t.id)}
                    data-testid={`ticket-${t.id}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0 flex items-start gap-1.5">
                        {(t.adminUnread && !isSeenLocally("support", t.id)) && <span className="inline-block mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className={`text-sm truncate ${(t.adminUnread && !isSeenLocally("support", t.id)) ? "font-semibold" : "font-medium"}`}>{t.subject}</p>
                          <p className="text-xs text-muted-foreground">{t.user?.fullName} · {new Date(t.createdAt).toLocaleDateString("ar-EG")}</p>
                        </div>
                      </div>
                      <Badge className={`text-xs ${status.color} border-0 flex-shrink-0`}>{status.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ticket detail */}
        {ticket && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{ticket.subject}</CardTitle>
                <Select value={ticket.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-36" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">مفتوح</SelectItem>
                    <SelectItem value="in_progress">قيد المعالجة</SelectItem>
                    <SelectItem value="resolved">محلول</SelectItem>
                    <SelectItem value="closed">مغلق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">{ticket.user?.fullName} · {ticket.user?.mobile}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">{ticket.message}</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ticket.replies?.map((r: any) => (
                  <div key={r.id} className={`rounded-lg p-3 text-sm ${r.senderId === currentUser?.id || r.senderId === null ? "bg-primary/10" : "bg-muted"}`} data-testid={`reply-${r.id}`}>
                    <p className="font-semibold text-xs mb-1">{r.sender?.fullName ?? "الإدارة"}</p>
                    {r.message}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="ردّ..." data-testid="input-reply" />
                <Button size="sm" onClick={handleReply} disabled={replyMutation.isPending} data-testid="button-reply">إرسال</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
