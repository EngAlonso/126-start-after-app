import { useMemo } from "react";
import {
  getListAdminSeoLandingPagesQueryKey,
  useListAdminSeoLandingPages,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { Eye, ExternalLink, Globe2, Loader2, MapPinned, SearchCheck } from "lucide-react";

const permission = "seo_pages.view";

function publicPagePath(serviceSlug: string, locationSlug: string) {
  return `/services/${encodeURIComponent(serviceSlug)}/${encodeURIComponent(locationSlug)}`;
}

export default function AdminSeoPages() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(permission);
  const { data: pages = [], isLoading, isError } = useListAdminSeoLandingPages({
    query: {
      queryKey: getListAdminSeoLandingPagesQueryKey(),
      enabled: canView,
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  const stats = useMemo(() => {
    const services = new Set(pages.map((page) => page.serviceId));
    const locations = new Set(pages.map((page) => page.areaId));
    return {
      total: pages.length,
      services: services.size,
      locations: locations.size,
    };
  }, [pages]);

  if (!canView) {
    return (
      <div className="p-6" dir="rtl">
        <Card className="mx-auto max-w-xl">
          <CardContent className="py-14 text-center">
            <SearchCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
            <h1 className="text-xl font-bold">ليس لديك صلاحية عرض صفحات محركات البحث</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              اطلب من مسؤول النظام منحك صلاحية seo_pages.view إذا كنت تحتاج إلى الوصول لهذه الصفحة.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
          <SearchCheck className="h-6 w-6 text-primary" />
          صفحات محركات البحث
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          متابعة صفحات الخدمات والمناطق المؤهلة حالياً من نظام مطابقة الفنيين.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "إجمالي الصفحات المؤهلة", value: stats.total, icon: Globe2 },
          { label: "الخدمات الممثلة", value: stats.services, icon: SearchCheck },
          { label: "المناطق الممثلة", value: stats.locations, icon: MapPinned },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">الصفحات المؤهلة حالياً</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="py-14 text-center text-sm text-destructive">
              تعذر تحميل صفحات محركات البحث.
            </div>
          ) : pages.length === 0 ? (
            <div className="py-14 text-center">
              <SearchCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-semibold">لا توجد صفحات مؤهلة حالياً</p>
              <p className="mt-1 text-sm text-muted-foreground">
                تظهر هنا فقط تركيبات الخدمة والمنطقة التي يستطيع النظام خدمتها فعلياً.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-right text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">الخدمة</th>
                    <th className="px-4 py-3 font-semibold">المنطقة</th>
                    <th className="px-4 py-3 font-semibold">المحافظة</th>
                    <th className="px-4 py-3 font-semibold">الحالة</th>
                    <th className="px-4 py-3 font-semibold">الرابط العام</th>
                    <th className="px-4 py-3 text-left font-semibold">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => {
                    const href = publicPagePath(page.serviceSlug, page.locationSlug);
                    return (
                      <tr key={`${page.serviceId}:${page.areaId}`} className="border-b last:border-0">
                        <td className="px-4 py-3 font-semibold">{page.serviceNameAr}</td>
                        <td className="px-4 py-3">{page.areaNameAr}</td>
                        <td className="px-4 py-3">{page.governorateNameAr}</td>
                        <td className="px-4 py-3">
                          <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
                            نشطة
                          </Badge>
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs text-muted-foreground" dir="ltr" title={href}>
                          {href}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`فتح صفحة ${page.serviceNameAr} في ${page.areaNameAr}`}>
                            <Button size="sm" variant="outline" className="gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              فتح
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
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
    </div>
  );
}