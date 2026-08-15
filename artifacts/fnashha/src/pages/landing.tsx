import { useState, useRef, useEffect, Fragment } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useListServices, useGetCmsSettings } from "@workspace/api-client-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBranding } from "@/contexts/branding-context";
import { useAuth } from "@/contexts/auth-context";
import { SiteHeader } from "@/components/site-header";
import { SiteLogo } from "@/components/site-logo";
import { HowItWorksSteps } from "@/components/how-it-works-steps";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { TechnicianBottomNav } from "@/components/technician-bottom-nav";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { Button } from "@/components/ui/button";
import { CldImg } from "@/components/ui/cld-img";
import { cldUrl } from "@/lib/cloudinary";
import {
  Wrench, Star, Shield, ChevronLeft, ChevronRight, Phone, Zap, CheckCircle,
  ClipboardList, MessageSquare, UserCheck, Users,
  ThumbsUp, MapPin, Mail, Facebook, Instagram, Twitter, Youtube,
  Droplets, Wind, Hammer, Paintbrush, Truck, Sparkles, Leaf,
  Camera, Grid3X3, Home, Flame, Wifi
} from "lucide-react";

type ServiceIconName = string;
const SERVICE_ICON_MAP: Record<ServiceIconName, React.ElementType> = {
  "كهرباء": Zap,
  "سباكة": Droplets,
  "تكييف": Wind,
  "نجارة": Hammer,
  "دهانات": Paintbrush,
  "بلاط وسيراميك": Grid3X3,
  "حدادة": Wrench,
  "نقل عفش": Truck,
  "تنظيف": Sparkles,
  "حدائق": Leaf,
  "كاميرات مراقبة": Camera,
  "إنترنت": Wifi,
  "ستائر": Home,
  "غاز": Flame,
};

function ServiceIcon({ name, size = 36 }: { name: string; size?: number }) {
  const Icon = SERVICE_ICON_MAP[name] || Wrench;
  return <Icon style={{ width: size, height: size }} />;
}

type Banner = {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  location: string;
  displayOrder: number;
  isActive: boolean;
  overlayEnabled?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
};

function bannerOverlayCss(banner: Banner, defaultOpacity = 45): string | null {
  if (banner.overlayEnabled === false) return null;
  const opacity = (banner.overlayOpacity ?? defaultOpacity) / 100;
  if (opacity === 0) return null;
  const color = banner.overlayColor || "#000000";
  const r = parseInt(color.slice(1, 3), 16) || 0;
  const g = parseInt(color.slice(3, 5), 16) || 0;
  const b = parseInt(color.slice(5, 7), 16) || 0;
  return `rgba(${r},${g},${b},${opacity})`;
}

