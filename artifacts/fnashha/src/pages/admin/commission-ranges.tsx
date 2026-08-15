import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListServices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { PlusCircle, Trash2, Layers, Pencil, ToggleLeft, ToggleRight } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiCall(path: string, method: string, body?: any, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === "DELETE" && res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

const EMPTY_FORM = { serviceId: "all", minPrice: "", maxPrice: "", type: "fixed", value: "" };

export default function AdminCommissionRanges() {
  const { toast } = useToast();
  const { token } = useAuth();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const { data: ranges = [], isLoading } = useQuery<any[]>({
    queryKey: ["commission-ranges"],
    queryFn: () => apiCall("/commission-ranges", "GET", undefined, token || ""),
    enabled: !!token,
  });

  const { data: services = [] } = useListServices();
  const serviceList = Array.isArray(services) ? services : [];

  const resetForm = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(false); };

  const startEdit = (r: any) => {
    setForm({
      serviceId: r.serviceId ? String(r.serviceId) : "all",
      minPrice: String(parseFloat(r.minPrice)),
      maxPrice: String(parseFloat(r.maxPrice)),
      type: r.commissionType || "fixed",
      value: String(parseFloat(r.commissionValue || r.requiredPoints || 0)),
    });
    setEditingId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!form.minPrice || !form.maxPrice || !form.value) {
      toast({ title: "يرجى تعبئة جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    const numMin = parseFloat(form.minPrice);
    const numMax = parseFloat(form.maxPrice);
    const numValue = parseFloat(form.value);
    if (numMin >= numMax) {
      toast({ title: "الحد الأدنى يجب أن يكون أقل من الحد الأقصى", variant: "destructive" });
      return;
    }
    if (form.type === "percentage" && (numValue <= 0 || numValue > 100)) {
      toast({ title: "النسبة المئوية يجب أن تكون بين 0 و 100", variant: "destructive" });
      return;
    }
    if (form.type === "fixed" && numValue <= 0) {
      toast({ title: "النقاط الثابتة يجب أن تكون أكبر من صفر", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        serviceId: form.serviceId !== "all" ? parseInt(form.serviceId) : null,
        minPrice: numMin,
        maxPrice: numMax,
        type: form.type,
        value: numValue,
      };
      if (editingId) {
        await apiCall(`/commission-ranges/${editingId}`, "PATCH", payload, token || "");
        toast({ title: "تم تحديث النطاق بنجاح" });
      } else {
        await apiCall("/commission-ranges", "POST", payload, token || "");
        toast({ title: "تم إضافة النطاق بنجاح" });
      }
      qc.invalidateQueries({ queryKey: ["commission-ranges"] });
      resetForm();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا النطاق؟")) return;
    try {
      await apiCall(`/commission-ranges/${id}`, "DELETE", undefined, token || "");
      qc.invalidateQueries({ queryKey: ["commission-ranges"] });
      toast({ title: "تم حذف النطاق" });
    } catch (err: any) {
      toast({ title: "خطأ في الحذف", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await apiCall(`/commission-ranges/${id}/toggle`, "PATCH", undefined, token || "");
      qc.invalidateQueries({ queryKey: ["commission-ranges"] });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">نطاقات العمولة</h1>
          <p className="text-sm text-muted-foreground">
            تحديد النقاط المطلوبة حسب نطاق السعر — الإجمالي = عمولة النطاق + نقاط المنطقة الإضافية
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} data-testid="button-add-range">
          <PlusCircle className="w-4 h-4 ms-2" />
          إضافة نطاق
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "تعديل النطاق" : "نطاق جديد"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium">الخدمة</label>
                <Select value={form.serviceId} onValueChange={v => setField("serviceId", v)}>
                  <SelectTrigger className="mt-1" data-testid="select-service">
                    <SelectValue placeholder="كل الخدمات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الخدمات</SelectItem>
                    {serviceList.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">نوع العمولة *</label>
                <Select value={form.type} onValueChange={v => setField("type", v)}>
                  <SelectTrigger className="mt-1" data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">نقاط ثابتة</SelectItem>
                    <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">الحد الأدنى للسعر (جنيه) *</label>
                <Input
                  type="number"
                  value={form.minPrice}
                  onChange={e => setField("minPrice", e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  data-testid="input-min-price"
                />
              </div>
              <div>
                <label className="text-sm font-medium">الحد الأقصى للسعر (جنيه) *</label>
                <Input
                  type="number"
                  value={form.maxPrice}
                  onChange={e => setField("maxPrice", e.target.value)}
                  placeholder="2000"
                  className="mt-1"
                  data-testid="input-max-price"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">
                  {form.type === "fixed" ? "النقاط المطلوبة *" : "نسبة العمولة (%) *"}
                </label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    value={form.value}
                    onChange={e => setField("value", e.target.value)}
                    placeholder={form.type === "fixed" ? "75 نقطة" : "10"}
                    className="mt-0"
                    data-testid="input-value"
                  />
                  {form.type === "percentage" && form.value && form.minPrice && form.maxPrice && (
                    <p className="text-xs text-muted-foreground mt-1">
                      مثال: سعر 1000 جنيه → {Math.ceil(1000 * parseFloat(form.value) / 100)} نقطة
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} data-testid="button-save-range">
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة"}
              </Button>
              <Button variant="outline" onClick={resetForm}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)
        ) : ranges.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">لا توجد نطاقات عمولة محددة</p>
              <p className="text-xs mt-1">أضف نطاقات لتحديد النقاط المطلوبة عند تقديم العروض</p>
            </CardContent>
          </Card>
        ) : (
          ranges.map((r: any) => {
            const commType = r.commissionType || "fixed";
            const commValue = parseFloat(r.commissionValue || r.requiredPoints || 0);
            return (
              <Card
                key={r.id}
                className={!r.isActive ? "opacity-50" : ""}
                data-testid={`row-range-${r.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    <Badge variant={r.service ? "default" : "secondary"} className="text-xs">
                      {r.service ? r.service.nameAr : "كل الخدمات"}
                    </Badge>
                    <Badge variant={commType === "percentage" ? "outline" : "secondary"} className="text-xs">
                      {commType === "percentage" ? "نسبة مئوية" : "نقاط ثابتة"}
                    </Badge>
                    <span className="text-sm font-medium">
                      {parseFloat(r.minPrice).toLocaleString("ar-EG")} — {parseFloat(r.maxPrice).toLocaleString("ar-EG")} جنيه
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[60px]">
                      <p className="text-xl font-black text-primary">
                        {commType === "percentage" ? `${commValue}%` : commValue}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {commType === "percentage" ? "من السعر" : "نقطة"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggle(r.id)}
                      title={r.isActive ? "تعطيل" : "تفعيل"}
                      data-testid={`button-toggle-range-${r.id}`}
                    >
                      {r.isActive
                        ? <ToggleRight className="w-5 h-5 text-green-600" />
                        : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(r)}
                      data-testid={`button-edit-range-${r.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(r.id)}
                      data-testid={`button-delete-range-${r.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
