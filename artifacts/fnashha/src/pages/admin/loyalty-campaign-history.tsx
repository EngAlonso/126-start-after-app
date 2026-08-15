import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle, Coins } from "lucide-react";
import { useAdminListState } from "@/hooks/use-admin-list-state";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
async function apiCall(path: string, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge className="bg-green-100 text-green-800 border-0 gap-1"><CheckCircle className="w-3 h-3" />نجح</Badge>;
  if (status === "failed")  return <Badge className="bg-red-100 text-red-800 border-0 gap-1"><XCircle className="w-3 h-3" />فشل</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-0 gap-1"><AlertTriangle className="w-3 h-3" />جزئي</Badge>;
}

function fmt(n: number) { return n.toLocaleString("ar-EG"); }

export default function AdminLoyaltyCampaignHistory() {
  const { token } = useAuth();
  const { params, updateQuery } = useAdminListState();
  const page = Math.max(1, Number(params.get("page") || "1"));

  const { data, isLoading } = useQuery({
    queryKey: ["adminCampaignExecHistory", page],
    queryFn: () => apiCall(`/loyalty/admin/campaigns/executions?page=${page}&limit=20`, token || ""),
    retry: false,
    placeholderData: (prev) => prev,
  });

  const logs: any[]   = data?.logs ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">سجل تنفيذ الحملات</h1>
        <Badge variant="secondary" className="mr-auto">{fmt(total)} عملية</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد عمليات تنفيذ حتى الآن — نفّذ حملة من صفحة الحملات.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right p-3">#</th>
                    <th className="text-right p-3">الحملة</th>
                    <th className="text-center p-3">الحالة</th>
                    <th className="text-center p-3">المستهدفون</th>
                    <th className="text-center p-3">المكافؤون</th>
                    <th className="text-center p-3">المتجاوزون</th>
                    <th className="text-center p-3">الكوينز الموزعة</th>
                    <th className="text-center p-3">المدة</th>
                    <th className="text-center p-3">المنفّذ</th>
                    <th className="text-center p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b hover:bg-muted/20">
                      <td className="p-3 text-muted-foreground">{log.id}</td>
                      <td className="p-3">
                        <p className="font-medium">{log.campaignName || `حملة #${log.campaignId}`}</p>
                        {log.campaignCoins && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Coins className="w-3 h-3" />{log.campaignCoins} كوين/عميل
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-center"><StatusBadge status={log.status} /></td>
                      <td className="p-3 text-center">{fmt(log.customersTargeted)}</td>
                      <td className="p-3 text-center font-bold text-green-600">{fmt(log.customersRewarded)}</td>
                      <td className="p-3 text-center text-muted-foreground">{fmt(log.customersSkipped)}</td>
                      <td className="p-3 text-center font-bold text-primary">{fmt(log.totalCoinsDistributed)}</td>
                      <td className="p-3 text-center text-xs text-muted-foreground">
                        {log.durationMs != null ? `${log.durationMs.toLocaleString("ar-EG")} ms` : "—"}
                      </td>
                      <td className="p-3 text-center text-xs text-muted-foreground">
                        {log.executorName || "المشرف العام"}
                      </td>
                      <td className="p-3 text-center text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("ar-EG")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => updateQuery({ page: page - 1 })}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => updateQuery({ page: page + 1 })}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
