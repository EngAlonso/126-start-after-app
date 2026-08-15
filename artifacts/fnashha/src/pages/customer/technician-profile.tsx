import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ArrowRight, Briefcase, Calendar, User } from "lucide-react";
import { CldImg } from "@/components/ui/cld-img";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface TechProfile {
  id: number;
  fullName: string;
  profileImage?: string;
  createdAt: string;
  averageRating: string;
  reviewCount: number;
  completedJobs: number;
  reviews: {
    id: number;
    stars: number;
    review?: string;
    createdAt: string;
    customerName?: string;
  }[];
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${cls} ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function TechnicianProfilePage({ id, requestId }: { id: string; requestId?: string }) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<TechProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id || !token) return;
    setLoading(true);
    fetch(`${BASE_URL}/api/technicians/${id}/public-profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setProfile(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, token]);

  const backHref = requestId ? `/customer/requests/${requestId}` : "/customer/requests";

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <p className="text-muted-foreground mb-4">تعذر تحميل الملف الشخصي</p>
        <Link href={backHref}>
          <Button variant="outline">العودة إلى الطلب</Button>
        </Link>
      </div>
    );
  }

  const avgRating = parseFloat(profile.averageRating);
  const joinDate = new Date(profile.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long" });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Back button */}
      <Link href={backHref}>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -mr-2 mb-1">
          <ArrowRight className="w-4 h-4" />
          العودة إلى الطلب
        </Button>
      </Link>

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {profile.profileImage ? (
              <CldImg
                src={profile.profileImage}
                alt={profile.fullName}
                width={160}
                className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 flex-shrink-0">
                <User className="w-10 h-10 text-primary/60" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{profile.fullName}</h1>

              {avgRating > 0 ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <StarRating rating={Math.round(avgRating)} size="lg" />
                  <span className="font-bold text-lg">{profile.averageRating}</span>
                  <span className="text-muted-foreground text-sm">({profile.reviewCount} تقييم)</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">لا توجد تقييمات بعد</p>
              )}

              <div className="flex flex-wrap gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Briefcase className="w-4 h-4" />
                  <span>{profile.completedJobs} طلب مكتمل</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>انضم في {joinDate}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            تقييمات العملاء ({profile.reviewCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.reviews.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Star className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد تقييمات بعد</p>
            </div>
          ) : (
            <div className="space-y-4">
              {profile.reviews.map((review) => (
                <div key={review.id} className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{review.customerName || "عميل"}</p>
                      <StarRating rating={review.stars} />
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(review.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                  {review.review && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{review.review}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