function useBanners(location: string) {
  return useQuery<Banner[]>({
    queryKey: ["banners", location],
    queryFn: async () => {
      const res = await fetch(`/api/banners?location=${location}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
}

function BannerStrip({ banner }: { banner: Banner }) {
  const isMobile = useIsMobile();
  if (!banner.isActive) return null;
  const bgImage = (isMobile && banner.mobileImageUrl) ? banner.mobileImageUrl : banner.imageUrl;
  const overlayBg = bgImage ? bannerOverlayCss(banner, 50) : null;
  const inner = (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary to-primary/70 text-primary-foreground p-8 md:p-12"
      style={bgImage ? { backgroundImage: `url(${cldUrl(bgImage, { width: 1200 })})`, backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundPosition: "center" } : {}}
    >
      {bgImage && overlayBg && <div className="absolute inset-0 rounded-2xl" style={{ backgroundColor: overlayBg }} />}
      <div className="relative z-10">
        <h3 className="text-2xl md:text-3xl font-black mb-3">{banner.title}</h3>
        {banner.description && <p className="text-primary-foreground/90 text-lg mb-6 max-w-xl">{banner.description}</p>}
        {banner.buttonText && (
          <a href={banner.buttonLink || "#"} onClick={(e) => e.stopPropagation()}>
            <Button size="lg" variant="secondary" className="font-bold">
              {banner.buttonText}
              <ChevronLeft className="w-4 h-4 mr-2" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
  if (!banner.buttonText && banner.buttonLink) {
    return (
      <a href={banner.buttonLink} style={{ display: "block", textDecoration: "none", cursor: "pointer" }}>
        {inner}
      </a>
    );
  }
  return inner;
}

function BannerCard({ banner }: { banner: Banner }) {
  const isMobile = useIsMobile();
  const bgImage = (isMobile && banner.mobileImageUrl) ? banner.mobileImageUrl : banner.imageUrl;
  const overlayBg = bgImage ? bannerOverlayCss(banner, 45) : null;
  const inner = (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary to-primary/70 text-primary-foreground" style={{ height: "clamp(180px, 24vw, 300px)" }}>
      {bgImage && <CldImg src={bgImage} alt={banner.title} width={900} widths={[480, 768, 900]} sizes="(max-width:768px) 100vw, 900px" className="absolute inset-0 w-full h-full object-cover" />}
      {bgImage && overlayBg && <div className="absolute inset-0 rounded-2xl" style={{ backgroundColor: overlayBg }} />}
      <div className="relative z-10 p-4 md:p-5 h-full flex flex-col justify-end">
        <h3 className="font-black text-base md:text-lg leading-tight line-clamp-2">{banner.title}</h3>
        {banner.description && <p className="text-xs md:text-sm mt-1 opacity-80 line-clamp-2">{banner.description}</p>}
        {banner.buttonText && (
          <span className="inline-block mt-2 text-xs font-bold bg-white/20 rounded-lg px-2.5 py-1 self-start">
            {banner.buttonText} ←
          </span>
        )}
      </div>
    </div>
  );
  if (banner.buttonLink) {
    return <a href={banner.buttonLink} style={{ textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{inner}</a>;
  }
  return inner;
}

function HeroSlider({ banners }: { banners: Banner[] }) {
  const isMobile = useIsMobile();
  const [idx, setIdx] = useState(0);
  const [autoKey, setAutoKey] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const active = banners.filter((b) => b.isActive);

  useEffect(() => {
    if (active.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % active.length), 4500);
    return () => clearInterval(t);
  }, [active.length, autoKey]);

  if (active.length === 0) return null;

  const go = (i: number) => { setIdx(i); setAutoKey((k) => k + 1); };
  const prev = () => go((idx - 1 + active.length) % active.length);
  const next = () => go((idx + 1) % active.length);

  const b = active[idx];
  const bgImage = (isMobile && b.mobileImageUrl) ? b.mobileImageUrl : b.imageUrl;

  const slide = (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-l from-primary/80 to-primary/50"
      style={{ height: "clamp(160px, 28vw, 420px)" }}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = touchStartX.current - e.changedTouches[0].clientX;
        touchStartX.current = null;
        if (Math.abs(delta) < 40) return;
        delta > 0 ? next() : prev();
      }}
    >
      {bgImage && (
        <CldImg
          key={b.id}
          src={bgImage}
          alt={b.title}
          width={1920}
          widths={[640, 960, 1280, 1920]}
          sizes="calc(100vw - 2rem)"
          eager
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        />
      )}
      {bgImage && (() => { const ov = bannerOverlayCss(b, 45); return ov ? <div className="absolute inset-0" style={{ backgroundColor: ov }} /> : null; })()}

      <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-10 z-10">
        <h3 className="text-xl md:text-3xl font-black text-white leading-snug mb-1">{b.title}</h3>
        {b.description && <p className="text-white/80 text-sm md:text-base max-w-xl line-clamp-2">{b.description}</p>}
        {b.buttonText && (
          <a href={b.buttonLink || "#"} onClick={(e) => e.stopPropagation()} className="mt-3 self-start">
            <Button size="sm" variant="secondary" className="font-bold">{b.buttonText} ←</Button>
          </a>
        )}
      </div>

      {active.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); prev(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 transition-all"
            aria-label="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); next(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 transition-all"
            aria-label="التالي"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </>
      )}

      {active.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
          {active.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(i); }}
              className={`rounded-full transition-all duration-300 ${i === idx ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50 hover:bg-white/80"}`}
              aria-label={`الشريحة ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (b.buttonLink && !b.buttonText) {
    return (
      <section className="container mx-auto px-4 py-4 md:py-5">
        <a href={b.buttonLink} style={{ display: "block", textDecoration: "none" }}>{slide}</a>
      </section>
    );
  }
  return <section className="container mx-auto px-4 py-4 md:py-5">{slide}</section>;
}

function BannerCarousel({ banners, sectionClass = "container mx-auto px-4 py-8" }: { banners: Banner[]; sectionClass?: string }) {
  const isMobile = useIsMobile();
  const perPage = isMobile ? 1 : 4;
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const active = banners.filter((b) => b.isActive);

  useEffect(() => { setPage(0); }, [perPage]);

  if (active.length === 0) return null;

  const totalPages = Math.ceil(active.length / perPage);
  const current = active.slice(page * perPage, (page + 1) * perPage);
  const prev = () => setPage((p) => (p - 1 + totalPages) % totalPages);
  const next = () => setPage((p) => (p + 1) % totalPages);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) next(); else prev();
  };

  return (
    <section className={sectionClass}>
      <div className="relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {totalPages > 1 && (
          <button
            onClick={prev}
            className="absolute -right-3 md:-right-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors border border-border"
            aria-label="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          {current.map((b) => <BannerCard key={b.id} banner={b} />)}
        </div>
        {totalPages > 1 && (
          <button
            onClick={next}
            className="absolute -left-3 md:-left-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors border border-border"
            aria-label="التالي"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {totalPages > 1 && (
          <div className="flex justify-center gap-1.5 mt-4">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-1.5 rounded-full transition-all ${i === page ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ServicesSection({ activeServices }: { activeServices: any[] }) {
  const isMobile = useIsMobile();
  const { isAuthenticated, isTechnician } = useAuth();
  const [, navigate] = useLocation();
  const [showAll, setShowAll] = useState(false);

  const initialCount = isMobile ? 6 : 10;
  const hasMore = activeServices.length > initialCount;
  const displayed = showAll ? activeServices : activeServices.slice(0, initialCount);

  return (
    <section id="services" className="py-20 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-black text-foreground mb-3">خدماتنا</h2>
          <p className="text-muted-foreground text-lg">نغطي جميع احتياجاتك المنزلية باحترافية عالية</p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-5">
          {displayed.map((service: any) => {
            const size = service.iconSize ?? 100;
            const shape = service.iconShape ?? "square";
            const iconPx = Math.round(56 * (size / 100));
            const borderRadius = shape === "circle" ? "50%" : "16px";

            return (
              <div
                key={service.id}
                className="cursor-pointer"
                onClick={() => {
                  if (!isAuthenticated) navigate("/login");
                  else if (isTechnician) navigate("/technician/requests");
                  else navigate("/customer/requests/new");
                }}
              >
                <div
                  className="group cursor-pointer flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 rounded-2xl hover:bg-white hover:shadow-md transition-all duration-200"
                  data-testid={`card-service-${service.id}`}
                >
                  {service.image ? (
                    <CldImg
                      src={service.image}
                      alt={service.nameAr}
                      width={120}
                      style={{ width: iconPx, height: iconPx, borderRadius, objectFit: "contain" }}
                    />
                  ) : service.icon ? (
                    <span style={{ fontSize: Math.round(40 * (size / 100)), lineHeight: 1 }}>
                      {service.icon}
                    </span>
                  ) : (
                    <div
                      className="flex items-center justify-center text-primary group-hover:text-primary/80 transition-colors"
                      style={{ width: iconPx, height: iconPx }}
                    >
                      <ServiceIcon name={service.nameAr} size={Math.round(40 * (size / 100))} />
                    </div>
                  )}
                  <span
                    className="font-semibold text-center leading-snug text-foreground group-hover:text-primary transition-colors"
                    style={{ fontSize: `${Math.round(0.75 * ((service.titleSize ?? 100) / 100))}rem` }}
                  >
                    {service.nameAr}
                  </span>
                </div>
              </div>
            );
          })}

          {activeServices.length === 0 &&
            Array.from({ length: isMobile ? 6 : 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-4 rounded-2xl animate-pulse">
                <div className="w-14 h-14 rounded-2xl bg-muted" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
        </div>

        {(hasMore || showAll) && (
          <div className="text-center mt-8">
            <Button
              size="lg"
              variant="outline"
              className="font-bold"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "عرض أقل" : "عرض كل الخدمات"}
              <ChevronLeft className={`w-4 h-4 mr-2 transition-transform ${showAll ? "rotate-90" : ""}`} />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Landing() {
  const isMobile = useIsMobile();
  const { isCustomer, isTechnician } = useAuth();
  const { data: services = [] } = useListServices();
  const { data: cms } = useGetCmsSettings();
  const s = cms as any;
  const branding = useBranding();

  const { data: heroBanners = [] } = useBanners("hero");
  const { data: belowServicesBanners = [] } = useBanners("below_services");
  const { data: beforeFooterBanners = [] } = useBanners("before_footer");

  const activeServices = Array.isArray(services) ? services.filter((sv: any) => sv.isActive) : [];

  const stats = [
    {
      icon: Users,
      label: "عميل سعيد",
      value: s?.statsCustomers || "10,000+",
    },
    {
      icon: Wrench,
      label: "فني محترف",
      value: s?.statsTechnicians || "500+",
    },
    {
      icon: CheckCircle,
      label: "طلب مكتمل",
      value: s?.statsRequests || "50,000+",
    },
    {
      icon: MapPin,
      label: "محافظة مغطاة",
      value: s?.statsGovernorates || "27",
    },
  ];


  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0" dir="rtl">
      <SiteHeader />

      {/* ── Hero ───────────────────────────────────────────────── */}
      {(() => {
        const heroVideoEnabled = s?.heroVideoEnabled === "true";
        const hasBgVideo = heroVideoEnabled && !!s?.heroVideoUrl;
        const hasBgImage = !!s?.heroBackgroundImage;
        const hasBg = hasBgVideo || hasBgImage;
        const showAndroid = s?.heroAndroidEnabled === "true" && !!s?.heroAndroidAppUrl;
        const showIos = s?.heroIosEnabled === "true" && !!s?.heroIosAppUrl;
        const showAppButtons = showAndroid || showIos;

        const overlayOpacity = parseFloat(s?.heroOverlayOpacity || "55") / 100;
        const textAlign = s?.heroTextAlign || "center";
        const titleColor = s?.heroTitleColor || "";
        const subtitleColor = s?.heroSubtitleColor || "";
        const btnBgColor = s?.heroBtnBgColor || "";
        const btnTextColor = s?.heroBtnTextColor || "";
        const btnRadius = s?.heroBtnBorderRadius ? `${s.heroBtnBorderRadius}px` : undefined;
        const btnPadX = s?.heroBtnPaddingX ? `${s.heroBtnPaddingX}px` : undefined;
        const btnPadY = s?.heroBtnPaddingY ? `${s.heroBtnPaddingY}px` : undefined;
        const btnShadow = s?.heroBtnShadow || undefined;
        const paddingTopExtra = parseInt(s?.heroPaddingTop || "0") || 0;
        const storeBtnBorderRadius = s?.heroStoreBtnBorderRadius ? `${s.heroStoreBtnBorderRadius}px` : "16px";
        const storeBtnPadX = s?.heroStoreBtnPaddingX ? `${s.heroStoreBtnPaddingX}px` : "18px";
        const storeBtnPadY = s?.heroStoreBtnPaddingY ? `${s.heroStoreBtnPaddingY}px` : "10px";
        const storeBtnMinWidth = `${s?.heroStoreBtnMinWidth || "170"}px`;
        const storeBtnFontSize = parseInt(s?.heroStoreBtnFontSize || "13");
        const storeBtnIconSize = parseInt(s?.heroStoreBtnIconSize || "24");
        const storeBtnGap = parseInt(s?.heroStoreBtnGap || "14");
        const storeBtnSpacingBelow = parseInt(s?.heroStoreBtnSpacingBelow || "0");

        const alignClass = textAlign === "start" ? "text-start" : textAlign === "end" ? "text-end" : "text-center";
        const flexJustify = textAlign === "start" ? "justify-start" : textAlign === "end" ? "justify-end" : "justify-center";

        const titleText = s?.heroTitleAr || "احصل على خدمة احترافية مع فنشها";

        // Multi-highlight support (heroHighlightsJson takes priority over single heroHighlightWord)
        const highlights: Array<{ word: string; color: string }> = (() => {
          try {
            if (s?.heroHighlightsJson) return JSON.parse(s.heroHighlightsJson);
            if (s?.heroHighlightWord) return [{ word: s.heroHighlightWord, color: s?.heroHighlightColor || "" }];
          } catch {}
          return [];
        })();

        // ── Element config — single source of truth (same defaults as admin preview) ──
        const HERO_ELEM_DEFAULTS: Record<string, any> = {
          badge:       { offsetX:0, offsetY:0, marginBottom:24 },
          title:       { offsetX:0, offsetY:0, fontSize:60, fontWeight:"900", lineHeight:"1.1", letterSpacing:"-1", textShadow:"", opacity:1 },
          subtitle:    { offsetX:0, offsetY:0, fontSize:20, fontWeight:"400", lineHeight:"1.6", letterSpacing:"0", maxWidth:"672" },
          description: { offsetX:0, offsetY:0, fontSize:16, opacity:1, maxWidth:"576" },
          buttons:     { offsetX:0, offsetY:0, marginTop:40 },
          features:    { offsetX:0, offsetY:0, marginTop:56 },
        };

        const elemCfg: Record<string, any> = (() => {
          try {
            const desktopRaw = s?.heroElementsConfig ? JSON.parse(s.heroElementsConfig) : {};
            const mobileRaw  = s?.heroElementsConfigMobile ? JSON.parse(s.heroElementsConfigMobile) : {};
            // On mobile: merge desktop → mobile (mobile values win). On desktop: use desktop only.
            const raw: Record<string, any> = isMobile
              ? Object.fromEntries(Object.keys(HERO_ELEM_DEFAULTS).map((k) => [k, { ...(desktopRaw[k] || {}), ...(mobileRaw[k] || {}) }]))
              : desktopRaw;
            // Merge with defaults so any unsaved fields fall back to sensible values
            const merged: Record<string, any> = {};
            for (const key of Object.keys(HERO_ELEM_DEFAULTS)) {
              merged[key] = { ...HERO_ELEM_DEFAULTS[key], ...(raw[key] || {}) };
            }
            return merged;
          } catch {
            return HERO_ELEM_DEFAULTS;
          }
        })();

        // Shorthand: get merged element config (defaults already baked in)
        const ec = (key: string) => elemCfg[key] || {};

        const renderTitle = () => {
          const defaultStyle = titleColor ? { color: titleColor } : hasBg ? { color: "white" as const } : {};
          const lines = titleText.replace(/\\n/g, "\n").split("\n");
          const renderLine = (text: string, li: number) => {
            if (!highlights.length) return <span key={li} style={defaultStyle}>{text}</span>;
            const matches: Array<{ start: number; end: number; color: string }> = [];
            highlights.forEach(({ word, color }) => {
              const idx = text.indexOf(word);
              if (idx >= 0) matches.push({ start: idx, end: idx + word.length, color: color || "hsl(var(--primary))" });
            });
            matches.sort((a, b) => a.start - b.start);
            const parts: React.ReactNode[] = [];
            let pos = 0;
            matches.forEach(({ start, end, color }, i) => {
              if (start > pos) parts.push(<span key={`t${i}`} style={defaultStyle}>{text.slice(pos, start)}</span>);
              parts.push(<span key={`h${i}`} style={{ color }}>{text.slice(start, end)}</span>);
              pos = end;
            });
            if (pos < text.length) parts.push(<span key="tail" style={defaultStyle}>{text.slice(pos)}</span>);
            return <span key={li}>{parts}</span>;
          };
          return <>{lines.map((line: string, i: number) => <span key={i}>{renderLine(line, i)}{i < lines.length - 1 && <br />}</span>)}</>;
        };

        const btnStyle: React.CSSProperties = {
          ...(btnBgColor ? { backgroundColor: btnBgColor } : {}),
          ...(btnTextColor ? { color: btnTextColor } : {}),
          ...(btnRadius ? { borderRadius: btnRadius } : {}),
          ...(btnPadX && btnPadY ? { padding: `${btnPadY} ${btnPadX}` } : {}),
          ...(btnShadow ? { boxShadow: btnShadow } : {}),
        };

        return (
          <section
            className={`relative overflow-x-hidden ${hasBg ? "" : "bg-gradient-to-bl from-primary/20 via-background to-background"}`}
            style={{ minHeight: "clamp(200px, 31.25vw, 660px)" }}
          >
            {!hasBg && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(43_80%_57%/0.15),transparent_60%)]" />}
            {hasBgVideo ? (
              <video src={s.heroVideoUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
            ) : hasBgImage ? (
              <picture>
                {s?.heroMobileImage && <source media="(max-width: 767px)" srcSet={cldUrl(s.heroMobileImage, { width: 768 })} />}
                <CldImg src={s.heroBackgroundImage} alt="" width={1920} widths={[768, 1280, 1920]} sizes="100vw" eager className="absolute inset-0 w-full h-full object-cover" />
              </picture>
            ) : null}
            {hasBg && <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }} />}

            {/* ── Hero content: relative on mobile (grows naturally), absolute on desktop ── */}
            <div
              className="relative z-10 w-full px-6 md:px-12 md:absolute md:inset-0"
              style={{
                paddingTop: `${80 + paddingTopExtra}px`, paddingBottom: "48px",
                display: "flex", flexDirection: "column",
                alignItems: textAlign === "start" ? "flex-end" : textAlign === "end" ? "flex-start" : "center",
                textAlign: textAlign === "start" ? "right" : textAlign === "end" ? "left" : "center",
                direction: "rtl",
              }}
            >
              {/* Badge */}
              {(s?.heroBadgeShow !== "false") && (() => {
                const BADGE_ICONS: Record<string, React.ElementType> = { Zap, Star, Shield, CheckCircle, ThumbsUp, MapPin, Users };
                const BadgeIcon = BADGE_ICONS[s?.heroBadgeIcon || "Zap"] || Zap;
                const badgeText = s?.heroBadgeText || "منصة الخدمات المنزلية الأولى في مصر";
                const bc = ec("badge");
                return (
                  <div style={{
                    transform: `translate(${bc.offsetX || 0}px, ${bc.offsetY || 0}px)`,
                    marginBottom: `${bc.marginBottom ?? 24}px`,
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    borderRadius: "100px", padding: "5px 14px",
                    background: hasBg ? "rgba(255,255,255,0.15)" : "hsl(var(--primary)/0.1)",
                    color: s?.heroBadgeColor || (hasBg ? "white" : "hsl(var(--primary))"),
                    fontSize: `${s?.heroBadgeFontSize || 14}px`, fontWeight: 600,
                  }}>
                    <BadgeIcon style={{ width: "15px", height: "15px", flexShrink: 0 }} />
                    <span>{badgeText}</span>
                  </div>
                );
              })()}

              {/* Title — outer div for position, inner div for typography (no Tailwind on either) */}
              {(() => {
                const tc = ec("title");
                return (
                  <div style={{
                    transform: `translate(${tc.offsetX || 0}px, ${tc.offsetY || 0}px)`,
                    maxWidth: tc.maxWidth || undefined,
                    marginBottom: "20px",
                  }}>
                    <h1 style={{
                      fontSize: `${tc.fontSize || 60}px`,
                      fontWeight: tc.fontWeight || "900",
                      lineHeight: tc.lineHeight || "1.1",
                      letterSpacing: `${tc.letterSpacing ?? "-1"}px`,
                      textShadow: tc.textShadow || undefined,
                      opacity: tc.opacity ?? 1,
                      fontStyle: tc.fontStyle || undefined,
                      textTransform: (tc.textTransform || "none") as any,
                    }}>
                      {renderTitle()}
                    </h1>
                  </div>
                );
              })()}

              {/* Subtitle */}
              {(() => {
                const sc = ec("subtitle");
                return (
                  <div style={{
                    transform: `translate(${sc.offsetX || 0}px, ${sc.offsetY || 0}px)`,
                    maxWidth: sc.maxWidth ? (/^\d+$/.test(String(sc.maxWidth)) ? `${sc.maxWidth}px` : String(sc.maxWidth)) : "672px",
                    marginBottom: "14px",
                  }}>
                    <div style={{
                      fontSize: `${sc.fontSize || 20}px`,
                      fontWeight: sc.fontWeight || "400",
                      lineHeight: sc.lineHeight || "1.6",
                      letterSpacing: `${sc.letterSpacing ?? "0"}px`,
                      opacity: sc.opacity ?? 1,
                      color: subtitleColor || (hasBg ? "rgba(255,255,255,0.82)" : "hsl(var(--muted-foreground))"),
                    }}>
                      {s?.heroSubtitleAr || "احصل على عروض أسعار من أفضل الفنيين في منطقتك. اختر الأنسب لك واستمتع بخدمة احترافية مضمونة."}
                    </div>
                  </div>
                );
              })()}

              {/* Description */}
              {s?.heroDescription && (() => {
                const dc = ec("description");
                return (
                  <div style={{
                    transform: `translate(${dc.offsetX || 0}px, ${dc.offsetY || 0}px)`,
                    maxWidth: dc.maxWidth ? (/^\d+$/.test(String(dc.maxWidth)) ? `${dc.maxWidth}px` : String(dc.maxWidth)) : "576px",
                    marginBottom: "14px",
                    fontSize: `${dc.fontSize || 16}px`,
                    opacity: dc.opacity ?? 1,
                    color: hasBg ? "rgba(255,255,255,0.7)" : "hsl(var(--muted-foreground))",
                  }}>
                    {s.heroDescription}
                  </div>
                );
              })()}

              {/* Buttons */}
              {(() => {
                const btc = ec("buttons");
                const inner = showAppButtons ? (
                  <div
                    className={`flex flex-col sm:flex-row items-center ${flexJustify}`}
                    style={{ gap: `${storeBtnGap}px`, marginBottom: storeBtnSpacingBelow > 0 ? `${storeBtnSpacingBelow}px` : undefined }}
                  >
                    {showAndroid && (
                      <a href={s.heroAndroidAppUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-3 text-white hover:bg-zinc-900 transition-colors shadow-lg border border-white/10"
                        style={{ background: btnBgColor || "#111", borderRadius: storeBtnBorderRadius, padding: `${storeBtnPadY} ${storeBtnPadX}`, minWidth: storeBtnMinWidth, ...(btnShadow ? { boxShadow: btnShadow } : {}) }}
                      >
                        {s?.heroAndroidIconUrl ? (
                          <CldImg src={s.heroAndroidIconUrl} alt="" width={64} eager style={{ width: `${storeBtnIconSize}px`, height: `${storeBtnIconSize}px`, objectFit: "contain", flexShrink: 0 }} />
                        ) : (
                          <svg style={{ width: `${storeBtnIconSize}px`, height: `${storeBtnIconSize}px`, flexShrink: 0 }} viewBox="0 0 48 48" fill="none">
                            <path d="M7.2 4.8c-.8.4-1.2 1.2-1.2 2.4v33.6c0 1.2.4 2 1.2 2.4l.2.1 18.8-18.8v-.4L7.4 4.7z" fill="#4FC3F7"/>
                            <path d="M32.3 30.2l-6.1-6.2v-.5l6.1-6.1.1.1 7.2 4.1c2.1 1.2 2.1 3.1 0 4.2l-7.2 4.1z" fill="#FFD740"/>
                            <path d="M32.4 30.1L26.2 24 7.2 43c.7.7 1.8.8 3.1.1l22.1-13z" fill="#F44336"/>
                            <path d="M32.4 17.9L10.3 4.9C9 4.2 7.9 4.3 7.2 5l19 19 6.2-6.1z" fill="#69F0AE"/>
                          </svg>
                        )}
                        <div className="text-right">
                          <div className="text-[10px] text-white/60 leading-none mb-0.5">احصل عليه من</div>
                          <div className="font-bold leading-tight" style={{ fontSize: `${storeBtnFontSize}px` }}>{s.heroAndroidText || "Google Play"}</div>
                        </div>
                      </a>
                    )}
                    {showIos && (
                      <a href={s.heroIosAppUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-3 text-white hover:bg-zinc-900 transition-colors shadow-lg border border-white/10"
                        style={{ background: btnBgColor || "#111", borderRadius: storeBtnBorderRadius, padding: `${storeBtnPadY} ${storeBtnPadX}`, minWidth: storeBtnMinWidth, ...(btnShadow ? { boxShadow: btnShadow } : {}) }}
                      >
                        {s?.heroIosIconUrl ? (
                          <CldImg src={s.heroIosIconUrl} alt="" width={64} eager style={{ width: `${storeBtnIconSize}px`, height: `${storeBtnIconSize}px`, objectFit: "contain", flexShrink: 0 }} />
                        ) : (
                          <svg style={{ width: `${storeBtnIconSize}px`, height: `${storeBtnIconSize}px`, flexShrink: 0 }} viewBox="0 0 814 1000" fill="white">
                            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.3 136.4-317 270.8-317 68 0 124.7 44.8 168 44.8 41.3 0 107.3-46.7 185.2-46.7zM544.1 31.7C513.7 16.9 453.6 0 410.6 0c-48.5 0-98.9 21.8-133.6 57.1-39.5 39.5-61.6 102.5-61.6 148.4 0 5.8.6 11.6 1.3 14.8 3.2.3 8.4.6 13.6.6 44.8 0 100.5-21.8 134.8-57.2C402.6 124.3 432.1 62 544.1 31.7z"/>
                          </svg>
                        )}
                        <div className="text-right">
                          <div className="text-[10px] text-white/60 leading-none mb-0.5">تنزيل على</div>
                          <div className="font-bold leading-tight" style={{ fontSize: `${storeBtnFontSize}px` }}>{s.heroIosText || "App Store"}</div>
                        </div>
                      </a>
                    )}
                  </div>
                ) : (
                  <div className={`flex flex-col sm:flex-row gap-4 items-center ${flexJustify}`}>
                    <Link href="/register/customer">
                      <Button size="lg" className="text-lg px-8 py-6 font-bold shadow-lg" style={btnStyle} data-testid="button-register-customer">
                        أنا عميل — ابدأ الآن
                        <ChevronLeft className="w-5 h-5 mr-2" />
                      </Button>
                    </Link>
                    <Link href="/register/technician">
                      <Button size="lg" variant={hasBg ? "secondary" : "outline"} className="text-lg px-8 py-6 font-bold" data-testid="button-register-technician">
                        أنا فني — انضم إلينا
                      </Button>
                    </Link>
                  </div>
                );
                return (
                  <div style={{
                    transform: `translate(${btc.offsetX || 0}px, ${btc.offsetY || 0}px)`,
                    marginTop: `${btc.marginTop ?? 40}px`,
                  }}>
                    {inner}
                  </div>
                );
              })()}

              {/* Features */}
              {(s?.heroFeaturesShow !== "false") && (() => {
                const DEFAULT_FEATURES = [
                  { icon: "Shield", text: "مدفوعات آمنة", show: true, color: "" },
                  { icon: "Star", text: "فنيون معتمدون", show: true, color: "" },
                  { icon: "CheckCircle", text: "ضمان الجودة", show: true, color: "" },
                ];
                let featList = DEFAULT_FEATURES;
                try { if (s?.heroFeaturesJson) featList = JSON.parse(s.heroFeaturesJson); } catch {}
                const FEAT_ICONS: Record<string, React.ElementType> = { Shield, Star, CheckCircle, Zap, ThumbsUp, MapPin, Users };
                const visible = featList.filter((f: any) => f.show !== false);
                if (visible.length === 0) return null;
                const fc = ec("features");
                return (
                  <div style={{
                    transform: `translate(${fc.offsetX || 0}px, ${fc.offsetY || 0}px)`,
                    marginTop: `${fc.marginTop ?? parseInt(s?.heroFeaturesSpacing || "56")}px`,
                    display: "flex", flexWrap: "wrap", gap: "32px",
                    justifyContent: textAlign === "start" ? "flex-end" : textAlign === "end" ? "flex-start" : "center",
                  }}>
                    {visible.map((f: any, i: number) => {
                      const FIcon = FEAT_ICONS[f.icon] || Shield;
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          color: f.color || (hasBg ? "rgba(255,255,255,0.8)" : "hsl(var(--muted-foreground))"),
                        }}>
                          <FIcon className="w-5 h-5 text-primary" />
                          <span style={{ fontWeight: 600 }}>{f.text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </section>
        );
      })()}

      {/* ── Hero Banners Slider ─────────────────────────────────── */}
      <HeroSlider banners={heroBanners} />

      {/* ── Services ───────────────────────────────────────────── */}
      <ServicesSection activeServices={activeServices} />

      {/* ── Below-Services Banners ─────────────────────────────── */}
      <HeroSlider banners={belowServicesBanners} />

      {/* ── How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "96px 0", background: "linear-gradient(180deg, #fffef8 0%, #f8f7f2 55%, #ffffff 100%)" }}>
        <div className="container mx-auto px-4 lg:px-8">
          <HowItWorksSteps />
        </div>
      </section>

            {/* ── Statistics ─────────────────────────────────────────── */}
      <section
        className="py-20 relative overflow-hidden"
        style={{
          backgroundImage: `url(${cldUrl(s?.statsBackgroundImage || "/stats-bg.png", { width: 1440 })})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/55" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-3">{branding.siteNameAr} بالأرقام</h2>
            <p className="text-white/60 text-lg">نفخر بثقة عملائنا وفنيينا في كل مصر</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center text-center p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all backdrop-blur-sm">
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <p className="text-4xl font-black text-primary mb-2">{value}</p>
                <p className="text-white/70 font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Before-Footer Banners ──────────────────────────────── */}
      <BannerCarousel banners={beforeFooterBanners} />

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-foreground text-background/70" dir="rtl">
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div>
              <button
                className="flex items-center gap-2 mb-4"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1.5px solid rgba(245,197,24,0.5)", boxShadow: "0 2px 8px rgba(245,197,24,0.18)" }}>
                  <SiteLogo size={36} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <span className="text-xl font-black text-background">{branding.siteNameAr}</span>
              </button>
              <p className="text-sm leading-relaxed mb-6">
                {s?.footerAboutUs || "منصة فنشها هي الأولى من نوعها في مصر لربط العملاء بأفضل الفنيين المحترفين في جميع المجالات."}
              </p>
              <div className="flex gap-3">
                {s?.facebookUrl && (
                  <a href={s.facebookUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg bg-white/10 hover:bg-primary flex items-center justify-center transition-colors">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {s?.instagramUrl && (
                  <a href={s.instagramUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg bg-white/10 hover:bg-primary flex items-center justify-center transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {s?.twitterUrl && (
                  <a href={s.twitterUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg bg-white/10 hover:bg-primary flex items-center justify-center transition-colors">
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {s?.youtubeUrl && (
                  <a href={s.youtubeUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg bg-white/10 hover:bg-primary flex items-center justify-center transition-colors">
                    <Youtube className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-background font-bold mb-5 text-base">روابط سريعة</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/register/customer" className="hover:text-primary transition-colors">ابدأ كعميل</Link></li>
                <li><Link href="/register/technician" className="hover:text-primary transition-colors">انضم كفني</Link></li>
                <li><Link href="/how-it-works" className="hover:text-primary transition-colors">كيف يعمل؟</Link></li>
                <li><Link href="/faq" className="hover:text-primary transition-colors">الأسئلة الشائعة</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-background font-bold mb-5 text-base">قانوني</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/terms" className="hover:text-primary transition-colors">الشروط والأحكام</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors">سياسة الخصوصية</Link></li>
                <li><Link href="/refund-policy" className="hover:text-primary transition-colors">سياسة الاسترداد</Link></li>
                <li><Link href="/contact" className="hover:text-primary transition-colors">اتصل بنا</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-background font-bold mb-5 text-base">تواصل معنا</h4>
              <ul className="space-y-3 text-sm">
                {s?.contactPhone && (
                  <li className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                    <a href={`tel:${s.contactPhone}`} className="hover:text-primary transition-colors">{s.contactPhone}</a>
                  </li>
                )}
                {s?.contactEmail && (
                  <li className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                    <a href={`mailto:${s.contactEmail}`} className="hover:text-primary transition-colors">{s.contactEmail}</a>
                  </li>
                )}
                {s?.whatsappNumber && (
                  <li className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                    <a href={`https://wa.me/${s.whatsappNumber}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                      واتساب: {s.whatsappNumber}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-background/40">
            <p>© {new Date().getFullYear()} {branding.siteNameAr}. جميع الحقوق محفوظة.</p>
            <p>صُنع بـ ❤️ في مصر</p>
          </div>
        </div>
      </footer>

      {/* Always show the bottom nav that matches the logged-in user's role.
          Unauthenticated visitors get the generic landing nav. */}
      {isTechnician ? (
        <TechnicianBottomNav />
      ) : isCustomer ? (
        <CustomerBottomNav />
      ) : (
        <MobileBottomNav />
      )}
    </div>
  );
}
