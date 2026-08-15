import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Wallet, Users, Gift, BarChart2, Clock, TrendingUp, CreditCard } from "lucide-react";
import { Link } from "wouter";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
async function apiCall(path: string, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

const TXN_TYPE_LABELS: Record<string, { label: string; color: string; sign: string }> = {
  earn_pending:    { label: "مكتسبة (معلقة)", color: "bg-yellow-100 text-yellow-800", sign: "+" },
  earn_available:  { label: "مكتسبة",          color: "bg-green-100 text-green-800",  sign: "+" },
  system_cancel:   { label: "إلغاء نظام",      color: "bg-gray-100 text-gray-800",    sign: "-" },
  redeem:          { label: "حجز استخدام",      color: "bg-blue-100 text-blue-800",   sign: "-" },
  redeem_reversal: { label: "استرداد",          color: "bg-teal-100 text-teal-800",   sign: "+" },
  referral_bonus:  { label: "مكافأة إحالة",    color: "bg-purple-100 text-purple-800",sign: "+" },
  campaign:        { label: "حملة ترويجية",    color: "bg-indigo-100 text-indigo-800",sign: "+" },
  manual_credit:   { label: "إضافة يدوية",     color: "bg-green-100 text-green-800",  sign: "+" },
  manual_debit:    { label: "خصم يدوي",        color: "bg-red-100 text-red-800",      sign: "-" },
  expiry:          { label: "انتهاء صلاحية",   color: "bg-gray-100 text-gray-800",    sign: "-" },
};

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

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

export default function AdminLoyaltyDashboard() {
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["adminLoyaltyDashboard"],
    queryFn: () => apiCall("/loyalty/admin/dashboard", token || ""),
    refetchInterval: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const w = data?.wallets ?? {};
  const c = data?.credits ?? {};
  const r = data?.referrals ?? {};
  const camp = data?.campaigns ?? {};
  const recentTxns: any[] = data?.recentTransactions ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Coins className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">لوحة نظام الولاء</h1>
      </div>

      {/* Wallet Stats */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-3">إحصائيات المحافظ</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard title="إجمالي المحافظ"      value={fmt(w.totalWallets ?? 0)}  icon={Wallet}    color="bg-primary/10 text-primary" />
          <StatCard title="كوينز متاحة"          value={fmt(w.totalAvailable ?? 0)} icon={Coins}    color="bg-green-100 text-green-700" />
          <StatCard title="كوينز معلقة"          value={fmt(w.totalPending ?? 0)}   icon={Clock}    color="bg-yellow-100 text-yellow-700" />
          <StatCard title="كوينز محجوزة"         value={fmt(w.totalReserved ?? 0)}  icon={TrendingUp} color="bg-blue-100 text-blue-700" />
          <StatCard title="إجمالي مُكتسب"        value={fmt(w.totalLifetime ?? 0)}  icon={BarChart2}  color="bg-purple-100 text-purple-700" />
          <StatCard title="إجمالي مُستخدم"        value={fmt(w.totalUsed ?? 0)}      icon={Gift}       color="bg-orange-100 text-orange-700" />
        </div>
      </div>

      {/* Other stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="ائتمانات معلقة"   value={fmt(c.pendingCount ?? 0)}  icon={CreditCard}  color="bg-red-100 text-red-700"    sub={`${(c.pendingAmount ?? 0).toFixed(2)} جنيه`} />
        <StatCard title="إجمالي الإحالات"  value={fmt(r.total ?? 0)}          icon={Users}       color="bg-teal-100 text-teal-700"  sub={`${r.completed ?? 0} مكتملة`} />
        <StatCard title="إحالات معلقة"     value={fmt(r.pending ?? 0)}        icon={Users}       color="bg-yellow-100 text-yellow-700" />
        <StatCard title="حملات نشطة"       value={`${camp.active ?? 0} / ${camp.total ?? 0}`} icon={Coins} color="bg-indigo-100 text-indigo-700" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/admin/loyalty/wallets",  label: "إدارة المحافظ",      icon: Wallet },
          { href: "/admin/loyalty/credits",  label: "الائتمانات",          icon: CreditCard },
          { href: "/admin/loyalty/referrals",label: "الإحالات",            icon: Users },
          { href: "/admin/loyalty/campaigns",label: "الحملات الترويجية",   icon: Gift },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">آخر المعاملات</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTxns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد معاملات حتى الآن</p>
          ) : (
            <div className="space-y-2">
              {recentTxns.map((txn: any) => {
                const meta = TXN_TYPE_LABELS[txn.type] ?? { label: txn.type, color: "bg-gray-100 text-gray-800", sign: "" };
                return (
                  <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${meta.color} border-0`}>{meta.label}</Badge>
                      <span className="text-sm text-muted-foreground">{txn.userName || "—"}</span>
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-bold ${meta.sign === "+" ? "text-green-600" : "text-red-600"}`}>
                        {meta.sign}{txn.amount} كوين
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(txn.createdAt).toLocaleDateString("ar-EG")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
