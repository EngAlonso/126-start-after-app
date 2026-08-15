import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Coins, ArrowRight, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";

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

function fmt(n: number) { return n.toLocaleString("ar-EG"); }

interface Props { userId: string }

export default function AdminLoyaltyWalletDetail({ userId }: Props) {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [txnPage, setTxnPage] = useState(1);
  const [adjType, setAdjType]   = useState<"manual_credit" | "manual_debit">("manual_credit");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjDesc, setAdjDesc]   = useState("");
  const [adjLoading, setAdjLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["adminLoyaltyWalletDetail", userId, txnPage],
    queryFn: () => apiCall(`/loyalty/admin/wallets/${userId}?page=${txnPage}`, "GET", undefined, token || ""),
    retry: false,
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });

  async function handleAdjust() {
    const amount = parseInt(adjAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "خطأ", description: "المبلغ يجب أن يكون رقماً موجباً", variant: "destructive" });
      return;
    }
    if (!adjDesc.trim()) {
      toast({ title: "خطأ", description: "وصف التعديل مطلوب", variant: "destructive" });
      return;
    }
    setAdjLoading(true);
    try {
      await apiCall(`/loyalty/admin/wallets/${userId}/adjust`, "POST", { type: adjType, amount, description: adjDesc }, token || "");
      toast({ title: "تم", description: adjType === "manual_credit" ? "تمت إضافة الكوينز بنجاح" : "تم خصم الكوينز بنجاح" });
      setAdjAmount(""); setAdjDesc("");
      qc.invalidateQueries({ queryKey: ["adminLoyaltyWalletDetail", userId] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setAdjLoading(false);
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
  }

  const { user, wallet, transactions = [], txnTotal = 0, txnLimit = 20 } = data ?? {};
  const totalPages = Math.ceil(txnTotal / txnLimit);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/admin/loyalty/wallets">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowRight className="w-4 h-4" />
            المحافظ
          </Button>
        </Link>
        <h1 className="text-xl font-bold">{user?.fullName || `عميل #${userId}`}</h1>
        <span className="text-sm text-muted-foreground">{user?.mobile}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Wallet balances */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              أرصدة المحفظة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {wallet ? (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">الرصيد المتاح</span>
                  <span className="font-bold text-green-600">{fmt(wallet.coinsBalance)} كوين</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">معلق</span>
                  <span className="font-medium text-yellow-600">{fmt(wallet.pendingCoins)} كوين</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">محجوز</span>
                  <span className="font-medium text-blue-600">{fmt(wallet.reservedCoins)} كوين</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-sm text-muted-foreground">إجمالي مكتسب</span>
                  <span className="font-medium">{fmt(wallet.lifetimeEarned)} كوين</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">إجمالي مستخدم</span>
                  <span className="font-medium">{fmt(wallet.lifetimeUsed)} كوين</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد محفظة لهذا العميل</p>
            )}
          </CardContent>
        </Card>

        {/* Manual adjustment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              تعديل يدوي للكوينز
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={adjType === "manual_credit" ? "default" : "outline"}
                className="flex-1 gap-1"
                onClick={() => setAdjType("manual_credit")}
              >
                <TrendingUp className="w-3 h-3" />
                إضافة
              </Button>
              <Button
                size="sm"
                variant={adjType === "manual_debit" ? "destructive" : "outline"}
                className="flex-1 gap-1"
                onClick={() => setAdjType("manual_debit")}
              >
                <TrendingDown className="w-3 h-3" />
                خصم
              </Button>
            </div>
            <Input
              type="number"
              placeholder="عدد الكوينز"
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              min={1}
            />
            <Input
              placeholder="وصف التعديل (سيظهر للعميل)"
              value={adjDesc}
              onChange={(e) => setAdjDesc(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleAdjust}
              disabled={adjLoading || !wallet}
              variant={adjType === "manual_debit" ? "destructive" : "default"}
            >
              {adjLoading ? "جاري التنفيذ..." : adjType === "manual_credit" ? "إضافة الكوينز" : "خصم الكوينز"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Transaction history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">سجل المعاملات ({fmt(txnTotal)})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-6">لا توجد معاملات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right p-3">النوع</th>
                    <th className="text-right p-3">الوصف</th>
                    <th className="text-center p-3">الكوينز</th>
                    <th className="text-center p-3">الرصيد بعد</th>
                    <th className="text-right p-3">المصدر</th>
                    <th className="text-center p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn: any) => {
                    const meta = TXN_TYPE_LABELS[txn.type] ?? { label: txn.type, color: "bg-gray-100 text-gray-800", sign: "" };
                    return (
                      <tr key={txn.id} className="border-b hover:bg-muted/20">
                        <td className="p-3">
                          <Badge className={`text-xs ${meta.color} border-0`}>{meta.label}</Badge>
                          {txn.cancelled && <Badge className="text-xs bg-red-100 text-red-700 border-0 mr-1">ملغي</Badge>}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[180px]">
                          <p className="truncate">{txn.description}</p>
                          {txn.performedBy && <p className="text-xs text-muted-foreground/70">بواسطة: {txn.performedBy === "admin" ? "أدمن" : txn.performedBy}</p>}
                        </td>
                        <td className={`p-3 text-center font-bold ${meta.sign === "+" ? "text-green-600" : "text-red-600"}`}>
                          {meta.sign}{fmt(txn.amount)}
                        </td>
                        <td className="p-3 text-center font-medium">{fmt(txn.balanceAfter)}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {txn.requestId && (
                            <Link href={`/admin/requests/${txn.requestId}`} className="text-primary underline underline-offset-2">
                              طلب #{txn.requestId}
                            </Link>
                          )}
                          {!txn.requestId && txn.sourceType === "campaign" && txn.sourceId && (
                            <span className="text-indigo-600">حملة #{txn.sourceId}</span>
                          )}
                          {!txn.requestId && txn.sourceType === "referral" && (
                            <span className="text-purple-600">إحالة #{txn.sourceId}</span>
                          )}
                          {!txn.requestId && txn.sourceType === "manual" && (
                            <span className="text-gray-500">تعديل يدوي</span>
                          )}
                          {!txn.requestId && txn.sourceType === "system" && (
                            <span className="text-gray-400">نظام</span>
                          )}
                          {!txn.requestId && !txn.sourceType && "—"}
                          {txn.expiresAt && (
                            <p className="text-orange-500 mt-0.5">ينتهي: {new Date(txn.expiresAt).toLocaleDateString("ar-EG")}</p>
                          )}
                        </td>
                        <td className="p-3 text-center text-muted-foreground">
                          {new Date(txn.createdAt).toLocaleDateString("ar-EG")}
                          <p className="text-xs text-muted-foreground/70">{new Date(txn.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</p>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={txnPage === 1} onClick={() => setTxnPage((p) => p - 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">صفحة {txnPage} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={txnPage >= totalPages} onClick={() => setTxnPage((p) => p + 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
