import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Star, User } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function StarRow({ stars, size = "sm" }: { stars: number; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= stars ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 86400 * 30) return `منذ ${Math.floor(diff / 86400)} يوم`;
  if (diff < 86400 * 365) return `منذ ${Math.floor(diff / (86400 * 30))} شهر`;
  return `منذ ${Math.floor(diff / (86400 * 365))} سنة`;
}

export default function TechnicianReviews() {
  const { currentUser, token } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !currentUser?.id) return;
    setLoading(true);
    fetch(`${BASE_URL}/api/ratings/technician/${currentUser.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setReviews(Array.isArray(data.ratings) ? data.ratings : []);
        setAvgRating(parseFloat(data.averageRating) || 0);
        setReviewCount(data.reviewCount || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, currentUser?.id]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تقييماتي</h1>
        <p className="text-muted-foreground mt-1 text-sm">آراء العملاء عن خدماتك</p>
      </div>

      {/* Summary card */}
      <Card className="border-yellow-200 bg-yellow-50/60">
        <CardContent className="p-6">
          {loading ? (
            <div className="h-16 bg-yellow-100 rounded-lg animate-pulse" />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="text-center">
                <p className="text-5xl font-black text-foreground">
                  {avgRating > 0 ? avgRating.toFixed(1) : "—"}
                </p>
                <StarRow stars={Math.round(avgRating)} size="lg" />
                <p className="text-sm text-muted-foreground mt-1">
                  {reviewCount > 0 ? `${reviewCount} تقييم` : "لا توجد تقييمات بعد"}
                </p>
              </div>

              {reviewCount > 0 && (
                <div className="flex-1 space-y-1.5 w-full">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => r.stars === star).length;
                    const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-muted-foreground text-left">{star}</span>
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        <div className="flex-1 bg-yellow-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 bg-yellow-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-5 text-left text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold">لا توجد تقييمات حتى الآن</p>
          <p className="text-sm mt-1">أكمل طلبات العملاء لتحصل على تقييماتك</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {r.customer?.profileImage ? (
                    <img
                      src={r.customer.profileImage}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-sm">
                        {r.customer?.fullName || "عميل"}
                      </p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <StarRow stars={r.stars} />
                    </div>
                    {r.review && (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {r.review}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
