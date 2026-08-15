import { useEffect, useRef, useState } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, Video, Image as ImageIcon, Upload, X, Settings, Megaphone } from "lucide-react";
import { uploadFile } from "@/lib/uploadMedia";

type Offer = {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  videoUrl?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  location: string;
  displayOrder: number;
  isActive: boolean;
  showIn: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
};

type OfferForm = Omit<Offer, "id" | "createdAt" | "location">;

const getToken = () => localStorage.getItem("fnashha_token") || "";

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
};

const EMPTY_FORM: OfferForm = {
  title: "",
  description: "",
  imageUrl: "",
  mobileImageUrl: "",
  videoUrl: "",
  buttonText: "",
  buttonLink: "",
  displayOrder: 0,
  isActive: true,
  showIn: "both",
  startDate: "",
  endDate: "",
};

const SHOW_IN_LABELS: Record<string, string> = {
  slider: "السلايدر فقط",
  grid: "الشبكة فقط",
  both: "سلايدر + شبكة",
};

function MediaUploadField({
  label,
  value,
  onChange,
  accept,
  testId,
  type = "image",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accept: string;
  testId: string;
  type?: "image" | "video";
  hint?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMB = type === "video" ? 50 : 10;
    if (file.size > maxMB * 1024 * 1024) {
      setError(`الحد الأقصى ${maxMB} ميجابايت`);
      return;
    }
    setError("");
    setUploading(true);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
    uploadFile(file, getToken(), setProgress)
      .then((url) => {
        onChange(url);
        setUploading(false);
      })
      .catch(() => {
        setError("فشل رفع الملف");
        setUploading(false);
      });
  };

  const isCloudinaryUrl = value.startsWith("https://res.cloudinary.com");

  return (
    <div className="space-y-2">
      <Label className="block">{label}</Label>
      <div className="border-2 border-dashed border-border rounded-xl p-3 space-y-2 bg-secondary/20">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="shrink-0"
          >
            <Upload className="w-3.5 h-3.5 ml-1.5" />
            {uploading ? `جاري الرفع ${progress}%` : type === "video" ? "رفع فيديو" : "رفع صورة"}
          </Button>
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
          <span className="text-xs text-muted-foreground">
            {type === "video" ? "mp4, webm — حتى 50MB" : "jpg, png, webp — حتى 10MB"}
          </span>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="mr-auto h-7 w-7 p-0" onClick={() => onChange("")}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {uploading && (
          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {value && !uploading && (
          <div className="rounded-lg overflow-hidden">
            {type === "video" ? (
              <video src={value} className="w-full max-h-32 object-cover" muted />
            ) : (
              <CldImg src={value} alt="" width={800} className="w-full max-h-32 object-cover" />
            )}
            {isCloudinaryUrl && (
              <p className="text-xs text-green-700 font-semibold mt-1 px-1">✓ تم الرفع إلى Cloudinary</p>
            )}
          </div>
        )}

        <div className="pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">أو أدخل رابطاً مباشراً:</p>
          <Input
            value={value.startsWith("data:") ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            data-testid={testId}
            className="text-xs h-8"
          />
        </div>
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
          📐 {hint}
        </p>
      )}
    </div>
  );
}

export default function AdminOffers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"offers" | "settings">("offers");
  const [form, setForm] = useState<OfferForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [adSettings, setAdSettings] = useState({
    offersAdTitle: "أعلن منتجك أو خدمتك هنا",
    offersAdDescription: "تواصل معنا وانضم لقائمة شركائنا الإعلانيين",
    offersAdButtonText: "تواصل للإعلان",
    offersAdButtonUrl: "/contact",
    offersAdShow: "true",
  });
  const [adSettingsSaving, setAdSettingsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/cms/settings")
      .then((r) => r.json())
      .then((data) => {
        setAdSettings({
          offersAdTitle: data.offersAdTitle || "أعلن منتجك أو خدمتك هنا",
          offersAdDescription: data.offersAdDescription || "تواصل معنا وانضم لقائمة شركائنا الإعلانيين",
          offersAdButtonText: data.offersAdButtonText || "تواصل للإعلان",
          offersAdButtonUrl: data.offersAdButtonUrl || "/contact",
          offersAdShow: data.offersAdShow ?? "true",
        });
      })
      .catch(() => {});
  }, []);

  const saveAdSettings = async () => {
    setAdSettingsSaving(true);
    try {
      await apiFetch("/api/cms/settings", {
        method: "PATCH",
        body: JSON.stringify(adSettings),
      });
      toast({ title: "تم حفظ إعدادات الإعلانات" });
    } catch {
      toast({ title: "حدث خطأ في الحفظ", variant: "destructive" });
    } finally {
      setAdSettingsSaving(false);
    }
  };

  const { data: allBanners = [], isLoading } = useQuery<Offer[]>({
    queryKey: ["admin-offers"],
    queryFn: () => apiFetch("/api/banners?location=offers_page"),
  });

  const offers = allBanners.filter((b: Offer) => b.location === "offers_page");

  const createMutation = useMutation({
    mutationFn: (data: OfferForm) =>
      apiFetch("/api/banners", {
        method: "POST",
        body: JSON.stringify({ ...data, location: "offers_page" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offers"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "تم إضافة العرض بنجاح" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OfferForm> }) =>
      apiFetch(`/api/banners/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offers"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "تم تحديث العرض" });
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/banners/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offers"] });
      toast({ title: "تم حذف العرض" });
      setDeleteDialogOpen(false);
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (o: Offer) => {
    setForm({
      title: o.title,
      description: o.description || "",
      imageUrl: o.imageUrl || "",
      mobileImageUrl: o.mobileImageUrl || "",
      videoUrl: o.videoUrl || "",
      buttonText: o.buttonText || "",
      buttonLink: o.buttonLink || "",
      displayOrder: o.displayOrder,
      isActive: o.isActive,
      showIn: o.showIn || "both",
      startDate: o.startDate ? o.startDate.slice(0, 10) : "",
      endDate: o.endDate ? o.endDate.slice(0, 10) : "",
    });
    setEditingId(o.id);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleActive = (offer: Offer) => {
    updateMutation.mutate({ id: offer.id, data: { isActive: !offer.isActive } });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const formatDate = (d?: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground">إدارة العروض</h1>
          <p className="text-muted-foreground text-sm mt-1">إضافة وتعديل العروض الترويجية في صفحة العروض</p>
        </div>
        {activeTab === "offers" && (
          <Button onClick={openAdd} data-testid="button-add-offer" className="sm:self-start">
            <Plus className="w-4 h-4 ml-2" />
            إضافة عرض
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab("offers")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "offers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tag className="w-4 h-4" />
          العروض
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "settings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="w-4 h-4" />
          إعدادات قسم الإعلانات
        </button>
      </div>

      {/* ── Tab: Offers ── */}
      {activeTab === "offers" && (
        <>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
          ) : offers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">لا توجد عروض بعد</p>
              <p className="text-sm mt-1">أضف عرضاً جديداً ليظهر في صفحة العروض</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {offers.map((offer) => (
                <Card key={offer.id} className={`border-2 ${offer.isActive ? "border-primary/20" : "border-border opacity-60"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {offer.videoUrl ? (
                        <div className="w-24 h-16 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                          <video src={offer.videoUrl} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Video className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      ) : offer.imageUrl ? (
                        <CldImg src={offer.imageUrl} alt={offer.title} width={200} className="w-24 h-16 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="w-24 h-16 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-2">
                          <div>
                            <h3 className="font-bold text-foreground">{offer.title}</h3>
                            {offer.description && (
                              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{offer.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">ترتيب: {offer.displayOrder}</Badge>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${offer.showIn === "slider" ? "text-blue-700" : offer.showIn === "grid" ? "text-purple-700" : "text-green-700"}`}
                              >
                                {SHOW_IN_LABELS[offer.showIn] || "سلايدر + شبكة"}
                              </Badge>
                              {offer.buttonText && <Badge variant="secondary" className="text-xs">زر: {offer.buttonText}</Badge>}
                              {offer.mobileImageUrl && <Badge variant="outline" className="text-xs text-orange-600">صورة موبايل ✓</Badge>}
                              {offer.startDate && <Badge variant="outline" className="text-xs text-green-700">من: {formatDate(offer.startDate)}</Badge>}
                              {offer.endDate && <Badge variant="outline" className="text-xs text-red-700">حتى: {formatDate(offer.endDate)}</Badge>}
                              {offer.videoUrl && <Badge variant="outline" className="text-xs text-blue-600">فيديو</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={offer.isActive}
                                onCheckedChange={() => toggleActive(offer)}
                                data-testid={`switch-offer-${offer.id}`}
                              />
                              <span className="text-xs text-muted-foreground">{offer.isActive ? "مفعّل" : "معطّل"}</span>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => openEdit(offer)} data-testid={`button-edit-offer-${offer.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => { setDeleteId(offer.id); setDeleteDialogOpen(true); }}
                              data-testid={`button-delete-offer-${offer.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Ad Settings ── */}
      {activeTab === "settings" && (
        <div className="max-w-xl space-y-5">
          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
            <Megaphone className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm text-foreground">
              هذه الإعدادات تتحكم في قسم "أعلن معنا" الذي يظهر أسفل صفحة العروض.
            </p>
          </div>

          <div>
            <Label className="mb-1.5 block">إظهار القسم</Label>
            <div className="flex items-center gap-3">
              <Switch
                checked={adSettings.offersAdShow === "true"}
                onCheckedChange={(v) => setAdSettings({ ...adSettings, offersAdShow: v ? "true" : "false" })}
              />
              <span className="text-sm text-muted-foreground">
                {adSettings.offersAdShow === "true" ? "القسم ظاهر" : "القسم مخفي"}
              </span>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">عنوان القسم</Label>
            <Input
              value={adSettings.offersAdTitle}
              onChange={(e) => setAdSettings({ ...adSettings, offersAdTitle: e.target.value })}
              placeholder="أعلن منتجك أو خدمتك هنا"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">وصف القسم</Label>
            <Textarea
              rows={3}
              value={adSettings.offersAdDescription}
              onChange={(e) => setAdSettings({ ...adSettings, offersAdDescription: e.target.value })}
              placeholder="تواصل معنا وانضم لقائمة شركائنا الإعلانيين"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">نص الزر</Label>
              <Input
                value={adSettings.offersAdButtonText}
                onChange={(e) => setAdSettings({ ...adSettings, offersAdButtonText: e.target.value })}
                placeholder="تواصل للإعلان"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">رابط الزر</Label>
              <Input
                value={adSettings.offersAdButtonUrl}
                onChange={(e) => setAdSettings({ ...adSettings, offersAdButtonUrl: e.target.value })}
                placeholder="/contact"
              />
            </div>
          </div>

          <Button onClick={saveAdSettings} disabled={adSettingsSaving} className="w-full">
            {adSettingsSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </div>
      )}

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "تعديل العرض" : "إضافة عرض جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="mb-1.5 block">العنوان (اختياري)</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="عنوان العرض"
                data-testid="input-offer-title"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">الوصف</Label>
              <Textarea
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="وصف العرض"
                data-testid="input-offer-description"
              />
            </div>

            <div>
              <Label className="mb-1.5 block">موقع العرض</Label>
              <Select value={form.showIn} onValueChange={(v) => setForm({ ...form, showIn: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">سلايدر + شبكة (الافتراضي)</SelectItem>
                  <SelectItem value="slider">السلايدر فقط (يحتاج صورة أو فيديو)</SelectItem>
                  <SelectItem value="grid">الشبكة فقط</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">تحكم في أين يظهر هذا العرض على صفحة العروض</p>
            </div>

            <MediaUploadField
              label="الصورة (ديسكتوب)"
              value={form.imageUrl || ""}
              onChange={(v) => setForm({ ...form, imageUrl: v })}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              testId="input-offer-image"
              type="image"
              hint={`أبعاد السلايدر: 1920 × 800 px — أبعاد بطاقة الشبكة: 1200 × 900 px`}
            />

            <MediaUploadField
              label="صورة الجوال (اختيارية)"
              value={form.mobileImageUrl || ""}
              onChange={(v) => setForm({ ...form, mobileImageUrl: v })}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              testId="input-offer-mobile-image"
              type="image"
              hint={`أبعاد الجوال: 1080 × 1350 px — إذا تُركت فارغة ستُستخدم صورة الديسكتوب`}
            />

            <MediaUploadField
              label="الفيديو (اختياري)"
              value={form.videoUrl || ""}
              onChange={(v) => setForm({ ...form, videoUrl: v })}
              accept="video/mp4,video/webm"
              testId="input-offer-video"
              type="video"
              hint={`أبعاد الفيديو: 1920 × 800 px — نسبة 16:9 أو أعرض`}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">نص الزر</Label>
                <Input
                  value={form.buttonText || ""}
                  onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                  placeholder="احجز الآن"
                  data-testid="input-offer-button-text"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">رابط الزر</Label>
                <Input
                  value={form.buttonLink || ""}
                  onChange={(e) => setForm({ ...form, buttonLink: e.target.value })}
                  placeholder="/register"
                  data-testid="input-offer-button-link"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">تاريخ البداية</Label>
                <Input
                  type="date"
                  value={form.startDate ? form.startDate.slice(0, 10) : ""}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value || null })}
                  data-testid="input-offer-start-date"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">تاريخ النهاية</Label>
                <Input
                  type="date"
                  value={form.endDate ? form.endDate.slice(0, 10) : ""}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value || null })}
                  data-testid="input-offer-end-date"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">ترتيب العرض</Label>
              <Input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-offer-order"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                data-testid="switch-offer-active"
              />
              <Label>مفعّل</Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSaving}
                data-testid="button-save-offer"
              >
                {isSaving ? "جاري الحفظ..." : editingId !== null ? "حفظ التعديلات" : "إضافة العرض"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm mt-2">هل أنت متأكد من حذف هذا العرض؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <div className="flex gap-3 mt-4">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-offer"
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
