import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListRequests } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, ClipboardList, ChevronLeft } from "lucide-react";
import { REQUEST_STATUS_MAP } from "@/lib/status";

const INITIAL_VISIBLE = 5;

export default function CustomerRequests() {
  const { data: requestsData, isLoading } = useListRequests();
  const requests = (requestsData as any)?.data || [];
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Reset visible window whenever the underlying dataset is replaced (e.g. after refetch)
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [requests.length]);

  const visibleRequests = requests.slice(0, visibleCount);
  const hasMore = requests.length > visibleCount;
  const remaining = requests.length - visibleCount;

  return (
    <div className="px-3 py-3 md:p-6 max-w-3xl mx-auto w-full overflow-x-hidden">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-lg md:text-2xl font-bold">طلباتي</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">جميع طلبات الخدمة التي قدمتها</p>
        </div>
        <Link href="/customer/requests/new">
          <Button size="sm" className="h-8 md:h-9 text-xs md:text-sm gap-1.5" data-testid="button-new-request">
            <PlusCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            طلب جديد
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[76px] bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 md:py-16 text-center">
            <ClipboardList className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold text-base md:text-lg mb-1.5">لا توجد طلبات</h3>
            <p className="text-muted-foreground text-xs md:text-sm mb-4 md:mb-6">
              أنشئ طلبك الأول واستقبل عروض الفنيين
            </p>
            <Link href="/customer/requests/new">
              <Button size="sm">إنشاء طلب جديد</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {visibleRequests.map((r: any) => {
              const status = REQUEST_STATUS_MAP[r.status] || {
                label: r.status,
                color: "bg-gray-100 text-gray-600",
              };
              return (
                <Link href={`/customer/requests/${r.id}`} key={r.id}>
                  {/* Card: rounded-2xl, layered shadow, subtle border → feels like an independent floating object */}
                  <Card
                    className="cursor-pointer rounded-2xl border border-border/40 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.11),0_2px_8px_rgba(0,0,0,0.06)] hover:border-primary/25 transition-all duration-200"
                    data-testid={`card-request-${r.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-stretch gap-3">

                        {/* ── Content column ── */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">

                          {/* Row 1: status badge + offers count */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              className={`text-[10px] md:text-xs ${status.color} border-0 rounded-full px-2 py-0.5 font-semibold leading-none`}
                            >
                              {status.label}
                            </Badge>
                            {r.offersCount > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] md:text-xs rounded-full border-primary/35 text-primary bg-primary/5 px-2 py-0.5 font-medium leading-none"
                              >
                                {r.offersCount} عرض
                              </Badge>
                            )}
                          </div>

                          {/* Row 2: description */}
                          <p className="font-semibold text-[13px] md:text-sm line-clamp-2 leading-snug text-foreground">
                            {r.description}
                          </p>

                          {/* Row 3: address */}
                          <p className="text-[10px] md:text-xs text-muted-foreground/75 truncate leading-none">
                            {r.address}
                          </p>

                        </div>

                        {/* ── Thin separator ── */}
                        <div className="w-px bg-border/35 flex-shrink-0 self-stretch" />

                        {/* ── Right column: date + arrow ── */}
                        <div className="flex flex-col items-center justify-between flex-shrink-0 gap-2">
                          <p className="text-[10px] text-muted-foreground/60 whitespace-nowrap tabular-nums leading-none">
                            {new Date(r.createdAt).toLocaleDateString("ar-EG")}
                          </p>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
                            <ChevronLeft className="w-4 h-4 text-primary" strokeWidth={2.5} />
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {hasMore && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs md:text-sm h-9 border-border/70"
                onClick={() => setVisibleCount((c) => c + INITIAL_VISIBLE)}
              >
                عرض المزيد · {remaining} طلب{remaining !== 1 ? "" : ""}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
