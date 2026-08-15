import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { useAdminListState } from "@/hooks/use-admin-list-state";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
async function apiCall(path: string, method: string, body?: any, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-800 border-0">مدفوع</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-0">معلق التسوية</Badge>;
}

export default function AdminLoyaltyCredits() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { params, updateQuery } = useAdminListState();

  const page = Math.max(1, Number(params.get("page") || "1"));
  const status = params.get("status") || "";
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState<Record<number, string>>({});
  const [payRef, setPayRef]       = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["adminLoyaltyCredits", page, status],
    queryFn: () => apiCall(`/loyalty/admin/platform-credits?page=${page}&limit=20${status ? `&status=${status}` : ""}`, "GET", undefined, token || ""),
    retry: false,
    placeholderData: (prev) => prev,
  });

  const credits: any[] = data?.credits ?? [];
  const total: number  = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  async function markPaid(id: number) {
    setMarkingId(id);
    try {
      await apiCall(`/loyalty/admin/platform-credits/${id}/mark-paid`, "PATCH", {
        paymentMethod:    payMethod[id] || undefined,
        paymentReference: payRef[id]    || undefined,
      }, token || "");
      toast({ title: "تم", description: "تم تحديد الائتمان كمدفوع" });
      qc.invalidateQueries({ queryKey: ["adminLoyaltyCredits"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">ائتمانات المنصة</h1>
        <Badge variant="secondary" className="mr-auto">{total.toLocaleString("ar-EG")} سجل</Badge>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { value: "",                    label: "الكل" },
          { value: "pending_settlement",  label: "معلق" },
          { value: "paid",                label: "مدفوع" },
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
          ) : credits.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد سجلات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right p-3">#</th>
                    <th className="text-right p-3">الفني</th>
                    <th className="text-right p-3">الطلب</th>
                    <th className="text-center p-3">المبلغ</th>
                    <th className="text-center p-3">الحالة</th>
                    <th className="text-center p-3">التاريخ</th>
                    <th className="text-center p-3">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {credits.map((c: any) => (
                    <tr key={c.id} className="border-b hover:bg-muted/20">
                      <td className="p-3 text-muted-foreground">{c.id}</td>
                      <td className="p-3">
                        <p className="font-medium">{c.techName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.techMobile}</p>
                      </td>
                      <td className="p-3">طلب #{c.requestId}</td>
                      <td className="p-3 text-center font-bold">{parseFloat(String(c.amount)).toFixed(2)} جنيه</td>
                      <td className="p-3 text-center"><StatusBadge status={c.status} /></td>
                      <td className="p-3 text-center text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-3 text-center">
                        {c.status === "pending_settlement" ? (
                          <div className="flex flex-col gap-1 items-center min-w-[150px]">
                            <Input
                              placeholder="طريقة الدفع"
                              value={payMethod[c.id] || ""}
                              onChange={(e) => setPayMethod((p) => ({ ...p, [c.id]: e.target.value }))}
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder="رقم مرجعي (اختياري)"
                              value={payRef[c.id] || ""}
                              onChange={(e) => setPayRef((p) => ({ ...p, [c.id]: e.target.value }))}
                              className="h-7 text-xs"
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs w-full gap-1"
                              disabled={markingId === c.id}
                              onClick={() => markPaid(c.id)}
                            >
                              <CheckCircle className="w-3 h-3" />
                              {markingId === c.id ? "..." : "تأكيد الدفع"}
                            </Button>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground text-center">
                            {c.paymentMethod && <p>{c.paymentMethod}</p>}
                            {c.paymentDate && <p>{new Date(c.paymentDate).toLocaleDateString("ar-EG")}</p>}
                          </div>
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
