import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { Wrench, Search, ArrowLeft, Zap, Shield, Star } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { setStructuredData, SEO_SITE_URL } from "@/lib/seo";

type Service = {
  id: number;
  nameAr: string;
  descriptionAr?: string | null;
  icon?: string | null;
  image?: string | null;
  iconSize?: number | null;
  iconShape?: string | null;
  titleSize?: number | null;
  isActive: boolean;
};

function ServiceIcon({ name, sizePx }: { name: string; sizePx: number }) {
  const icons: Record<string, string> = {
    "كهرباء": "⚡", "سباكة": "🚿", "نجارة": "🪚", "دهانات": "🎨",
    "تكييف": "❄️", "حدادة": "🔩", "بلاط": "🏠", "غاز": "🔥",
    "مراتب": "🛏️", "ستائر": "🪟", "صيانة": "🔧", "تنظيف": "🧹",
  };
  for (const [key, emoji] of Object.entries(icons)) {
    if (name.includes(key)) return <span style={{ fontSize: sizePx }}>{emoji}</span>;
  }
  return <Wrench style={{ width: sizePx, height: sizePx }} className="text-primary" />;
}

export default function ServicesPage() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const { isAuthenticated, isCustomer } = useAuth();

  // Logged-in customers go straight into the existing request form with the
  // chosen service pre-selected. Everyone else is routed to register first.
  const handleServiceClick = (serviceId: number) => {
    if (isAuthenticated && isCustomer) {
      navigate(`/customer/requests/new?serviceId=${serviceId}`);
    } else {
      navigate("/register/customer");
    }
  };

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeServices = useMemo(
    () => services.filter((s) => s.isActive),
    [services]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return activeServices;
    const q = search.trim().toLowerCase();
    return activeServices.filter(
      (s) =>
        s.nameAr.toLowerCase().includes(q) ||
        (s.descriptionAr || "").toLowerCase().includes(q)
    );
  }, [activeServices, search]);

  useEffect(() => {
    if (activeServices.length === 0) {
      setStructuredData(undefined);
      return;
    }
    setStructuredData({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "خدمات فنشها",
      itemListElement: activeServices.map((service, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: service.nameAr,
        url: `${SEO_SITE_URL}/services#service-${service.id}`,
      })),
    });
  }, [activeServices]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <SiteHeader />

      {/* Premium Hero */}
      <section className="relative overflow-hidden py-20 md:py-28 text-center bg-gradient-to-b from-primary/8 via-background to-background">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-primary/8 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="container mx-auto px-4 relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-5 py-2 text-sm font-bold mb-6 border border-primary/20">
            <Wrench className="w-4 h-4" />
            خدماتنا المنزلية
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-foreground mb-5 leading-tight tracking-tight">
            كل خدمة تحتاجها{" "}
            <span className="text-primary relative">
              في مكان واحد
            </span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-lg mx-auto mb-10 leading-relaxed">
            نغطي جميع احتياجاتك المنزلية باحترافية عالية مع أفضل الفنيين في مصر
          </p>

          {/* Search bar */}
          <div className="max-w-md mx-auto relative group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن خدمة..."
              className="pr-12 h-14 text-base rounded-2xl border-2 shadow-sm focus:border-primary focus:shadow-lg focus:shadow-primary/10 transition-all bg-white/80 backdrop-blur"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-sm font-semibold"
              >
                مسح
              </button>
            )}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            {[
              { icon: Shield, label: "فنيون معتمدون" },
              { icon: Star, label: "مدفوعات آمنة" },
              { icon: Zap, label: "ضمان الجودة" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-muted-foreground text-sm">
                <Icon className="w-4 h-4 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-secondary/40 animate-pulse h-40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
              <Search className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h2 className="text-xl font-black text-foreground mb-2">لا توجد نتائج</h2>
            <p className="text-muted-foreground mb-4">جرّب كلمة بحث أخرى</p>
            {search && (
              <Button variant="outline" onClick={() => setSearch("")} className="font-semibold">
                مسح البحث وعرض الكل
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black text-foreground">
                  {search ? `نتائج البحث عن "${search}"` : "جميع الخدمات"}
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {filtered.length} خدمة متاحة
                </p>
              </div>
              {search && (
                <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="text-muted-foreground">
                  عرض الكل
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((service) => {
                const size = service.iconSize ?? 100;
                const shape = service.iconShape ?? "square";
                const iconPx = Math.round(56 * (size / 100));
                const borderRadius = shape === "circle" ? "50%" : "14px";
                const nameFontSize = `${Math.round(0.875 * ((service.titleSize ?? 100) / 100))}rem`;

                return (
                  <div key={service.id}>
                    <a
                      id={`service-${service.id}`}
                      href={`/services#service-${service.id}`}
                      onClickCapture={(e) => {
                        e.preventDefault();
                        handleServiceClick(service.id);
                      }}
                      className="group cursor-pointer flex flex-col items-center gap-3 p-5 rounded-2xl bg-white border-2 border-border/60 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-1 transition-all duration-250 h-full"
                      data-testid={`card-service-${service.id}`}
                    >
                      {/* Icon container */}
                      <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary/8 rounded-full blur-lg scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        {service.image ? (
                          <img
                            src={service.image}
                            alt={service.nameAr}
                            style={{ width: iconPx, height: iconPx, borderRadius, objectFit: "contain" }}
                            className="relative z-10 group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : service.icon ? (
                          <span
                            style={{ fontSize: Math.round(40 * (size / 100)), lineHeight: 1 }}
                            className="relative z-10 group-hover:scale-110 transition-transform duration-300 block"
                          >
                            {service.icon}
                          </span>
                        ) : (
                          <div
                            className="relative z-10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300"
                            style={{ width: iconPx, height: iconPx }}
                          >
                            <ServiceIcon name={service.nameAr} sizePx={Math.round(40 * (size / 100))} />
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <span
                        className="font-bold text-center leading-snug text-foreground group-hover:text-primary transition-colors duration-200"
                        style={{ fontSize: nameFontSize }}
                      >
                        {service.nameAr}
                      </span>

                      {/* Description - shown on hover on larger screens */}
                      {service.descriptionAr && (
                        <p className="text-xs text-muted-foreground text-center leading-snug line-clamp-2 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mt-1">
                          {service.descriptionAr}
                        </p>
                      )}

                      {/* Hover indicator */}
                      <div className="w-6 h-0.5 rounded-full bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 mt-auto" />
                    </a>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* CTA Section */}
        <div className="mt-20 relative overflow-hidden rounded-3xl bg-gradient-to-bl from-primary/15 via-primary/5 to-transparent border border-primary/15 p-10 md:p-14 text-center">
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/8 rounded-full blur-2xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-black text-foreground mb-3">
              لم تجد الخدمة التي تبحث عنها؟
            </h2>
            <p className="text-muted-foreground mb-8 text-base max-w-md mx-auto">
              أنشئ طلبك وسنجد لك أفضل فني مناسب في منطقتك
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register/customer">
                <Button size="lg" className="font-bold px-8 text-base rounded-xl shadow-lg">
                  أنشئ طلبك الآن
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>
              </Link>
              <Link href="/register/technician">
                <Button size="lg" variant="outline" className="font-bold px-8 text-base rounded-xl border-2">
                  انضم كفني
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
