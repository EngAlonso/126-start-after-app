import { useState } from "react";
import { useGetPointsBalance, getGetPointsBalanceQueryKey, useListPointTransactions, getListPointTransactionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, TrendingDown, Lock } from "lucide-react";

type FilterType = "all" | "credit" | "debit" | "commission";

const FILTER_LABELS: Record<FilterType, string> = {
  all: "الكل",
  credit: "مضافة",
  debit: "مخصومة",
  commission: "عمولات",
};

export default function TechnicianWallet() {
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: balanceData } = useGetPointsBalance({ query: { queryKey: getGetPointsBalanceQueryKey() } });
  const { data: transactions = [] } = useListPointTransactions(
    undefined as any,
    { query: { queryKey: getListPointTransactionsQueryKey() } }
  );

  const bd = balanceData as any;
  const totalBalance = bd?.balance ?? 0;
  const reservedPoints = bd?.reservedPoints ?? 0;
  const available = bd?.available ?? Math.max(0, totalBalance - reservedPoints);

  const allTxns = Array.isArray(transactions) ? transactions : [];
  const txns = filter === "all" ? allTxns : allTxns.filter((t: any) => t.type === filter);

  const totalAdded = allTxns.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + t.amount, 0);
  const totalDeducted = allTxns.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + t.amount, 0);
  const totalCommission = allTxns.filter((t: any) => t.type === "commission").reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">المحفظة</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Card className="bg-gradient-to-bl from-primary/30 to-primary/5 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Wallet className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">النقاط المتاحة</p>
                <p className="text-4xl font-black text-foreground">{available}</p>
                <p className="text-xs text-muted-foreground">جاهزة للاستخدام</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-bl from-orange-100 to-orange-50 border-orange-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-200/50 flex items-center justify-center">
                <Lock className="w-7 h-7 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-orange-600">نقاط محجوزة</p>
                <p className="text-4xl font-black text-orange-700">{reservedPoints}</p>
                <p className="text-xs text-orange-500">محجوزة لعروض قيد الانتظار</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground mb-5 text-center">
        الرصيد الإجمالي: <span className="font-bold text-foreground">{totalBalance}</span> نقطة (متاح + محجوز)
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-lg font-black text-green-700">+{totalAdded}</p>
            <p className="text-xs text-green-600">مضافة</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3 text-center">
            <TrendingDown className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-lg font-black text-red-700">-{totalDeducted}</p>
            <p className="text-xs text-red-600">مخصومة</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-3 text-center">
            <Lock className="w-4 h-4 text-orange-600 mx-auto mb-1" />
            <p className="text-lg font-black text-orange-700">-{totalCommission}</p>
            <p className="text-xs text-orange-600">عمولات</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">سجل المعاملات</CardTitle>
            <div className="flex gap-1 flex-wrap">
              {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  className="text-xs h-7 px-2"
                  onClick={() => setFilter(f)}
                  data-testid={`filter-${f}`}
                >
                  {FILTER_LABELS[f]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد معاملات</p>
          ) : (
            <div className="space-y-3">
              {txns.map((t: any) => {
                const isCredit = t.type === "credit";
                const isDebit = t.type === "debit";
                return (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`txn-${t.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        isCredit ? "bg-green-50" : isDebit ? "bg-red-50" : "bg-orange-50"
                      }`}>
                        {isCredit
                          ? <TrendingUp className="w-4 h-4 text-green-600" />
                          : isDebit
                            ? <TrendingDown className="w-4 h-4 text-red-600" />
                            : <Lock className="w-4 h-4 text-orange-600" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("ar-EG")}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className={`font-bold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                        {isCredit ? "+" : "-"}{t.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">الرصيد: {t.balanceAfter}</p>
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
