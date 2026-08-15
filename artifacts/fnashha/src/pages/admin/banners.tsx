import { useRef, useState } from "react";
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
import { Plus, Pencil, Trash2, ImageIcon, Upload, X } from "lucide-react";
import { uploadFile } from "@/lib/uploadMedia";

type Banner = {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  videoUrl?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  location: "hero" | "below_services" | "before_footer" | "customer_dashboard" | "offers_page";
  displayOrder: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  overlayEnabled?: boolean;
  overlayColor?: string | null;
  overlayOpacity?: number;
  createdAt: string;
};

type BannerForm = Omit<Banner, "id" | "createdAt">;

const LOCATION_LABELS: Record<string, string> = {
  hero: "البانر الرئيسي (أعلى الصفحة)",
  below_services: "بانر أسفل الخدمات",
  before_footer: "بانر قبل الفوتر",
  customer_dashboard: "لوحة تحكم العميل",
  offers_page: "صفحة العروض",
};

type LocationDim = {
  desktop: string;
  mobile: string;
  desktopPx: string;
  mobilePx: string;
  desktopRatio: string;
  mobileRatio: string;
  renderMode: string;
  note: string;
};

const LOCATION_DIMS: Record<string, LocationDim> = {
  hero: {
    desktop: "1248 × 310 px",
    mobile: "370 × 180 px",
    desktopPx: "العرض 1248 px — الارتفاع 310 px",
    mobilePx: "العرض 370 px — الارتفاع 180 px",
    desktopRatio: "4.03 : 1",
    mobileRatio: "2.06 : 1",
    renderMode: "object-cover",
    note: "شريط منزلق رئيسي — الارتفاع ثابت 310 px ديسكتوب / 180 px جوال — الصورة تملأ الحاوية بالكامل",
  },
  below_services: {
    desktop: "1248 × 310 px",
    mobile: "370 × 180 px",
    desktopPx: "العرض 1248 px — الارتفاع 310 px",
    mobilePx: "العرض 370 px — الارتفاع 180 px",
    desktopRatio: "4.03 : 1",
    mobileRatio: "2.06 : 1",
    renderMode: "background-cover",
    note: "شريط أسفل الخدمات — الصورة خلفية تملأ الحاوية بلا مساحات فارغة",
  },
  before_footer: {
    desktop: "300 × 260 px",
    mobile: "370 × 200 px",
    desktopPx: "العرض 300 px — الارتفاع 260 px (كارد من 4 أعمدة)",
    mobilePx: "العرض 370 px — الارتفاع 200 px (عمود واحد)",
    desktopRatio: "1.15 : 1",
    mobileRatio: "1.85 : 1",
    renderMode: "object-cover",
    note: "كارد بانر — ديسكتوب: شبكة 4 أعمدة بعرض 300 px وارتفاع 260 px — جوال: عمود واحد 370 × 200 px",
  },
  customer_dashboard: {
    desktop: "720 × 200 px",
    mobile: "362 × 160 px",
    desktopPx: "العرض 720 px — الارتفاع ≥ 200 px (حسب المحتوى)",
    mobilePx: "العرض 362 px — الارتفاع ≥ 160 px (حسب المحتوى)",
    desktopRatio: "3.6 : 1",
    mobileRatio: "2.26 : 1",
    renderMode: "background-cover",
    note: "داخل حاوية max-width 768 px مع padding 24 px جانبي — الصورة خلفية تملأ الحاوية بلا مساحات فارغة",
  },
  offers_page: {
    desktop: "1248 × 380 px",
    mobile: "370 × 220 px",
    desktopPx: "العرض 1248 px — الارتفاع 380 px (عند شاشة 1280 px)",
    mobilePx: "العرض 370 px — الارتفاع 220 px",
    desktopRatio: "3.28 : 1",
    mobileRatio: "1.68 : 1",
    renderMode: "object-cover",
    note: "شريط عروض — الارتفاع يتغير بين 220–380 px بحسب عرض الشاشة (32 vw) — الصورة تملأ الحاوية بالكامل",
  },
};

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

const EMPTY_FORM: BannerForm = {
  title: "",
  description: "",
  imageUrl: "",
  mobileImageUrl: "",
  videoUrl: "",
  buttonText: "",
  buttonLink: "",
  location: "hero",
  displayOrder: 0,
  isActive: true,
  startDate: "",
  endDate: "",
  overlayEnabled: true,
  overlayColor: "#000000",
  overlayOpacity: 45,
};

function MediaUploadField({
  label,
  value,
  onChange,
  accept,
  testId,
  type = "image",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accept: string;
  testId: string;
  type?: "image" | "video";
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
              <video src={value} className="w-full max-h-32 object-cover" muted controls={false} />
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
    </div>
  );
}

