import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronLeft } from "lucide-react";
import { OFFER_STATUS_MAP } from "@/lib/status";
import { useAuth } from "@/contexts/auth-context";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function TechnicianOffers() {
  const { token } = useAuth();

  const { data: offers = [], isLoading } = useQuery<any[]>({
    queryKey: ["technician-my-offers"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/offers/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("فشل تحميل العروض");
      return res.json();
    },
    enabled: !!token,
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">عروضي</h1>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : offers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لم تقدم أي عروض بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((offer: any) => {
            const status = OFFER_STATUS_MAP[offer.status] || { label: offer.status, color: "bg-gray-100" };
            return (
              <Link href={`/technician/requests/${offer.requestId}`} key={offer.id}>
                <Card className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" data-testid={`card-offer-${offer.id}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">طلب #{offer.requestId}</p>
                      {offer.service?.name && (
                        <p className="text-xs text-primary mt-0.5">{offer.service.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(offer.createdAt).toLocaleDateString("ar-EG")}</p>
                      {offer.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{offer.notes}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-lg font-black text-primary">{offer.price} جنيه</p>
                      <Badge className={`text-xs ${status.color} border-0`}>{status.label}</Badge>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
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
