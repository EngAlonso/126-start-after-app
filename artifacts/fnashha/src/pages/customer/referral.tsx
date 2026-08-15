import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, CheckCheck, Users, Clock, Award, XCircle, Coins, Share2 } from "lucide-react";
import { useLoyaltyReferral, useLoyaltyConfig } from "@/hooks/use-loyalty";
import { useToast } from "@/hooks/use-toast";

function statusLabel(status: string, referrerRewarded: boolean): { text: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (status === "completed" && referrerRewarded) return { text: "مكتمل ومكافأ", variant: "default" };
  if (status === "completed") return { text: "مكتمل", variant: "secondary" };
  if (status === "fraud_flagged") return { text: "مرفوض", variant: "destructive" };
  return { text: "قيد الانتظار", variant: "outline" };
}

export default function CustomerReferral() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const { data: config } = useLoyaltyConfig();
  const { data: referralData, isLoading } = useLoyaltyReferral();

  const referral = referralData as any;
  const coinName = config?.coinName ?? "عملات فنشها";
  const stats = referral?.statistics;
  const history: any[] = referral?.rewardHistory ?? [];

  const copy = async (text: string, kind: "code" | "link") => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    toast({ title: kind === "code" ? "تم نسخ الكود" : "تم نسخ رابط الإحالة" });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = async () => {
    if (!referral?.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "انضم لفنشها",
          text: `سجّل عبر رابطي واحصل على ${config?.referralRefereeCoins ?? ""} ${coinName} مجاناً! كودي: ${referral.referralCode}`,
          url: referral.referralLink,
        });
      } catch {
        copy(referral.referralLink, "link");
      }
    } else {
      copy(referral.referralLink, "link");
    }
  };

  return (
    <div className="px-3 py-3 md:p-6 max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-primary" />
        <h1 className="text-lg md:text-2xl font-bold">برنامج الإحالة</h1>
      </div>

      {/* Hero card */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 border-0 text-primary-foreground overflow-hidden relative">
        <div className="absolute -left-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -right-4 -bottom-8 w-24 h-24 rounded-full bg-black/5" />
        <CardContent className="pt-5 pb-5 relative z-10">
          <Gift className="w-10 h-10 mb-3 text-primary-foreground/80" />
          <p className="text-lg font-black leading-tight mb-1">ادعُ أصدقاءك، اكسب {coinName}</p>
          <p className="text-sm text-primary-foreground/85 leading-relaxed">
            {config?.referralEnabled ? (
              <>
                عندما يسجل صديقك باستخدام كودك:
                <br />• أنت تحصل على <strong>{config.referralReferrerCoins}</strong> {coinName}
                <br />• صديقك يحصل على <strong>{config.referralRefereeCoins}</strong> {coinName}
              </>
            ) : (
              "ادعُ أصدقاءك للانضمام إلى فنشها"
            )}
          </p>
        </CardContent>
      </Card>

      {/* Referral code & link */}
      {isLoading ? (
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
      ) : referral?.referralCode ? (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">كود الإحالة الخاص بك</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Code */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
              <code className="flex-1 text-center text-xl font-black tracking-widest text-primary select-all">
                {referral.referralCode}
              </code>
              <Button
                variant="ghost" size="icon" className="w-9 h-9 flex-shrink-0"
                onClick={() => copy(referral.referralCode, "code")}
              >
                {copied === "code" ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            {/* Link */}
            {referral.referralLink && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg border border-border">
                <p className="flex-1 text-xs text-muted-foreground truncate" dir="ltr">{referral.referralLink}</p>
                <Button
                  variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0"
                  onClick={() => copy(referral.referralLink, "link")}
                >
                  {copied === "link" ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2 text-sm" onClick={() => copy(referral.referralLink, "link")}>
                <Copy className="w-4 h-4" />
                نسخ الرابط
              </Button>
              <Button className="gap-2 font-semibold text-sm" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
                مشاركة
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Gift className="w-8 h-8 mx-auto mb-2 opacity-25" />
            <p className="text-sm">لا يتوفر كود إحالة حالياً</p>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {!isLoading && stats && (
        <>
          {/* Total rewards earned */}
          {stats.totalRewardsEarned > 0 && (
            <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <Coins className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-yellow-700">إجمالي المكافآت المكتسبة</p>
                  <p className="text-xl font-black text-yellow-700">{stats.totalRewardsEarned.toLocaleString()} {coinName}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-base font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">الإجمالي</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <p className="text-base font-bold">{stats.pending}</p>
                <p className="text-[10px] text-muted-foreground">قيد الانتظار</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1.5">
                  <Award className="w-3.5 h-3.5 text-green-600" />
                </div>
                <p className="text-base font-bold">{stats.completed}</p>
                <p className="text-[10px] text-muted-foreground">مكتمل</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                </div>
                <p className="text-base font-bold">{stats.rejected}</p>
                <p className="text-[10px] text-muted-foreground">مرفوض</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Reward history */}
      {!isLoading && history.length > 0 && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">سجل الإحالات</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {history.map((item: any) => {
              const { text, variant } = statusLabel(item.status, item.referrerRewarded);
              const date = item.rewardedAt ?? item.createdAt;
              return (
                <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.refereeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(date).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge variant={variant} className="text-[10px] px-1.5 py-0">{text}</Badge>
                    {item.referrerRewarded && config?.referralReferrerCoins && (
                      <span className="text-xs font-bold text-green-600">+{config.referralReferrerCoins} {coinName}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="bg-muted/40">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-base">كيف يعمل البرنامج؟</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {[
            { step: "١", text: "شارك كودك أو رابطك مع أصدقائك" },
            { step: "٢", text: "يسجل صديقك في فنشها باستخدام كودك" },
            { step: "٣", text: `صديقك يحصل على ${config?.referralRefereeCoins ?? 0} ${coinName} عند التسجيل` },
            { step: "٤", text: `أنت تحصل على ${config?.referralReferrerCoins ?? 0} ${coinName} بعد إتمام أول طلب لصديقك` },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                {step}
              </div>
              <p className="text-sm leading-relaxed mt-1">{text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