export default function AdminBanners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: banners = [], isLoading } = useQuery<Banner[]>({
    queryKey: ["admin-banners"],
    queryFn: () => apiFetch("/api/banners"),
  });

  const createMutation = useMutation({
    mutationFn: (data: BannerForm) => apiFetch("/api/banners", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "تم إضافة البانر بنجاح" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BannerForm> }) =>
      apiFetch(`/api/banners/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "تم تحديث البانر" });
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/banners/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast({ title: "تم حذف البانر" });
      setDeleteDialogOpen(false);
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const filtered = locationFilter === "all"
    ? banners
    : banners.filter((b) => b.location === locationFilter);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (b: Banner) => {
    setForm({
      title: b.title,
      description: b.description || "",
      imageUrl: b.imageUrl || "",
      mobileImageUrl: b.mobileImageUrl || "",
      videoUrl: b.videoUrl || "",
      buttonText: b.buttonText || "",
      buttonLink: b.buttonLink || "",
      location: b.location,
      displayOrder: b.displayOrder,
      isActive: b.isActive,
      startDate: b.startDate ? b.startDate.slice(0, 10) : "",
      endDate: b.endDate ? b.endDate.slice(0, 10) : "",
      overlayEnabled: b.overlayEnabled !== undefined ? b.overlayEnabled : true,
      overlayColor: b.overlayColor || "#000000",
      overlayOpacity: b.overlayOpacity ?? 45,
    });
    setEditingId(b.id);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleActive = (banner: Banner) => {
    updateMutation.mutate({ id: banner.id, data: { isActive: !banner.isActive } });
  };

  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground">إدارة البانرات</h1>
          <p className="text-muted-foreground text-sm mt-1">إضافة وتعديل وتنظيم البانرات في الصفحة الرئيسية</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-banner" className="sm:self-start">
          <Plus className="w-4 h-4 ml-2" />
          إضافة بانر
        </Button>
      </div>

      {/* Location filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { value: "all", label: "جميع البانرات" },
          { value: "hero", label: "البانر الرئيسي" },
          { value: "below_services", label: "أسفل الخدمات" },
          { value: "before_footer", label: "قبل الفوتر" },
          { value: "customer_dashboard", label: "لوحة العميل" },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setLocationFilter(value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              locationFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا توجد بانرات</p>
          <p className="text-sm mt-1">أضف بانر جديد للبدء</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((banner) => (
            <Card key={banner.id} className={`border-2 ${banner.isActive ? "border-primary/20" : "border-border opacity-60"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {banner.imageUrl ? (
                    <CldImg src={banner.imageUrl} alt={banner.title} width={200} className="w-24 h-16 object-cover rounded-lg flex-shrink-0" />
                  ) : banner.videoUrl ? (
                    <div className="w-24 h-16 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-muted-foreground font-semibold">فيديو</span>
                    </div>
                  ) : (
                    <div className="w-24 h-16 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-2">
                      <div>
                        <h3 className="font-bold text-foreground">{banner.title}</h3>
                        {banner.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{banner.description}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{LOCATION_LABELS[banner.location]}</Badge>
                          <Badge variant="outline" className="text-xs">ترتيب: {banner.displayOrder}</Badge>
                          {banner.buttonText && <Badge variant="secondary" className="text-xs">زر: {banner.buttonText}</Badge>}
                          {banner.videoUrl && <Badge variant="outline" className="text-xs text-blue-600">فيديو</Badge>}
                          {banner.startDate && <Badge variant="outline" className="text-xs text-green-700">من: {new Date(banner.startDate).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}</Badge>}
                          {banner.endDate && <Badge variant="outline" className="text-xs text-red-700">حتى: {new Date(banner.endDate).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={banner.isActive}
                            onCheckedChange={() => toggleActive(banner)}
                            data-testid={`switch-banner-${banner.id}`}
                          />
                          <span className="text-xs text-muted-foreground">{banner.isActive ? "مفعّل" : "معطّل"}</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openEdit(banner)} data-testid={`button-edit-banner-${banner.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => confirmDelete(banner.id)} data-testid={`button-delete-banner-${banner.id}`}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "تعديل البانر" : "إضافة بانر جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="mb-1.5 block">العنوان (اختياري)</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان البانر" data-testid="input-banner-title" />
            </div>
            <div>
              <Label className="mb-1.5 block">الوصف</Label>
              <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="وصف اختياري" data-testid="input-banner-description" />
            </div>

            <div>
              <MediaUploadField
                label="الصورة (ديسكتوب)"
                value={form.imageUrl || ""}
                onChange={(v) => setForm({ ...form, imageUrl: v })}
                accept="image/jpeg,image/jpg,image/png,image/webp"
                testId="input-banner-image"
                type="image"
              />
              <div className="mt-1.5 bg-secondary/40 rounded-lg px-3 py-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>🖥️ ديسكتوب: <span className="font-semibold text-foreground">{LOCATION_DIMS[form.location]?.desktop || "—"}</span></span>
                  <span>📱 جوال: <span className="font-semibold text-foreground">{LOCATION_DIMS[form.location]?.mobile || "—"}</span></span>
                  <span>📐 نسبة الديسكتوب: <span className="font-semibold text-foreground">{LOCATION_DIMS[form.location]?.desktopRatio || "—"}</span></span>
                </div>
                <p className="text-primary/80 font-medium">صمم الصورة بنفس هذا المقاس للحصول على أفضل نتيجة.</p>
              </div>
            </div>

            <div>
              <MediaUploadField
                label="صورة الجوال (اختيارية)"
                value={form.mobileImageUrl || ""}
                onChange={(v) => setForm({ ...form, mobileImageUrl: v })}
                accept="image/jpeg,image/jpg,image/png,image/webp"
                testId="input-banner-mobile-image"
                type="image"
              />
              <div className="mt-1.5 bg-secondary/40 rounded-lg px-3 py-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>📱 جوال: <span className="font-semibold text-foreground">{LOCATION_DIMS[form.location]?.mobile || "—"}</span></span>
                  <span>📐 نسبة الجوال: <span className="font-semibold text-foreground">{LOCATION_DIMS[form.location]?.mobileRatio || "—"}</span></span>
                </div>
                <p className="text-primary/80 font-medium">صمم الصورة بنفس هذا المقاس للحصول على أفضل نتيجة.</p>
                <p className="text-muted-foreground/70">إذا تُركت فارغة ستُستخدم صورة الديسكتوب</p>
              </div>
            </div>

            <MediaUploadField
              label="الفيديو (اختياري)"
              value={form.videoUrl || ""}
              onChange={(v) => setForm({ ...form, videoUrl: v })}
              accept="video/mp4,video/webm"
              testId="input-banner-video"
              type="video"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">نص الزر</Label>
                <Input value={form.buttonText || ""} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} placeholder="اضغط هنا" data-testid="input-banner-button-text" />
              </div>
              <div>
                <Label className="mb-1.5 block">رابط الزر</Label>
                <Input value={form.buttonLink || ""} onChange={(e) => setForm({ ...form, buttonLink: e.target.value })} placeholder="/register" data-testid="input-banner-button-link" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">الموقع</Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v as BannerForm["location"] })}>
                  <SelectTrigger data-testid="select-banner-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero">البانر الرئيسي</SelectItem>
                    <SelectItem value="below_services">أسفل الخدمات</SelectItem>
                    <SelectItem value="before_footer">قبل الفوتر</SelectItem>
                    <SelectItem value="customer_dashboard">لوحة تحكم العميل</SelectItem>
                    <SelectItem value="offers_page">صفحة العروض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">ترتيب العرض</Label>
                <Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} data-testid="input-banner-order" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">تاريخ البداية</Label>
                <Input type="date" value={form.startDate ? form.startDate.slice(0, 10) : ""} onChange={(e) => setForm({ ...form, startDate: e.target.value || null })} data-testid="input-banner-start-date" />
              </div>
              <div>
                <Label className="mb-1.5 block">تاريخ النهاية</Label>
                <Input type="date" value={form.endDate ? form.endDate.slice(0, 10) : ""} onChange={(e) => setForm({ ...form, endDate: e.target.value || null })} data-testid="input-banner-end-date" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-testid="switch-banner-active" />
              <Label>مفعّل</Label>
            </div>

            {/* Overlay Controls */}
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-sm font-bold text-foreground">إعدادات الطبقة المعتمة (Overlay)</p>
              <div className="flex items-center gap-3">
                <Switch checked={form.overlayEnabled !== false} onCheckedChange={(v) => setForm({ ...form, overlayEnabled: v })} data-testid="switch-banner-overlay" />
                <Label>تفعيل الطبقة المعتمة</Label>
              </div>
              {form.overlayEnabled !== false && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm">لون الطبقة المعتمة</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.overlayColor || "#000000"}
                        onChange={(e) => setForm({ ...form, overlayColor: e.target.value })}
                        className="w-10 h-9 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                      />
                      <Input
                        value={form.overlayColor || "#000000"}
                        onChange={(e) => setForm({ ...form, overlayColor: e.target.value })}
                        placeholder="#000000"
                        className="flex-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm">شفافية الطبقة</Label>
                      <span className="text-sm font-bold">{form.overlayOpacity ?? 45}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={form.overlayOpacity ?? 45}
                      onChange={(e) => setForm({ ...form, overlayOpacity: parseInt(e.target.value) })}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>شفاف 0%</span>
                      <span>معتم 100%</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={handleSubmit} disabled={isSaving} data-testid="button-save-banner">
                {isSaving ? "جاري الحفظ..." : editingId !== null ? "حفظ التعديلات" : "إضافة البانر"}
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
          <p className="text-muted-foreground text-sm mt-2">هل أنت متأكد من حذف هذا البانر؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <div className="flex gap-3 mt-4">
            <Button variant="destructive" className="flex-1" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
