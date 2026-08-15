import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListTickets, getListTicketsQueryKey,
  useCreateTicket, useGetTicket, getGetTicketQueryKey,
  useReplyTicket,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { HeadphonesIcon, PlusCircle, MessageCircle } from "lucide-react";
import { TICKET_STATUS_MAP } from "@/lib/status";
import { useAuth } from "@/contexts/auth-context";

const newTicketSchema = z.object({
  subject: z.string().min(3, "الموضوع مطلوب"),
  message: z.string().min(10, "الرسالة مطلوبة"),
});

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function CustomerSupport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser, token } = useAuth();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [replyText, setReplyText] = useState("");

  const { data: tickets = [], isLoading } = useListTickets(
    undefined as any,
    { query: { queryKey: getListTicketsQueryKey() } }
  );

  const { data: ticketDetail } = useGetTicket(
    selectedTicketId!,
    { query: { enabled: !!selectedTicketId, queryKey: getGetTicketQueryKey(selectedTicketId!) } }
  );

  const createMutation = useCreateTicket();
  const replyMutation = useReplyTicket();

  useEffect(() => {
    if (!selectedTicketId || !token) return;
    fetch(`${BASE_URL}/api/notifications/read-related`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ relatedId: selectedTicketId, types: ["support_reply"] }),
    })
      .then(() => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId]);

  const form = useForm<z.infer<typeof newTicketSchema>>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: { subject: "", message: "" },
  });

  const onCreateTicket = (values: z.infer<typeof newTicketSchema>) => {
    createMutation.mutate(
      { data: values as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
          toast({ title: "تم إرسال التذكرة" });
          form.reset();
          setShowNew(false);
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  const handleReply = () => {
    if (!replyText.trim() || !selectedTicketId) return;
    replyMutation.mutate(
      { id: selectedTicketId, data: { message: replyText } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(selectedTicketId) });
          setReplyText("");
        },
      }
    );
  };

  const myTickets = Array.isArray(tickets) ? tickets.filter((t: any) => t.userId === currentUser?.id) : [];
  const ticket = ticketDetail as any;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الدعم الفني</h1>
          <p className="text-muted-foreground text-sm mt-1">تواصل مع فريق الدعم لأي استفسار</p>
        </div>
        <Button onClick={() => setShowNew(!showNew)} data-testid="button-new-ticket">
          <PlusCircle className="w-4 h-4 ms-2" />
          تذكرة جديدة
        </Button>
      </div>

      {showNew && (
        <Card className="mb-6 border-primary/20">
          <CardHeader><CardTitle className="text-base">تذكرة دعم جديدة</CardTitle></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateTicket)} className="space-y-4">
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الموضوع</FormLabel>
                    <FormControl><Input placeholder="موضوع مشكلتك" data-testid="input-subject" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الرسالة</FormLabel>
                    <FormControl><Textarea placeholder="صف مشكلتك..." rows={4} data-testid="textarea-message" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? "جاري الإرسال..." : "إرسال"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowNew(false)}>إلغاء</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Tickets list */}
        <div>
          <h2 className="font-semibold mb-3">تذاكري ({myTickets.length})</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : myTickets.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <HeadphonesIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>لا توجد تذاكر</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {myTickets.map((t: any) => {
                const status = TICKET_STATUS_MAP[t.status] || { label: t.status, color: "bg-gray-100" };
                return (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-colors hover:border-primary ${selectedTicketId === t.id ? "border-primary bg-primary/5" : "border-border"}`}
                    onClick={() => setSelectedTicketId(t.id)}
                    data-testid={`ticket-${t.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">{t.subject}</p>
                      <Badge className={`text-xs ${status.color} border-0`}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(t.createdAt).toLocaleDateString("ar-EG")}</p>
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
              <CardTitle className="text-base">{ticket.subject}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">{ticket.message}</div>
              {ticket.replies?.map((r: any) => (
                <div key={r.id} className={`rounded-lg p-3 text-sm ${r.senderId === currentUser?.id ? "bg-primary/10" : "bg-muted"}`} data-testid={`reply-${r.id}`}>
                  <p className="font-semibold text-xs mb-1">{r.sender?.fullName}</p>
                  {r.message}
                </div>
              ))}
              {ticket.status !== "closed" && (
                <div className="flex gap-2">
                  <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="ردّ..." data-testid="input-reply" />
                  <Button size="sm" onClick={handleReply} disabled={replyMutation.isPending} data-testid="button-reply">إرسال</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
