import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronLeft, ChevronRight, CheckCircle, Clock, AlertTriangle } from "lucide-react";
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
  if (status === "completed")    return <Badge className="bg-green-100 text-green-800 border-0 gap-1"><CheckCircle className="w-3 h-3" />مكتملة</Badge>;
  if (status === "fraud_flagged") return <Badge className="bg-red-100 text-red-800 border-0 gap-1"><AlertTriangle className="w-3 h-3" />مشبوهة</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-0 gap-1"><Clock className="w-3 h-3" />معلقة</Badge>;
}

export default function AdminLoyaltyReferrals() {
  const { token } = useAuth();
  const { params, updateQuery } = useAdminListState();
  const page = Math.max(1, Number(params.get("page") || "1"));
  const status = params.get("status") || "";

  const { data, isLoading } = useQuery({
    queryKey: ["adminLoyaltyReferrals", page, status],
    queryFn: () => apiCall(`/loyalty/admin/referrals?page=${page}&limit=20${status ? `&status=${status}` : ""}`, token || ""),
    retry: false,
    placeholderData: (prev) => prev,
  });

  const referrals: any[] = data?.referrals ?? [];
  const total: number    = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">سجل الإحالات</h1>
        <Badge variant="secondary" className="mr-auto">{total.toLocaleString("ar-EG")} إحالة</Badge>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "",              label: "الكل" },
          { value: "pending",       label: "معلقة" },
          { value: "completed",     label: "مكتملة" },
          { value: "fraud_flagged", label: "مشبوهة" },
        ].map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={status === f.value ? "default" : "outline"}
            onClick={() => updateQuery({ status: f.value || null, page: null })}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : referrals.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد إحالات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right p-3">#</th>
                    <th className="text-right p-3">المُحيل</th>
                    <th className="text-right p-3">العميل الجديد</th>
                    <th className="text-center p-3">الكود</th>
                    <th className="text-center p-3">الحالة</th>
                    <th className="text-center p-3">مكافآت</th>
                    <th className="text-center p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-muted/20">
                      <td className="p-3 text-muted-foreground">{r.id}</td>
                      <td className="p-3">
                        <p className="font-medium">{r.referrerName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.referrerMobile}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{r.refereeName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.refereeMobile}</p>
                      </td>
                      <td className="p-3 text-center font-mono text-xs bg-muted/30">{r.referralCode}</td>
                      <td className="p-3 text-center"><StatusBadge status={r.status} /></td>
                      <td className="p-3 text-center text-xs">
                        <div className="flex flex-col gap-0.5 items-center">
                          {r.referrerRewarded && <span className="text-green-600">✓ مُحيل</span>}
                          {r.refereeRewarded  && <span className="text-green-600">✓ جديد</span>}
                          {!r.referrerRewarded && !r.refereeRewarded && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="p-3 text-center text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("ar-EG")}
                        {r.rewardedAt && (
                          <p className="text-xs text-green-600">{new Date(r.rewardedAt).toLocaleDateString("ar-EG")}</p>
                        )}
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
