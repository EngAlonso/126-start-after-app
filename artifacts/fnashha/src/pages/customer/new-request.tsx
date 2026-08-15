import { useLocation, useSearch } from "wouter";
import { CldImg } from "@/components/ui/cld-img";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRef, useState, useEffect, useCallback } from "react";
import type { FieldErrors } from "react-hook-form";
import { useCreateRequest, useListServices, useListGovernorates, useListAreas, getListRequestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, Mic, X, Volume2, Square, Circle, MapPin, User, FileText, Wrench, Send, Phone } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { uploadFileLocal } from "@/lib/uploadMedia";
import { ImagePicker } from "@/components/ui/image-picker";
import { cn } from "@/lib/utils";

/* ─────────────────── schema (unchanged) ─────────────────── */
const schema = z.object({
  serviceId:     z.string().min(1, "اختر الخدمة"),
  fullName:      z.string().min(3, "الاسم مطلوب"),
  mobile:        z.string().min(8, "رقم الهاتف مطلوب"),
  governorateId: z.string().min(1, "اختر المحافظة"),
  areaId:        z.string().min(1, "اختر المنطقة"),
  address:       z.string().min(5, "العنوان مطلوب"),
  description:   z.string().min(10, "الوصف مطلوب"),
});

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ACCEPTED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/m4a", "audio/mp4"];

/* ─────────────────── helpers ─────────────────── */
const SERVICE_EMOJI_MAP: Record<string, string> = {
  "كهرباء": "⚡", "سباكة": "🚿", "نجارة": "🪚", "دهانات": "🎨",
  "تكييف": "❄️", "حدادة": "🔩", "بلاط": "🏠", "غاز": "🔥",
  "مراتب": "🛏️", "ستائر": "🪟", "صيانة": "🔧", "تنظيف": "🧹",
};

function getServiceEmoji(nameAr: string): string | null {
  for (const [key, emoji] of Object.entries(SERVICE_EMOJI_MAP)) {
    if (nameAr.includes(key)) return emoji;
  }
  return null;
}

