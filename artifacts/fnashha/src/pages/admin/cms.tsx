import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useGetCmsSettings, getGetCmsSettingsQueryKey, useUpdateCmsSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Globe, BarChart2, AlignLeft, FileText, Coins } from "lucide-react";

type Tab = "general" | "stats" | "footer" | "pages" | "loyalty";

export default function AdminCms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useGetCmsSettings({ query: { queryKey: getGetCmsSettingsQueryKey() } });
  const updateMutation = useUpdateCmsSettings();
  const s = settings as any;
  const [tab, setTab] = useState<Tab>("general");

  const generalForm = useForm({
    defaultValues: {
      siteNameAr: "",
      heroTitleAr: "",
      heroSubtitleAr: "",
      aboutUsAr: "",
    },
  });

  const statsForm = useForm({
    defaultValues: {
      statsCustomers: "",
      statsTechnicians: "",
      statsRequests: "",
      statsGovernorates: "",
    },
  });

  const footerForm = useForm({
    defaultValues: {
      footerAboutUs: "",
      footerFaq: "",
      contactPhone: "",
      contactEmail: "",
      whatsappNumber: "",
      facebookUrl: "",
      instagramUrl: "",
      twitterUrl: "",
      tiktokUrl: "",
      youtubeUrl: "",
      hotlineSchedule: "",
    },
  });

  const pagesForm = useForm({
    defaultValues: {
      termsConditions: "",
      privacyPolicy: "",
      refundPolicy: "",
      faqContent: "",
    },
  });

  const loyaltyForm = useForm({
    defaultValues: {
      loyaltyEnabled: "false",
      coinName: "",
      coinNameEn: "",
      coinEarnX: "",
      coinEarnY: "",
      coinRedeemX: "",
      coinRedeemY: "",
      maxCoinsPerRequest: "",
      minRequestValue: "",
      pendingCoinDays: "",
      coinExpiryDays: "",
      allowCoinsPlusCoupons: "false",
      earnCoinsOnDiscount: "false",
      referralEnabled: "true",
      referralReferrerCoins: "",
      referralRefereeCoins: "",
    },
  });

  useEffect(() => {
    if (s) {
      generalForm.reset({
        siteNameAr: s.siteNameAr || "",
        heroTitleAr: s.heroTitleAr || "",
        heroSubtitleAr: s.heroSubtitleAr || "",
        aboutUsAr: s.aboutUsAr || "",
      });
      statsForm.reset({
        statsCustomers: s.statsCustomers || "",
        statsTechnicians: s.statsTechnicians || "",
        statsRequests: s.statsRequests || "",
        statsGovernorates: s.statsGovernorates || "",
      });
      footerForm.reset({
        footerAboutUs: s.footerAboutUs || "",
        footerFaq: s.footerFaq || "",
        contactPhone: s.contactPhone || "",
        contactEmail: s.contactEmail || "",
        whatsappNumber: s.whatsappNumber || "",
        facebookUrl: s.facebookUrl || "",
        instagramUrl: s.instagramUrl || "",
        twitterUrl: s.twitterUrl || "",
        tiktokUrl: s.tiktokUrl || "",
        youtubeUrl: s.youtubeUrl || "",
        hotlineSchedule: s.hotlineSchedule || "",
      });
      pagesForm.reset({
        termsConditions: s.termsConditions || "",
        privacyPolicy: s.privacyPolicy || "",
        refundPolicy: s.refundPolicy || "",
        faqContent: s.faqContent || "",
      });
      loyaltyForm.reset({
        loyaltyEnabled: s.loyaltyEnabled || "false",
        coinName: s.coinName || "",
        coinNameEn: s.coinNameEn || "",
        coinEarnX: s.coinEarnX || "10",
        coinEarnY: s.coinEarnY || "1",
        coinRedeemX: s.coinRedeemX || "1",
        coinRedeemY: s.coinRedeemY || "0.5",
        maxCoinsPerRequest: s.maxCoinsPerRequest || "",
        minRequestValue: s.minRequestValue || "",
        pendingCoinDays: s.pendingCoinDays || "",
        coinExpiryDays: s.coinExpiryDays || "",
        allowCoinsPlusCoupons: s.allowCoinsPlusCoupons || "false",
        earnCoinsOnDiscount: s.earnCoinsOnDiscount || "false",
        referralEnabled: s.referralEnabled || "true",
        referralReferrerCoins: s.referralReferrerCoins || "",
        referralRefereeCoins: s.referralRefereeCoins || "",
      });
    }
  }, [s]);

  const save = (values: any) => {
    updateMutation.mutate(
      { data: values as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCmsSettingsQueryKey() });
          toast({ title: "تم حفظ الإعدادات بنجاح" });
        },
        onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
      }
    );
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "general", label: "الإعدادات العامة", icon: Globe },
    { id: "stats", label: "الإحصائيات", icon: BarChart2 },
    { id: "footer", label: "الفوتر والتواصل", icon: AlignLeft },
    { id: "pages", label: "الصفحات القانونية", icon: FileText },
    { id: "loyalty", label: "نظام الولاء", icon: Coins },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">إدارة المحتوى</h1>
        <p className="text-muted-foreground text-sm mt-1">تحكم في كل محتوى الموقع من هنا</p>
      </div>

      {/* Tabs */}
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

      {/* ── General Settings ─────────────────────────────────── */}
      {tab === "general" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الإعدادات العامة والصفحة الرئيسية</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...generalForm}>
              <form onSubmit={generalForm.handleSubmit(save)} className="space-y-5">
                {[
                  { name: "siteNameAr", label: "اسم الموقع بالعربي" },
                  { name: "heroTitleAr", label: "عنوان الصفحة الرئيسية" },
                  { name: "heroSubtitleAr", label: "وصف الصفحة الرئيسية", textarea: true },
                  { name: "aboutUsAr", label: "عن المنصة", textarea: true },
                ].map(({ name, label, textarea }: any) => (
                  <FormField key={name} control={generalForm.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        {textarea
                          ? <Textarea rows={4} data-testid={`input-${name}`} {...field} />
                          : <Input data-testid={`input-${name}`} {...field} />}
                      </FormControl>
                    </FormItem>
                  )} />
                ))}
                <Button type="submit" className="w-full font-bold" disabled={updateMutation.isPending} data-testid="button-save-general">
                  {updateMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات العامة"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ── Statistics ───────────────────────────────────────── */}
      {tab === "stats" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">قسم الإحصائيات في الصفحة الرئيسية</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-5 bg-secondary/50 p-3 rounded-lg">
              هذه الأرقام تظهر في قسم "فنشها بالأرقام" في الصفحة الرئيسية. يمكنك كتابة أي قيمة مثل "10,000+" أو "500+".
            </p>
            <Form {...statsForm}>
              <form onSubmit={statsForm.handleSubmit(save)} className="space-y-5">
                {[
                  { name: "statsCustomers", label: "عدد العملاء", placeholder: "10,000+" },
                  { name: "statsTechnicians", label: "عدد الفنيين", placeholder: "500+" },
                  { name: "statsRequests", label: "الطلبات المكتملة", placeholder: "50,000+" },
                  { name: "statsGovernorates", label: "المحافظات المغطاة", placeholder: "27" },
                ].map(({ name, label, placeholder }: any) => (
                  <FormField key={name} control={statsForm.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Input placeholder={placeholder} data-testid={`input-${name}`} {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                ))}
                <Button type="submit" className="w-full font-bold" disabled={updateMutation.isPending} data-testid="button-save-stats">
                  {updateMutation.isPending ? "جاري الحفظ..." : "حفظ إعدادات الإحصائيات"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ── Footer & Contact ─────────────────────────────────── */}
      {tab === "footer" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">نص الفوتر والتواصل</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...footerForm}>
                <form onSubmit={footerForm.handleSubmit(save)} className="space-y-5">
                  {[
                    { name: "footerAboutUs", label: "نص عن فنشها في الفوتر", textarea: true },
                  ].map(({ name, label, textarea }: any) => (
                    <FormField key={name} control={footerForm.control} name={name} render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          {textarea
                            ? <Textarea rows={3} data-testid={`input-${name}`} {...field} />
                            : <Input data-testid={`input-${name}`} {...field} />}
                        </FormControl>
                      </FormItem>
                    )} />
                  ))}

                  <div className="pt-2 border-t border-border">
                    <p className="text-sm font-semibold text-foreground mb-4">معلومات التواصل</p>
                    <div className="space-y-4">
                      {[
                        { name: "contactPhone", label: "رقم الهاتف" },
                        { name: "contactEmail", label: "البريد الإلكتروني" },
                        { name: "whatsappNumber", label: "رقم واتساب" },
                      ].map(({ name, label }: any) => (
                        <FormField key={name} control={footerForm.control} name={name} render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl><Input data-testid={`input-${name}`} {...field} /></FormControl>
                          </FormItem>
                        )} />
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-sm font-semibold text-foreground mb-4">روابط التواصل الاجتماعي</p>
                    <div className="space-y-4">
                      {[
                        { name: "facebookUrl",   label: "رابط فيسبوك" },
                        { name: "instagramUrl",  label: "رابط إنستغرام" },
                        { name: "twitterUrl",    label: "رابط تويتر / X" },
                        { name: "tiktokUrl",     label: "رابط تيك توك" },
                        { name: "youtubeUrl",    label: "رابط يوتيوب" },
                        { name: "hotlineSchedule", label: "أوقات الخط الساخن" },
                      ].map(({ name, label }: any) => (
                        <FormField key={name} control={footerForm.control} name={name} render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl><Input placeholder="https://..." data-testid={`input-${name}`} {...field} /></FormControl>
                          </FormItem>
                        )} />
                      ))}
                    </div>
                  </div>

                  <Button type="submit" className="w-full font-bold" disabled={updateMutation.isPending} data-testid="button-save-footer">
                    {updateMutation.isPending ? "جاري الحفظ..." : "حفظ إعدادات الفوتر"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Legal Pages ──────────────────────────────────────── */}
      {tab === "pages" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">محتوى الصفحات القانونية</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-5 bg-secondary/50 p-3 rounded-lg">
              يمكنك استخدام HTML للتنسيق مثل: <code className="bg-muted px-1 rounded text-xs">&lt;b&gt;نص غامق&lt;/b&gt;</code> أو <code className="bg-muted px-1 rounded text-xs">&lt;h2&gt;عنوان&lt;/h2&gt;</code>. اترك الحقل فارغاً لعرض المحتوى الافتراضي.
            </p>
            <Form {...pagesForm}>
              <form onSubmit={pagesForm.handleSubmit(save)} className="space-y-6">
                {[
                  { name: "termsConditions", label: "الشروط والأحكام", hint: "يظهر في صفحة /terms" },
                  { name: "privacyPolicy", label: "سياسة الخصوصية", hint: "يظهر في صفحة /privacy" },
                  { name: "refundPolicy", label: "سياسة الاسترداد", hint: "يظهر في صفحة /refund-policy" },
                  { name: "faqContent", label: "الأسئلة الشائعة", hint: "يظهر في صفحة /faq (اتركه فارغاً لعرض الأسئلة الافتراضية)" },
                ].map(({ name, label, hint }: any) => (
                  <FormField key={name} control={pagesForm.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">{label}</FormLabel>
                      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
                      <FormControl>
                        <Textarea rows={8} data-testid={`input-${name}`} className="font-mono text-sm" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                ))}
                <Button type="submit" className="w-full font-bold" disabled={updateMutation.isPending} data-testid="button-save-pages">
                  {updateMutation.isPending ? "جاري الحفظ..." : "حفظ الصفحات القانونية"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ── Loyalty System ───────────────────────────────────── */}
      {tab === "loyalty" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">إعدادات نظام الولاء (الكوينز والإحالة)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-5 bg-secondary/50 p-3 rounded-lg">
              تحكم في كل إعدادات نظام الكوينز والإحالة بدون الحاجة لتعديل الكود.
            </p>
            <Form {...loyaltyForm}>
              <form onSubmit={loyaltyForm.handleSubmit(save)} className="space-y-6">
                <FormField control={loyaltyForm.control} name="loyaltyEnabled" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">تفعيل نظام الولاء</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-loyaltyEnabled"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">مفعّل</SelectItem>
                        <SelectItem value="false">غير مفعّل</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <div className="pt-2 border-t border-border">
                  <p className="text-sm font-semibold text-foreground mb-4">إعدادات الكوين</p>
                  <div className="space-y-4">
                    {[
                      { name: "coinName", label: "اسم العملة بالعربي", placeholder: "عملات فنشها" },
                      { name: "coinNameEn", label: "اسم العملة بالإنجليزي", placeholder: "Fnashha Currency" },
                    ].map(({ name, label, placeholder }: any) => (
                      <FormField key={name} control={loyaltyForm.control} name={name as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl><Input placeholder={placeholder} data-testid={`input-${name}`} {...field} /></FormControl>
                        </FormItem>
                      )} />
                    ))}

                    {/* ── Earning Formula ──────────────────────────────────── */}
                    <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                      <p className="text-sm font-bold text-foreground">معادلة كسب عملات فنشها</p>
                      <p className="text-xs text-muted-foreground">كل كم جنيه يكسب العميل كم عملة؟</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">كل</span>
                        <FormField control={loyaltyForm.control} name="coinEarnX" render={({ field }) => (
                          <FormItem className="flex-1 min-w-[80px] max-w-[120px]">
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="10"
                                data-testid="input-coinEarnX"
                                className="text-center font-bold"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">جنيه</span>
                        <span className="text-lg font-bold text-primary">=</span>
                        <FormField control={loyaltyForm.control} name="coinEarnY" render={({ field }) => (
                          <FormItem className="flex-1 min-w-[80px] max-w-[120px]">
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="1"
                                data-testid="input-coinEarnY"
                                className="text-center font-bold"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">عملة فنشها</span>
                      </div>
                      <p className="text-xs text-muted-foreground bg-secondary rounded p-2">
                        مثال: كل ١٠ جنيه = ١ عملة | كل ٢٠ جنيه = ٣ عملات
                      </p>
                    </div>

                    {/* ── Redemption Formula ───────────────────────────────── */}
                    <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                      <p className="text-sm font-bold text-foreground">معادلة استخدام عملات فنشها كخصم</p>
                      <p className="text-xs text-muted-foreground">كل كم عملة تساوي كم جنيه خصمًا؟</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">كل</span>
                        <FormField control={loyaltyForm.control} name="coinRedeemX" render={({ field }) => (
                          <FormItem className="flex-1 min-w-[80px] max-w-[120px]">
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="1"
                                data-testid="input-coinRedeemX"
                                className="text-center font-bold"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">عملة فنشها</span>
                        <span className="text-lg font-bold text-primary">=</span>
                        <FormField control={loyaltyForm.control} name="coinRedeemY" render={({ field }) => (
                          <FormItem className="flex-1 min-w-[80px] max-w-[120px]">
                            <FormControl>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="0.5"
                                data-testid="input-coinRedeemY"
                                className="text-center font-bold"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">جنيه خصم</span>
                      </div>
                      <p className="text-xs text-muted-foreground bg-secondary rounded p-2">
                        مثال: كل ١ عملة = ٠.٥ جنيه خصم | كل ٥ عملات = ١٠ جنيه خصم
                      </p>
                    </div>

                    {[
                      { name: "maxCoinsPerRequest", label: "أقصى عدد عملات يمكن استخدامه في الطلب الواحد" },
                      { name: "minRequestValue", label: "أقل قيمة للطلب لاستحقاق كسب/استخدام عملات فنشها (جنيه)" },
                      { name: "pendingCoinDays", label: "عدد أيام انتظار العملة قبل أن تصبح متاحة", hint: "0 = تصبح متاحة فورًا" },
                      { name: "coinExpiryDays", label: "عدد أيام صلاحية العملة قبل انتهائها", hint: "0 = لا تنتهي أبدًا" },
                    ].map(({ name, label, hint }: any) => (
                      <FormField key={name} control={loyaltyForm.control} name={name as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
                          <FormControl><Input data-testid={`input-${name}`} {...field} /></FormControl>
                        </FormItem>
                      )} />
                    ))}

                    <FormField control={loyaltyForm.control} name="allowCoinsPlusCoupons" render={({ field }) => (
                      <FormItem>
                        <FormLabel>السماح بدمج الكوينز مع الكوبونات في نفس الطلب</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-allowCoinsPlusCoupons"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">مسموح</SelectItem>
                            <SelectItem value="false">غير مسموح</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={loyaltyForm.control} name="earnCoinsOnDiscount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>كسب كوينز حتى لو كان الطلب عليه خصم بالفعل</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-earnCoinsOnDiscount"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">نعم</SelectItem>
                            <SelectItem value="false">لا</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <p className="text-sm font-semibold text-foreground mb-4">إعدادات الإحالة</p>
                  <div className="space-y-4">
                    <FormField control={loyaltyForm.control} name="referralEnabled" render={({ field }) => (
                      <FormItem>
                        <FormLabel>تفعيل نظام الإحالة</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-referralEnabled"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">مفعّل</SelectItem>
                            <SelectItem value="false">غير مفعّل</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    {[
                      { name: "referralReferrerCoins", label: "عدد الكوينز التي يحصل عليها من قام بالإحالة" },
                      { name: "referralRefereeCoins", label: "عدد الكوينز التي يحصل عليها المُحال" },
                    ].map(({ name, label }: any) => (
                      <FormField key={name} control={loyaltyForm.control} name={name as any} render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl><Input data-testid={`input-${name}`} {...field} /></FormControl>
                        </FormItem>
                      )} />
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full font-bold" disabled={updateMutation.isPending} data-testid="button-save-loyalty">
                  {updateMutation.isPending ? "جاري الحفظ..." : "حفظ إعدادات نظام الولاء"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
