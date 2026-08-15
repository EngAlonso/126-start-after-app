import { Link } from "wouter";
import {
  useListRequests, getListRequestsQueryKey,
  useListNotifications, getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Search, Zap } from "lucide-react";
import { REQUEST_STATUS_MAP } from "@/lib/status";

export default function TechnicianRequests() {
  const { data: pendingData, isLoading: loadingPending } = useListRequests(
    { status: "pending" } as any,
    { query: { refetchInterval: 20_000, queryKey: getListRequestsQueryKey({ status: "pending" } as any) } }
  );
  const { data: offersData, isLoading: loadingOffers } = useListRequests(
    { status: "offers_received" } as any,
    { query: { refetchInterval: 20_000, queryKey: getListRequestsQueryKey({ status: "offers_received" } as any) } }
  );

  const { data: notifications = [] } = useListNotifications(
    {},
    { query: { refetchInterval: 20_000, queryKey: getListNotificationsQueryKey() } }
  );
  const notifs = notifications as any[];
  const newRequestIds = new Set(
    notifs
      .filter((n) => !n.isRead && n.type === "new_request")
      .map((n) => n.relatedId)
  );

  const pendingRequests  = (pendingData as any)?.data  || [];
  const offersRequests   = (offersData  as any)?.data  || [];

  const seen = new Set<number>();
  const requests: any[] = [];
  for (const r of [...pendingRequests, ...offersRequests]) {
    if (!seen.has(r.id)) { seen.add(r.id); requests.push(r); }
  }

  const isLoading = loadingPending || loadingOffers;

  return (
    <div className="p-3 md:p-6 max-w-3xl mx-auto">
      <div className="mb-3 md:mb-6">
        <h1 className="text-lg md:text-2xl font-bold">الطلبات المتاحة</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-0.5">طلبات في نطاق خدمتك — قدّم عرضك الآن</p>
      </div>

      {isLoading ? (
        <div className="space-y-2 md:space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 md:h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 md:py-16 text-center text-muted-foreground">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 md:w-7 md:h-7 opacity-40" />
            </div>
            <p className="font-semibold text-sm md:text-base">لا توجد طلبات متاحة الآن</p>
            <p className="text-xs md:text-sm mt-1">سيتم إشعارك عند وصول طلبات جديدة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 md:space-y-4">
          {requests.map((r: any) => {
            const status = REQUEST_STATUS_MAP[r.status] || { label: r.status, color: "bg-gray-100" };
            const isNew = newRequestIds.has(r.id);
            return (
              <Link href={`/technician/requests/${r.id}`} key={r.id}>
                <Card
                  className={`hover:shadow-md cursor-pointer transition-all hover:border-primary/40 ${isNew ? "border-primary/60 ring-1 ring-primary/30" : ""}`}
                  data-testid={`card-request-${r.id}`}
                >
                  <CardContent className="p-3 md:p-5">
                    <div className="flex items-start justify-between gap-2 md:gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <Badge className={`text-[10px] md:text-xs ${status.color} border-0 px-1.5 py-0`}>{status.label}</Badge>
                          {isNew && (
                            <Badge className="text-[10px] md:text-xs bg-destructive text-destructive-foreground border-0 flex items-center gap-0.5 px-1.5 py-0">
                              <Zap className="w-2.5 h-2.5" />
                              جديد
                            </Badge>
                          )}
                          {r.offersCount > 0 && (
                            <span className="text-[10px] md:text-xs text-muted-foreground">{r.offersCount} عرض مقدم</span>
                          )}
                        </div>
                        <p className="font-medium text-xs md:text-sm line-clamp-2 mb-1.5">{r.description}</p>
                        <div className="flex flex-wrap gap-2 md:gap-3 text-[10px] md:text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            {r.address}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            {new Date(r.createdAt).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
