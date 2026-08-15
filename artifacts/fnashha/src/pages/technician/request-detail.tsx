import { useState, useRef, useEffect } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { Link } from "wouter";
import {
  useGetRequest, getGetRequestQueryKey,
  useListOffers, getListOffersQueryKey,
  useCreateOffer, useUpdateOffer,
  useListNotifications, getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { REQUEST_STATUS_MAP } from "@/lib/status";
import {
  MapPin, Phone, Clock, MessageCircle, Tag, Pencil,
  Images, Volume2, X, CheckCircle, DollarSign, Clock3,
  AlertCircle, ImagePlus, Coins, BadgeCheck, Hourglass,
} from "lucide-react";
import { uploadFileLocal } from "@/lib/uploadMedia";
import { ImagePicker } from "@/components/ui/image-picker";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiCall(path: string, method: string, body?: any, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

export default function TechnicianRequestDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser, token } = useAuth();
  const reqId = parseInt(id);

  const [price, setPrice] = useState("");
  const [spareParts, setSpareParts] = useState("");
  const [notes, setNotes] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const [showPriceAdjust, setShowPriceAdjust] = useState(false);
  const [adjPrice, setAdjPrice] = useState("");
  const [adjSpareParts, setAdjSpareParts] = useState("");
  const [adjDesc, setAdjDesc] = useState("");
  const [adjImage, setAdjImage] = useState<string | null>(null);
  const [adjLoading, setAdjLoading] = useState(false);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const { data: request, isLoading } = useGetRequest(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestQueryKey(reqId) },
  });
  const { data: offers = [] } = useListOffers(
    reqId,
    { query: { enabled: !!reqId, queryKey: getListOffersQueryKey(reqId) } }
  );

  const createMutation = useCreateOffer();
  const updateMutation = useUpdateOffer();

  const { data: notifications = [] } = useListNotifications(
    {},
    { query: { queryKey: getListNotificationsQueryKey() } }
  );

  useEffect(() => {
    if (!token || !reqId) return;
    fetch(`${BASE_URL}/api/notifications/read-related`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ relatedId: reqId }),
    })
      .then(() => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId]);

  // Fetch platform credit when request is completed with coin discount.
  // Uses react-query so SSE ("platform_credit_updated") can invalidate this
  // exact key and refresh the summary live, without a page reload.
  // NOTE: must run before any conditional early returns below (Rules of Hooks),
  // so the enabled flag guards against `request` not being loaded yet.
  const reqStatus = (request as any)?.status;
  const reqHasDiscount = (request as any)?.hasDiscount;
  const { data: platformCredit } = useQuery({
    queryKey: ["platform-credit", reqId],
    queryFn: () => apiCall(`/requests/${reqId}/platform-credit`, "GET", undefined, token || ""),
    enabled: !!token && !!reqId && reqStatus === "completed" && !!reqHasDiscount,
  });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {[1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
    </div>
  );
  if (!request) return <div className="p-6 text-center text-muted-foreground">الطلب غير موجود</div>;

  const req = request as any;
  const notifs = notifications as any[];
  const unreadChatCount = notifs.filter(
    (n) => !n.isRead && n.type === "new_message" && n.relatedId === reqId
  ).length;

  const statusInfo = REQUEST_STATUS_MAP[req.status] || { label: req.status, color: "bg-gray-100" };
  const myOffer = (offers as any[]).find((o: any) => o.technicianId === currentUser?.id);
  const canSubmitOffer = ["pending", "offers_received"].includes(req.status);
  const canEdit = myOffer && ["pending", "offers_received"].includes(req.status) && myOffer.status !== "selected";
  const canChat = req.selectedTechnicianId === currentUser?.id &&
    ["technician_selected", "in_progress", "price_change_requested", "waiting_approval"].includes(req.status);
  const isSelectedTech = req.selectedTechnicianId === currentUser?.id && myOffer?.status === "selected";
  // Show adjustment/completion buttons when technician_selected OR in_progress
  const canAdjustPrice = isSelectedTech && ["technician_selected", "in_progress"].includes(req.status);
  const canRequestCompletion = isSelectedTech && ["technician_selected", "in_progress"].includes(req.status);
  const isPriceAdjPending = req.status === "price_change_requested" && isSelectedTech;
  const awaitingCustomerApproval = isSelectedTech && req.status === "waiting_approval";

  // Normalise a raw offer row (price/spareParts as strings from POST/PATCH)
  // into the enriched shape that GET /requests/:id/offers returns, so that
  // setQueryData always writes the same structure the list hook expects.
  const normalizeOffer = (raw: any) => {
    const laborPrice = typeof raw.price === "string" ? parseFloat(raw.price) : (raw.price ?? 0);
    const sparePartsPrice = raw.spareParts
      ? (typeof raw.spareParts === "string" ? parseFloat(raw.spareParts) : raw.spareParts)
      : 0;
    return {
      ...raw,
      price: laborPrice,
      spareParts: sparePartsPrice,
      totalPrice: laborPrice + sparePartsPrice,
      // technician is populated by the list endpoint; not in the mutation response
      technician: raw.technician ?? null,
      // Ensure technicianId is always set (create response always has it)
      technicianId: raw.technicianId ?? currentUser?.id,
    };
  };

  const invalidateAll = () => {
    // Invalidate (mark stale) so other mounted pages/components also pick up the change
    queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(reqId) });
    queryClient.invalidateQueries({ queryKey: getListOffersQueryKey(reqId) });
    // Force an immediate refetch on this page — required because the global
    // staleTime (30 s) would otherwise suppress the background refetch that
    // invalidateQueries schedules, leaving the UI stuck on stale cache data.
    queryClient.refetchQueries({ queryKey: getGetRequestQueryKey(reqId) });
    queryClient.refetchQueries({ queryKey: getListOffersQueryKey(reqId) });
  };

  const handleSubmitOffer = () => {
    if (!price) { toast({ title: "أدخل سعر الخدمة", variant: "destructive" }); return; }
    createMutation.mutate(
      { requestId: reqId, data: { price: parseFloat(price), spareParts: spareParts ? parseFloat(spareParts) : undefined, notes } as any },
      {
        onSuccess: (newOffer: any) => {
          // Immediately update the cache so the UI switches to "My Offer" without
          // waiting for the background refetch to complete.
          queryClient.setQueryData(
            getListOffersQueryKey(reqId),
            (old: any) => [...(Array.isArray(old) ? old : []), normalizeOffer(newOffer)]
          );
          invalidateAll();
          toast({ title: "تم إرسال عرضك بنجاح" });
          setPrice(""); setSpareParts(""); setNotes("");
        },
        onError: (err: any) => toast({ title: "خطأ", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleEditOffer = () => {
    updateMutation.mutate(
      {
        requestId: reqId,
        offerId: myOffer.id,
        data: {
          ...(price ? { price: parseFloat(price) } : {}),
          ...(spareParts !== "" ? { spareParts: parseFloat(spareParts) || null } : {}),
          ...(notes !== undefined ? { notes } : {}),
        } as any
      },
      {
        onSuccess: (updatedOffer: any) => {
          // Immediately replace the offer in cache so the displayed data updates
          // without waiting for the background refetch.
          queryClient.setQueryData(
            getListOffersQueryKey(reqId),
            (old: any) =>
              Array.isArray(old)
                ? old.map((o: any) => (o.id === myOffer.id ? normalizeOffer(updatedOffer) : o))
                : old
          );
          invalidateAll();
          toast({ title: "تم تعديل عرضك" });
          setIsEditing(false); setPrice(""); setSpareParts(""); setNotes("");
        },
        onError: (err: any) => toast({ title: "خطأ", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const openEdit = () => {
    setPrice(String(myOffer.price || ""));
    setSpareParts(String(myOffer.spareParts || ""));
    setNotes(myOffer.notes || "");
    setIsEditing(true);
  };

  const handleAdjImageChange = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً (الحد الأقصى 5 ميجا)", variant: "destructive" });
      return;
    }
    try {
      const url = await uploadFileLocal(file, token || null, "pricing");
      setAdjImage(url);
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    }
  };

  const handlePriceAdjustment = async () => {
    if (!adjPrice || parseFloat(adjPrice) <= 0) {
      toast({ title: "أدخل السعر الجديد", variant: "destructive" });
      return;
    }
    setAdjLoading(true);
    try {
      await apiCall(`/requests/${reqId}/price-adjustment`, "POST", {
        newPrice: parseFloat(adjPrice),
        newSpareParts: adjSpareParts ? parseFloat(adjSpareParts) : undefined,
        newDescription: adjDesc || undefined,
        supportingImage: adjImage || undefined,
      }, token || "");
      invalidateAll();
      toast({ title: "تم إرسال طلب تعديل السعر", description: "سيتم إشعار العميل للموافقة" });
      setShowPriceAdjust(false);
      setAdjPrice(""); setAdjSpareParts(""); setAdjDesc(""); setAdjImage(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setAdjLoading(false);
    }
  };

  const handleWithdrawOffer = async () => {
    if (!myOffer) return;
    if (!window.confirm("هل أنت متأكد من سحب عرضك؟ سيتم استرجاع نقاطك المحجوزة.")) return;
    setWithdrawLoading(true);
    const withdrawnOfferId = myOffer.id;
    try {
      await apiCall(`/requests/${reqId}/offers/${withdrawnOfferId}/withdraw`, "POST", undefined, token || "");
      // Immediately remove the offer from cache so the Submit Offer form
      // reappears without waiting for the background refetch.
      queryClient.setQueryData(
        getListOffersQueryKey(reqId),
        (old: any) =>
          Array.isArray(old) ? old.filter((o: any) => o.id !== withdrawnOfferId) : old
      );
      invalidateAll();
      toast({ title: "تم سحب عرضك بنجاح", description: "تم استرجاع نقاطك المحجوزة" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleRequestCompletion = async () => {
    setCompletionLoading(true);
    try {
      await apiCall(`/requests/${reqId}/request-completion`, "POST", {}, token || "");
      invalidateAll();
      toast({ title: "تم إشعار العميل", description: "بانتظار تأكيد العميل على إكمال العمل" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setCompletionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">طلب #{req.id}</h1>
          <Badge className={`mt-2 ${statusInfo.color} border-0`}>{statusInfo.label}</Badge>
        </div>
        {canChat && (
          <Link href={`/technician/chat/${reqId}`}>
            <Button size="sm" className="relative">
              {unreadChatCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {unreadChatCount > 9 ? "9+" : unreadChatCount}
                </span>
              )}
              <MessageCircle className="w-4 h-4 ms-2" />
              المحادثة
            </Button>
          </Link>
        )}
      </div>

      {/* Selected technician action buttons */}
      {(canAdjustPrice || canRequestCompletion) && (
        <div className="flex gap-2 flex-wrap">
          {canAdjustPrice && !showPriceAdjust && (
            <Button size="sm" variant="outline" onClick={() => setShowPriceAdjust(true)} data-testid="button-price-adjust">
              <DollarSign className="w-4 h-4 ms-1" />
              تعديل السعر
            </Button>
          )}
          {canRequestCompletion && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleRequestCompletion}
              disabled={completionLoading}
              data-testid="button-request-completion"
            >
              <CheckCircle className="w-4 h-4 ms-1" />
              {completionLoading ? "جاري..." : "تم التنفيذ"}
            </Button>
          )}
        </div>
      )}

      {/* Price adjustment form */}
      {showPriceAdjust && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader><CardTitle className="text-base text-orange-800 flex items-center gap-2"><DollarSign className="w-4 h-4" />طلب تعديل السعر</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">سعر الخدمة الجديد (جنيه) *</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={adjPrice}
                  onChange={(e) => setAdjPrice(e.target.value)}
                  className="mt-1"
                  data-testid="input-adj-price"
                />
              </div>
              <div>
                <label className="text-sm font-medium">قطع الغيار الجديد (جنيه)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={adjSpareParts}
                  onChange={(e) => setAdjSpareParts(e.target.value)}
                  className="mt-1"
                  data-testid="input-adj-spare-parts"
                />
              </div>
            </div>

            {(parseFloat(adjPrice) > 0 || parseFloat(adjSpareParts) > 0) && (
              <div className="bg-white rounded-lg p-3 text-sm border border-orange-200">
                <p className="text-xs text-muted-foreground mb-1">ملخص السعر الجديد:</p>
                <div className="flex gap-3">
                  {parseFloat(adjPrice) > 0 && <span>خدمة: {adjPrice} ج</span>}
                  {parseFloat(adjSpareParts) > 0 && <span>قطع: {adjSpareParts} ج</span>}
                  <span className="font-bold text-orange-700">
                    الإجمالي: {(parseFloat(adjPrice || "0") + parseFloat(adjSpareParts || "0")).toFixed(0)} جنيه
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">سبب التعديل</label>
              <Textarea
                placeholder="مثال: تطلب الأمر استبدال قطع إضافية غير متوقعة..."
                value={adjDesc}
                onChange={(e) => setAdjDesc(e.target.value)}
                className="mt-1"
                rows={2}
                data-testid="textarea-adj-desc"
              />
            </div>

            {/* Supporting image */}
            <div>
              <label className="text-sm font-medium">صورة داعمة (اختياري)</label>
              {adjImage ? (
                <div className="relative mt-1 w-32 h-32">
                  <CldImg src={adjImage} alt="" width={256} className="w-full h-full object-cover rounded-lg border border-orange-200" />
                  <button
                    type="button"
                    onClick={() => setAdjImage(null)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <ImagePicker onFiles={handleAdjImageChange} accept="image/jpeg,image/png,image/webp" captureMode="environment">
                <button
                  type="button"
                  className="mt-1 w-full border-2 border-dashed border-orange-300 rounded-lg py-3 flex items-center justify-center gap-2 hover:border-orange-500 transition-colors text-sm text-orange-600"
                >
                  <ImagePlus className="w-4 h-4" />
                  إضافة صورة
                </button>
              </ImagePicker>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                onClick={handlePriceAdjustment}
                disabled={adjLoading}
                data-testid="button-submit-adj"
              >
                {adjLoading ? "جاري الإرسال..." : "إرسال طلب التعديل"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowPriceAdjust(false); setAdjPrice(""); setAdjSpareParts(""); setAdjDesc(""); setAdjImage(null); }}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending price adjustment notice (for selected tech) */}
      {isPriceAdjPending && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
          <DollarSign className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">يوجد طلب تعديل سعر قيد المراجعة.</p>
            <p className="text-xs mt-0.5">لا يمكن تقديم طلب إكمال أو تعديل سعر آخر حتى يرد العميل.</p>
          </div>
        </div>
      )}

      {/* Waiting for customer approval notice */}
      {awaitingCustomerApproval && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <Clock3 className="w-5 h-5 flex-shrink-0" />
          <span>بانتظار تأكيد العميل على إكمال العمل...</span>
        </div>
      )}

      {/* Request Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">تفاصيل الطلب</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>{req.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href={`tel:${req.mobile}`} className="text-primary hover:underline font-medium">
              {req.mobile}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{new Date(req.createdAt).toLocaleDateString("ar-EG")}</span>
          </div>
          <div className="pt-2 border-t">
            <p className="text-muted-foreground mb-1">وصف المشكلة:</p>
            <p>{req.description}</p>
          </div>
          {req.agreedPrice && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Tag className="w-4 h-4 text-primary" />
              <span className="font-semibold text-primary">السعر المتفق عليه: {parseFloat(req.agreedPrice)} جنيه</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Credit Summary — shown when completed with coin discount */}
      {req.status === "completed" && platformCredit?.hasCoinDiscount && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-blue-800">
              <Coins className="w-4 h-4 text-blue-600" />
              ملخص التسوية المالية
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 text-sm">
            {/* Row 1: Original agreed price */}
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">سعر الطلب الأصلي</span>
              <span className="font-semibold">{platformCredit.agreedPrice?.toFixed(2)} ج</span>
            </div>
            {/* Row 2: Coin discount the customer received — technician must know the split */}
            <div className="flex justify-between py-1 text-orange-700">
              <span className="font-medium">خصم عملة فنشها للعميل</span>
              <span className="font-bold">−{platformCredit.platformCreditAmount?.toFixed(2)} ج</span>
            </div>
            {/* Row 3: What technician physically collects from the customer */}
            <div className="flex justify-between py-1 border-t border-blue-200 mt-1 pt-2">
              <span className="font-bold text-foreground">يجب تحصيله من العميل</span>
              <span className="font-black text-foreground">{platformCredit.customerPayableAmount?.toFixed(2)} ج</span>
            </div>
            {/* Row 4: What Fnashha pays the technician directly */}
            <div className="flex justify-between py-1 text-blue-700">
              <span className="font-medium">فنشها ستدفع لك</span>
              <span className="font-bold">+{platformCredit.platformCreditAmount?.toFixed(2)} ج</span>
            </div>
            {/* Settlement status */}
            <div className="flex items-center justify-between pt-2 border-t border-blue-200">
              <span className="text-muted-foreground text-xs">حالة رصيد فنشها</span>
              {platformCredit.status === "paid" ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  تم الدفع بواسطة فنشها
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-orange-600">
                  <Hourglass className="w-3.5 h-3.5" />
                  في انتظار التسوية
                </span>
              )}
            </div>
            {platformCredit.paymentDate && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>تاريخ الدفع</span>
                <span>{new Date(platformCredit.paymentDate).toLocaleDateString("ar-EG")}</span>
              </div>
            )}
            {platformCredit.paymentReference && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>مرجع التسوية</span>
                <span className="font-mono">{platformCredit.paymentReference}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Images */}
      {req.images && req.images.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Images className="w-4 h-4" />صور المشكلة ({req.images.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {req.images.map((src: string, i: number) => (
                <button key={i} onClick={() => setLightboxImg(src)} className="aspect-square rounded-lg overflow-hidden border hover:opacity-80 transition-opacity">
                  <CldImg src={src} alt="" width={600} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audio */}
      {req.audioUrl && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Volume2 className="w-4 h-4" />تسجيل صوتي</CardTitle></CardHeader>
          <CardContent>
            <audio controls src={req.audioUrl} className="w-full" />
          </CardContent>
        </Card>
      )}

      {/* My Offer */}
      {myOffer ? (
        <Card className={myOffer.status === "selected" ? "border-green-500 bg-green-50" : "border-primary/20 bg-primary/5"}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="font-semibold">
                {myOffer.status === "selected" ? (
                  <span className="flex items-center gap-1 text-green-700"><CheckCircle className="w-4 h-4" />تم اختيارك!</span>
                ) : "عرضك المقدّم"}
              </p>
              <div className="flex gap-2">
                {canEdit && !isEditing && (
                  <Button size="sm" variant="outline" onClick={openEdit} data-testid="button-edit-offer">
                    <Pencil className="w-3 h-3 ms-1" />
                    تعديل
                  </Button>
                )}
                {canEdit && !isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleWithdrawOffer}
                    disabled={withdrawLoading}
                    data-testid="button-withdraw-offer"
                  >
                    <X className="w-3 h-3 ms-1" />
                    {withdrawLoading ? "جارٍ السحب..." : "سحب العرض"}
                  </Button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">سعر الخدمة (جنيه) *</label>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">قطع الغيار (جنيه)</label>
                    <Input type="number" value={spareParts} onChange={(e) => setSpareParts(e.target.value)} className="mt-1" placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ملاحظات</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEditOffer} disabled={updateMutation.isPending} className="flex-1">
                    {updateMutation.isPending ? "جاري..." : "حفظ التعديل"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>إلغاء</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">سعر الخدمة</p>
                    <p className="text-xl font-black text-primary">{myOffer.price} جنيه</p>
                  </div>
                  {myOffer.spareParts > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">قطع الغيار</p>
                      <p className="text-xl font-black text-orange-600">{myOffer.spareParts} جنيه</p>
                    </div>
                  )}
                  {myOffer.spareParts > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">الإجمالي</p>
                      <p className="text-xl font-black">{myOffer.totalPrice} جنيه</p>
                    </div>
                  )}
                </div>
                {myOffer.notes && <p className="text-sm text-muted-foreground">{myOffer.notes}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      ) : canSubmitOffer ? (
        <Card>
          <CardHeader><CardTitle className="text-base">تقديم عرضك</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">سعر الخدمة (جنيه) *</label>
                <Input type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" data-testid="input-price" />
                <p className="text-xs text-muted-foreground mt-1">العمولة تُحسب على هذا السعر فقط</p>
              </div>
              <div>
                <label className="text-sm font-medium">قطع الغيار (جنيه)</label>
                <Input type="number" placeholder="0" value={spareParts} onChange={(e) => setSpareParts(e.target.value)} className="mt-1" data-testid="input-spare-parts" />
                <p className="text-xs text-muted-foreground mt-1">لا تُحسب منها عمولة</p>
              </div>
            </div>
            {(parseFloat(price) > 0 || parseFloat(spareParts) > 0) && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex gap-4 text-muted-foreground">
                  {parseFloat(price) > 0 && <span>خدمة: {price} ج</span>}
                  {parseFloat(spareParts) > 0 && <span>قطع: {spareParts} ج</span>}
                  <span className="font-semibold text-foreground">الإجمالي: {(parseFloat(price || "0") + parseFloat(spareParts || "0")).toFixed(0)} ج</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">ملاحظات (اختياري)</label>
              <Textarea placeholder="أضف تفاصيل عن عرضك..." value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={3} data-testid="textarea-notes" />
            </div>
            <Button className="w-full font-bold" onClick={handleSubmitOffer} disabled={createMutation.isPending} data-testid="button-submit-offer">
              {createMutation.isPending ? "جاري الإرسال..." : "إرسال العرض"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 left-4 text-white" onClick={() => setLightboxImg(null)}>
            <X className="w-6 h-6" />
          </button>
          <CldImg src={lightboxImg} alt="" width={1200} eager className="max-w-full max-h-full rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
