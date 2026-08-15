import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, MapPin, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/contexts/auth-context";
import { applySeo, SEO_IMAGE_URL, SEO_SITE_URL } from "@/lib/seo";
import NotFound from "@/pages/not-found";

type SeoLandingPageData = {
  serviceId: number;
  serviceName: string;
  serviceNameAr: string;
  serviceIcon: string | null;
  serviceImage: string | null;
  areaId: number;
  areaName: string;
  areaNameAr: string;
  governorateId: number;
  governorateName: string;
  governorateNameAr: string;
  serviceSlug: string;
  locationSlug: string;
};

function getPageUrl(page: SeoLandingPageData) {
  return `/services/${encodeURIComponent(page.serviceSlug)}/${encodeURIComponent(page.locationSlug)}`;
}

export default function ServiceLocationSeoPage({
  serviceSlug,
  locationSlug,
}: {
  serviceSlug: string;
  locationSlug: string;
}) {
  const [, navigate] = useLocation();
  const { isAuthenticated, isCustomer } = useAuth();
  const [page, setPage] = useState<SeoLandingPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsMissing(false);
    setPage(null);

    fetch(
      `/api/seo/landing-pages/${encodeURIComponent(serviceSlug)}/${encodeURIComponent(locationSlug)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) {
          setIsMissing(true);
          return null;
        }
        return (await response.json()) as SeoLandingPageData;
      })
      .then((data) => {
        if (cancelled || !data) return;
        setPage(data);
        const path = getPageUrl(data);
        const title = `${data.serviceNameAr} في ${data.areaNameAr} | فنشها`;
        const description = `اطلب خدمة ${data.serviceNameAr} في ${data.areaNameAr} بمحافظة ${data.governorateNameAr} عبر فنشها، وتابع طلبك من خلال المنصة.`;
        applySeo({
          title,
          description,
          canonicalPath: path,
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "Service",
            name: `${data.serviceNameAr} في ${data.areaNameAr}`,
            serviceType: data.serviceNameAr,
            areaServed: {
              "@type": "AdministrativeArea",
              name: `${data.areaNameAr}، ${data.governorateNameAr}`,
            },
            provider: {
              "@type": "Organization",
              name: "فنشها",
              url: SEO_SITE_URL,
              logo: SEO_IMAGE_URL,
            },
            url: `${SEO_SITE_URL}${path}`,
          },
        });
      })
      .catch(() => {
        if (!cancelled) setIsMissing(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceSlug, locationSlug]);

  if (isMissing) return <NotFound />;

  if (isLoading || !page) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <SiteHeader />
        <main className="container mx-auto px-4 py-24 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-primary/15" />
          <p className="mt-5 text-muted-foreground">جاري تحميل تفاصيل الخدمة...</p>
        </main>
      </div>
    );
  }

  const requestQuery = new URLSearchParams({
    serviceId: String(page.serviceId),
    governorateId: String(page.governorateId),
    areaId: String(page.areaId),
  }).toString();

  const handleRequest = () => {
    if (isAuthenticated && isCustomer) {
      navigate(`/customer/requests/new?${requestQuery}`);
    } else {
      navigate(`/register/customer?${requestQuery}`);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/12 via-background to-background py-20 md:py-28">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="container relative mx-auto max-w-5xl px-4 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 p-4 shadow-sm">
              {page.serviceImage ? (
                <img src={page.serviceImage} alt="" className="h-full w-full object-contain" />
              ) : page.serviceIcon ? (
                <span className="text-4xl">{page.serviceIcon}</span>
              ) : (
                <Wrench className="h-10 w-10 text-primary" />
              )}
            </div>
            <p className="mb-4 text-sm font-bold text-primary">
              خدمات فنشها في {page.governorateNameAr}
            </p>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground md:text-6xl">
              {page.serviceNameAr} في {page.areaNameAr}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading- looser text-muted-foreground md:text-xl">
              اطلب {page.serviceNameAr} في {page.areaNameAr} التابعة لمحافظة {page.governorateNameAr}
              من خلال فنشها، واشرح احتياجك ليصل طلبك إلى الفنيين المؤهلين في منطقتك.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="rounded-xl px-8 text-base font-bold" onClick={handleRequest}>
                اطلب الخدمة
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
              <Link href="/services">
                <Button size="lg" variant="outline" className="w-full rounded-xl px-8 text-base font-bold sm:w-auto">
                  تصفح كل الخدمات
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto grid max-w-5xl gap-6 px-4 py-12 md:grid-cols-3">
          {[
            {
              title: "خدمة مرتبطة بمنطقتك",
              body: `هذه الصفحة تعرض ${page.serviceNameAr} في ${page.areaNameAr} بناءً على بيانات الخدمة والمنطقة المتاحة على المنصة.`,
              icon: MapPin,
            },
            {
              title: "اشرح احتياجك بوضوح",
              body: "أدخل تفاصيل المشكلة والعنوان داخل نموذج الطلب الحالي حتى يفهم الفنيون المطلوب قبل تقديم عروضهم.",
              icon: Wrench,
            },
            {
              title: "تابع الطلب من مكان واحد",
              body: "بعد إنشاء الطلب، استخدم حسابك لمراجعة العروض والتواصل واختيار الفني وفق خطوات فنشها المعتادة.",
              icon: CheckCircle2,
            },
          ].map(({ title, body, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <Icon className="mb-4 h-7 w-7 text-primary" />
              <h2 className="mb-2 text-lg font-black">{title}</h2>
              <p className="leading-8 text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>

        <section className="container mx-auto max-w-3xl px-4 pb-16">
          <div className="rounded-3xl border border-primary/15 bg-primary/5 p-6 md:p-8">
            <h2 className="mb-4 text-2xl font-black">أسئلة شائعة عن الخدمة في {page.areaNameAr}</h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-bold">كيف أطلب {page.serviceNameAr} في {page.areaNameAr}؟</h3>
                <p className="mt-1 leading-8 text-muted-foreground">
                  اضغط على «اطلب الخدمة» وأكمل نموذج الطلب الحالي ببياناتك وموقعك ووصف احتياجك.
                </p>
              </div>
              <div>
                <h3 className="font-bold">هل أحتاج إلى تحديد المنطقة بالتفصيل؟</h3>
                <p className="mt-1 leading-8 text-muted-foreground">
                  نعم، اختر المحافظة والمنطقة وأضف العنوان التفصيلي حتى يطابق النظام طلبك مع الفنيين الذين تغطي خدماتهم منطقتك.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}