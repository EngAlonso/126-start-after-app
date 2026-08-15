import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListServices, useListGovernorates, useListAreas } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gift, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X, CheckCircle, XCircle, Play, History } from "lucide-react";
import { Link } from "wouter";
import { useAdminListState } from "@/hooks/use-admin-list-state";

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

const EMPTY_FORM = {
  name: "", nameAr: "", description: "",
  notificationTitle: "", notificationBody: "",
  coinsAmount: "",
  target: "all_customers" as "all_customers" | "manual" | "registration_range" | "inactive_customers" | "service_based" | "location_based" | "spending_based" | "completed_services",
  inactivityDays: "",
  serviceId: "",
  serviceUsage: "used" as "used" | "not_used",
  locationType: "governorate" as "governorate" | "area",
  governorateId: "",
  areaId: "",
  locationActivity: "used" as "used" | "not_used",
  minimumSpending: "",
  spendingPeriod: "all_time" as "all_time" | "custom",
  spendingStartsAt: "",
  spendingEndsAt: "",
  minimumCompletedServices: "",
  completedServicesPeriod: "all_time" as "all_time" | "custom",
  completedServicesStartsAt: "",
  completedServicesEndsAt: "",
  isActive: false, startsAt: "", endsAt: "",
};

const EGYPT_TIME_ZONE = "Africa/Cairo";

function formatEgyptDateTimeInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default function AdminLoyaltyCampaigns() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { params, updateQuery } = useAdminListState();

  const page = Math.max(1, Number(params.get("page") || "1"));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [executing, setExecuting] = useState<number | null>(null);

  const { data: services = [] } = useListServices();
  const serviceList = Array.isArray(services) ? services : [];
  const { data: governorates = [] } = useListGovernorates();
  const governorateList = Array.isArray(governorates) ? governorates : [];
  const locationAreaParams = form.target === "location_based" && form.locationType === "area" && form.governorateId
    ? { governorateId: Number(form.governorateId) }
    : undefined;
  const { data: areas = [] } = useListAreas(locationAreaParams, {
    query: {
      queryKey: ["adminLoyaltyCampaignAreas", locationAreaParams?.governorateId],
      enabled: Boolean(locationAreaParams),
    },
  });
  const areaList = Array.isArray(areas) ? areas : [];

  const { data, isLoading } = useQuery({
    queryKey: ["adminLoyaltyCampaigns", page],
    queryFn: () => apiCall(`/loyalty/admin/campaigns?page=${page}&limit=20`, "GET", undefined, token || ""),
    retry: false,
    placeholderData: (prev) => prev,
  });

  const campaigns: any[] = data?.campaigns ?? [];
  const total: number    = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c: any) {
    setEditing(c);
    setForm({
      name:        c.name,
      nameAr:      c.nameAr,
      description: c.description || "",
      notificationTitle: typeof c.notificationTitle === "string" ? c.notificationTitle : "",
      notificationBody: typeof c.notificationBody === "string" ? c.notificationBody : "",
      coinsAmount: String(c.coinsAmount),
      target:      c.target,
      inactivityDays: c.segmentFilter?.inactivityDays != null ? String(c.segmentFilter.inactivityDays) : "",
      serviceId: c.segmentFilter?.serviceId != null ? String(c.segmentFilter.serviceId) : "",
      serviceUsage: c.segmentFilter?.serviceUsage === "not_used" ? "not_used" : "used",
      locationType: c.segmentFilter?.locationType === "area" ? "area" : "governorate",
      governorateId: c.segmentFilter?.governorateId != null ? String(c.segmentFilter.governorateId) : "",
      areaId: c.segmentFilter?.areaId != null ? String(c.segmentFilter.areaId) : "",
      locationActivity: c.segmentFilter?.activity === "not_used" ? "not_used" : "used",
      minimumSpending: c.segmentFilter?.minimumSpending != null ? String(c.segmentFilter.minimumSpending) : "",
      spendingPeriod: c.segmentFilter?.spendingPeriod === "custom" ? "custom" : "all_time",
      spendingStartsAt: c.target === "spending_based" && c.segmentFilter?.spendingPeriod === "custom"
        ? formatEgyptDateTimeInput(c.segmentFilter.startsAt)
        : "",
      spendingEndsAt: c.target === "spending_based" && c.segmentFilter?.spendingPeriod === "custom"
        ? formatEgyptDateTimeInput(c.segmentFilter.endsAt)
        : "",
      minimumCompletedServices: c.segmentFilter?.minimumCompletedServices != null
        ? String(c.segmentFilter.minimumCompletedServices)
        : "",
      completedServicesPeriod: c.segmentFilter?.completedServicesPeriod === "custom" ? "custom" : "all_time",
      completedServicesStartsAt: c.target === "completed_services" && c.segmentFilter?.completedServicesPeriod === "custom"
        ? formatEgyptDateTimeInput(c.segmentFilter.startsAt)
        : "",
      completedServicesEndsAt: c.target === "completed_services" && c.segmentFilter?.completedServicesPeriod === "custom"
        ? formatEgyptDateTimeInput(c.segmentFilter.endsAt)
        : "",
      isActive:    c.isActive,
      startsAt:    c.target === "registration_range"
        ? formatEgyptDateTimeInput(c.startsAt)
        : c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : "",
      endsAt:      c.target === "registration_range"
        ? formatEgyptDateTimeInput(c.endsAt)
        : c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 16) : "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.nameAr.trim()) {
      toast({ title: "خطأ", description: "الاسم بالعربي والإنجليزي مطلوبان", variant: "destructive" });
      return;
    }
    const coins = parseInt(form.coinsAmount);
    if (isNaN(coins) || coins <= 0) {
      toast({ title: "خطأ", description: "عدد الكوينز يجب أن يكون رقماً موجباً", variant: "destructive" });
      return;
    }
    const notificationTitle = form.notificationTitle.trim();
    const notificationBody = form.notificationBody.trim();
    if ((notificationTitle && !notificationBody) || (!notificationTitle && notificationBody)) {
      toast({ title: "خطأ", description: "يجب إدخال عنوان ورسالة الإشعار معاً", variant: "destructive" });
      return;
    }
    if (Array.from(notificationTitle).length > 100) {
      toast({ title: "خطأ", description: "عنوان الإشعار يجب ألا يتجاوز 100 حرف", variant: "destructive" });
      return;
    }
    if (Array.from(notificationBody).length > 500) {
      toast({ title: "خطأ", description: "رسالة الإشعار يجب ألا تتجاوز 500 حرف", variant: "destructive" });
      return;
    }
    if (/<[^>]*>/i.test(notificationTitle) || /<[^>]*>/i.test(notificationBody)) {
      toast({ title: "خطأ", description: "الإشعار يقبل نصاً فقط ولا يسمح بوسوم HTML", variant: "destructive" });
      return;
    }
    if (form.target === "registration_range") {
      if (!form.startsAt || !form.endsAt) {
        toast({ title: "خطأ", description: "يجب تحديد بداية ونهاية فترة تسجيل العملاء", variant: "destructive" });
        return;
      }
      if (form.startsAt > form.endsAt) {
        toast({ title: "خطأ", description: "يجب أن تكون بداية فترة التسجيل قبل أو مساوية للنهاية", variant: "destructive" });
        return;
      }
    }
    const inactivityDays = form.target === "inactive_customers"
      ? parseInt(form.inactivityDays, 10)
      : undefined;
    if (form.target === "inactive_customers" && (!Number.isInteger(inactivityDays) || inactivityDays! < 1)) {
      toast({ title: "خطأ", description: "يجب تحديد فترة عدم النشاط بالأيام (رقم صحيح موجب)", variant: "destructive" });
      return;
    }
    const serviceId = form.target === "service_based"
      ? parseInt(form.serviceId, 10)
      : undefined;
    if (form.target === "service_based" && (!Number.isInteger(serviceId) || serviceId! < 1)) {
      toast({ title: "خطأ", description: "يجب اختيار خدمة للحملة", variant: "destructive" });
      return;
    }
    const governorateId = form.target === "location_based"
      ? parseInt(form.governorateId, 10)
      : undefined;
    if (form.target === "location_based" && (!Number.isInteger(governorateId) || governorateId! < 1)) {
      toast({ title: "خطأ", description: "يجب اختيار المحافظة للحملة", variant: "destructive" });
      return;
    }
    const areaId = form.target === "location_based" && form.locationType === "area"
      ? parseInt(form.areaId, 10)
      : undefined;
    if (form.target === "location_based" && form.locationType === "area" && (!Number.isInteger(areaId) || areaId! < 1)) {
      toast({ title: "خطأ", description: "يجب اختيار المنطقة للحملة", variant: "destructive" });
      return;
    }
    const minimumSpending = form.target === "spending_based"
      ? Number(form.minimumSpending)
      : undefined;
    if (form.target === "spending_based" && (!Number.isFinite(minimumSpending) || minimumSpending! <= 0)) {
      toast({ title: "خطأ", description: "يجب تحديد حد أدنى للإنفاق أكبر من صفر", variant: "destructive" });
      return;
    }
    if (form.target === "spending_based" && form.spendingPeriod === "custom") {
      if (!form.spendingStartsAt || !form.spendingEndsAt) {
        toast({ title: "خطأ", description: "يجب تحديد بداية ونهاية فترة احتساب الإنفاق", variant: "destructive" });
        return;
      }
      if (form.spendingStartsAt > form.spendingEndsAt) {
        toast({ title: "خطأ", description: "يجب أن تكون بداية فترة الإنفاق قبل أو مساوية للنهاية", variant: "destructive" });
        return;
      }
    }
    const minimumCompletedServices = form.target === "completed_services"
      ? parseInt(form.minimumCompletedServices, 10)
      : undefined;
    if (form.target === "completed_services" && (!Number.isInteger(minimumCompletedServices) || minimumCompletedServices! < 1)) {
      toast({ title: "خطأ", description: "يجب تحديد حد أدنى صحيح للخدمات المكتملة (رقم صحيح موجب)", variant: "destructive" });
      return;
    }
    if (form.target === "completed_services" && form.completedServicesPeriod === "custom") {
      if (!form.completedServicesStartsAt || !form.completedServicesEndsAt) {
        toast({ title: "خطأ", description: "يجب تحديد بداية ونهاية فترة احتساب الخدمات المكتملة", variant: "destructive" });
        return;
      }
      if (form.completedServicesStartsAt > form.completedServicesEndsAt) {
        toast({ title: "خطأ", description: "يجب أن تكون بداية فترة الخدمات المكتملة قبل أو مساوية للنهاية", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const {
        inactivityDays: _unused,
        serviceId: _serviceId,
        serviceUsage: _serviceUsage,
        locationType: _locationType,
        governorateId: _governorateId,
        areaId: _areaId,
        locationActivity: _locationActivity,
        minimumSpending: _minimumSpending,
        spendingPeriod: _spendingPeriod,
        spendingStartsAt: _spendingStartsAt,
        spendingEndsAt: _spendingEndsAt,
        minimumCompletedServices: _minimumCompletedServices,
        completedServicesPeriod: _completedServicesPeriod,
        completedServicesStartsAt: _completedServicesStartsAt,
        completedServicesEndsAt: _completedServicesEndsAt,
        ...formPayload
      } = form;
      const payload = {
        ...formPayload,
        notificationTitle: notificationTitle || null,
        notificationBody: notificationBody || null,
        coinsAmount: coins,
        ...(inactivityDays !== undefined ? { segmentFilter: { inactivityDays } } : {}),
        ...(serviceId !== undefined ? { segmentFilter: { serviceId, serviceUsage: form.serviceUsage } } : {}),
        ...(governorateId !== undefined ? {
          segmentFilter: {
            locationType: form.locationType,
            governorateId,
            ...(areaId !== undefined ? { areaId } : {}),
            activity: form.locationActivity,
          },
        } : {}),
        ...(form.target === "spending_based" ? {
          segmentFilter: {
            minimumSpending,
            spendingPeriod: form.spendingPeriod,
            ...(form.spendingPeriod === "custom" ? {
              startsAt: form.spendingStartsAt,
              endsAt: form.spendingEndsAt,
            } : {}),
          },
        } : {}),
        ...(form.target === "completed_services" ? {
          segmentFilter: {
            minimumCompletedServices,
            completedServicesPeriod: form.completedServicesPeriod,
            ...(form.completedServicesPeriod === "custom" ? {
              startsAt: form.completedServicesStartsAt,
              endsAt: form.completedServicesEndsAt,
            } : {}),
          },
        } : {}),
      };
      if (editing) {
        await apiCall(`/loyalty/admin/campaigns/${editing.id}`, "PUT", payload, token || "");
        toast({ title: "تم", description: "تم تحديث الحملة بنجاح" });
      } else {
        await apiCall("/loyalty/admin/campaigns", "POST", payload, token || "");
        toast({ title: "تم", description: "تم إنشاء الحملة بنجاح" });
      }
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["adminLoyaltyCampaigns"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد من حذف هذه الحملة؟")) return;
    setDeleting(id);
    try {
      await apiCall(`/loyalty/admin/campaigns/${id}`, "DELETE", undefined, token || "");
      toast({ title: "تم", description: "تم حذف الحملة" });
      qc.invalidateQueries({ queryKey: ["adminLoyaltyCampaigns"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  async function handleExecute(c: any) {
    if (!c.isActive) {
      toast({ title: "تنبيه", description: "الحملة غير نشطة — فعّلها أولاً قبل التنفيذ", variant: "destructive" });
      return;
    }
    if (!window.confirm(`هل تريد تنفيذ حملة "${c.nameAr}" الآن؟ سيتم توزيع ${c.coinsAmount} كوين على جميع العملاء المؤهلين.`)) return;
    setExecuting(c.id);
    try {
      const result = await apiCall(`/loyalty/admin/campaigns/${c.id}/execute`, "POST", undefined, token || "");
      toast({
        title: "تم التنفيذ بنجاح",
        description: `كوفئ ${result.customersRewarded} عميل بـ ${result.totalCoinsDistributed} كوين (${result.customersSkipped} تم تجاهلهم لأنهم استلموا الحملة من قبل)`,
      });
      qc.invalidateQueries({ queryKey: ["adminLoyaltyCampaigns"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setExecuting(null);
    }
  }

  async function toggleActive(c: any) {
    try {
      await apiCall(`/loyalty/admin/campaigns/${c.id}`, "PUT", { isActive: !c.isActive }, token || "");
      toast({ title: "تم", description: c.isActive ? "تم إيقاف الحملة" : "تم تفعيل الحملة" });
      qc.invalidateQueries({ queryKey: ["adminLoyaltyCampaigns"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">الحملات الترويجية</h1>
        <Badge variant="secondary" className="mr-auto">{total.toLocaleString("ar-EG")} حملة</Badge>
        <Link href="/admin/loyalty/campaigns/history">
          <Button size="sm" variant="outline" className="gap-1">
            <History className="w-4 h-4" />
            السجل
          </Button>
        </Link>
        <Button size="sm" onClick={openCreate} className="gap-1">
          <Plus className="w-4 h-4" />
          حملة جديدة
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{editing ? "تعديل الحملة" : "حملة جديدة"}</CardTitle>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">الاسم (عربي)</label>
                <Input value={form.nameAr} onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))} placeholder="اسم الحملة بالعربي" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">الاسم (إنجليزي)</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Campaign name" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">الوصف (اختياري)</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="وصف مختصر للحملة" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">عدد الكوينز</label>
                <Input type="number" min={1} value={form.coinsAmount} onChange={(e) => setForm((f) => ({ ...f, coinsAmount: e.target.value }))} placeholder="100" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">الاستهداف</label>
                <select
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value as any }))}
                  className="w-full border rounded-md px-2 h-10 text-sm bg-background"
                >
                  <option value="all_customers">جميع العملاء</option>
                  <option value="manual">يدوي</option>
                  <option value="registration_range">حسب تاريخ التسجيل</option>
                  <option value="inactive_customers">عملاء غير نشطين</option>
                  <option value="service_based">حسب استخدام خدمة</option>
                  <option value="location_based">حسب الموقع</option>
                  <option value="spending_based">حسب إجمالي الإنفاق</option>
                  <option value="completed_services">حسب عدد الخدمات المكتملة</option>
                </select>
              </div>
              {form.target === "registration_range" && (
                <p className="text-xs text-muted-foreground md:col-span-2">
                  العملاء الذين سجلوا بين هذين التاريخين سيحصلون على المكافأة عند الضغط على «تنفيذ الحملة» يدوياً. التوقيت حسب مصر.
                </p>
              )}
              {form.target === "inactive_customers" && (
                <p className="text-xs text-muted-foreground md:col-span-2">
                  هذه الحملة تكافئ العملاء الذين لم يكملوا طلب خدمة خلال فترة عدم النشاط المحددة. التنفيذ يدوي عند الضغط على «تنفيذ الحملة».
                </p>
              )}
              {form.target === "inactive_customers" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">فترة عدم النشاط (بالأيام)</label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={form.inactivityDays}
                    onChange={(e) => setForm((f) => ({ ...f, inactivityDays: e.target.value }))}
                    placeholder="30"
                  />
                </div>
              )}
              {form.target === "service_based" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">الخدمة</label>
                    <Select value={form.serviceId} onValueChange={(value) => setForm((f) => ({ ...f, serviceId: value }))}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="اختر الخدمة" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceList.map((service: any) => (
                          <SelectItem key={service.id} value={String(service.id)}>
                            {service.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">نوع الاستخدام</label>
                    <Select value={form.serviceUsage} onValueChange={(value: "used" | "not_used") => setForm((f) => ({ ...f, serviceUsage: value }))}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="used">العملاء الذين استخدموا الخدمة</SelectItem>
                        <SelectItem value="not_used">العملاء الذين لم يستخدموا الخدمة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2">
                    {form.serviceUsage === "used"
                      ? "ستستهدف الحملة العملاء الذين أكملوا طلب خدمة واحداً على الأقل لهذه الخدمة."
                      : "ستستهدف الحملة العملاء الذين لم يكملوا أي طلب لهذه الخدمة."}
                    {" "}لا تُحتسب الطلبات غير المكتملة أو الملغاة، والتنفيذ يدوي عند الضغط على «تنفيذ الحملة».
                  </p>
                </>
              )}
              {form.target === "location_based" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">نوع الموقع</label>
                    <Select
                      value={form.locationType}
                      onValueChange={(value: "governorate" | "area") => setForm((f) => ({
                        ...f,
                        locationType: value,
                        areaId: value === "area" ? f.areaId : "",
                      }))}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="governorate">محافظة</SelectItem>
                        <SelectItem value="area">منطقة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">المحافظة</label>
                    <Select
                      value={form.governorateId}
                      onValueChange={(value) => setForm((f) => ({ ...f, governorateId: value, areaId: "" }))}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="اختر المحافظة" />
                      </SelectTrigger>
                      <SelectContent>
                        {governorateList.map((governorate: any) => (
                          <SelectItem key={governorate.id} value={String(governorate.id)}>
                            {governorate.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.locationType === "area" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">المنطقة</label>
                      <Select
                        value={form.areaId}
                        onValueChange={(value) => setForm((f) => ({ ...f, areaId: value }))}
                        disabled={!form.governorateId}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder={form.governorateId ? "اختر المنطقة" : "اختر المحافظة أولاً"} />
                        </SelectTrigger>
                        <SelectContent>
                          {areaList.map((area: any) => (
                            <SelectItem key={area.id} value={String(area.id)}>
                              {area.nameAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">نشاط العميل في الموقع</label>
                    <Select
                      value={form.locationActivity}
                      onValueChange={(value: "used" | "not_used") => setForm((f) => ({ ...f, locationActivity: value }))}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="used">استخدم الموقع</SelectItem>
                        <SelectItem value="not_used">لم يستخدم الموقع</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-3">
                    تستهدف الحملة العملاء حسب وجود طلب خدمة مكتمل في المحافظة أو المنطقة المختارة.
                    الطلبات غير المكتملة لا تُحتسب، والمكافأة تُوزّع فقط عند تنفيذ الحملة يدوياً.
                  </p>
                </>
              )}
              {form.target === "spending_based" && (
                <>
                  <p className="text-xs text-muted-foreground md:col-span-3">
                    تستهدف الحملة العملاء الذين يصل إجمالي ما دفعوه إلى الحد الأدنى المحدد للخدمات المكتملة فقط.
                    تُحتسب قيمة المبلغ الفعلي الذي دفعه العميل،
                    وتُوزّع المكافأة فقط عند تنفيذ الحملة يدوياً.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      الحد الأدنى لإجمالي الإنفاق (جنيه)
                    </label>
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={form.minimumSpending}
                      onChange={(e) => setForm((f) => ({ ...f, minimumSpending: e.target.value }))}
                      placeholder="1000"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      فترة احتساب الإنفاق
                    </label>
                    <Select
                      value={form.spendingPeriod}
                      onValueChange={(value: "all_time" | "custom") => setForm((f) => ({
                        ...f,
                        spendingPeriod: value,
                        ...(value === "all_time" ? { spendingStartsAt: "", spendingEndsAt: "" } : {}),
                      }))}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_time">منذ بداية الحساب</SelectItem>
                        <SelectItem value="custom">فترة محددة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.spendingPeriod === "custom" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          بداية فترة الإنفاق
                        </label>
                        <Input
                          type="datetime-local"
                          value={form.spendingStartsAt}
                          onChange={(e) => setForm((f) => ({ ...f, spendingStartsAt: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          نهاية فترة الإنفاق
                        </label>
                        <Input
                          type="datetime-local"
                          value={form.spendingEndsAt}
                          onChange={(e) => setForm((f) => ({ ...f, spendingEndsAt: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground md:col-span-3">
                    لا تُحتسب الطلبات المعلقة أو المسودة أو الملغاة أو المرفوضة أو المتنازع عليها أو غير المكتملة.
                  </p>
                </>
              )}
              {form.target === "completed_services" && (
                <>
                  <p className="text-xs text-muted-foreground md:col-span-3">
                    تستهدف الحملة العملاء الذين أكملوا العدد الأدنى المحدد من طلبات الخدمة.
                    تُحتسب الطلبات التي حالتها «مكتملة» فقط، وتُوزّع المكافأة عند تنفيذ الحملة يدوياً.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      الحد الأدنى للخدمات المكتملة
                    </label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={form.minimumCompletedServices}
                      onChange={(e) => setForm((f) => ({ ...f, minimumCompletedServices: e.target.value }))}
                      placeholder="3"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      فترة احتساب الخدمات المكتملة
                    </label>
                    <Select
                      value={form.completedServicesPeriod}
                      onValueChange={(value: "all_time" | "custom") => setForm((f) => ({
                        ...f,
                        completedServicesPeriod: value,
                        ...(value === "all_time" ? { completedServicesStartsAt: "", completedServicesEndsAt: "" } : {}),
                      }))}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_time">منذ بداية الحساب</SelectItem>
                        <SelectItem value="custom">فترة محددة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.completedServicesPeriod === "custom" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          بداية فترة الخدمات المكتملة
                        </label>
                        <Input
                          type="datetime-local"
                          value={form.completedServicesStartsAt}
                          onChange={(e) => setForm((f) => ({ ...f, completedServicesStartsAt: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          نهاية فترة الخدمات المكتملة
                        </label>
                        <Input
                          type="datetime-local"
                          value={form.completedServicesEndsAt}
                          onChange={(e) => setForm((f) => ({ ...f, completedServicesEndsAt: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground md:col-span-3">
                    كل طلب مكتمل يُحتسب مرة واحدة فقط، ولا تُضاف مكافآت تلقائياً عند إكمال الطلبات.
                  </p>
                </>
              )}
              <div className="md:col-span-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">إشعار العميل</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    يُرسل هذا الإشعار فقط للعملاء الذين استلموا مكافأة الحملة بنجاح بعد التنفيذ اليدوي.
                    استخدم {"{coins}"} في الرسالة لعرض عدد الكوينز الفعلي.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">عنوان الإشعار</label>
                    <Input
                      value={form.notificationTitle}
                      onChange={(e) => setForm((f) => ({ ...f, notificationTitle: e.target.value }))}
                      placeholder="🎉 أهلاً بيك في فنشها!"
                      maxLength={100}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">حتى 100 حرف</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">رسالة الإشعار</label>
                    <Textarea
                      value={form.notificationBody}
                      onChange={(e) => setForm((f) => ({ ...f, notificationBody: e.target.value }))}
                      placeholder="هديتك وصلتلك: {coins} فنشها كوينز 🎁"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">حتى 500 حرف — اترك الحقلين فارغين للإشعار الافتراضي</p>
                  </div>
                </div>
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium">نشطة الآن</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {form.target === "registration_range" ? "بداية تسجيل العملاء" : "تاريخ البداية (اختياري)"}
                </label>
                <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {form.target === "registration_range" ? "نهاية تسجيل العملاء" : "تاريخ الانتهاء (اختياري)"}
                </label>
                <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إنشاء الحملة"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد حملات — أنشئ أول حملة!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right p-3">الحملة</th>
                    <th className="text-center p-3">الكوينز</th>
                    <th className="text-center p-3">الاستهداف</th>
                    <th className="text-center p-3">الحالة</th>
                    <th className="text-center p-3">الفترة</th>
                    <th className="text-center p-3">المنشئ</th>
                    <th className="text-center p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: any) => (
                    <tr key={c.id} className="border-b hover:bg-muted/20">
                      <td className="p-3">
                        <p className="font-medium">{c.nameAr}</p>
                        <p className="text-xs text-muted-foreground">{c.name}</p>
                        {c.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{c.description}</p>}
                      </td>
                      <td className="p-3 text-center font-bold">{c.coinsAmount.toLocaleString("ar-EG")}</td>
                      <td className="p-3 text-center">
                  <Badge variant="outline" className="text-xs">
                          {c.target === "all_customers"
                            ? "جميع العملاء"
                            : c.target === "registration_range"
                              ? "حسب تاريخ التسجيل"
                              : c.target === "inactive_customers"
                                ? `عملاء غير نشطين (${c.segmentFilter?.inactivityDays ?? "—"} يوم)`
                                : c.target === "service_based"
                                  ? `حسب الخدمة (${serviceList.find((s: any) => String(s.id) === String(c.segmentFilter?.serviceId))?.nameAr ?? c.segmentFilter?.serviceId ?? "—"} — ${c.segmentFilter?.serviceUsage === "not_used" ? "لم يستخدمها" : "استخدمها"})`
                                     : c.target === "location_based"
                                    ? `حسب الموقع (${c.segmentFilter?.locationType === "area"
                                      ? areaList.find((a: any) => String(a.id) === String(c.segmentFilter?.areaId))?.nameAr ?? c.segmentFilter?.areaId ?? "منطقة"
                                      : governorateList.find((g: any) => String(g.id) === String(c.segmentFilter?.governorateId))?.nameAr ?? c.segmentFilter?.governorateId ?? "محافظة"} — ${c.segmentFilter?.activity === "not_used" ? "لم يستخدمه" : "استخدمه"})`
                                     : c.target === "spending_based"
                                       ? `حسب الإنفاق (≥ ${Number(c.segmentFilter?.minimumSpending ?? 0).toLocaleString("ar-EG")} جنيه)`
                                     : c.target === "completed_services"
                                       ? `حسب الخدمات المكتملة (≥ ${Number(c.segmentFilter?.minimumCompletedServices ?? 0).toLocaleString("ar-EG")})`
                                    : "يدوي"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => toggleActive(c)}>
                          {c.isActive
                            ? <Badge className="bg-green-100 text-green-800 border-0 gap-1 cursor-pointer"><CheckCircle className="w-3 h-3" />نشطة</Badge>
                            : <Badge className="bg-gray-100 text-gray-600 border-0 gap-1 cursor-pointer"><XCircle className="w-3 h-3" />متوقفة</Badge>
                          }
                        </button>
                      </td>
                      <td className="p-3 text-center text-xs text-muted-foreground">
                        {c.startsAt
                          ? c.target === "registration_range"
                            ? new Date(c.startsAt).toLocaleString("ar-EG", { timeZone: EGYPT_TIME_ZONE })
                            : new Date(c.startsAt).toLocaleDateString("ar-EG")
                          : "—"}
                        {" → "}
                        {c.endsAt
                          ? c.target === "registration_range"
                            ? new Date(c.endsAt).toLocaleString("ar-EG", { timeZone: EGYPT_TIME_ZONE })
                            : new Date(c.endsAt).toLocaleDateString("ar-EG")
                          : "—"}
                      </td>
                      <td className="p-3 text-center text-xs text-muted-foreground">{c.creatorName || "—"}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                            disabled={executing === c.id || !c.isActive}
                            onClick={() => handleExecute(c)}
                            title={c.isActive ? "تنفيذ الحملة وتوزيع الكوينز" : "الحملة غير نشطة"}
                          >
                            {executing === c.id
                              ? <span className="text-xs">جاري...</span>
                              : <><Play className="w-3 h-3" /><span className="text-xs">تنفيذ</span></>
                            }
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            disabled={deleting === c.id}
                            onClick={() => handleDelete(c.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => updateQuery({ page: page - 1 })}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => updateQuery({ page: page + 1 })}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
