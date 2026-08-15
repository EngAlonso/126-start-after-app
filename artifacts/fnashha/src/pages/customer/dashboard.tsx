import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle, ChevronLeft, ChevronRight, MessageCircle,
  ClipboardList, CheckCircle2, XCircle, Clock, Coins, Gift,
} from "lucide-react";
import { REQUEST_STATUS_MAP } from "@/lib/status";
import { useLoyaltyConfig, useLoyaltyWallet } from "@/hooks/use-loyalty";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Banner = {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  isActive: boolean;
  displayOrder: number;
};

function useBanners() {
  return useQuery<Banner[]>({
    queryKey: ["banners", "customer_dashboard"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/banners?location=customer_dashboard`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data.filter((b: Banner) => b.isActive) : [];
    },
    staleTime: 60_000,
  });
}

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = banners.length;

  useEffect(() => {
    if (total <= 1 || paused) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [total, paused]);

  if (total === 0) return null;

  const b = banners[index];

  return (
    <div
      className="relative overflow-hidden rounded-xl md:rounded-2xl min-h-[90px] md:min-h-[200px] select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="absolute inset-0 bg-gradient-to-l from-primary to-primary/70 transition-all duration-500"
        style={b.imageUrl ? {
          backgroundImage: `url(${b.imageUrl})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        } : {}}
      />
      {b.imageUrl && <div className="absolute inset-0 bg-black/45 rounded-xl md:rounded-2xl" />}

      <div className="relative z-10 p-3 md:p-10 text-primary-foreground">
        <h2 className="text-sm md:text-2xl font-black leading-snug mb-1">{b.title}</h2>
        {b.description && (
          <p className="text-primary-foreground/85 text-xs md:text-base mb-2 md:mb-5 max-w-lg leading-relaxed">
            {b.description}
          </p>
        )}
        {b.buttonText && (
          <a href={b.buttonLink || "#"}>
            <Button size="sm" variant="secondary" className="font-bold gap-1 h-7 text-xs md:h-9 md:text-sm">
              {b.buttonText}
              <ChevronLeft className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </Button>
          </a>
        )}
      </div>

      {total > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 md:w-8 md:h-8 rounded-full bg-black/25 hover:bg-black/45 text-white flex items-center justify-center transition-colors"
            aria-label="السابق"
          >
            <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % total)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 md:w-8 md:h-8 rounded-full bg-black/25 hover:bg-black/45 text-white flex items-center justify-center transition-colors"
            aria-label="التالي"
          >
            <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" />
          </button>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-300 ${
                  i === index ? "bg-white scale-125" : "bg-white/40 hover:bg-white/65"
                }`}
                aria-label={`الشريحة ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const ACTIVE_STATUSES = [
  "pending", "offers_received", "technician_selected", "in_progress",
  "price_change_requested", "waiting_approval", "awaiting_completion", "disputed",
];
const DONE_STATUSES = ["completed", "cancelled_by_customer", "cancelled_by_technician", "cancelled_by_admin"];

function LoyaltyBanner() {
  const { data: config } = useLoyaltyConfig();
  const { data: wallet } = useLoyaltyWallet();

  if (!config?.loyaltyEnabled) return null;

  const coins = (wallet as any)?.availableCoins ?? 0;
  const approxDiscount = (wallet as any)?.approximateDiscountValue ?? 0;
  const coinName = config.coinName;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Link href="/customer/wallet">
        <div className="relative overflow-hidden rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 p-3 cursor-pointer hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-yellow-600" />
            <span className="text-xs font-semibold text-yellow-700">{coinName}</span>
          </div>
          <p className="text-2xl font-black text-yellow-700">{coins.toLocaleString()}</p>
          {approxDiscount > 0 && (
            <p className="text-[11px] text-yellow-600 mt-0.5">≈ {approxDiscount.toFixed(2)} ج خصم</p>
          )}
          <div className="absolute -left-2 -bottom-2 w-12 h-12 rounded-full bg-yellow-200/40" />
        </div>
      </Link>
      <Link href="/customer/referral">
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-3 cursor-pointer hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary">الإحالة</span>
          </div>
          <p className="text-sm font-bold leading-tight">ادعُ صديقاً</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">اكسب {config.referralReferrerCoins} {coinName}</p>
          <div className="absolute -left-2 -bottom-2 w-12 h-12 rounded-full bg-primary/10" />
        </div>
      </Link>
    </div>
  );
}

export default function CustomerDashboard() {
  const { currentUser, token } = useAuth();
  const { data: banners = [] } = useBanners();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${BASE_URL}/api/requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRequests(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const activeRequests = requests
    .filter((r) => ACTIVE_STATUSES.includes(r.status));

  const latestDone = requests
    .filter((r) => DONE_STATUSES.includes(r.status))
    .slice(0, 3);

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" />;
    if (status.startsWith("cancelled")) return <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400" />;
    return <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />;
  };

  return (
    <div className="px-3 py-3 md:p-6 max-w-3xl mx-auto space-y-3 md:space-y-6 w-full overflow-x-hidden">

      {/* Greeting */}
      <div className="pt-0.5">
        <h1 className="text-base md:text-xl font-bold text-foreground tracking-tight">أهلاً، {currentUser?.fullName}</h1>
        <p className="text-muted-foreground text-[11px] md:text-sm mt-0.5">ماذا تحتاج اليوم؟</p>
      </div>

      {/* Banner carousel — only shown when banners exist */}
      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {/* Loyalty section */}
      <LoyaltyBanner />

      {/* Create request CTA — premium primary action */}
      <div className="mb-3 md:mb-0">
      <Link href="/services">
        <div className="relative overflow-hidden rounded-2xl cursor-pointer group shadow-sm hover:shadow-lg transition-shadow duration-200 bg-gradient-to-l from-primary to-primary/85">
          <div
            className="absolute -left-6 -top-6 w-28 h-28 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110"
            aria-hidden="true"
          />
          <div
            className="absolute -right-4 -bottom-8 w-24 h-24 rounded-full bg-black/5"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-3 md:gap-4 px-4 py-3.5 md:px-6 md:py-5">
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 ring-1 ring-white/25 group-hover:bg-white/25 transition-colors">
              <PlusCircle className="w-5 h-5 md:w-7 md:h-7 text-primary-foreground" strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-lg font-black text-primary-foreground leading-tight">إنشاء طلب جديد</p>
              <p className="text-[11px] md:text-sm text-primary-foreground/85 mt-0.5 leading-snug truncate">
                احصل على عروض أسعار من أفضل الفنيين في منطقتك
              </p>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:bg-white/25 group-hover:-translate-x-1 transition-all">
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
            </div>
          </div>
        </div>
      </Link>
      </div>

      {/* Active / current requests */}
      <Card className="overflow-hidden">
        <CardHeader className="px-3.5 pt-3 pb-1.5 md:px-6 md:pt-6 md:pb-2">
          <CardTitle className="text-sm md:text-base font-bold">الطلبات الحالية</CardTitle>
        </CardHeader>
        <CardContent className="px-3.5 pb-3.5 md:px-6 md:pb-6">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 md:h-20 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : activeRequests.length === 0 ? (
            <div className="py-3 md:py-8 text-center text-muted-foreground">
              <ClipboardList className="w-6 h-6 md:w-9 md:h-9 mx-auto mb-1 opacity-25" />
              <p className="text-xs md:text-sm">لا توجد طلبات نشطة حالياً</p>
              <Link href="/services">
                <Button size="sm" className="mt-2 h-7 text-xs md:h-9 md:text-sm">أنشئ طلبك الأول</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {activeRequests.map((r: any) => {
                const status = REQUEST_STATUS_MAP[r.status] || { label: r.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={r.id} className="rounded-xl border border-border p-2.5 md:p-4 space-y-1.5 md:space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs md:text-sm leading-snug truncate">
                          {r.service?.nameAr || r.description?.substring(0, 45) || `طلب #${r.id}`}
                        </p>
                        {r.technician && (
                          <p className="text-[11px] md:text-xs text-muted-foreground mt-1">
                            الفني: {r.technician.fullName}
                          </p>
                        )}
                      </div>
                      <Badge className={`text-[10px] md:text-xs border-0 flex-shrink-0 ${status.color}`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/customer/requests/${r.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-[11px] md:text-xs h-7 md:h-8 gap-1 md:gap-1.5">
                          <ClipboardList className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          عرض التفاصيل
                        </Button>
                      </Link>
                      {["technician_selected", "in_progress", "price_change_requested", "waiting_approval"].includes(r.status) && (
                        <Link href={`/customer/chat/${r.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full text-[11px] md:text-xs h-7 md:h-8 gap-1 md:gap-1.5">
                            <MessageCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            الرسائل
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Latest completed / cancelled */}
      <Card className="overflow-hidden">
        <CardHeader className="px-3.5 pt-3 pb-1.5 md:px-6 md:pt-6 md:pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-base font-bold">آخر الطلبات</CardTitle>
            <Link href="/customer/requests">
              <Button variant="ghost" size="sm" className="text-primary font-semibold text-xs md:text-sm gap-1 h-7 md:h-8 px-2 md:px-3">
                عرض الكل
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-3.5 pb-3.5 md:px-6 md:pb-6">
          {loading ? (
            <div className="space-y-1.5 md:space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 md:h-12 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : latestDone.length === 0 ? (
            <div className="py-3 md:py-8 text-center text-muted-foreground">
              <ClipboardList className="w-6 h-6 md:w-9 md:h-9 mx-auto mb-1 opacity-25" />
              <p className="text-xs md:text-sm">لا توجد طلبات سابقة</p>
            </div>
          ) : (
            <div className="space-y-1.5 md:space-y-2">
              {latestDone.map((r: any) => {
                const status = REQUEST_STATUS_MAP[r.status] || { label: r.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <Link href={`/customer/requests/${r.id}`} key={r.id}>
                    <div className="flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 rounded-xl border border-border hover:bg-muted/40 hover:border-primary/30 cursor-pointer transition-colors">
                      <div className="flex-shrink-0">{statusIcon(r.status)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs md:text-sm truncate">
                          {r.service?.nameAr || r.description?.substring(0, 40) || `طلب #${r.id}`}
                        </p>
                        <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                          {new Date(r.createdAt).toLocaleDateString("ar-EG")}
                        </p>
                      </div>
                      <Badge className={`text-[10px] md:text-xs border-0 flex-shrink-0 ${status.color}`}>
                        {status.label}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
