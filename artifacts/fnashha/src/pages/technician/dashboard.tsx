import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useGetPointsBalance, getGetPointsBalanceQueryKey, useGetTechnicianProfile, getGetTechnicianProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Star, FileText, Search, CheckCircle2, ChevronLeft, Bell } from "lucide-react";
import { REQUEST_STATUS_MAP, OFFER_STATUS_MAP } from "@/lib/status";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function OfferStatusBadge({ offer }: { offer: any }) {
  const requestStatus = offer.request?.status;
  if (offer.status === "selected" && (requestStatus === "price_change_requested" || requestStatus === "waiting_approval")) {
    return <Badge className="text-[10px] md:text-xs bg-orange-100 text-orange-800 border-0">طلب تعديل سعر</Badge>;
  }
  const statusMap: Record<string, { label: string; color: string }> = {
    selected:  { label: "تم الاختيار",     color: "bg-green-100 text-green-800" },
    pending:   { label: "بانتظار العميل",   color: "bg-yellow-100 text-yellow-800" },
    rejected:  { label: "مرفوض",           color: "bg-red-100 text-red-800" },
    withdrawn: { label: "مسحوب",           color: "bg-gray-100 text-gray-600" },
  };
  const s = statusMap[offer.status] || { label: offer.status, color: "bg-gray-100 text-gray-600" };
  return <Badge className={`text-[10px] md:text-xs border-0 ${s.color}`}>{s.label}</Badge>;
}

