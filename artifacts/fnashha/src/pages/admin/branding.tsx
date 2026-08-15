import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useGetCmsSettings, getGetCmsSettingsQueryKey, useUpdateCmsSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useBranding } from "@/contexts/branding-context";
import { uploadFile } from "@/lib/uploadMedia";
import {
  Type, Image, Smartphone, Star, Upload, Trash2, Eye,
  Palette, AlertCircle, Loader2, CheckCircle2
} from "lucide-react";

type Tab = "names" | "logo" | "favicon" | "app-icons";

interface ImageFieldProps {
  label: string;
  description: string;
  currentUrl: string | null;
  onSave: (url: string | null) => Promise<void>;
  accept?: string;
  token: string | null;
  previewShape?: "square" | "circle" | "rect";
}

function ImageField({ label, description, currentUrl, onSave, accept = "image/*", token, previewShape = "square" }: ImageFieldProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  useEffect(() => {
    setPreview(currentUrl);
  }, [currentUrl]);

  const handleFile = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadFile(file, token, (pct) => setProgress(pct));
      setPreview(url);
      await onSave(url);
      toast({ title: `تم رفع ${label} بنجاح` });
    } catch (e: any) {
      toast({ title: "فشل الرفع", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setPreview(null);
    await onSave(null);
    toast({ title: `تم حذف ${label}` });
  };

  const shapeClass =
    previewShape === "circle"
      ? "rounded-full"
      : previewShape === "rect"
      ? "rounded-lg aspect-video"
      : "rounded-xl";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="flex items-start gap-4">
        <div
          className={`bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden flex-shrink-0 ${shapeClass}`}
          style={{ width: previewShape === "rect" ? 160 : 80, height: previewShape === "rect" ? 90 : 80 }}
        >
          {preview ? (
            <img src={preview} alt={label} className="w-full h-full object-contain" />
          ) : (
            <Image className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        <div className="space-y-2 flex-1">
          {uploading ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جار الرفع... {progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="gap-1.5 text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                {preview ? "تغيير" : "رفع صورة"}
              </Button>
              {preview && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => window.open(preview!, "_blank")}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    معاينة
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={handleRemove}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </Button>
                </>
              )}
            </div>
          )}
          {preview && (
            <p className="text-[10px] text-muted-foreground break-all leading-relaxed max-w-xs truncate">
              {preview}
            </p>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

export default function AdminBranding() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token, isSuperAdmin, hasPermission } = useAuth();
  const branding = useBranding();
  const { data: settings } = useGetCmsSettings({ query: { queryKey: getGetCmsSettingsQueryKey() } });
  const updateMutation = useUpdateCmsSettings();
  const s = settings as any;
  const [tab, setTab] = useState<Tab>("names");

  const namesForm = useForm({
    defaultValues: {
      siteNameAr: "",
      siteName: "",
      shortName: "",
      appName: "",
      siteSlogan: "",
    },
  });

  useEffect(() => {
    if (s) {
      namesForm.reset({
        siteNameAr: s.siteNameAr || "",
        siteName: s.siteName || "",
        shortName: s.shortName || "",
        appName: s.appName || "",
        siteSlogan: s.siteSlogan || "",
      });
    }
  }, [s]);

  const saveSettings = (values: Record<string, string | null>) => {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      clean[k] = v ?? "";
    }
    return new Promise<void>((resolve, reject) => {
      updateMutation.mutate(
        { data: clean as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCmsSettingsQueryKey() });
            resolve();
          },
          onError: reject,
        }
      );
    });
  };

  const saveImage = async (key: string, url: string | null) => {
    await saveSettings({ [key]: url ?? "" });
  };

  if (!isSuperAdmin && !hasPermission("cms.settings")) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64" dir="rtl">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">ليس لديك صلاحية الوصول إلى هذه الصفحة</p>
          <p className="text-xs text-muted-foreground">تواصل مع المدير العام لمنحك الصلاحية</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "names", label: "الأسماء والنصوص", icon: Type },
    { id: "logo", label: "الشعار الرئيسي", icon: Image },
    { id: "favicon", label: "الأيقونة (Favicon)", icon: Star },
    { id: "app-icons", label: "أيقونات التطبيق", icon: Smartphone },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Palette className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">العلامة التجارية</h1>
          <p className="text-muted-foreground text-sm mt-0.5">تحكم في اسم الموقع، الشعار، والأيقونات</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "names" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" />
              أسماء الموقع والتطبيق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...namesForm}>
              <form onSubmit={namesForm.handleSubmit(async (v) => {
                try {
                  await saveSettings(v);
                  toast({ title: "تم حفظ الأسماء بنجاح" });
                } catch {
                  toast({ title: "حدث خطأ", variant: "destructive" });
                }
              })} className="space-y-5">

                <FormField control={namesForm.control} name="siteNameAr" render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الموقع (عربي)</FormLabel>
                    <FormDescription className="text-xs">يظهر في الهيدر، الفوتر، لوحة التحكم، وعنوان المتصفح</FormDescription>
                    <FormControl><Input {...field} placeholder="فنشها" dir="rtl" /></FormControl>
                  </FormItem>
                )} />

                <FormField control={namesForm.control} name="siteName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الموقع (إنجليزي)</FormLabel>
                    <FormDescription className="text-xs">يُستخدم في الأماكن التي تحتاج نصاً إنجليزياً</FormDescription>
                    <FormControl><Input {...field} placeholder="Fnashha" dir="ltr" /></FormControl>
                  </FormItem>
                )} />

                <FormField control={namesForm.control} name="shortName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم المختصر</FormLabel>
                    <FormDescription className="text-xs">يظهر في أيقونة التطبيق ورمز الشاشة الرئيسية</FormDescription>
                    <FormControl><Input {...field} placeholder="فنشها" dir="rtl" /></FormControl>
                  </FormItem>
                )} />

                <FormField control={namesForm.control} name="appName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم تطبيق الجوال</FormLabel>
                    <FormDescription className="text-xs">يظهر أسفل أيقونة التطبيق على جهاز المستخدم</FormDescription>
                    <FormControl><Input {...field} placeholder="فنشها" dir="rtl" /></FormControl>
                  </FormItem>
                )} />

                <FormField control={namesForm.control} name="siteSlogan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الشعار / السلوغان</FormLabel>
                    <FormDescription className="text-xs">يظهر في عنوان المتصفح بجانب اسم الموقع</FormDescription>
                    <FormControl><Input {...field} placeholder="صيانة بيتك بضغطة زر" dir="rtl" /></FormControl>
                  </FormItem>
                )} />

                <div className="pt-2 flex items-center gap-3">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    حفظ الأسماء
                  </Button>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    التغييرات تظهر فوراً في كل أنحاء الموقع
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {tab === "logo" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              الشعار الرئيسي (Logo)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">يظهر الشعار في:</p>
              <ul className="list-disc list-inside space-y-0.5 mr-2">
                <li>الهيدر العلوي للموقع</li>
                <li>الفوتر</li>
                <li>لوحة تحكم العميل والفني</li>
                <li>صفحة تسجيل الدخول والتسجيل</li>
                <li>لوحة الإدارة</li>
              </ul>
              <p className="mt-2 text-yellow-600 dark:text-yellow-400">يُفضل استخدام صورة PNG بخلفية شفافة بأبعاد مربعة (512×512 على الأقل)</p>
            </div>

            <ImageField
              label="الشعار الرئيسي"
              description="الشعار الذي يظهر في جميع أرجاء الموقع والتطبيق"
              currentUrl={s?.logoUrl || null}
              onSave={(url) => saveImage("logoUrl", url)}
              token={token}
              previewShape="square"
            />

            {s?.logoUrl && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">معاينة في سياقات مختلفة:</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
                    <img src={s.logoUrl} alt="logo" className="w-7 h-7 object-contain" />
                    <span className="text-sm font-black text-gray-900">{branding.siteNameAr}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-900 border border-border rounded-lg px-3 py-2">
                    <img src={s.logoUrl} alt="logo" className="w-7 h-7 object-contain" />
                    <span className="text-sm font-black text-white">{branding.siteNameAr}</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-border flex items-center justify-center overflow-hidden">
                    <img src={s.logoUrl} alt="logo" className="w-9 h-9 object-contain" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "favicon" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              أيقونة المتصفح (Favicon)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">يُستخدم الـ Favicon في:</p>
              <ul className="list-disc list-inside space-y-0.5 mr-2">
                <li>أيقونة تبويب المتصفح</li>
                <li>أيقونة PWA عند الإضافة للشاشة الرئيسية</li>
                <li>نتائج البحث وصفحات المفضلة</li>
              </ul>
              <p className="mt-2 text-yellow-600 dark:text-yellow-400">يُفضل استخدام صورة ICO أو PNG مربعة بحجم 32×32 أو 64×64 أو 512×512</p>
            </div>

            <ImageField
              label="أيقونة المتصفح"
              description="تظهر في تبويب المتصفح وعند حفظ الموقع كتطبيق"
              currentUrl={s?.faviconUrl || null}
              onSave={(url) => saveImage("faviconUrl", url)}
              accept="image/png,image/x-icon,image/svg+xml,image/webp"
              token={token}
              previewShape="square"
            />

            {s?.faviconUrl && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">معاينة كتبويب متصفح:</p>
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-t-lg px-3 py-2 w-fit border border-border">
                  <img src={s.faviconUrl} alt="favicon" className="w-4 h-4 object-contain" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{branding.siteNameAr}</span>
                  <span className="text-gray-400 text-xs">×</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "app-icons" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" />
              أيقونات تطبيق الجوال
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">ملاحظة</p>
              <p>هذه الأيقونات ستُستخدم عند توليد نسخة Capacitor للتطبيق. لا تؤثر على الموقع الإلكتروني حالياً.</p>
            </div>

            <div className="space-y-6 divide-y divide-border">
              <div className="pt-0">
                <ImageField
                  label="أيقونة Android"
                  description="مطلوب بحجم 512×512 — PNG بخلفية غير شفافة"
                  currentUrl={s?.androidIconUrl || null}
                  onSave={(url) => saveImage("androidIconUrl", url)}
                  token={token}
                  previewShape="square"
                />
              </div>

              <div className="pt-6">
                <ImageField
                  label="أيقونة iOS"
                  description="مطلوب بحجم 1024×1024 — PNG بخلفية غير شفافة (بدون شفافية)"
                  currentUrl={s?.iosIconUrl || null}
                  onSave={(url) => saveImage("iosIconUrl", url)}
                  token={token}
                  previewShape="square"
                />
              </div>

              <div className="pt-6">
                <ImageField
                  label="شعار شاشة البداية (Splash)"
                  description="يظهر عند فتح التطبيق — PNG بأبعاد مربعة"
                  currentUrl={s?.splashLogoUrl || null}
                  onSave={(url) => saveImage("splashLogoUrl", url)}
                  token={token}
                  previewShape="square"
                />
              </div>

              <div className="pt-6">
                <ImageField
                  label="أيقونة PWA (ويب)"
                  description="أيقونة التطبيق التقدمي على المتصفح — PNG بحجم 512×512 على الأقل. إذا تُركت فارغة تُستخدم الأيقونة الافتراضية."
                  currentUrl={s?.pwaIconUrl || null}
                  onSave={(url) => saveImage("pwaIconUrl", url)}
                  token={token}
                  previewShape="square"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
