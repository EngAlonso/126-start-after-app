import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import {
  Zap, ArrowLeft, Tag, Video, ExternalLink, ChevronLeft, ChevronRight,
  Megaphone, Clock, TrendingUp, Star, Volume2, VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type OfferBanner = {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  videoUrl?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  displayOrder: number;
  isActive: boolean;
  showIn?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

function useBannersForOffers() {
  return useQuery<OfferBanner[]>({
    queryKey: ["banners", "offers_page"],
    queryFn: async () => {
      const res = await fetch("/api/banners?location=offers_page");
      if (!res.ok) return [];
      return res.json();
    },
  });
}

function useCmsSettings() {
  return useQuery<Record<string, string | null>>({
    queryKey: ["cms-settings-offers"],
    queryFn: async () => {
      const res = await fetch("/api/cms/settings");
      return res.ok ? res.json() : {};
    },
    staleTime: 60_000,
  });
}

function timeRemaining(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} يوم`;
  if (hours > 0) return `${hours} ساعة`;
  return "أقل من ساعة";
}

function HeroSlider({ offers }: { offers: OfferBanner[] }) {
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);

  const goTo = (next: number) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setIdx(next);
      setAnimating(false);
    }, 250);
  };

  useEffect(() => {
    if (offers.length <= 1) return;
    timerRef.current = setTimeout(() => goTo((idx + 1) % offers.length), 5500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [idx, offers.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) goTo((idx + 1) % offers.length);
    else goTo((idx - 1 + offers.length) % offers.length);
  };

  /* Apply user's sound preference after video mounts / slide changes */
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !soundOn;
    }
  });

  if (offers.length === 0) return null;
  const current = offers[idx];
  const hasVideo = Boolean(current.videoUrl);

  const openLink = (link: string) => {
    if (link.startsWith("http")) window.open(link, "_blank", "noopener");
    else window.location.href = link;
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl shadow-2xl"
      style={{ height: "clamp(220px, 32vw, 380px)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background media */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${animating ? "opacity-0" : "opacity-100"}`}>
        {current.videoUrl ? (
          <video
            key={current.id + "v"}
            ref={videoRef}
            src={current.videoUrl}
            autoPlay muted loop playsInline
            className="w-full h-full object-cover"
          />
        ) : current.imageUrl || current.mobileImageUrl ? (
          <picture>
            {current.mobileImageUrl && (
              <source media="(max-width: 767px)" srcSet={current.mobileImageUrl} />
            )}
            <img
              key={current.id + "i"}
              src={current.imageUrl || current.mobileImageUrl || ""}
              alt={current.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </picture>
        ) : (
          <div className="w-full h-full bg-gradient-to-bl from-primary/60 via-primary/30 to-primary/10" />
        )}
      </div>

      {/* Gradient overlays — only shown when there is text content */}
      {(current.title || current.description || current.buttonText) && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
        </>
      )}

      {/* Sound toggle for videos */}
      {hasVideo && (
        <button
          onClick={() => setSoundOn((prev) => !prev)}
          className="absolute top-4 right-4 z-20 bg-black/40 backdrop-blur text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/60 transition-all border border-white/20"
          aria-label={soundOn ? "كتم الصوت" : "تشغيل الصوت"}
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      )}

      {/* Content */}
      <div
        className={`absolute inset-0 flex flex-col justify-end px-5 pb-8 sm:px-10 sm:pb-10 md:px-14 md:pb-12 text-right transition-all duration-500 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
        dir="rtl"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs sm:text-sm font-bold shadow-lg">
            <Zap className="w-3.5 h-3.5" />
            عرض مميز
          </div>
          {current.endDate && timeRemaining(current.endDate) && (
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur text-white rounded-full px-3 py-1.5 text-xs font-semibold">
              <Clock className="w-3 h-3" />
              ينتهي خلال {timeRemaining(current.endDate)}
            </div>
          )}
        </div>

        <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-2 sm:mb-3 leading-tight drop-shadow-lg max-w-2xl">
          {current.title}
        </h2>
        {current.description && (
          <p className="text-white/80 text-sm sm:text-base md:text-lg mb-4 sm:mb-6 max-w-xl leading-relaxed drop-shadow line-clamp-2 hidden sm:block">
            {current.description}
          </p>
        )}
        {current.buttonText && current.buttonLink && (
          <div>
            <Button
              size="lg"
              className="font-bold text-sm sm:text-base px-6 sm:px-8 shadow-xl rounded-xl h-10 sm:h-12"
              onClick={() => openLink(current.buttonLink!)}
            >
              {current.buttonText}
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      {offers.length > 1 && (
        <>
          <div className="absolute bottom-3 sm:bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
            {offers.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-400 ${i === idx ? "bg-primary w-6 sm:w-7 h-2" : "bg-white/50 hover:bg-white/80 w-2 h-2"}`}
                aria-label={`الشريحة ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => goTo((idx - 1 + offers.length) % offers.length)}
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 bg-white/15 backdrop-blur-sm text-white rounded-full w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center hover:bg-white/30 transition-all z-10 border border-white/20"
            aria-label="السابق"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => goTo((idx + 1) % offers.length)}
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 bg-white/15 backdrop-blur-sm text-white rounded-full w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center hover:bg-white/30 transition-all z-10 border border-white/20"
            aria-label="التالي"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </>
      )}

      {/* Slide counter */}
      {offers.length > 1 && (
        <div dir="ltr" className="absolute top-4 left-4 bg-black/40 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full z-10">
          {idx + 1} / {offers.length}
        </div>
      )}
    </div>
  );
}

function OfferCard({ offer }: { offer: OfferBanner }) {
  const now = new Date();
  const isExpired = offer.endDate ? new Date(offer.endDate) < now : false;
  const isUpcoming = offer.startDate ? new Date(offer.startDate) > now : false;
  const remaining = offer.endDate && !isExpired ? timeRemaining(offer.endDate) : null;

  const handleClick = () => {
    if (offer.buttonLink) {
      if (offer.buttonLink.startsWith("http")) window.open(offer.buttonLink, "_blank", "noopener");
      else window.location.href = offer.buttonLink;
    }
  };

  return (
    <div
      onClick={offer.buttonLink ? handleClick : undefined}
      className={`group relative rounded-2xl overflow-hidden bg-white border border-border/60 shadow-sm transition-all duration-300 flex flex-col
        ${offer.buttonLink ? "cursor-pointer hover:shadow-xl hover:-translate-y-1.5 hover:border-primary/40" : ""}
        ${isExpired ? "opacity-55 grayscale" : ""}
      `}
    >
      {/* Media */}
      <div className="relative w-full overflow-hidden bg-secondary/30" style={{ paddingBottom: "62%" }}>
        {offer.videoUrl ? (
          <video
            src={offer.videoUrl}
            muted loop playsInline
            className="absolute inset-0 w-full h-full object-contain"
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
        ) : offer.imageUrl || offer.mobileImageUrl ? (
          <picture>
            {offer.mobileImageUrl && (
              <source media="(max-width: 767px)" srcSet={offer.mobileImageUrl} />
            )}
            <img
              src={offer.imageUrl || offer.mobileImageUrl || ""}
              alt={offer.title}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </picture>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-bl from-primary/20 via-secondary to-secondary">
            <Tag className="w-14 h-14 text-primary/25" />
          </div>
        )}

        {offer.videoUrl && !isExpired && !isUpcoming && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-white rounded-full px-2.5 py-1 text-xs flex items-center gap-1 font-bold">
            <Video className="w-3 h-3" />
            فيديو
          </div>
        )}
        {isExpired && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-white/95 text-foreground rounded-full px-5 py-2 text-sm font-black shadow">انتهى العرض</span>
          </div>
        )}
        {isUpcoming && (
          <div className="absolute inset-0 bg-primary/25 backdrop-blur-sm flex items-center justify-center">
            <span className="bg-primary text-primary-foreground rounded-full px-5 py-2 text-sm font-black shadow">قريباً</span>
          </div>
        )}

        {(offer.imageUrl || offer.mobileImageUrl || offer.videoUrl) && !isExpired && !isUpcoming && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <h3 className="font-black text-base text-foreground mb-2 leading-snug group-hover:text-primary transition-colors">
          {offer.title}
        </h3>
        {offer.description && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-3 line-clamp-2 flex-1">
            {offer.description}
          </p>
        )}

        <div className="mt-auto space-y-3">
          {remaining && (
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold bg-amber-50 rounded-lg px-3 py-1.5">
              <Clock className="w-3.5 h-3.5" />
              ينتهي خلال {remaining}
            </div>
          )}
          {offer.buttonText && !isExpired && (
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-bold text-sm px-4 py-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
              {offer.buttonText}
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ adShow, adTitle, adDesc, adBtnText, adBtnUrl }: {
  adShow: boolean; adTitle: string; adDesc: string; adBtnText: string; adBtnUrl: string;
}) {
  return (
    <div className="py-16" dir="rtl">
      <div className="text-center mb-16">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Tag className="w-10 h-10 text-primary/50" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-3">لا توجد عروض حالياً</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">تابعنا قريباً لأحدث العروض والخصومات الحصرية على خدمات الصيانة المنزلية</p>
        <Link href="/register/customer">
          <Button size="lg" className="font-bold px-8">
            ابدأ الآن
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
        </Link>
      </div>

      {adShow && (
        <div className="bg-gradient-to-bl from-foreground/5 via-secondary/30 to-transparent rounded-3xl p-8 md:p-12 border border-border/50">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-5 py-2 text-sm font-bold mb-6">
              <Megaphone className="w-4 h-4" />
              أعلن معنا
            </div>
            <h2 className="text-3xl font-black text-foreground mb-4">{adTitle}</h2>
            <p className="text-muted-foreground text-lg mb-10 leading-relaxed max-w-xl mx-auto">{adDesc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              {[
                { icon: TrendingUp, title: "وصول واسع", desc: "آلاف الزيارات اليومية من عملاء نشطين" },
                { icon: Star, title: "عروض مميزة", desc: "عرض احترافي لمنتجك أو خدمتك مع صور وفيديو" },
                { icon: Zap, title: "نتائج سريعة", desc: "ابدأ حملتك الإعلانية خلال 24 ساعة" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 mx-auto">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1.5 text-sm">{title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <Link href={adBtnUrl.startsWith("http") ? "#" : adBtnUrl} onClick={adBtnUrl.startsWith("http") ? () => window.open(adBtnUrl, "_blank") : undefined}>
              <Button size="lg" className="font-bold px-8 text-base bg-primary hover:bg-primary/90">
                {adBtnText}
                <ExternalLink className="w-4 h-4 mr-2" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OffersPage() {
  const { data: offers = [], isLoading } = useBannersForOffers();
  const { data: cmsSettings } = useCmsSettings();

  const adShow = cmsSettings?.offersAdShow !== "false";
  const adTitle = cmsSettings?.offersAdTitle || "أعلن منتجك أو خدمتك هنا";
  const adDesc = cmsSettings?.offersAdDescription || "تواصل معنا وانضم لقائمة شركائنا الإعلانيين";
  const adBtnText = cmsSettings?.offersAdButtonText || "تواصل للإعلان";
  const adBtnUrl = cmsSettings?.offersAdButtonUrl || "/contact";

  const activeOffers = offers
    .filter((o) => o.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const sliderOffers = activeOffers
    .filter((o) => (o.showIn ?? "both") !== "grid" && (o.imageUrl || o.mobileImageUrl || o.videoUrl))
    .slice(0, 5);

  const gridOffers = activeOffers.filter((o) => (o.showIn ?? "both") !== "slider");

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <SiteHeader />

      <div className="container mx-auto px-4 pt-10 pb-20">
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-5 py-2 text-sm font-bold mb-5">
            <Tag className="w-4 h-4" />
            أحدث العروض والخصومات
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-foreground mb-4 leading-tight tracking-tight">
            عروض <span className="text-primary">فنشها</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
            اكتشف أفضل العروض والخصومات الحصرية على جميع خدمات الصيانة المنزلية
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="w-full rounded-3xl bg-secondary/40 animate-pulse" style={{ height: 400 }} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-secondary/40 animate-pulse" style={{ height: 320 }} />
              ))}
            </div>
          </div>
        ) : activeOffers.length === 0 ? (
          <EmptyState adShow={adShow} adTitle={adTitle} adDesc={adDesc} adBtnText={adBtnText} adBtnUrl={adBtnUrl} />
        ) : (
          <div className="space-y-12">
            {/* Hero Slider */}
            {sliderOffers.length > 0 && <HeroSlider offers={sliderOffers} />}

            {/* All Offers Grid */}
            {gridOffers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-foreground">جميع العروض</h2>
                  <span className="text-muted-foreground text-sm bg-secondary px-3 py-1.5 rounded-full font-semibold">
                    {gridOffers.length} عرض
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {gridOffers.map((offer) => (
                    <OfferCard key={offer.id} offer={offer} />
                  ))}
                </div>
              </div>
            )}

            {/* Advertise CTA */}
            {adShow && (
              <div className="bg-gradient-to-bl from-foreground/5 via-secondary/30 to-transparent rounded-3xl p-8 md:p-12 border border-border/50 text-center">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-5 py-2 text-sm font-bold mb-4">
                  <Megaphone className="w-4 h-4" />
                  فرصة إعلانية
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-foreground mb-3">{adTitle}</h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">{adDesc}</p>
                <Link
                  href={adBtnUrl.startsWith("http") ? "#" : adBtnUrl}
                  onClick={adBtnUrl.startsWith("http") ? (e) => { e.preventDefault(); window.open(adBtnUrl, "_blank"); } : undefined}
                >
                  <Button size="lg" className="font-bold px-10 text-base bg-primary hover:bg-primary/90 shadow-lg">
                    {adBtnText}
                    <ExternalLink className="w-4 h-4 mr-2" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
