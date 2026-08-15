import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useGetCmsSettings, getGetCmsSettingsQueryKey, useUpdateCmsSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { QrCode, ExternalLink, Smartphone, Share2, Save, Download, ZoomIn } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import QRCode from "qrcode";

type QrLinksForm = {
  qrPageTitle: string;
  qrPageWelcome: string;
  qrPageDescription: string;
  qrPageBgImage: string;
  qrAndroidUrl: string;
  qrIosUrl: string;
  qrFacebookUrl: string;
  qrWhatsappUrl: string;
  qrInstagramUrl: string;
  qrTiktokUrl: string;
  qrTwitterUrl: string;
};

function QrGenerator({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(256);
  const [rendered, setRendered] = useState(false);

  const renderQr = useCallback(async (targetSize: number) => {
    if (!canvasRef.current || !url) return;
    try {
      await QRCode.toCanvas(canvasRef.current, url, {
        width: targetSize,
        margin: 3,
        color: { dark: "#1a1a1a", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      setRendered(true);
    } catch {
      setRendered(false);
    }
  }, [url]);

  useEffect(() => {
    renderQr(size);
  }, [url, size, renderQr]);

  const handleDownload = () => {
    if (!canvasRef.current || !rendered) return;
    const link = document.createElement("a");
    link.download = `fnashha-qr-${size}px.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  if (!url) return null;

  return (
    <Card className="mb-6 border-yellow-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="w-4 h-4 text-yellow-600" />
          رمز QR — معاينة وتحميل
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Preview */}
        <div className="flex justify-center mb-5">
          <div style={{
            background: "#fff",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            border: "1px solid rgba(0,0,0,0.06)",
            display: "inline-block",
          }}>
            <canvas
              ref={canvasRef}
              style={{ display: "block", borderRadius: 8 }}
            />
          </div>
        </div>

        {/* Size control */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-gray-400" />
              الحجم
            </label>
            <span className="text-sm font-mono text-yellow-700 bg-yellow-50 px-2.5 py-0.5 rounded-md border border-yellow-200">
              {size} × {size} px
            </span>
          </div>
          <input
            type="range"
            min={128}
            max={512}
            step={32}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-yellow-500"
            style={{ cursor: "pointer" }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>128px</span>
            <span>256px</span>
            <span>384px</span>
            <span>512px</span>
          </div>
        </div>

        {/* Download */}
        <Button
          type="button"
          onClick={handleDownload}
          disabled={!rendered}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white gap-2"
        >
          <Download className="w-4 h-4" />
          تحميل PNG ({size}×{size})
        </Button>

        {/* URL shown below */}
        <p className="text-xs text-gray-400 text-center mt-3 font-mono break-all">{url}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminQrLinks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("cms.homepage");

  const { data: settings, isLoading } = useGetCmsSettings({
    query: { queryKey: getGetCmsSettingsQueryKey() },
  });
  const s = settings as any;
  const updateMutation = useUpdateCmsSettings();

  const form = useForm<QrLinksForm>({
    defaultValues: {
      qrPageTitle: "",
      qrPageWelcome: "",
      qrPageDescription: "",
      qrPageBgImage: "",
      qrAndroidUrl: "",
      qrIosUrl: "",
      qrFacebookUrl: "",
      qrWhatsappUrl: "",
      qrInstagramUrl: "",
      qrTiktokUrl: "",
      qrTwitterUrl: "",
    },
  });

  useEffect(() => {
    if (s) {
      form.reset({
        qrPageTitle:       s.qrPageTitle       || "",
        qrPageWelcome:     s.qrPageWelcome     || "",
        qrPageDescription: s.qrPageDescription || "",
        qrPageBgImage:     s.qrPageBgImage     || "",
        qrAndroidUrl:      s.qrAndroidUrl      || "",
        qrIosUrl:          s.qrIosUrl          || "",
        qrFacebookUrl:     s.qrFacebookUrl     || "",
        qrWhatsappUrl:     s.qrWhatsappUrl     || "",
        qrInstagramUrl:    s.qrInstagramUrl    || "",
        qrTiktokUrl:       s.qrTiktokUrl       || "",
        qrTwitterUrl:      s.qrTwitterUrl      || "",
      });
    }
  }, [s]);

  const onSubmit = async (data: QrLinksForm) => {
    const payload: Record<string, string> = {};
    (Object.keys(data) as (keyof QrLinksForm)[]).forEach((k) => {
      payload[k] = data[k] ?? "";
    });
    try {
      await updateMutation.mutateAsync({ data: payload } as any);
      await queryClient.invalidateQueries({ queryKey: getGetCmsSettingsQueryKey() });
      toast({ title: "تم الحفظ", description: "تم تحديث إعدادات صفحة QR بنجاح" });
    } catch {
      toast({ title: "خطأ", description: "فشل حفظ الإعدادات", variant: "destructive" });
    }
  };

  const qrPageUrl = `${window.location.origin}${import.meta.env.BASE_URL}qr`
    .replace(/([^:])\/\//g, "$1/")
    .replace(":/", "://");

  return (
    <div className="p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-yellow-50 rounded-xl border border-yellow-200">
          <QrCode className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">QR وروابط التواصل</h1>
          <p className="text-sm text-gray-500">إعداد صفحة الوصول من رمز QR وروابط منصات التواصل الاجتماعي</p>
        </div>
      </div>

      {/* QR page URL preview */}
      <Card className="mb-5 border-yellow-200 bg-yellow-50/60">
        <CardContent className="flex items-center gap-3 py-4">
          <ExternalLink className="w-4 h-4 text-yellow-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-yellow-700 font-semibold mb-0.5">رابط الصفحة العامة</p>
            <p className="text-sm text-yellow-800 font-mono break-all">{qrPageUrl}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 shrink-0"
            onClick={() => window.open(qrPageUrl, "_blank")}
          >
            فتح
          </Button>
        </CardContent>
      </Card>

      {/* Live QR code generator */}
      <QrGenerator url={qrPageUrl} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* Page content */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="w-4 h-4 text-gray-500" />
                محتوى الصفحة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="qrPageTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان الصفحة</FormLabel>
                  <FormControl><Input {...field} placeholder="مرحباً بك في فنشها" disabled={!canEdit} /></FormControl>
                  <FormDescription className="text-xs">يظهر أسفل الشعار</FormDescription>
                </FormItem>
              )} />

              <FormField control={form.control} name="qrPageWelcome" render={({ field }) => (
                <FormItem>
                  <FormLabel>نص الترحيب</FormLabel>
                  <FormControl><Input {...field} placeholder="حمّل التطبيق أو تابعنا على منصات التواصل" disabled={!canEdit} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="qrPageDescription" render={({ field }) => (
                <FormItem>
                  <FormLabel>وصف إضافي (اختياري)</FormLabel>
                  <FormControl><Input {...field} placeholder="نص توضيحي صغير..." disabled={!canEdit} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="qrPageBgImage" render={({ field }) => (
                <FormItem>
                  <FormLabel>صورة خلفية مخصصة (اختياري)</FormLabel>
                  <FormControl><Input {...field} placeholder="https://..." dir="ltr" disabled={!canEdit} /></FormControl>
                  <FormDescription className="text-xs">اتركه فارغاً لاستخدام الخلفية المتحركة الافتراضية</FormDescription>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Download links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                روابط التحميل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="qrAndroidUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs">🤖</span>
                    رابط أندرويد (Google Play)
                  </FormLabel>
                  <FormControl><Input {...field} placeholder="https://play.google.com/store/apps/..." dir="ltr" disabled={!canEdit} /></FormControl>
                  <FormDescription className="text-xs">اتركه فارغاً لإخفاء الزر</FormDescription>
                </FormItem>
              )} />

              <FormField control={form.control} name="qrIosUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs">🍎</span>
                    رابط آيفون (App Store)
                  </FormLabel>
                  <FormControl><Input {...field} placeholder="https://apps.apple.com/app/..." dir="ltr" disabled={!canEdit} /></FormControl>
                  <FormDescription className="text-xs">اتركه فارغاً لإخفاء الزر</FormDescription>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Social links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="w-4 h-4 text-gray-500" />
                روابط منصات التواصل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: "qrFacebookUrl"  as const, label: "فيسبوك",    emoji: "👤", placeholder: "https://facebook.com/..." },
                { name: "qrWhatsappUrl"  as const, label: "واتساب",    emoji: "💬", placeholder: "https://wa.me/..." },
                { name: "qrInstagramUrl" as const, label: "انستجرام",  emoji: "📸", placeholder: "https://instagram.com/..." },
                { name: "qrTiktokUrl"    as const, label: "تيك توك",   emoji: "🎵", placeholder: "https://tiktok.com/@..." },
                { name: "qrTwitterUrl"   as const, label: "X (تويتر)", emoji: "✖️", placeholder: "https://x.com/..." },
              ].map(({ name, label, emoji, placeholder }) => (
                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <span>{emoji}</span>
                      {label}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={placeholder} dir="ltr" disabled={!canEdit} />
                    </FormControl>
                    <FormDescription className="text-xs">اتركه فارغاً لإخفاء الزر</FormDescription>
                  </FormItem>
                )} />
              ))}
            </CardContent>
          </Card>

          {canEdit && (
            <div className="flex justify-start pb-4">
              <Button
                type="submit"
                disabled={updateMutation.isPending || isLoading}
                className="bg-yellow-500 hover:bg-yellow-600 text-white gap-2 px-6"
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
