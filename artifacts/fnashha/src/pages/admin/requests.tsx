import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListRequests, getListRequestsQueryKey } from "@workspace/api-client-react";
import { useAdminUnread } from "@/contexts/admin-unread-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, ChevronLeft } from "lucide-react";
import { REQUEST_STATUS_MAP } from "@/lib/status";
import { useAdminListState } from "@/hooks/use-admin-list-state";

const STATUS_OPTIONS = [
  { value: "all", label: "جميع الحالات" },
  { value: "pending", label: "بانتظار العروض" },
  { value: "offers_received", label: "تم استلام عروض" },
  { value: "technician_selected", label: "تم اختيار الفني" },
  { value: "in_progress", label: "جاري التنفيذ" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled_by_customer", label: "ملغي من العميل" },
  { value: "cancelled_by_technician", label: "ملغي من الفني" },
  { value: "cancelled_by_admin", label: "ملغي بواسطة الإدارة" },
  { value: "disputed", label: "متنازع عليه" },
];

export default function AdminRequests() {
  const { params, updateQuery } = useAdminListState();
  const status = params.get("status") || "all";
  const { isSeenLocally, trackUnread } = useAdminUnread();

  const statusFilter = status === "all" ? undefined : status;
  const { data, isLoading } = useListRequests(
    statusFilter ? { status: statusFilter } as any : undefined,
    { query: { queryKey: getListRequestsQueryKey(statusFilter ? { status: statusFilter } as any : undefined) } }
  );

  const requests = (data as any)?.data || [];

  // Register which requests were unread so detail pages can decrement the badge
  useEffect(() => {
    requests.forEach((r: any) => {
      if (!r.adminSeen) trackUnread("requests", r.id);
    });
  }, [data]);

  return (
    <div className="px-3 py-3 md:p-6 w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-5 gap-2 md:gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">إدارة الطلبات</h1>
          <p className="text-muted-foreground text-sm">إجمالي: {(data as any)?.total || 0} طلب</p>
        </div>
        <Select value={status} onValueChange={(value) => updateQuery({ status: value === "all" ? null : value })}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status">
            <SelectValue placeholder="تصفية الحالة" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد طلبات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => {
            const statusInfo = REQUEST_STATUS_MAP[r.status] || { label: r.status, color: "bg-gray-100" };
            const unread = !r.adminSeen && !isSeenLocally("requests", r.id);
            return (
              <Link href={`/admin/requests/${r.id}`} key={r.id}>
                <Card className={`cursor-pointer hover:border-primary/40 transition-all ${unread ? "border-primary/60 bg-primary/[0.03]" : ""}`} data-testid={`row-request-${r.id}`}>
                  <CardContent className="p-3 md:p-4 flex items-center justify-between gap-2 md:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                        {unread && <span className="inline-block w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        <Badge className={`text-xs ${statusInfo.color} border-0`}>{statusInfo.label}</Badge>
                        <span className="text-xs text-muted-foreground">#{r.id}</span>
                      </div>
                      <p className={`text-sm line-clamp-1 ${unread ? "font-semibold" : "font-medium"}`}>{r.description}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.address} · {new Date(r.createdAt).toLocaleDateString("ar-EG")}</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
