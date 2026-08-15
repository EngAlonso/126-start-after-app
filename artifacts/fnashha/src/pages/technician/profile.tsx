import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetMe, getGetMeQueryKey, useUpdateUser, useGetTechnicianProfile, getGetTechnicianProfileQueryKey, useListAreas, getListAreasQueryKey, useListServices } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { User, Star, Camera, Lock, MapPin, Info, Briefcase, ChevronDown, ChevronUp, Check, HeadphonesIcon, ChevronLeft, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { APPROVAL_STATUS_MAP } from "@/lib/status";
import { uploadFileLocal } from "@/lib/uploadMedia";
import { ImagePicker } from "@/components/ui/image-picker";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const schema = z.object({
  fullName:        z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
  email:           z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  currentPassword: z.string().optional(),
  newPassword:     z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(
  (data) => {
    if (data.newPassword && !data.currentPassword) return false;
    return true;
  },
  { message: "يرجى إدخال كلمة المرور الحالية", path: ["currentPassword"] }
).refine(
  (data) => {
    if (data.newPassword && data.newPassword.length < 6) return false;
    return true;
  },
  { message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل", path: ["newPassword"] }
).refine(
  (data) => {
    if (data.newPassword && data.newPassword !== data.confirmPassword) return false;
    return true;
  },
  { message: "كلمة المرور الجديدة وتأكيدها غير متطابقين", path: ["confirmPassword"] }
);

export default function TechnicianProfile() {
  const { currentUser, token, logout } = useAuth();
  const [, navigate] = useLocation();
  const logoutMutation = useLogout();
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savingExp, setSavingExp] = useState(false);
  const [editingExp, setEditingExp] = useState(false);
  const [selectedExp, setSelectedExp] = useState<string>("");

  const [editingServices, setEditingServices] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [savingServices, setSavingServices] = useState(false);
  const [expandedGovIds, setExpandedGovIds] = useState<Set<string>>(new Set());

  const EXPERIENCE_OPTIONS = [
    { value: "1", label: "سنة واحدة" },
    { value: "2", label: "سنتان" },
    { value: "3", label: "3 سنوات" },
    { value: "5", label: "5 سنوات" },
    { value: "7", label: "7 سنوات" },
    { value: "10", label: "10 سنوات" },
    { value: "15", label: "15 سنة" },
    { value: "20", label: "20 سنة أو أكثر" },
  ];

  const { data: me }      = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: profile } = useGetTechnicianProfile(currentUser?.id!, {
    query: { enabled: !!currentUser?.id, queryKey: getGetTechnicianProfileQueryKey(currentUser?.id!) },
  });

  const updateMutation = useUpdateUser();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: currentUser?.fullName || "",
      email: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const p = profile as any;
  const u = me     as any;
  const approvalStatus = APPROVAL_STATUS_MAP[p?.approvalStatus] || { label: "غير معروف", color: "bg-gray-100" };

  useEffect(() => {
    if (me) {
      form.reset({
        fullName:        u.fullName  || "",
        email:           u.email     || "",
        currentPassword: "",
        newPassword:     "",
        confirmPassword: "",
      });
    }
  }, [me]);

  /* Areas state */
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [savingAreas, setSavingAreas] = useState(false);

  const { data: areasData, isLoading: areasLoading } = useListAreas(undefined as any, {
    query: { queryKey: getListAreasQueryKey() },
  });
  const allAreas = (Array.isArray(areasData) ? areasData : []).filter((a: any) => a.isActive !== false);

  const { data: servicesData } = useListServices();
  const allServices = (Array.isArray(servicesData) ? servicesData : []).filter((s: any) => s.isActive !== false) as any[];

  useEffect(() => {
    if (p?.areas) {
      setSelectedAreaIds(p.areas.map((a: any) => a.id).filter(Boolean));
    }
  }, [profile]);

  useEffect(() => {
    if (p?.services) {
      setSelectedServiceIds(p.services.map((s: any) => s.id).filter(Boolean));
    }
  }, [profile]);

  const toggleArea = (id: number) => {
    setSelectedAreaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleService = (id: number) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleGovProfile = (name: string) => {
    setExpandedGovIds((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    if (p?.yearsOfExperience) {
      setSelectedExp(String(p.yearsOfExperience));
    }
  }, [profile]);

  const handleSaveExp = async () => {
    if (!token || !currentUser?.id) return;
    setSavingExp(true);
    try {
      const res = await fetch(`${BASE_URL}/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ yearsOfExperience: selectedExp ? parseInt(selectedExp) : null }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getGetTechnicianProfileQueryKey(currentUser.id) });
      toast({ title: "تم حفظ سنوات الخبرة" });
      setEditingExp(false);
    } catch {
      toast({ title: "خطأ في الحفظ", variant: "destructive" });
    } finally {
      setSavingExp(false);
    }
  };

  const handleSaveAreas = async () => {
    if (!token || !currentUser?.id) return;
    setSavingAreas(true);
    try {
      const res = await fetch(`${BASE_URL}/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ areaIds: selectedAreaIds }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getGetTechnicianProfileQueryKey(currentUser.id) });
      toast({ title: "تم حفظ المناطق" });
    } catch {
      toast({ title: "خطأ في حفظ المناطق", variant: "destructive" });
    } finally {
      setSavingAreas(false);
    }
  };

  const handleSaveServices = async () => {
    if (!token || !currentUser?.id) return;
    if (selectedServiceIds.length === 0) {
      toast({ title: "اختر خدمة واحدة على الأقل", variant: "destructive" });
      return;
    }
    setSavingServices(true);
    try {
      const res = await fetch(`${BASE_URL}/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: selectedServiceIds }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getGetTechnicianProfileQueryKey(currentUser.id) });
      toast({ title: "تم حفظ الخدمات" });
      setEditingServices(false);
    } catch {
      toast({ title: "خطأ في حفظ الخدمات", variant: "destructive" });
    } finally {
      setSavingServices(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof schema>) => {
    const payload: Record<string, any> = {
      fullName: values.fullName,
      email:    values.email || undefined,
    };
    if (values.newPassword && values.currentPassword) {
      payload.currentPassword = values.currentPassword;
      payload.newPassword     = values.newPassword;
    }

    updateMutation.mutate(
      { id: currentUser!.id, data: payload as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          form.setValue("currentPassword", "");
          form.setValue("newPassword", "");
          form.setValue("confirmPassword", "");
          toast({ title: "تم حفظ التغييرات" });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || "حدث خطأ";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handlePhotoChange = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً", description: "الحجم الأقصى 5 ميجابايت", variant: "destructive" });
      return;
    }
    try {
      const url = await uploadFileLocal(file, token || null, "profiles");
      updateMutation.mutate(
        { id: currentUser!.id, data: { profileImage: url } as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTechnicianProfileQueryKey(currentUser?.id!) });
            toast({ title: "تم تحديث صورة الملف الشخصي" });
          },
          onError: () => toast({ title: "خطأ في تحديث الصورة", variant: "destructive" }),
        }
      );
    } catch {
      toast({ title: "خطأ في رفع الصورة", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "تم حذف حسابك بنجاح" });
      logout();
      navigate("/");
    } catch {
      toast({ title: "خطأ في حذف الحساب", variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  /* Group areas by governorate */
  const areasByGov = allAreas.reduce<Record<string, any[]>>((acc, area) => {
    const govName = area.governorate?.nameAr || "أخرى";
    if (!acc[govName]) acc[govName] = [];
    acc[govName].push(area);
    return acc;
  }, {});

  const handleMobileLogout = () => {
    logoutMutation.mutate(undefined as any);
    logout();
  };

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto space-y-3 md:space-y-6">
      <h1 className="text-lg md:text-2xl font-bold">ملفي الشخصي</h1>

      {/* Mobile-only: quick links (support, logout) */}
      <div className="md:hidden space-y-1.5">
        <Link href="/technician/support" style={{ textDecoration: "none" }}>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <HeadphonesIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">الدعم والمساعدة</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
        <button
          onClick={handleMobileLogout}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-destructive/30 bg-card hover:bg-destructive/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-5 h-5 text-destructive" />
            <span className="text-sm font-medium text-destructive">تسجيل الخروج</span>
          </div>
        </button>
      </div>

      {/* Status / overview card */}
      {p && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {u?.profileImage ? (
                    <img
                      src={u.profileImage}
                      alt="صورة الملف الشخصي"
                      className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                  )}
                  <ImagePicker onFiles={handlePhotoChange} captureMode="user" accept="image/jpeg,image/jpg,image/png,image/webp">
                    <button
                      type="button"
                      className="absolute bottom-0 left-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
                      title="تغيير الصورة"
                      data-testid="button-change-photo"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </ImagePicker>
                </div>
                <div>
                  <p className="font-bold text-lg">{currentUser?.fullName}</p>
                  <p className="text-sm text-muted-foreground">{currentUser?.mobile}</p>
                </div>
              </div>
              <div className="text-left flex flex-col items-end gap-1">
                <Badge className={`${approvalStatus.color} border-0`}>{approvalStatus.label}</Badge>
                {p.averageRating > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {p.averageRating?.toFixed(1)}
                    {p.reviewCount > 0 && <span className="text-xs">({p.reviewCount})</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-black">{p.pointsBalance || 0}</p>
                <p className="text-xs text-muted-foreground">رصيد النقاط</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black">{p.reviewCount || 0}</p>
                <p className="text-xs text-muted-foreground">تقييمات</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit form */}
      <Card>
        <CardHeader><CardTitle className="text-base">تعديل البيانات</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الكامل</FormLabel>
                  <FormControl><Input data-testid="input-fullname" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني (اختياري)</FormLabel>
                  <FormControl><Input type="email" data-testid="input-email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Password section */}
              <div className="pt-2 border-t">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  تغيير كلمة المرور (اختياري)
                </p>
                <div className="space-y-3">
                  <FormField control={form.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الحالية</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="أدخل كلمة المرور الحالية" data-testid="input-current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الجديدة</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="6 أحرف على الأقل" data-testid="input-new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>تأكيد كلمة المرور الجديدة</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="أعد إدخال كلمة المرور" data-testid="input-confirm-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={updateMutation.isPending}
                data-testid="button-save"
              >
                {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Services — READ ONLY */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            الخدمات المقدمة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(p?.services || []).length > 0
              ? p.services.map((s: any) => (
                  <Badge key={s?.id} variant="secondary" className="text-sm px-3 py-1">
                    {s?.nameAr || s?.name}
                  </Badge>
                ))
              : <span className="text-sm text-muted-foreground">لم يتم تحديد خدمات بعد</span>}
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
            لتعديل الخدمات برجاء التواصل مع الإدارة
          </p>
        </CardContent>
      </Card>

      {/* Experience — READ ONLY */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            سنوات الخبرة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <span className="text-foreground font-medium">
            {p?.yearsOfExperience
              ? (EXPERIENCE_OPTIONS.find(o => o.value === String(p.yearsOfExperience))?.label || `${p.yearsOfExperience} سنوات`)
              : <span className="text-muted-foreground text-sm">غير محدد</span>}
          </span>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
            لتعديل سنوات الخبرة برجاء التواصل مع الإدارة
          </p>
        </CardContent>
      </Card>

      {/* Areas — EDITABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            المناطق المغطاة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {areasLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : Object.keys(areasByGov).length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مناطق متاحة</p>
          ) : (
            <div className="border rounded-xl overflow-hidden divide-y divide-border">
              {Object.entries(areasByGov).map(([govName, areas]) => {
                const isExpanded = expandedGovIds.has(govName);
                const selectedCount = (areas as any[]).filter((a) => selectedAreaIds.includes(a.id)).length;
                const allSelected = selectedCount === (areas as any[]).length && (areas as any[]).length > 0;
                return (
                  <div key={govName}>
                    <button
                      type="button"
                      onClick={() => toggleGovProfile(govName)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-right"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{govName}</span>
                        {selectedCount > 0 && (
                          <span className="text-[11px] bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-bold leading-none">
                            {selectedCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              const ids = (areas as any[]).map((a) => a.id);
                              if (allSelected) {
                                setSelectedAreaIds((prev) => prev.filter((id) => !ids.includes(id)));
                              } else {
                                setSelectedAreaIds((prev) => [...new Set([...prev, ...ids])]);
                              }
                            }}
                            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()}
                            className="text-[11px] text-primary hover:underline cursor-pointer"
                          >
                            {allSelected ? "إلغاء الكل" : "اختيار الكل"}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                        {(areas as any[]).map((area) => {
                          const selected = selectedAreaIds.includes(area.id);
                          return (
                            <button
                              key={area.id}
                              type="button"
                              onClick={() => toggleArea(area.id)}
                              data-testid={`area-btn-${area.id}`}
                              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border text-right transition-all
                                ${selected ? "bg-primary/10 border-primary text-primary font-semibold" : "bg-background border-border text-foreground hover:border-primary/40"}`}
                            >
                              <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${selected ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"}`}>
                                {selected && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                              {area.nameAr || area.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Button
            onClick={handleSaveAreas}
            disabled={savingAreas || areasLoading}
            variant="outline"
            className="w-full"
            data-testid="button-save-areas"
          >
            {savingAreas ? "جاري الحفظ..." : "حفظ المناطق"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Delete Account ─────────────────────────── */}
      <div className="pt-6 border-t border-border">
        <h3 className="text-sm font-semibold text-destructive mb-1">منطقة الخطر</h3>
        <p className="text-xs text-muted-foreground mb-3">
          حذف حسابك سيؤدي إلى إلغاء وصولك نهائياً. هذا الإجراء لا يمكن التراجع عنه.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => setShowDelete(true)}
          data-testid="button-delete-account"
        >
          حذف الحساب
        </Button>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف حسابك؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف حسابك بشكل دائم ولن تتمكن من استعادته. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="سبب الحذف (اختياري)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            className="text-sm mt-2"
            rows={3}
          />
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "جاري الحذف..." : "تأكيد الحذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
