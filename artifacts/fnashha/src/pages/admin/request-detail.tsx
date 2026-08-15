import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CldImg } from "@/components/ui/cld-img";
import {
  useGetRequest, getGetRequestQueryKey, getListRequestsQueryKey,
  useListOffers, getListOffersQueryKey,
  useUpdateRequest,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminUnread } from "@/contexts/admin-unread-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { REQUEST_STATUS_MAP } from "@/lib/status";
import { MapPin, Phone, Clock, User, TrendingUp, ArrowUpDown, Star, Building2, CheckCircle2, Tag, Coins, BadgeCheck, Hourglass, ReceiptText, Eye, Printer, Download, MessageCircle, Loader2, RefreshCw } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const ADMIN_STATUSES = [
  { value: "pending", label: "بانتظار العروض" },
  { value: "in_progress", label: "جاري التنفيذ" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled_by_admin", label: "إلغاء من الإدارة" },
  { value: "disputed", label: "متنازع عليه" },
];

export default function AdminRequestDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperAdmin, hasPermission, token } = useAuth();
  const { markSeen, wasKnownUnread } = useAdminUnread();
  const reqId = parseInt(id);

  // Decrement badge immediately when this detail page mounts for an unread request
  useEffect(() => {
    if (!reqId) return;
    markSeen("requests", reqId, wasKnownUnread("requests", reqId));
  }, [reqId]);
  const [newStatus, setNewStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [priceAdjustments, setPriceAdjustments] = useState<any[]>([]);
  const [platformCredit, setPlatformCredit] = useState<any>(null);
  const [offerForm, setOfferForm] = useState({ price: "", spareParts: "", notes: "" });
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [isEditingOffer, setIsEditingOffer] = useState(false);
  const [editOfferForm, setEditOfferForm] = useState({ price: "", spareParts: "", notes: "" });
  // Invoice state
  const [reqInvoices, setReqInvoices]       = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [generating, setGenerating]           = useState(false);

  const { data: request, isLoading } = useGetRequest(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestQueryKey(reqId) },
  });

  // Offers loaded via React Query so SSE new_offer / offer_selected / offer_withdrawn
  // events can instantly refresh the list without a manual page reload.
  const { data: offersRaw = [] } = useListOffers(reqId, {
    query: { enabled: !!reqId, queryKey: getListOffersQueryKey(reqId) },
  });
  const offers = offersRaw as any[];

  const updateMutation = useUpdateRequest();

  useEffect(() => {
    if (!reqId) return;
    fetch(`${BASE_URL}/api/requests/${reqId}/price-adjustments`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPriceAdjustments(data); })
      .catch(() => {});
  }, [reqId]);

  // Fetch platform credit (coin discount settlement) when request is completed
  useEffect(() => {
    if (!reqId || !token) return;
    fetch(`${BASE_URL}/api/requests/${reqId}/platform-credit`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (data && typeof data === "object") setPlatformCredit(data); })
      .catch(() => {});
  }, [reqId, token]);

  // Fetch invoices for this request
  const fetchInvoices = () => {
    if (!reqId || !token) return;
    setInvoicesLoading(true);
    fetch(`${BASE_URL}/api/invoices/request/${reqId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setReqInvoices(d); })
      .catch(() => {})
      .finally(() => setInvoicesLoading(false));
  };

  useEffect(() => { fetchInvoices(); }, [reqId, token]);

  const handleGenerateInvoices = async () => {
    if (!reqId || !token) return;
    setGenerating(true);
    try {
      const res = await fetch(`${BASE_URL}/api/invoices/request/${reqId}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      if (Array.isArray(data.invoices)) setReqInvoices(data.invoices);
      toast({ title: "تم إنشاء الفواتير بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const formatPhone = (mobile: string): string => {
    let digits = (mobile ?? "").replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length === 11) digits = "20" + digits.slice(1);
    else if (digits.length === 10 && digits.startsWith("1")) digits = "20" + digits;
    return digits;
  };

  if (isLoading) return <div className="p-6"><div className="h-40 bg-muted rounded-xl animate-pulse" /></div>;
  if (!request) return <div className="p-6 text-center text-muted-foreground">الطلب غير موجود</div>;

  const req = request as any;
  const statusInfo = REQUEST_STATUS_MAP[req.status] || { label: req.status, color: "bg-gray-100" };

  const handleSubmitOffer = async (): Promise<void> => {
    if (!offerForm.price) { toast({ title: "السعر مطلوب", variant: "destructive" }); return; }
    setOfferSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/requests/${reqId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          price: offerForm.price,
          ...(offerForm.spareParts ? { spareParts: offerForm.spareParts } : {}),
          ...(offerForm.notes ? { notes: offerForm.notes } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
      toast({ title: "تم تقديم العرض بنجاح" });
      setOfferForm({ price: "", spareParts: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(reqId) });
      queryClient.invalidateQueries({ queryKey: getListOffersQueryKey(reqId) });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setOfferSubmitting(false);
    }
  };

  const handleEditOffer = async (): Promise<void> => {
    if (!editOfferForm.price) { toast({ title: "السعر مطلوب", variant: "destructive" }); return; }
    const adminOffer = offers.find((o: any) => !o.technicianId || o.isAdminOffer);
    if (!adminOffer) return;
    setOfferSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/requests/${reqId}/offers/${adminOffer.id}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          price: editOfferForm.price,
          ...(editOfferForm.spareParts ? { spareParts: editOfferForm.spareParts } : { spareParts: "" }),
          notes: editOfferForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
      toast({ title: "تم تحديث العرض" });
      setIsEditingOffer(false);
      queryClient.invalidateQueries({ queryKey: getListOffersQueryKey(reqId) });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setOfferSubmitting(false);
    }
  };

  const handleUpdate = () => {
    updateMutation.mutate(
      { id: reqId, data: { status: newStatus || req.status, adminNote } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(reqId) });
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({ title: "تم التحديث" });
        },
        onError: (err: any) => toast({ title: "خطأ", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  // Check if admin offer was accepted
  const adminOffer = offers.find((o: any) => !o.technicianId || o.isAdminOffer);
  const acceptedAdminOffer = offers.find(
    (o: any) => ((!o.technicianId || o.isAdminOffer) && o.status === "selected")
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">طلب #{req.id}</h1>
          <Badge className={`mt-2 ${statusInfo.color} border-0`}>{statusInfo.label}</Badge>
        </div>
      </div>

      {/* Request details */}
      <Card>
        <CardHeader><CardTitle className="text-base">بيانات الطلب</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {req.customer && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{req.customer.fullName} — {req.customer.mobile}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span>{req.mobile}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <span>{req.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{new Date(req.createdAt).toLocaleDateString("ar-EG")}</span>
          </div>
          <div className="pt-2 border-t">
            <p className="text-muted-foreground mb-1">الوصف:</p>
            <p>{req.description}</p>
          </div>
          {req.agreedPrice && (
            <div className="pt-2 border-t">
              <p className="font-semibold text-primary">السعر المتفق عليه: {req.agreedPrice} جنيه</p>
            </div>
          )}
          {req.adminNote && (
            <div className="pt-2 border-t">
              <p className="text-muted-foreground mb-1">ملاحظة الإدارة:</p>
              <p>{req.adminNote}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Financial Settlement Card ────────────────────────────────────────
           Shown for any completed request that involved a coin discount.
           Data from GET /api/requests/:id/platform-credit                */}
      {platformCredit?.hasCoinDiscount && (
        <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-800">
              <Coins className="w-4 h-4" />
              تفاصيل التسوية المالية (عملات فنشها)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-0 text-sm">
            {(() => {
              const agreedPrice      = parseFloat(platformCredit.agreedPrice ?? 0);
              const customerPaid     = parseFloat(platformCredit.customerPayableAmount ?? agreedPrice);
              const platformCreditAmt = parseFloat(platformCredit.platformCreditAmount ?? 0);
              // discount = agreedPrice - customerPaid (same as platformCreditAmount by construction)
              const discount = agreedPrice - customerPaid;

              const rows = [
                { label: "السعر الأصلي",           value: `${agreedPrice.toFixed(2)} جنيه`,     cls: "" },
                { label: "خصم عملات فنشها",          value: `-${discount.toFixed(2)} جنيه`,       cls: "text-green-700 font-bold" },
                { label: "العميل دفع",               value: `${customerPaid.toFixed(2)} جنيه`,    cls: "text-blue-700 font-bold" },
                { label: "ائتمان فنشها للفني",       value: `${platformCreditAmt.toFixed(2)} جنيه`, cls: "text-purple-700 font-bold" },
                { label: "إجمالي أرباح الفني",       value: `${agreedPrice.toFixed(2)} جنيه`,    cls: "text-emerald-700 font-bold" },
              ];

              return rows.map(({ label, value, cls }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-yellow-200/60 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cls || "text-foreground font-medium"}>{value}</span>
                </div>
              ));
            })()}

            {/* Settlement status */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-muted-foreground font-medium">حالة التسوية</span>
              {platformCredit.status === "paid" ? (
                <Badge className="bg-green-100 text-green-800 border-0 gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  تمت التسوية
                </Badge>
              ) : (
                <Badge className="bg-orange-100 text-orange-800 border-0 gap-1">
                  <Hourglass className="w-3.5 h-3.5" />
                  معلقة
                </Badge>
              )}
            </div>
            {platformCredit.paymentDate && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>تاريخ التسوية</span>
                <span>{new Date(platformCredit.paymentDate).toLocaleDateString("ar-EG")}</span>
              </div>
            )}
            {platformCredit.paymentReference && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>رقم المرجع</span>
                <span dir="ltr" className="font-mono">{platformCredit.paymentReference}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Price adjustments section */}
      {priceAdjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              سجل تعديلات السعر ({priceAdjustments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {priceAdjustments.map((adj: any, i: number) => {
              const originalTotal = (adj.originalLaborCost ?? 0) + (adj.originalSpareParts ?? 0);
              const newTotal = (adj.newLaborCost ?? 0) + (adj.newSpareParts ?? 0);
              const diff = newTotal - originalTotal;

              return (
                <div key={adj.id ?? i} className="rounded-lg border border-border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(adj.createdAt).toLocaleString("ar-EG")}
                    </span>
                    <Badge
                      variant="outline"
                      className={diff > 0 ? "border-red-300 text-red-700 bg-red-50" : diff < 0 ? "border-green-300 text-green-700 bg-green-50" : ""}
                    >
                      {diff > 0 ? "+" : ""}{diff.toFixed(2)} جنيه
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/40 rounded p-2">
                      <p className="text-xs text-muted-foreground mb-1">السعر الأصلي</p>
                      <p className="font-semibold">{originalTotal.toFixed(2)} جنيه</p>
                      {adj.originalLaborCost != null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          خدمة: {adj.originalLaborCost} ج
                          {adj.originalSpareParts ? ` + قطع: ${adj.originalSpareParts} ج` : ""}
                        </p>
                      )}
                    </div>
                    <div className={`rounded p-2 ${diff > 0 ? "bg-red-50" : "bg-green-50"}`}>
                      <p className={`text-xs mb-1 ${diff > 0 ? "text-red-600" : "text-green-600"}`}>السعر الجديد</p>
                      <p className="font-semibold">{newTotal.toFixed(2)} جنيه</p>
                      {adj.newLaborCost != null && (
                        <p className={`text-xs mt-1 ${diff > 0 ? "text-red-500" : "text-green-500"}`}>
                          خدمة: {adj.newLaborCost} ج
                          {adj.newSpareParts ? ` + قطع: ${adj.newSpareParts} ج` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {adj.reason && (
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      <span className="font-medium">السبب:</span> {adj.reason}
                    </p>
                  )}
                  {adj.customerApprovalStatus && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">قرار العميل: </span>
                      <span className={
                        adj.customerApprovalStatus === "approved" ? "text-green-600 font-medium" :
                        adj.customerApprovalStatus === "rejected" ? "text-red-600 font-medium" :
                        "text-orange-600 font-medium"
                      }>
                        {adj.customerApprovalStatus === "approved" ? "✓ وافق" :
                         adj.customerApprovalStatus === "rejected" ? "✗ رفض" : "⏳ بانتظار"}
                      </span>
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Selected technician */}
      {req.selectedTechnician && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-green-800">
              <CheckCircle2 className="w-4 h-4" />
              الفني المختار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              {req.selectedTechnician.profileImage ? (
                <CldImg src={req.selectedTechnician.profileImage} width={96} className="w-12 h-12 rounded-full object-cover border-2 border-green-300" alt="" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                  <span className="font-bold text-green-800 text-base">{req.selectedTechnician.fullName?.[0]}</span>
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-green-900">{req.selectedTechnician.fullName}</p>
                <div className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5">
                  <Phone className="w-3 h-3" />
                  {req.selectedTechnician.mobile}
                </div>
                {req.selectedTechnician.averageRating > 0 && (
                  <div className="flex items-center gap-1 text-xs mt-0.5">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    <span>{Number(req.selectedTechnician.averageRating).toFixed(1)}</span>
                  </div>
                )}
              </div>
              {req.agreedPrice && (
                <div className="flex items-center gap-1 text-green-700 font-bold">
                  <TrendingUp className="w-4 h-4" />
                  {req.agreedPrice} جنيه
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin offer accepted notice */}
      {acceptedAdminOffer && (
        <Card className="border-purple-300 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-purple-800">
              <Building2 className="w-4 h-4" />
              تم قبول عرض الإدارة
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex items-center gap-2 text-purple-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>قبل العميل عرض الإدارة بتاريخ {new Date(acceptedAdminOffer.updatedAt || acceptedAdminOffer.createdAt).toLocaleDateString("ar-EG")}</span>
            </div>
            {acceptedAdminOffer.submittedByName && (
              <p className="text-xs text-purple-600">
                قُدِّم بواسطة: {acceptedAdminOffer.submittedByName}
              </p>
            )}
            <div className="bg-purple-100 rounded-lg p-2 flex gap-4">
              <div>
                <p className="text-xs text-purple-600">السعر</p>
                <p className="font-bold text-purple-900">{parseFloat(acceptedAdminOffer.price)} جنيه</p>
              </div>
              {parseFloat(acceptedAdminOffer.spareParts || "0") > 0 && (
                <div>
                  <p className="text-xs text-purple-600">قطع الغيار</p>
                  <p className="font-bold text-purple-900">{parseFloat(acceptedAdminOffer.spareParts)} جنيه</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All offers */}
      {offers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" />
              العروض المقدمة ({offers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {offers.map((offer: any) => {
              const isAdminOffer = !offer.technicianId || offer.isAdminOffer;
              const tech = offer.technician;
              const laborPrice = parseFloat(offer.price) || 0;
              const sparePartsPrice = parseFloat(offer.spareParts) || 0;
              const totalPrice = laborPrice + sparePartsPrice;
              const isSelected = offer.status === "selected";

              return (
                <div
                  key={offer.id}
                  className={`border rounded-xl p-4 space-y-3 ${
                    isSelected ? "border-green-400 bg-green-50" :
                    offer.status === "rejected" ? "opacity-60 bg-muted/30" : "bg-background"
                  }`}
                >
                  {/* Offer header */}
                  <div className="flex items-start gap-3">
                    {isAdminOffer ? (
                      <div className="w-11 h-11 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 border-2 border-purple-200">
                        <Building2 className="w-5 h-5 text-purple-600" />
                      </div>
                    ) : tech?.profileImage ? (
                      <CldImg src={tech.profileImage} alt="" width={88} className="w-11 h-11 rounded-full object-cover border-2 border-primary/20 flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
                        <span className="text-sm font-bold text-primary">{tech?.fullName?.[0] || "؟"}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAdminOffer ? (
                          <p className="font-semibold text-sm text-purple-800">عرض من الإدارة</p>
                        ) : (
                          <p className="font-semibold text-sm">{tech?.fullName || "—"}</p>
                        )}
                        {isSelected && (
                          <Badge className="bg-green-600 text-white text-xs border-0 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            تم اختيار العرض
                          </Badge>
                        )}
                        {offer.status === "rejected" && (
                          <Badge className="bg-red-100 text-red-700 text-xs border-0">مرفوض</Badge>
                        )}
                      </div>
                      {!isAdminOffer && tech?.averageRating > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                          <span>{Number(tech.averageRating).toFixed(1)}</span>
                          {tech.reviewCount > 0 && <span>({tech.reviewCount} تقييم)</span>}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(offer.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>

                  {/* Pricing */}
                  <div className={`bg-muted/50 rounded-lg p-3 grid ${sparePartsPrice > 0 ? "grid-cols-3" : "grid-cols-2"} gap-2 text-center`}>
                    <div>
                      <p className="text-xs text-muted-foreground">سعر الخدمة</p>
                      <p className="font-bold text-primary">{laborPrice} <span className="text-xs font-normal">ج</span></p>
                    </div>
                    {sparePartsPrice > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">قطع الغيار</p>
                        <p className="font-bold text-orange-600">{sparePartsPrice} <span className="text-xs font-normal">ج</span></p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">الإجمالي</p>
                      <p className="font-black text-base">{totalPrice} <span className="text-xs font-normal">ج</span></p>
                    </div>
                  </div>

                  {/* Notes */}
                  {offer.notes && (
                    <p className="text-xs text-muted-foreground border-t pt-2">{offer.notes}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Admin offer submission / edit */}
      {(isSuperAdmin || hasPermission("offers.submit_on_behalf")) && ["pending", "offers_received"].includes(req.status) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>تقديم عرض من الإدارة</span>
              {adminOffer && !isEditingOffer && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditOfferForm({
                      price: String(parseFloat(adminOffer.price) || ""),
                      spareParts: String(parseFloat(adminOffer.spareParts || "0") || ""),
                      notes: adminOffer.notes || "",
                    });
                    setIsEditingOffer(true);
                  }}
                >
                  تعديل العرض
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {adminOffer && !isEditingOffer ? (
              /* Show existing admin offer summary */
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm space-y-1">
                <p className="text-purple-700 font-medium">يوجد عرض مقدم من الإدارة</p>
                <div className="flex gap-4 mt-1">
                  <div>
                    <p className="text-xs text-purple-600">سعر الخدمة</p>
                    <p className="font-bold text-purple-900">{parseFloat(adminOffer.price)} جنيه</p>
                  </div>
                  {parseFloat(adminOffer.spareParts || "0") > 0 && (
                    <div>
                      <p className="text-xs text-purple-600">قطع الغيار</p>
                      <p className="font-bold text-purple-900">{parseFloat(adminOffer.spareParts)} جنيه</p>
                    </div>
                  )}
                </div>
                {adminOffer.notes && (
                  <p className="text-xs text-muted-foreground pt-1">{adminOffer.notes}</p>
                )}
              </div>
            ) : isEditingOffer ? (
              /* Edit form */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">سعر الخدمة *</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={editOfferForm.price}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, price: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">قطع الغيار</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={editOfferForm.spareParts}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, spareParts: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">ملاحظات</label>
                  <Textarea
                    placeholder="ملاحظات اختيارية..."
                    value={editOfferForm.notes}
                    onChange={(e) => setEditOfferForm({ ...editOfferForm, notes: e.target.value })}
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleEditOffer} disabled={offerSubmitting}>
                    {offerSubmitting ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditingOffer(false)} disabled={offerSubmitting}>
                    إلغاء
                  </Button>
                </div>
              </>
            ) : (
              /* Submit new offer form */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">سعر الخدمة *</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={offerForm.price}
                      onChange={(e) => setOfferForm({ ...offerForm, price: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">قطع الغيار</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={offerForm.spareParts}
                      onChange={(e) => setOfferForm({ ...offerForm, spareParts: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">ملاحظات</label>
                  <Textarea
                    placeholder="ملاحظات اختيارية..."
                    value={offerForm.notes}
                    onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })}
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <Button onClick={handleSubmitOffer} disabled={offerSubmitting}>
                  {offerSubmitting ? "جاري الإرسال..." : "تقديم العرض"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Invoice Card (completed requests only) ─────────────────────────── */}
      {req.status === "completed" && (isSuperAdmin ||
        hasPermission("invoices.view_customer") || hasPermission("invoices.view_technician")) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-primary" />
                الفواتير
              </span>
              {!invoicesLoading && reqInvoices.length === 0 && (
                <Button size="sm" variant="outline" disabled={generating} onClick={handleGenerateInvoices} className="gap-1 text-xs">
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  إنشاء الفواتير
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoicesLoading && (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            )}

            {!invoicesLoading && reqInvoices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                لم يتم إنشاء الفواتير بعد. انقر «إنشاء الفواتير» لإنشائها.
              </p>
            )}

            {!invoicesLoading && reqInvoices.map((inv: any) => {
              const snap       = inv.snapshot_data ?? {};
              const isCustomer = inv.invoice_type === "customer";
              const invoiceNum = isCustomer ? snap.invoiceNumber : snap.settlementNumber;
              const mobile     = isCustomer ? snap.customerMobile : snap.technicianMobile;
              const waMsg      = isCustomer
                ? `السلام عليكم،\nمرفق فاتورة الطلب رقم ${invoiceNum}\nشكراً لاختياركم فنشها ❤️`
                : `السلام عليكم،\nمرفق إشعار تسوية الطلب رقم #${snap.requestId}\nشكراً لتعاونكم مع فنشها ❤️`;
              const waPhone = formatPhone(mobile ?? "");

              const canView     = isSuperAdmin || hasPermission(isCustomer ? "invoices.view_customer"       : "invoices.view_technician");
              const canPrint    = isSuperAdmin || hasPermission(isCustomer ? "invoices.print_customer"      : "invoices.print_technician");
              const canDownload = isSuperAdmin || hasPermission(isCustomer ? "invoices.download_customer"   : "invoices.download_technician");
              const canWA       = isSuperAdmin || hasPermission(isCustomer ? "invoices.whatsapp_customer"   : "invoices.whatsapp_technician");

              if (!canView) return null;

              return (
                <div key={inv.id} className={`border rounded-xl p-4 space-y-3 ${
                  isCustomer ? "border-yellow-200 bg-yellow-50/40" : "border-indigo-200 bg-indigo-50/40"
                }`}>
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1.5">
                        <ReceiptText className={`w-4 h-4 ${isCustomer ? "text-yellow-700" : "text-indigo-700"}`} />
                        {isCustomer ? "فاتورة العميل" : "إشعار تسوية الفني"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{invoiceNum}</p>
                    </div>
                    <Badge className={isCustomer
                      ? "bg-yellow-100 text-yellow-800 border-yellow-300 text-xs"
                      : "bg-indigo-100 text-indigo-800 border-indigo-300 text-xs"
                    }>
                      {isCustomer ? "عميل" : "فني"}
                    </Badge>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {canView && (
                      <Link href={`/admin/invoices/${inv.id}`}>
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <Eye className="w-3 h-3" />
                          عرض
                        </Button>
                      </Link>
                    )}
                    {canPrint && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs"
                        onClick={() => window.open(`${BASE_URL}/admin/invoices/${inv.id}`, "_blank")}>
                        <Printer className="w-3 h-3" />
                        طباعة
                      </Button>
                    )}
                    {canDownload && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs"
                        onClick={() => window.open(`${BASE_URL}/admin/invoices/${inv.id}`, "_blank")}>
                        <Download className="w-3 h-3" />
                        تنزيل PDF
                      </Button>
                    )}
                    {canWA && mobile && (
                      <Button size="sm" className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`, "_blank");
                          fetch(`${BASE_URL}/api/invoices/${inv.id}/log`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ action: "whatsapp_opened" }),
                          }).catch(() => {});
                        }}>
                        <MessageCircle className="w-3 h-3" />
                        واتساب
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Admin controls */}
      <Card>
        <CardHeader><CardTitle className="text-base">تحديث الطلب</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">تغيير الحالة</label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="mt-1" data-testid="select-status">
                <SelectValue placeholder="اختر حالة جديدة" />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">ملاحظة الإدارة</label>
            <Textarea
              placeholder="ملاحظة داخلية..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="mt-1"
              rows={3}
              data-testid="textarea-admin-note"
            />
          </div>
          <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-update">
            {updateMutation.isPending ? "جاري التحديث..." : "حفظ التغييرات"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