export default function TechnicianDashboard() {
  const { currentUser, token } = useAuth();

  const { data: balanceData } = useGetPointsBalance({
    query: { queryKey: getGetPointsBalanceQueryKey() },
  });
  const balance = (balanceData as any)?.balance || 0;

  const { data: profileData } = useGetTechnicianProfile(currentUser?.id!, {
    query: { enabled: !!currentUser?.id, queryKey: getGetTechnicianProfileQueryKey(currentUser?.id!) },
  });
  const profile = profileData as any;
  const avgRating = profile?.averageRating || 0;
  const reviewCount = profile?.reviewCount || 0;

  const [availableRequests, setAvailableRequests] = useState<any[]>([]);
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${BASE_URL}/api/requests`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/offers/my`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/requests/my-completed`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([reqData, offersData, completedData]) => {
        const allRequests = reqData?.data || [];
        setAvailableRequests(
          allRequests
            .filter((r: any) => ["pending", "offers_received"].includes(r.status))
            .slice(0, 5)
        );
        setActiveRequests(
          allRequests
            .filter((r: any) => ["technician_selected", "in_progress", "price_change_requested", "waiting_approval"].includes(r.status))
            .slice(0, 5)
        );
        setOffers(Array.isArray(offersData) ? offersData.slice(0, 5) : []);
        const comp = completedData?.data || [];
        setCompleted(comp.slice(0, 3));
        setCompletedTotal(completedData?.total ?? comp.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="p-2.5 md:p-6 max-w-5xl mx-auto space-y-2.5 md:space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-base md:text-2xl font-bold">أهلاً، {currentUser?.fullName}</h1>
        <p className="text-muted-foreground mt-0.5 text-xs md:text-sm">هنا ملخص نشاطك على فنشها</p>
      </div>

      {/* Stat cards — 3-column grid on all sizes */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Link href="/technician/wallet">
          <Card className="border-primary/20 bg-primary/5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 h-full">
            <CardContent className="p-2.5 md:p-5 flex flex-col items-center justify-center gap-1 md:flex-row md:items-center md:gap-4 text-center md:text-right">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-4 h-4 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <p className="text-xl md:text-3xl font-black text-foreground leading-tight">{balance}</p>
                <p className="text-[10px] md:text-sm text-muted-foreground leading-tight">النقاط</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/technician/requests">
          <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 h-full">
            <CardContent className="p-2.5 md:p-5 flex flex-col items-center justify-center gap-1 md:flex-row md:items-center md:gap-4 text-center md:text-right">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 md:w-6 md:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xl md:text-3xl font-black text-foreground leading-tight">{activeRequests.length}</p>
                <p className="text-[10px] md:text-sm text-muted-foreground leading-tight">نشطة</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/technician/reviews">
          <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 h-full">
            <CardContent className="p-2.5 md:p-5 flex flex-col items-center justify-center gap-1 md:flex-row md:items-center md:gap-4 text-center md:text-right">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 md:w-6 md:h-6 text-yellow-500 fill-yellow-400" />
              </div>
              <div>
                <p className="text-xl md:text-3xl font-black text-foreground leading-tight">
                  {avgRating > 0 ? avgRating.toFixed(1) : "—"}
                </p>
                <p className="text-[10px] md:text-sm text-muted-foreground leading-tight">تقييمي</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Available requests */}
      <Card>
        <CardHeader className="px-3 pt-3 pb-1.5 md:pb-2 md:px-6 md:pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm md:text-base">الطلبات المتاحة</CardTitle>
              {availableRequests.length > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                  <Bell className="w-2.5 h-2.5" />
                  {availableRequests.length}
                </span>
              )}
            </div>
            <Link href="/technician/requests">
              <Button variant="ghost" size="sm" className="text-primary font-semibold text-xs md:text-sm gap-0.5 h-7 md:h-8 px-2">
                تصفح الكل
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
          {loading ? (
            <div className="space-y-1.5">
              {[1, 2].map((i) => <div key={i} className="h-10 md:h-14 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : availableRequests.length === 0 ? (
            <div className="py-4 md:py-6 text-center text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-1.5">
                <Search className="w-4 h-4 opacity-40" />
              </div>
              <p className="text-xs md:text-sm">لا توجد طلبات متاحة حالياً في منطقتك</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {availableRequests.map((r: any) => {
                const status = REQUEST_STATUS_MAP[r.status] || { label: r.status, color: "bg-gray-100" };
                return (
                  <Link href={`/technician/requests/${r.id}`} key={r.id}>
                    <div className="flex items-center justify-between p-2.5 md:p-3 rounded-lg hover:bg-primary/5 border border-primary/20 bg-primary/[0.02] cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs md:text-sm truncate">{r.description?.substring(0, 55) || `طلب #${r.id}`}{r.description?.length > 55 ? "..." : ""}</p>
                        {r.address && <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 truncate">{r.address}</p>}
                      </div>
                      <Badge className={`text-[10px] md:text-xs border-0 mr-2 flex-shrink-0 ${status.color}`}>{status.label}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active requests */}
      <Card>
        <CardHeader className="px-3 pt-3 pb-1.5 md:pb-2 md:px-6 md:pt-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-base">الطلبات النشطة</CardTitle>
            <Link href="/technician/requests">
              <Button variant="ghost" size="sm" className="text-primary font-semibold text-xs md:text-sm gap-0.5 h-7 md:h-8 px-2">
                عرض الكل
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
          {loading ? (
            <div className="space-y-1.5">
              {[1, 2].map((i) => <div key={i} className="h-10 md:h-14 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : activeRequests.length === 0 ? (
            <div className="py-4 md:py-8 text-center text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-1.5">
                <Search className="w-4 h-4 opacity-40" />
              </div>
              <p className="text-xs md:text-sm">لا توجد طلبات نشطة</p>
              <Link href="/technician/requests">
                <Button size="sm" className="mt-2.5 h-7 text-xs">تصفح الطلبات المتاحة</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {activeRequests.map((r: any) => {
                const status = REQUEST_STATUS_MAP[r.status] || { label: r.status, color: "bg-gray-100" };
                return (
                  <Link href={`/technician/requests/${r.id}`} key={r.id}>
                    <div
                      className="flex items-center justify-between p-2.5 md:p-3 rounded-lg hover:bg-muted/50 border border-border cursor-pointer transition-colors"
                      data-testid={`row-request-${r.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs md:text-sm truncate">{r.description?.substring(0, 55) || `طلب #${r.id}`}{r.description?.length > 55 ? "..." : ""}</p>
                        {r.address && <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 truncate">{r.address}</p>}
                      </div>
                      <Badge className={`text-[10px] md:text-xs border-0 mr-2 flex-shrink-0 ${status.color}`}>{status.label}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offers */}
      <Card>
        <CardHeader className="px-3 pt-3 pb-1.5 md:pb-2 md:px-6 md:pt-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-base">عروضي الأخيرة</CardTitle>
            <Link href="/technician/offers">
              <Button variant="ghost" size="sm" className="text-primary font-semibold text-xs md:text-sm gap-0.5 h-7 md:h-8 px-2">
                عرض الكل
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
          {loading ? (
            <div className="space-y-1.5">
              {[1, 2].map((i) => <div key={i} className="h-10 md:h-14 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : offers.length === 0 ? (
            <div className="py-4 md:py-8 text-center text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-1.5">
                <FileText className="w-4 h-4 opacity-40" />
              </div>
              <p className="text-xs md:text-sm">لم تقدم أي عروض بعد</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {offers.map((offer: any) => (
                <Link href={`/technician/requests/${offer.requestId}`} key={offer.id}>
                  <div
                    className="flex items-center justify-between p-2.5 md:p-3 rounded-lg hover:bg-muted/50 border border-border cursor-pointer transition-colors"
                    data-testid={`row-offer-${offer.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs md:text-sm">طلب #{offer.requestId}</p>
                      {offer.service?.nameAr && (
                        <p className="text-[10px] md:text-xs text-primary mt-0.5">{offer.service.nameAr}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mr-2 flex-shrink-0">
                      <p className="font-bold text-xs md:text-sm text-foreground">{offer.price} ج</p>
                      <OfferStatusBadge offer={offer} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed */}
      <Card>
        <CardHeader className="px-3 pt-3 pb-1.5 md:pb-2 md:px-6 md:pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm md:text-base">الطلبات المكتملة</CardTitle>
              {completedTotal > 0 && (
                <span className="text-[10px] bg-green-100 text-green-800 font-bold rounded-full px-1.5 py-0.5">
                  {completedTotal}
                </span>
              )}
            </div>
            <Link href="/technician/completed">
              <Button variant="ghost" size="sm" className="text-primary font-semibold text-xs md:text-sm gap-0.5 h-7 md:h-8 px-2">
                عرض الكل
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
          {loading ? (
            <div className="space-y-1.5">
              {[1, 2].map((i) => <div key={i} className="h-10 md:h-14 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : completed.length === 0 ? (
            <div className="py-4 md:py-8 text-center text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-1.5">
                <CheckCircle2 className="w-4 h-4 opacity-40" />
              </div>
              <p className="text-xs md:text-sm">لا توجد طلبات مكتملة بعد</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {completed.map((r: any) => (
                <Link href={`/technician/requests/${r.id}`} key={r.id}>
                  <div
                    className="flex items-center justify-between p-2.5 md:p-3 rounded-lg hover:bg-muted/50 border border-green-100 bg-green-50/40 cursor-pointer transition-colors"
                    data-testid={`row-completed-${r.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs md:text-sm">طلب #{r.id}</p>
                      {r.service?.nameAr && <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">{r.service.nameAr}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 mr-2 flex-shrink-0">
                      {r.agreedPrice && parseFloat(r.agreedPrice) > 0 && (
                        <p className="font-bold text-xs md:text-sm text-green-700">{parseFloat(r.agreedPrice).toFixed(0)} ج</p>
                      )}
                      <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
