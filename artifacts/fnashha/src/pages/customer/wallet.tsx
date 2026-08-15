import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, TrendingUp, Clock, Lock, Gift, ChevronLeft,
  ArrowDownCircle, ArrowUpCircle, RefreshCcw, AlertTriangle, CalendarClock,
} from "lucide-react";
import { useLoyaltyWallet, useLoyaltyTransactions, useLoyaltyConfig } from "@/hooks/use-loyalty";

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Transaction types that ADD coins to the customer's balance.
 * Every type in this list shows green / "+" in the wallet history.
 */
const CREDIT_TYPES = new Set([
  "earn_pending",    // coins earned, locked in pending period
  "earn_available",  // pending period elapsed; coins become spendable
  "referral_bonus",  // reward granted to referrer or referee
  "campaign",        // coins granted via admin campaign
  "manual_credit",   // admin manually added coins
  "redeem_reversal", // coins returned when request was cancelled after redemption
  // legacy / fallback names kept for backward compat:
  "credit",
  "release",
]);

function TxnIcon({ type }: { type: string }) {
  if (CREDIT_TYPES.has(type))
    return <ArrowDownCircle className="w-4 h-4 text-green-500" />;
  if (type === "expiry")
    return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  // redeem, manual_debit, system_cancel, and anything unknown
  return <ArrowUpCircle className="w-4 h-4 text-red-500" />;
}

function TxnColor(type: string): string {
  if (CREDIT_TYPES.has(type)) return "text-green-600";
  if (type === "expiry")      return "text-orange-500";
  return "text-red-500";
}

function TxnSign(type: string): string {
  return CREDIT_TYPES.has(type) ? "+" : "−";
}

/** Days until a date. Returns null if date is in the past. */
function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CustomerWallet() {
  const [page, setPage] = useState(1);
  const { data: config } = useLoyaltyConfig();
  const { data: walletData, isLoading: walletLoading } = useLoyaltyWallet();
  const { data: txnData, isLoading: txnLoading } = useLoyaltyTransactions(page);

  const wallet = walletData as any;
  const coinName    = config?.coinName    ?? "عملات فنشها";
  // Redemption formula: every coinRedeemX coins = coinRedeemY EGP discount
  const coinRedeemX = config?.coinRedeemX ?? 1;
  const coinRedeemY = config?.coinRedeemY ?? 0.5;

  const transactions: any[] = txnData?.transactions ?? [];
  const totalPages: number = txnData?.totalPages ?? 1;

  // Next expiration from wallet endpoint
  const nextExp = wallet?.nextExpiration as { amount: number; expiresAt: string } | null | undefined;
  const nextExpDays = nextExp ? daysUntil(nextExp.expiresAt) : null;

  return (
    <div className="px-3 py-3 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-5 h-5 text-yellow-600" />
        <h1 className="text-lg md:text-2xl font-bold">عملات فنشها</h1>
      </div>

      {/* Balance cards */}
      {walletLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Available */}
          <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 col-span-2">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-yellow-700 font-medium mb-1">الرصيد المتاح</p>
                  <p className="text-3xl font-black text-yellow-700">{(wallet?.availableCoins ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-yellow-600 mt-1">{coinName}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground mb-1">يعادل تقريباً</p>
                  <p className="text-xl font-bold text-green-600">{(wallet?.approximateDiscountValue ?? 0).toFixed(2)} ج</p>
                  <p className="text-xs text-muted-foreground">خصم</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">قيد الانتظار</p>
                <p className="text-lg font-bold">{(wallet?.pendingCoins ?? 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">محجوز</p>
                <p className="text-lg font-bold">{(wallet?.reservedCoins ?? 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Next expiration alert */}
      {!walletLoading && nextExp && nextExpDays !== null && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-800">أقرب انتهاء صلاحية</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-orange-700">
                    <strong>{nextExp.amount.toLocaleString()}</strong> {coinName} — تنتهي خلال <strong>{nextExpDays}</strong> {nextExpDays === 1 ? "يوم" : "أيام"}
                  </p>
                  <Badge className="text-[10px] bg-orange-200 text-orange-800 border-0">
                    {new Date(nextExp.expiresAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                  </Badge>
                </div>
                <p className="text-[11px] text-orange-600 mt-1">استخدمها قبل انتهاء صلاحيتها</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lifetime stats */}
      {!walletLoading && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المكتسب</p>
                <p className="text-lg font-bold">{(wallet?.lifetimeEarned ?? 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Gift className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المستخدم</p>
                <p className="text-lg font-bold">{(wallet?.lifetimeUsed ?? 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Program info */}
      {config?.loyaltyEnabled && (
        <Card className="bg-muted/40">
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-sm font-semibold mb-2">معلومات البرنامج</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>سعر التحويل</span>
              <span className="font-medium text-foreground">كل {coinRedeemX} {coinName} = {coinRedeemY} جنيه خصم</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>الحد الأقصى لكل طلب</span>
              <span className="font-medium text-foreground">{config.maxCoinsPerRequest?.toLocaleString()} {coinName}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>أدنى قيمة طلب</span>
              <span className="font-medium text-foreground">{config.minRequestValue} جنيه</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Referral link */}
      {config?.referralEnabled && (
        <Link href="/customer/referral">
          <div className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Gift className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">برنامج الإحالة</p>
                <p className="text-xs text-muted-foreground">ادعُ أصدقاءك واكسب {config.referralReferrerCoins} {coinName}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-base">سجل المعاملات</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {txnLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Coins className="w-8 h-8 mx-auto mb-2 opacity-25" />
              <p className="text-sm">لا توجد معاملات بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => {
                const expDate: string | null = tx.expiresAt ?? null;
                const expDays = daysUntil(expDate);
                // Show expiry info for any transaction that carries an expiresAt date
                // (earn_pending, earn_available — other credit types don't have expiry dates)
                const isEarning = CREDIT_TYPES.has(tx.type) && !!expDate;
                const isExpired = expDate && new Date(expDate) <= new Date();

                return (
                  <div key={tx.id} className="py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <TxnIcon type={tx.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description || tx.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                        {/* Expiry info row */}
                        {isEarning && expDate && (
                          <p className={`text-[11px] mt-0.5 font-medium ${isExpired ? "text-red-500" : expDays !== null && expDays <= 7 ? "text-orange-500" : "text-muted-foreground"}`}>
                            {isExpired
                              ? "منتهية الصلاحية"
                              : expDays !== null
                                ? `تنتهي خلال ${expDays} ${expDays === 1 ? "يوم" : "أيام"}`
                                : `تنتهي: ${new Date(expDate).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}`
                            }
                          </p>
                        )}
                      </div>
                      <div className="text-left flex-shrink-0 flex flex-col items-end gap-0.5">
                        <p className={`text-sm font-bold ${TxnColor(tx.type)}`}>
                          {TxnSign(tx.type)}{Math.abs(tx.amount).toLocaleString()}
                        </p>
                        {tx.balanceAfter != null && (
                          <p className="text-[10px] text-muted-foreground">رصيد: {tx.balanceAfter}</p>
                        )}
                        {tx.cancelled && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">ملغي</Badge>
                        )}
                        {isEarning && isExpired && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-0">منتهية</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <Button
                variant="outline" size="sm" className="text-xs"
                disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              >السابق</Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button
                variant="outline" size="sm" className="text-xs"
                disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              >التالي</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
