import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, Coins, Users, Gift, CreditCard, TrendingUp, TrendingDown, Award } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
async function apiCall(path: string, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

function fmt(n: number) { return n.toLocaleString("ar-EG"); }

const TXN_TYPE_LABELS: Record<string, { label: string; sign: "+" | "-" }> = {
  earn_pending:    { label: "مكتسبة (معلقة)",   sign: "+" },
  earn_available:  { label: "مكتسبة (متاحة)",   sign: "+" },
  system_cancel:   { label: "إلغاء نظام",        sign: "-" },
  redeem:          { label: "استبدال / حجز",     sign: "-" },
  redeem_reversal: { label: "استرداد استبدال",   sign: "+" },
  referral_bonus:  { label: "مكافأة إحالة",      sign: "+" },
  campaign:        { label: "حملة ترويجية",      sign: "+" },
  manual_credit:   { label: "إضافة يدوية",       sign: "+" },
  manual_debit:    { label: "خصم يدوي",          sign: "-" },
  expiry:          { label: "انتهاء صلاحية",     sign: "-" },
};

function StatCard({ title, value, icon: Icon, color, sub }: { title: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-lg font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminLoyaltyReports() {
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["adminLoyaltyReports"],
    queryFn: () => apiCall("/loyalty/admin/reports", token || ""),
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  const coinsByType: any[]     = data?.coinsByType ?? [];
  const topEarners: any[]      = data?.topEarners ?? [];
  const topCampaigns: any[]    = data?.topCampaigns ?? [];
  const creditSummary: any     = data?.creditSummary ?? {};
  const referralStats: any     = data?.referralStats ?? {};
  const walletSummary: any     = data?.walletSummary ?? {};
  const execStats: any         = data?.campaignExecStats ?? {};

  // Derived totals
  const totalGranted  = coinsByType.filter(r => ["+"].includes(TXN_TYPE_LABELS[r.type]?.sign ?? "")).reduce((s, r) => s + Number(r.total), 0);
  const totalRedeemed = Number(coinsByType.find(r => r.type === "redeem")?.total ?? 0);
  const totalExpired  = Number(coinsByType.find(r => r.type === "expiry")?.total ?? 0);
  const totalReferral = Number(coinsByType.find(r => r.type === "referral_bonus")?.total ?? 0);
  const totalCampaign = Number(coinsByType.find(r => r.type === "campaign")?.total ?? 0);

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">تقارير الولاء</h1>
        <Badge variant="secondary" className="mr-auto text-xs">بيانات حية</Badge>
      </div>

      {/* Top summary stats */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-3">ملخص الكوينز</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard title="إجمالي الكوينز الممنوحة"   value={fmt(totalGranted)}  icon={TrendingUp}   color="bg-green-100 text-green-700" />
          <StatCard title="إجمالي المستبدل"            value={fmt(totalRedeemed)} icon={Coins}        color="bg-blue-100 text-blue-700" />
          <StatCard title="إجمالي المنتهي الصلاحية"   value={fmt(totalExpired)}  icon={TrendingDown}  color="bg-gray-100 text-gray-700" />
          <StatCard title="مكافآت الإحالات"            value={fmt(totalReferral)} icon={Users}        color="bg-purple-100 text-purple-700" />
          <StatCard title="توزيعات الحملات"            value={fmt(totalCampaign)} icon={Gift}         color="bg-indigo-100 text-indigo-700" />
        </div>
      </div>

      {/* Wallet totals */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-3">المحافظ</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="عدد المحافظ"     value={fmt(Number(walletSummary.totalWallets ?? 0))}        icon={Users}   color="bg-primary/10 text-primary" />
          <StatCard title="رصيد متاح (كل)" value={fmt(Number(walletSummary.totalAvailable ?? 0))}       icon={Coins}   color="bg-green-100 text-green-700" />
          <StatCard title="مكتسب (كل الوقت)" value={fmt(Number(walletSummary.totalLifetimeEarned ?? 0))} icon={TrendingUp} color="bg-teal-100 text-teal-700" />
          <StatCard title="مستخدم (كل الوقت)" value={fmt(Number(walletSummary.totalLifetimeUsed ?? 0))} icon={TrendingDown} color="bg-orange-100 text-orange-700" />
        </div>
      </div>

      {/* Platform credits + referrals + campaign execution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Platform credits */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              تكلفة ائتمانات المنصة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">إجمالي</span>
              <span className="font-bold">{parseFloat(String(creditSummary.totalAmount ?? "0")).toFixed(2)} جنيه</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">مدفوع</span>
              <span className="text-green-600">{parseFloat(String(creditSummary.paidAmount ?? "0")).toFixed(2)} جنيه</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">معلق</span>
              <span className="text-yellow-600">{parseFloat(String(creditSummary.pendingAmount ?? "0")).toFixed(2)} جنيه</span>
            </div>
          </CardContent>
        </Card>

        {/* Referral stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              إحصائيات الإحالات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">إجمالي</span>
              <span className="font-bold">{fmt(Number(referralStats.total ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">مكتملة</span>
              <span className="text-green-600">{fmt(Number(referralStats.completed ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">معلقة</span>
              <span className="text-yellow-600">{fmt(Number(referralStats.pending ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">مشبوهة</span>
              <span className="text-red-600">{fmt(Number(referralStats.flagged ?? 0))}</span>
            </div>
          </CardContent>
        </Card>

        {/* Campaign executions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              تنفيذ الحملات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">عمليات ناجحة</span>
              <span className="font-bold">{fmt(Number(execStats.totalRuns ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">عملاء مكافؤون</span>
              <span className="text-primary">{fmt(Number(execStats.totalCustomers ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">كوينز وُزّعت</span>
              <span className="text-primary font-bold">{fmt(Number(execStats.totalCoins ?? 0))}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coins breakdown by type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">توزيع الكوينز حسب النوع</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {coinsByType.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-6">لا توجد معاملات بعد</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="text-right p-3">نوع المعاملة</th>
                  <th className="text-center p-3">عدد المعاملات</th>
                  <th className="text-center p-3">إجمالي الكوينز</th>
                </tr>
              </thead>
              <tbody>
                {coinsByType.map((row: any) => {
                  const meta = TXN_TYPE_LABELS[row.type];
                  return (
                    <tr key={row.type} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-medium">{meta?.label ?? row.type}</td>
                      <td className="p-3 text-center text-muted-foreground">{fmt(Number(row.txns))}</td>
                      <td className={`p-3 text-center font-bold ${meta?.sign === "+" ? "text-green-600" : "text-red-600"}`}>
                        {meta?.sign}{fmt(Number(row.total))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Top earners + top campaigns side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top 10 earners */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              أعلى العملاء كسباً
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topEarners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center p-4">لا توجد بيانات</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right p-2">#</th>
                    <th className="text-right p-2">العميل</th>
                    <th className="text-center p-2">مكتسب</th>
                    <th className="text-center p-2">رصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {topEarners.map((e: any, i) => (
                    <tr key={e.userId} className="border-b hover:bg-muted/20">
                      <td className="p-2 text-muted-foreground font-bold">{i + 1}</td>
                      <td className="p-2">
                        <p className="font-medium">{e.userName || "—"}</p>
                        <p className="text-muted-foreground">{e.userMobile}</p>
                      </td>
                      <td className="p-2 text-center font-bold text-green-600">{fmt(e.lifetimeEarned)}</td>
                      <td className="p-2 text-center">{fmt(e.coinsBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Top campaigns */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              أعلى الحملات توزيعاً
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center p-4">لا توجد حملات منفّذة بعد</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right p-2">#</th>
                    <th className="text-right p-2">الحملة</th>
                    <th className="text-center p-2">عملاء</th>
                    <th className="text-center p-2">كوينز</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((c: any, i) => (
                    <tr key={c.campaignId} className="border-b hover:bg-muted/20">
                      <td className="p-2 text-muted-foreground font-bold">{i + 1}</td>
                      <td className="p-2 font-medium">{c.campaignName || `#${c.campaignId}`}</td>
                      <td className="p-2 text-center">{fmt(Number(c.customersReached))}</td>
                      <td className="p-2 text-center font-bold text-primary">{fmt(Number(c.totalCoins))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
