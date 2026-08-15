import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MapPin, CalendarDays, DollarSign, Star } from "lucide-react";
import { REQUEST_STATUS_MAP } from "@/lib/status";
import { useAuth } from "@/contexts/auth-context";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function TechnicianCompleted() {
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    fetch(`${BASE_URL}/api/requests/my-completed`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.data)) {
          setRequests(data.data);
          setTotal(data.total ?? data.data.length);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  const totalEarnings = requests
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + parseFloat(r.agreedPrice ?? "0"), 0);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الطلبات المكتملة</h1>
          <p className="text-sm text-muted-foreground">{total} طلب</p>
        </div>
      </div>

      {/* Summary card */}
      {!isLoading && requests.length > 0 && (
        <Card className="mb-5 bg-gradient-to-bl from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-xs text-green-700">إجمالي الأرباح المكتسبة</p>
                <p className="text-2xl font-black text-green-800">{totalEarnings.toFixed(0)} جنيه</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-semibold">{requests.filter((r) => r.status === "completed").length} مكتمل</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد طلبات مكتملة بعد</p>
          <p className="text-sm mt-1">ستظهر هنا طلباتك التي قمت بإنجازها</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => {
            const statusInfo = REQUEST_STATUS_MAP[req.status] || { label: req.status, color: "bg-gray-100" };
            const agreedPrice = parseFloat(req.agreedPrice ?? "0");

            return (
              <Card
                key={req.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-border"
                onClick={() => navigate(`/technician/requests/${req.id}`)}
                data-testid={`completed-request-${req.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">طلب #{req.id}</span>
                        <Badge className={`text-xs border-0 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                      </div>
                      {req.service?.name && (
                        <p className="text-sm text-primary font-medium mb-1">{req.service.name}</p>
                      )}
                      {req.customer?.fullName && (
                        <p className="text-xs text-muted-foreground mb-1">
                          العميل: {req.customer.fullName}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {req.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {req.address.length > 30 ? req.address.slice(0, 30) + "..." : req.address}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(req.createdAt).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                    </div>

                    {agreedPrice > 0 && (
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-green-600 text-base">{agreedPrice.toFixed(0)} ج</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-current text-yellow-400" />
                          إجمالي
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
