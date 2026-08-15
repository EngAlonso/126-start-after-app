import { Link } from "wouter";
import { useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey, useListPendingTechnicians, getListPendingTechniciansQueryKey, useListRequests, useListTickets } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Wrench, ClipboardList, CheckCircle, Clock, AlertTriangle, UserCheck, Tag, HeadphonesIcon } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:         { label: "جديد",             cls: "bg-blue-100 text-blue-800" },
  offers_received: { label: "عروض واردة",       cls: "bg-violet-100 text-violet-800" },
  open:            { label: "مفتوحة",            cls: "bg-green-100 text-green-800" },
  in_progress:     { label: "قيد المعالجة",     cls: "bg-yellow-100 text-yellow-800" },
  disputed:        { label: "متنازع عليه",       cls: "bg-red-100 text-red-800" },
};

function fmtDate(d: string | Date) {
  try { return new Date(d).toLocaleDateString("ar-EG", { day: "2-digit", month: "short" }); }
  catch { return "—"; }
}

export default function AdminDashboard() {
  const { data: overview } = useGetAnalyticsOverview({
    query: { queryKey: getGetAnalyticsOverviewQueryKey(), refetchInterval: 30_000 },
  });
  const { data: pendingTechs = [] } = useListPendingTechnicians({
    query: { queryKey: getListPendingTechniciansQueryKey(), refetchInterval: 30_000 },
  });
  const { data: disputedData }     = useListRequests({ status: "disputed" } as any, { query: { queryKey: ["admin-dashboard", "requests", "disputed"], refetchInterval: 30_000 } });
  const { data: pendingReqData }   = useListRequests({ status: "pending" } as any, { query: { queryKey: ["admin-dashboard", "requests", "pending"], refetchInterval: 30_000 } });
  const { data: offersRecvData }   = useListRequests({ status: "offers_received" } as any, { query: { queryKey: ["admin-dashboard", "requests", "offers_received"], refetchInterval: 30_000 } });
  const { data: ticketsRaw = [] }  = useListTickets(undefined, { query: { queryKey: ["admin-dashboard", "tickets"], refetchInterval: 30_000 } });

  const disputedRequests  = (disputedData as any)?.data ?? [];
  const waitingRequests   = [
    ...((pendingReqData as any)?.data ?? []),
    ...((offersRecvData as any)?.data ?? []),
  ].slice(0, 5);
  const openTickets = ((ticketsRaw as any[]) ?? [])
    .filter((t: any) => ["open", "in_progress"].includes(t.status))
    .slice(0, 5);

  const ov = overview as any;

  const stats = [
    { label: "إجمالي العملاء",        value: ov?.totalCustomers   ?? "—", icon: Users,          color: "text-blue-600",   bg: "bg-blue-50" },
    { label: "الفنيون النشطون",       value: ov?.activeTechnicians ?? "—", icon: Wrench,         color: "text-green-600",  bg: "bg-green-50" },
    { label: "في انتظار الموافقة",    value: ov?.pendingApprovals  ?? "—", icon: UserCheck,      color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "إجمالي الطلبات",        value: ov?.totalRequests     ?? "—", icon: ClipboardList,  color: "text-purple-600", bg: "bg-purple-50" },
    { label: "طلبات مفتوحة",         value: ov?.openRequests      ?? "—", icon: Clock,           color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "طلبات مكتملة",         value: ov?.completedRequests ?? "—", icon: CheckCircle,     color: "text-green-600",  bg: "bg-green-50" },
    { label: "طلبات ملغاة",          value: ov?.cancelledRequests ?? "—", icon: AlertTriangle,   color: "text-orange-600", bg: "bg-orange-50" },
    { label: "متنازع عليها",          value: ov?.disputedRequests  ?? "—", icon: AlertTriangle,  color: "text-red-600",    bg: "bg-red-50" },
    { label: "طلبات بانتظار عروض",   value: ov?.waitingForOffers  ?? "—", icon: Tag,             color: "text-violet-600", bg: "bg-violet-50" },
    { label: "تذاكر دعم مفتوحة",    value: ov?.openSupportTickets ?? "—", icon: HeadphonesIcon, color: "text-rose-600",   bg: "bg-rose-50" },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold">لوحة الإدارة</h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة عامة على المنصة</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-xl font-black text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pending technicians */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              فنيون بانتظار الموافقة
              <Link href="/admin/technicians">
                <Button variant="ghost" size="sm">عرض الكل</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(pendingTechs as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا يوجد طلبات معلقة</p>
            ) : (
              <div className="space-y-3">
                {(pendingTechs as any[]).slice(0, 5).map((t: any) => (
                  <Link href={`/admin/technicians/${t.userId}`} key={t.id}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer border border-border" data-testid={`pending-tech-${t.id}`}>
                      <div>
                        <p className="font-medium text-sm">{t.user?.fullName}</p>
                        <p className="text-xs text-muted-foreground">{t.user?.mobile}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800 border-0 text-xs">في الانتظار</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disputed requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              طلبات متنازع عليها
              <Link href="/admin/requests">
                <Button variant="ghost" size="sm">عرض الكل</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {disputedRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد نزاعات</p>
            ) : (
              <div className="space-y-3">
                {disputedRequests.slice(0, 5).map((r: any) => (
                  <Link href={`/admin/requests/${r.id}`} key={r.id}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer border border-border" data-testid={`disputed-req-${r.id}`}>
                      <div>
                        <p className="font-medium text-sm">طلب #{r.id}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>
                      </div>
                      <Badge className="bg-red-100 text-red-800 border-0 text-xs">متنازع عليه</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requests waiting for offers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                طلبات بانتظار عروض
                {waitingRequests.length > 0 && (
                  <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {waitingRequests.length}
                  </span>
                )}
              </span>
              <Link href="/admin/requests">
                <Button variant="ghost" size="sm">عرض الكل</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {waitingRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد طلبات بانتظار عروض</p>
            ) : (
              <div className="space-y-3">
                {waitingRequests.map((r: any) => {
                  const st = STATUS_LABELS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-700" };
                  return (
                    <Link href={`/admin/requests/${r.id}`} key={r.id}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer border border-border" data-testid={`waiting-req-${r.id}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">طلب #{r.id}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{r.description || r.service?.name || "—"}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(r.createdAt)}</p>
                        </div>
                        <Badge className={`${st.cls} border-0 text-xs flex-shrink-0 mr-2`}>{st.label}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open support tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                تذاكر الدعم المفتوحة
                {openTickets.length > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {openTickets.length}
                  </span>
                )}
              </span>
              <Link href="/admin/support">
                <Button variant="ghost" size="sm">عرض الكل</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openTickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد تذاكر مفتوحة</p>
            ) : (
              <div className="space-y-3">
                {openTickets.map((t: any) => {
                  const st = STATUS_LABELS[t.status] ?? { label: t.status, cls: "bg-gray-100 text-gray-700" };
                  const priorityCls = t.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";
                  return (
                    <Link href="/admin/support" key={t.id}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer border border-border" data-testid={`open-ticket-${t.id}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm line-clamp-1">{t.subject}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(t.createdAt)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 mr-2">
                          <Badge className={`${st.cls} border-0 text-[10px]`}>{st.label}</Badge>
                          {t.priority === "urgent" && (
                            <Badge className={`${priorityCls} border-0 text-[10px]`}>عاجل</Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