/* ─────────────────── section card wrapper ─────────────────── */
function SectionCard({
  icon,
  title,
  subtitle,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  iconBg?: string;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border bg-muted/30">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <p className="font-bold text-sm text-foreground leading-tight">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {/* Section body */}
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

/* ─────────────────── page ─────────────────── */
export default function CustomerNewRequest() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const queryParams = new URLSearchParams(search);
  const rawServiceId = queryParams.get("serviceId") || "";
  const rawGovernorateId = queryParams.get("governorateId") || "";
  const rawAreaId = queryParams.get("areaId") || "";
  const preselectedServiceId = /^\d+$/.test(rawServiceId) ? rawServiceId : "";
  const preselectedGovernorateId = /^\d+$/.test(rawGovernorateId) ? rawGovernorateId : "";
  const preselectedAreaId = /^\d+$/.test(rawAreaId) ? rawAreaId : "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  /* ── created-request id — drives post-success navigation ── */
  const [createdId, setCreatedId] = useState<number | null>(null);

  const createMutation = useCreateRequest({
    mutation: {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
        toast({ title: "تم إنشاء الطلب ✓", description: "سيتقدم الفنيون بعروضهم قريباً" });
        setCreatedId(data?.id ?? null);
      },
      onError: (err: any) => {
        toast({ title: "خطأ", description: err?.data?.error || "حدث خطأ", variant: "destructive" });
      },
    },
  });

  const [images, setImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const audioRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: services = [] } = useListServices();
  const { data: governorates = [] } = useListGovernorates();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceId: preselectedServiceId, fullName: "", mobile: "",
      governorateId: preselectedGovernorateId, areaId: preselectedAreaId,
      address: "", description: "",
    },
  });

  useEffect(() => {
    if (preselectedServiceId && (services as any[]).some((s: any) => String(s.id) === preselectedServiceId)) {
      form.setValue("serviceId", preselectedServiceId, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedServiceId, services]);

  useEffect(() => {
    if (
      preselectedGovernorateId &&
      (governorates as any[]).some((g: any) => String(g.id) === preselectedGovernorateId)
    ) {
      form.setValue("governorateId", preselectedGovernorateId, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedGovernorateId, governorates]);

  const selectedGovId = form.watch("governorateId");
  const selectedServiceId = form.watch("serviceId");
  const { data: areas = [] } = useListAreas({ governorateId: selectedGovId ? parseInt(selectedGovId) : undefined } as any);

  useEffect(() => {
    if (
      preselectedAreaId &&
      (areas as any[]).some((area: any) => String(area.id) === preselectedAreaId)
    ) {
      form.setValue("areaId", preselectedAreaId, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedAreaId, areas]);

  const selectedService = (services as any[]).find((s: any) => String(s.id) === selectedServiceId);

  /* Navigate after successful creation */
  useEffect(() => {
    if (createdId !== null) {
      navigate(`/customer/requests/${createdId}`);
    }
  }, [createdId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* ── handlers (all unchanged) ── */
  const handleImagesChange = async (files: File[]) => {
    const valid = files.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
    if (valid.length < files.length)
      toast({ title: "تحذير", description: "بعض الملفات لم تُقبل (JPG, PNG, WEBP فقط)", variant: "destructive" });
    if (!valid.length) return;
    setUploadingImages(true);
    try {
      const urls = await Promise.all(valid.map((f) => uploadFileLocal(f, token, "requests")));
      setImages((prev) => [...prev, ...urls].slice(0, 6));
    } catch {
      toast({ title: "فشل رفع الصور", variant: "destructive" });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type) && !file.name.endsWith(".m4a")) {
      toast({ title: "صيغة غير مدعومة", description: "يُقبل MP3, WAV, M4A فقط", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "الملف كبير", description: "الحجم الأقصى 10 ميجابايت", variant: "destructive" });
      return;
    }
    if (audioRef.current) audioRef.current.value = "";
    try {
      const url = await uploadFileLocal(file, token, "requests");
      setAudioUrl(url);
      setAudioName(file.name);
    } catch {
      toast({ title: "فشل رفع الصوت", variant: "destructive" });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        try {
          const url = await uploadFileLocal(blob, token, "requests");
          setAudioUrl(url);
          setAudioName("تسجيل صوتي مباشر");
        } catch {
          toast({ title: "خطأ في رفع التسجيل", variant: "destructive" });
        }
      };
      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: "تعذر الوصول للميكروفون", description: "تأكد من منح صلاحية الميكروفون", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const clearAudio = () => {
    setAudioUrl(null);
    setAudioName("");
    if (audioRef.current) audioRef.current.value = "";
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const onSubmit = (values: z.infer<typeof schema>) => {
    if (createMutation.isPending || createMutation.isSuccess) return;
    createMutation.mutate({
      data: {
        serviceId: parseInt(values.serviceId),
        fullName: values.fullName,
        mobile: values.mobile,
        governorateId: parseInt(values.governorateId),
        areaId: parseInt(values.areaId),
        address: values.address,
        description: values.description,
        images,
        audioUrl: audioUrl || undefined,
      } as any,
    });
  };

  // Map schema field names → their data-testid selector in the DOM
  const FIELD_SELECTOR: Record<string, string> = {
    serviceId:     '[data-testid="select-service"]',
    fullName:      '[data-testid="input-fullname"]',
    mobile:        '[data-testid="input-mobile"]',
    governorateId: '[data-testid="select-governorate"]',
    areaId:        '[data-testid="select-area"]',
    address:       '[data-testid="input-address"]',
    description:   '[data-testid="textarea-description"]',
  };

  const onInvalid = useCallback((errors: FieldErrors<z.infer<typeof schema>>) => {
    const fieldOrder = ["serviceId", "fullName", "mobile", "governorateId", "areaId", "address", "description"] as const;
    for (const field of fieldOrder) {
      if (errors[field]) {
        const el = document.querySelector(FIELD_SELECTOR[field]) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // HTMLInputElement / HTMLTextAreaElement support focus(); SelectTrigger is a button
          el.focus?.();
        }
        break;
      }
    }
  }, []);

  /* ── derived UI values ── */
  const serviceEmoji = selectedService
    ? selectedService.icon || getServiceEmoji(selectedService.nameAr)
    : null;
  const descValue = form.watch("description") || "";

  return (
    <div className="min-h-screen bg-muted/20" dir="rtl">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-l from-primary to-primary/80 px-5 pt-6 pb-8 relative overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute -top-6 -left-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-4 right-10 w-16 h-16 rounded-full bg-white/10 pointer-events-none" />

        <div className="relative max-w-2xl mx-auto flex items-center gap-3.5">
          {/* Service icon bubble */}
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-md border border-white/30 p-2.5">
            {selectedService?.image ? (
              <img src={selectedService.image} alt="" className="w-full h-full object-contain" />
            ) : serviceEmoji ? (
              <span className="text-2xl leading-none">{serviceEmoji}</span>
            ) : (
              <Wrench className="w-full h-full text-white" />
            )}
          </div>

          <div>
            <h1 className="text-xl font-black text-primary-foreground leading-tight">
              {selectedService ? selectedService.nameAr : "طلب خدمة جديد"}
            </h1>
            <p className="text-primary-foreground/75 text-sm mt-0.5">
              أملأ البيانات وسنجد لك أفضل الفنيين
            </p>
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="max-w-2xl mx-auto px-4 -mt-4 pb-10 space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">

            {/* ═══ Card 1: نوع الخدمة ═══ */}
            <SectionCard
              icon={<Wrench className="w-4 h-4" />}
              title="نوع الخدمة"
              subtitle="اختر الخدمة التي تحتاجها"
              iconBg="bg-primary/10"
              iconColor="text-primary"
            >
              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      الخدمة <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          data-testid="select-service"
                          className="h-11 rounded-xl border-border/60 bg-background focus:ring-primary/30"
                        >
                          <SelectValue placeholder="اختر الخدمة المطلوبة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(services as any[]).filter((s: any) => s.isActive).map((s: any) => {
                          const emoji = s.icon || getServiceEmoji(s.nameAr);
                          return (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              <span className="flex items-center gap-2">
                                {emoji && <span className="text-base leading-none">{emoji}</span>}
                                {s.nameAr}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SectionCard>

            {/* ═══ Card 2: البيانات الشخصية ═══ */}
            <SectionCard
              icon={<User className="w-4 h-4" />}
              title="البيانات الشخصية"
              subtitle="بيانات التواصل معك"
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-muted-foreground">
                        الاسم الكامل <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="relative">
                        <User className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-muted-foreground/50 pointer-events-none z-10" />
                        <FormControl>
                          <Input
                            placeholder="اسمك الكامل"
                            data-testid="input-fullname"
                            className="h-11 rounded-xl border-border/60 pe-9"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-muted-foreground">
                        رقم الهاتف <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="relative">
                        <Phone className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-muted-foreground/50 pointer-events-none z-10" />
                        <FormControl>
                          <Input
                            placeholder="01xxxxxxxxx"
                            data-testid="input-mobile"
                            className="h-11 rounded-xl border-border/60 pe-9"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SectionCard>

            {/* ═══ Card 3: الموقع ═══ */}
            <SectionCard
              icon={<MapPin className="w-4 h-4" />}
              title="الموقع"
              subtitle="أين تريد الخدمة؟"
              iconBg="bg-green-50"
              iconColor="text-green-600"
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="governorateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-muted-foreground">
                        المحافظة <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={(v) => { field.onChange(v); form.setValue("areaId", ""); }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-governorate" className="h-11 rounded-xl border-border/60">
                            <SelectValue placeholder="اختر المحافظة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(governorates as any[]).map((g: any) => (
                            <SelectItem key={g.id} value={g.id.toString()}>{g.nameAr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="areaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-muted-foreground">
                        المنطقة <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedGovId}>
                        <FormControl>
                          <SelectTrigger data-testid="select-area" className="h-11 rounded-xl border-border/60">
                            <SelectValue placeholder={selectedGovId ? "اختر المنطقة" : "اختر محافظة أولاً"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(areas as any[]).map((a: any) => (
                            <SelectItem key={a.id} value={a.id.toString()}>{a.nameAr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-muted-foreground">
                      العنوان التفصيلي <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="relative">
                      <MapPin className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-muted-foreground/50 pointer-events-none z-10" />
                      <FormControl>
                        <Input
                          placeholder="الشارع، البناية، الدور..."
                          data-testid="input-address"
                          className="h-11 rounded-xl border-border/60 pe-9"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SectionCard>

            {/* ═══ Card 4: وصف المشكلة ═══ */}
            <SectionCard
              icon={<FileText className="w-4 h-4" />}
              title="وصف المشكلة"
              subtitle="اشرح المشكلة بالتفصيل ليتمكن الفنيون من مساعدتك"
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            >
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="صف المشكلة بالتفصيل لمساعدة الفنيين... (متى بدأت، ما الأعراض، هل جربت أي حل سابق؟)"
                        rows={5}
                        data-testid="textarea-description"
                        className="rounded-xl border-border/60 resize-none leading-relaxed"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-center justify-between mt-1">
                      <FormMessage />
                      <span className={cn(
                        "text-xs ms-auto tabular-nums",
                        descValue.length < 10 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {descValue.length} حرف
                      </span>
                    </div>
                  </FormItem>
                )}
              />
            </SectionCard>

            {/* ═══ Card 5: المرفقات ═══ */}
            <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border bg-muted/30">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50">
                  <ImagePlus className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground leading-tight">المرفقات</p>
                  <p className="text-xs text-muted-foreground mt-0.5">صور وتسجيل صوتي (اختياري)</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* ── Images sub-section ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">صور المشكلة</p>
                      <p className="text-xs text-muted-foreground">
                        {images.length}/6 صور • JPG, PNG, WEBP
                      </p>
                    </div>
                    {images.length > 0 && images.length < 6 && (
                      <ImagePicker
                        onFiles={handleImagesChange}
                        multiple
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        captureMode="environment"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs rounded-lg gap-1.5"
                          disabled={uploadingImages}
                        >
                          <ImagePlus className="w-3.5 h-3.5" />
                          إضافة
                        </Button>
                      </ImagePicker>
                    )}
                  </div>

                  {images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border/50 group shadow-sm">
                          <CldImg src={src} alt="" width={600} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          <button
                            type="button"
                            onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                            className="absolute top-1.5 start-1.5 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-1.5 end-1.5 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                            {i + 1}
                          </div>
                        </div>
                      ))}
                      {images.length < 6 && (
                        <ImagePicker
                          onFiles={handleImagesChange}
                          multiple
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          captureMode="environment"
                        >
                          <button
                            type="button"
                            disabled={uploadingImages}
                            className="aspect-square rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                          >
                            {uploadingImages ? (
                              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            ) : (
                              <>
                                <ImagePlus className="w-6 h-6 text-primary/40" />
                                <span className="text-[10px] text-muted-foreground">إضافة</span>
                              </>
                            )}
                          </button>
                        </ImagePicker>
                      )}
                    </div>
                  ) : (
                    <ImagePicker
                      onFiles={handleImagesChange}
                      multiple
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      captureMode="environment"
                    >
                      <button
                        type="button"
                        disabled={uploadingImages}
                        className="w-full border-2 border-dashed border-primary/20 rounded-xl py-7 flex flex-col items-center gap-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                      >
                        {uploadingImages ? (
                          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                              <ImagePlus className="w-6 h-6 text-primary/60" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-foreground/70">اضغط لإضافة صور</p>
                              <p className="text-xs text-muted-foreground mt-0.5">أو التقط صورة مباشرة</p>
                            </div>
                          </>
                        )}
                      </button>
                    </ImagePicker>
                  )}

                  {/* Helper text — always visible below the upload control */}
                  <p className="text-xs text-muted-foreground text-center mt-2 px-1 leading-relaxed">
                    للحصول على سعر دقيق، يُفضل إرفاق صور واضحة للمشكلة.
                  </p>
                </div>

                {/* divider */}
                <div className="border-t border-border/50" />

                {/* ── Audio sub-section ── */}
                <div>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-foreground">تسجيل صوتي</p>
                    <p className="text-xs text-muted-foreground">سجّل مباشرة أو ارفع ملفاً • MP3, WAV, M4A</p>
                  </div>

                  {audioUrl ? (
                    /* ── Recorded/uploaded audio player ── */
                    <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/15 rounded-xl">
                      <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Volume2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{audioName}</p>
                        <audio controls src={audioUrl} className="w-full mt-1.5 h-8" />
                      </div>
                      <button
                        type="button"
                        onClick={clearAudio}
                        className="w-8 h-8 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center text-destructive transition-colors flex-shrink-0"
                        title="حذف التسجيل"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : isRecording ? (
                    /* ── Active recording indicator ── */
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Circle className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
                        <span className="text-base font-mono font-bold text-red-600 tabular-nums">{formatTime(recordingSeconds)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-700">جاري التسجيل...</p>
                        <div className="flex gap-0.5 mt-1.5 h-3 items-end">
                          {[3,5,2,6,4,7,3,5,2,6,4,7].map((h, i) => (
                            <div
                              key={i}
                              className="w-1 bg-red-400 rounded-full animate-pulse"
                              style={{ height: `${h * 2}px`, animationDelay: `${i * 80}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={stopRecording}
                        data-testid="button-stop-recording"
                        className="rounded-lg gap-1.5 h-9"
                      >
                        <Square className="w-3 h-3" />
                        إيقاف
                      </Button>
                    </div>
                  ) : (
                    /* ── Record / upload idle buttons ── */
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={startRecording}
                        data-testid="button-start-recording"
                        className="border-2 border-dashed border-red-200 rounded-xl py-5 flex flex-col items-center gap-2.5 hover:border-red-400 hover:bg-red-50 transition-colors group"
                      >
                        <div className="w-11 h-11 rounded-2xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                          <Mic className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground/70">تسجيل مباشر</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">اضغط للبدء</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => audioRef.current?.click()}
                        className="border-2 border-dashed border-border/40 rounded-xl py-5 flex flex-col items-center gap-2.5 hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                      >
                        <div className="w-11 h-11 rounded-2xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                          <Volume2 className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground/70">رفع ملف صوتي</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">MP3, WAV, M4A</p>
                        </div>
                      </button>
                    </div>
                  )}

                  <input
                    ref={audioRef}
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,.m4a,audio/m4a"
                    className="hidden"
                    onChange={handleAudioChange}
                  />
                </div>
              </div>
            </div>

            {/* ═══ Submit ═══ */}
            <div className="pt-1 pb-2">
              <Button
                type="submit"
                data-testid="button-submit"
                disabled={createMutation.isPending || createMutation.isSuccess}
                className="w-full h-14 rounded-2xl text-base font-black shadow-lg shadow-primary/25 gap-2.5 transition-all active:scale-[.98]"
                style={{
                  background: (createMutation.isPending || createMutation.isSuccess)
                    ? undefined
                    : "linear-gradient(135deg, hsl(43 85% 62%), hsl(43 80% 50%))",
                }}
              >
                {createMutation.isPending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    إرسال الطلب
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3">
                سيصلك إشعار فور تقدم الفنيين بعروضهم
              </p>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
