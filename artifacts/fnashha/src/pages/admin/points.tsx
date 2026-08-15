import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Coins, TrendingUp, TrendingDown, History, User, ShieldCheck } from "lucide-react";

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

const TXN_TYPE_LABEL: Record<string, { label: string; color: string; sign: string }> = {
  credit:     { label: "إضافة نقاط",   color: "bg-green-100 text-green-800",  sign: "+" },
  debit:      { label: "خصم نقاط",     color: "bg-red-100 text-red-800",      sign: "-" },
  commission: { label: "عمولة",         color: "bg-orange-100 text-orange-800", sign: "-" },
  release:    { label: "استرداد محجوز", color: "bg-blue-100 text-blue-800",    sign: "+" },
  reserve:    { label: "حجز نقاط",     color: "bg-yellow-100 text-yellow-800", sign: "-" },
};

export default function AdminPoints() {
  const { toast } = useToast();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"manage" | "history">("manage");
  const [techMobile, setTechMobile] = useState("");
  const [techId, setTechId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [deductLoading, setDeductLoading] = useState(false);

  const { data: allTechs } = useListUsers({ role: "technician" } as any);

  const { data: transactions = [], refetch: refetchTxns } = useQuery({
    queryKey: ["adminPointTransactions", techId],
    queryFn: () =>
      apiCall(`/points/transactions?technicianId=${techId}`, "GET", undefined, token || ""),
    enabled: !!techId,
    retry: false,
  });

  const { data: globalTransactions = [], isLoading: globalLoading } = useQuery({
    queryKey: ["adminAllPointTransactions"],
    queryFn: () => apiCall(`/points/transactions/all`, "GET", undefined, token || ""),
    enabled: activeTab === "history",
    retry: false,
    staleTime: 30_000,
  });

  const techs = (allTechs as any)?.data || [];
  const txns = Array.isArray(transactions) ? transactions : [];
  const globalTxns = Array.isArray(globalTransactions) ? globalTransactions : [];

  const findTech = () => {
    const tech = techs.find((t: any) => t.mobile === techMobile);
    if (tech) setTechId(tech.id);
    else toast({ title: "الفني غير موجود", variant: "destructive" });
  };

  const selectedTech = techs.find((t: any) => t.id === techId);

  const handleAdd = async () => {
    if (!techId || !amount) {
      toast({ title: "أدخل البيانات المطلوبة", variant: "destructive" });
      return;
    }
    setAddLoading(true);
    try {
      await apiCall("/points/add", "POST", {
        technicianId: techId,
        amount: parseInt(amount),
        description,
      }, token || "");
      refetchTxns();
      queryClient.invalidateQueries({ queryKey: ["adminAllPointTransactions"] });
      toast({ title: "تم إضافة النقاط بنجاح", description: `تمت إضافة ${amount} نقطة للفني ${selectedTech?.fullName}` });
      setAmount("");
      setDescription("");
    } catch (err: any) {
      toast({ title: "خطأ في إضافة النقاط", description: err.message, variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeduct = async () => {
    if (!techId || !amount) {
      toast({ title: "أدخل البيانات المطلوبة", variant: "destructive" });
      return;
    }
    setDeductLoading(true);
    try {
      await apiCall("/points/deduct", "POST", {
        technicianId: techId,
        amount: parseInt(amount),
        description,
      }, token || "");
      refetchTxns();
      queryClient.invalidateQueries({ queryKey: ["adminAllPointTransactions"] });
      toast({ title: "تم خصم النقاط بنجاح", description: `تم خصم ${amount} نقطة من الفني ${selectedTech?.fullName}` });
      setAmount("");
      setDescription("");
    } catch (err: any) {
      toast({ title: "خطأ في خصم النقاط", description: err.message, variant: "destructive" });
    } finally {
      setDeductLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">إدارة النقاط</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("manage")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "manage"
              ? "bg-background shadow text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            إدارة النقاط
          </span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "history"
              ? "bg-background shadow text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4" />
            سجل النقاط الكامل
          </span>
        </button>
      </div>

      {activeTab === "manage" && (
        <>
          {/* Controls */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">إضافة / خصم نقاط</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="رقم هاتف الفني"
                  value={techMobile}
                  onChange={(e) => setTechMobile(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && findTech()}
                  data-testid="input-tech-mobile"
                />
                <Button variant="outline" onClick={findTech} data-testid="button-find-tech">بحث</Button>
              </div>

              {selectedTech && (
                <div className="bg-primary/5 rounded-lg p-3 text-sm">
                  <p className="font-semibold">{selectedTech.fullName}</p>
                  <p className="text-muted-foreground">{selectedTech.mobile}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">الكمية *</label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" className="mt-1" data-testid="input-amount" />
                </div>
                <div>
                  <label className="text-sm font-medium">السبب</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="سبب الإضافة/الخصم" className="mt-1" data-testid="input-description" />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleAdd}
                  disabled={addLoading || !techId}
                  data-testid="button-add"
                >
                  <TrendingUp className="w-4 h-4 ms-2" />
                  {addLoading ? "جاري الإضافة..." : "إضافة نقاط"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeduct}
                  disabled={deductLoading || !techId}
                  data-testid="button-deduct"
                >
                  <TrendingDown className="w-4 h-4 ms-2" />
                  {deductLoading ? "جاري الخصم..." : "خصم نقاط"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent transactions for selected tech */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="w-4 h-4" />
                {selectedTech ? `معاملات ${selectedTech.fullName}` : "آخر المعاملات"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {txns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  {techId ? "لا توجد معاملات لهذا الفني" : "ابحث عن فني لعرض معاملاته"}
                </p>
              ) : (
                <div className="space-y-2">
                  {txns.slice(0, 20).map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border text-sm" data-testid={`txn-${t.id}`}>
                      <div>
                        <p className="font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("ar-EG")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${t.type === "credit" || t.type === "release" ? "text-green-600" : "text-red-600"}`}>
                          {t.type === "credit" || t.type === "release" ? "+" : "-"}{t.amount}
                        </span>
                        <Badge variant="outline" className="text-xs">رصيد: {t.balanceAfter}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "history" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4" />
              سجل النقاط الكامل
            </CardTitle>
          </CardHeader>
          <CardContent>
            {globalLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : globalTxns.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">لا توجد معاملات</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-right py-2 px-2 font-medium">التاريخ</th>
                      <th className="text-right py-2 px-2 font-medium">الفني</th>
                      <th className="text-right py-2 px-2 font-medium">نوع العملية</th>
                      <th className="text-center py-2 px-2 font-medium">المبلغ</th>
                      <th className="text-right py-2 px-2 font-medium">السبب</th>
                      <th className="text-right py-2 px-2 font-medium">نفّذ بواسطة</th>
                      <th className="text-center py-2 px-2 font-medium">رقم الطلب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalTxns.map((t: any) => {
                      const typeInfo = TXN_TYPE_LABEL[t.type] || { label: t.type, color: "bg-gray-100 text-gray-700", sign: "" };
                      const performedBy = t.performed_by || t.admin_name || "النظام";
                      return (
                        <tr key={t.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(t.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                            <br />
                            <span className="text-[10px]">{new Date(t.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">{t.technician_name || "—"}</span>
                            </div>
                            {t.technician_mobile && <p className="text-[10px] text-muted-foreground mt-0.5">{t.technician_mobile}</p>}
                          </td>
                          <td className="py-2.5 px-2">
                            <Badge className={`text-xs border-0 ${typeInfo.color}`}>{typeInfo.label}</Badge>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`font-bold ${typeInfo.sign === "+" ? "text-green-600" : "text-red-600"}`}>
                              {typeInfo.sign}{t.amount}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-xs max-w-[180px] truncate">{t.description || "—"}</td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1 text-xs">
                              <ShieldCheck className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              {performedBy}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center text-xs">
                            {t.request_id ? (
                              <Badge variant="outline" className="text-xs">#{t.request_id}</Badge>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
