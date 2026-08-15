import {
  useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey,
  useGetFinancialAnalytics, getGetFinancialAnalyticsQueryKey,
  useGetRequestsChart, getGetRequestsChartQueryKey,
  useGetTopTechnicians, getGetTopTechniciansQueryKey,
  useGetTopServices, getGetTopServicesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Star, TrendingUp } from "lucide-react";

export default function AdminAnalytics() {
  const { data: overview } = useGetAnalyticsOverview({ query: { queryKey: getGetAnalyticsOverviewQueryKey() } });
  const { data: financial } = useGetFinancialAnalytics(undefined, { query: { queryKey: getGetFinancialAnalyticsQueryKey() } });
  const { data: requestsChart = [] } = useGetRequestsChart(undefined, { query: { queryKey: getGetRequestsChartQueryKey() } });
  const { data: topTechs = [] } = useGetTopTechnicians({ query: { queryKey: getGetTopTechniciansQueryKey() } });
  const { data: topServices = [] } = useGetTopServices({ query: { queryKey: getGetTopServicesQueryKey() } });

  const ov = overview as any;
  const fin = financial as any;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">التحليلات</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "إجمالي العملاء", value: ov?.totalCustomers ?? "—" },
          { label: "الفنيون النشطون", value: ov?.activeTechnicians ?? "—" },
          { label: "إجمالي الطلبات", value: ov?.totalRequests ?? "—" },
          { label: "طلبات مكتملة", value: ov?.completedRequests ?? "—" },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-2xl font-black">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">الطلبات بمرور الوقت</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={Array.isArray(requestsChart) ? requestsChart : []}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(43 80% 57%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(43 80% 57%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" name="طلبات" stroke="hsl(43 80% 57%)" fill="url(#colorReq)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">أفضل الخدمات طلباً</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={Array.isArray(topServices) ? (topServices as any[]).slice(0, 6) : []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="nameAr" type="category" width={80} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="requestCount" name="طلبات" fill="hsl(43 80% 57%)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top technicians */}
      <Card>
        <CardHeader><CardTitle className="text-base">أفضل الفنيين</CardTitle></CardHeader>
        <CardContent>
          {(topTechs as any[]).length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">لا توجد بيانات</p>
          ) : (
            <div className="space-y-3">
              {(topTechs as any[]).slice(0, 10).map((t: any, i: number) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid={`top-tech-${t.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t.fullName}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3 h-3 fill-primary text-primary" />
                        {t.averageRating?.toFixed(1) || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">{t.completedJobs} طلب</p>
                    <p className="text-xs text-muted-foreground">مكتملة</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
