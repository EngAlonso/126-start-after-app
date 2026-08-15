import { CldImg } from "@/components/ui/cld-img";
import {
  useGetUser, getGetUserQueryKey,
  useGetTechnicianProfile, getGetTechnicianProfileQueryKey,
  useApproveTechnician, useRejectTechnician,
  getListPendingTechniciansQueryKey,
  useListServices, useListAreas, useListGovernorates,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Star, CheckCircle, XCircle, Wallet, ZoomIn, Edit2, Save } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useAdminUnread } from "@/contexts/admin-unread-context";

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

const APPROVAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:  { label: "بانتظار المراجعة", color: "bg-amber-100 text-amber-800" },
  approved: { label: "موافق عليه",       color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض",            color: "bg-red-100 text-red-800" },
};

const USER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:    { label: "نشط",              color: "bg-green-100 text-green-800" },
  pending:   { label: "بانتظار الموافقة", color: "bg-amber-100 text-amber-800" },
  suspended: { label: "موقوف",            color: "bg-yellow-100 text-yellow-800" },
  banned:    { label: "محظور",            color: "bg-red-100 text-red-800" },
  rejected:  { label: "مرفوض",           color: "bg-red-100 text-red-800" },
};

function ImageViewer({ src, label }: { src: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative group w-full h-32 rounded-xl overflow-hidden border bg-muted hover:border-primary/40 transition-colors"
        >
          <CldImg src={src} alt={label} width={800} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ZoomIn className="w-6 h-6 text-white" />
          </div>
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-2">
          <CldImg src={src} alt={label} width={1200} className="w-full rounded-lg object-contain max-h-[80vh]" />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminTechnicianDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const userId = parseInt(id);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Services/areas editing state
  const [editingSvcs, setEditingSvcs] = useState(false);
  const [editingAreas, setEditingAreas] = useState(false);
  const [selectedSvcs, setSelectedSvcs] = useState<number[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: user } = useGetUser(userId, { query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId) } });
  const { data: profile } = useGetTechnicianProfile(userId, { query: { enabled: !!userId, queryKey: getGetTechnicianProfileQueryKey(userId) } });
  const { data: allServicesData } = useListServices();
  const { data: allAreasData } = useListAreas();
  const { data: allGovData = [] } = useListGovernorates();
  const allServices = Array.isArray(allServicesData) ? allServicesData : (allServicesData as any)?.data || [];
  const allAreas = Array.isArray(allAreasData) ? allAreasData : (allAreasData as any)?.data || [];
  const allGovernorates = Array.isArray(allGovData) ? allGovData : [];

  // Experience editing state
  const [editingExp, setEditingExp] = useState(false);
  const [selectedExp, setSelectedExp] = useState<string>("");
  const [savingExp, setSavingExp] = useState(false);

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

  const u = user as any;
  const p = profile as any;

  const { markSeen } = useAdminUnread();

  // When profile loads, check if it was unread → decrement badge immediately + persist to server
  useEffect(() => {
    if (!p?.id || !userId) return;
    const wasUnread = p.adminSeen === false;
    markSeen("technicians", userId, wasUnread);
    if (wasUnread && token) {
      fetch(`${BASE_URL}/api/technicians/${userId}/mark-seen`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [p?.id, userId]);

  const approveMutation = useApproveTechnician();
  const rejectMutation = useRejectTechnician();
  const approvalInfo = APPROVAL_STATUS_MAP[p?.approvalStatus] || { label: "—", color: "bg-gray-100 text-gray-600" };
  const userStatusInfo = USER_STATUS_MAP[u?.status] || { label: u?.status, color: "bg-gray-100 text-gray-600" };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: getGetTechnicianProfileQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: getListPendingTechniciansQueryKey() });
  };

  const startEditSvcs = () => {
    setSelectedSvcs((p?.services || []).map((s: any) => s.id));
    setEditingSvcs(true);
  };

  const startEditAreas = () => {
    setSelectedAreas((p?.areas || []).map((a: any) => a.id));
    setEditingAreas(true);
  };

  const toggleSvc = (id: number) =>
    setSelectedSvcs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleArea = (id: number) =>
    setSelectedAreas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveSvcs = async () => {
    setSaving(true);
    try {
      await apiCall(`/technicians/${userId}/admin-services`, "PATCH", { serviceIds: selectedSvcs }, token || "");
      toast({ title: "تم تحديث الخدمات" });
      invalidate();
      setEditingSvcs(false);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveAreas = async () => {
    setSaving(true);
    try {
      await apiCall(`/technicians/${userId}/admin-areas`, "PATCH", { areaIds: selectedAreas }, token || "");
      toast({ title: "تم تحديث المناطق" });
      invalidate();
      setEditingAreas(false);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startEditExp = () => {
    setSelectedExp(p?.yearsOfExperience ? String(p.yearsOfExperience) : "");
    setEditingExp(true);
  };

  const saveExp = async () => {
    setSavingExp(true);
    try {
      await apiCall(`/technicians/${userId}/admin-experience`, "PATCH", { yearsOfExperience: selectedExp ? parseInt(selectedExp) : null }, token || "");
      toast({ title: "تم تحديث سنوات الخبرة" });
      invalidate();
      setEditingExp(false);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSavingExp(false);
    }
  };

  const handleApprove = () => {
    approveMutation.mutate(
      { id: userId },
      {
        onSuccess: () => { invalidate(); toast({ title: "✅ تم الموافقة على الفني وتفعيل حسابه" }); },
        onError: (err: any) => toast({ title: "خطأ", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast({ title: "يرجى كتابة سبب الرفض", variant: "destructive" });
      return;
    }
    rejectMutation.mutate(
      { id: userId, data: { reason: rejectReason } as any },
      {
        onSuccess: () => { invalidate(); setShowRejectForm(false); toast({ title: "تم رفض الطلب" }); },
        onError: (err: any) => toast({ title: "خطأ", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  if (!u) return <div className="p-6 text-center text-muted-foreground">جاري التحميل...</div>;

  const isPending = p?.approvalStatus === "pending";
  const hasImages = p?.personalPhoto || p?.nationalIdFront || p?.nationalIdBack;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{u.fullName}</h1>
          <p className="text-muted-foreground">{u.mobile}</p>
          {u.email && <p className="text-sm text-muted-foreground">{u.email}</p>}
        </div>
        {isPending && !showRejectForm && (
          <div className="flex gap-2">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              data-testid="button-approve"
            >
              <CheckCircle className="w-4 h-4 ms-1" /> موافقة وتفعيل
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowRejectForm(true)}
              data-testid="button-reject"
            >
              <XCircle className="w-4 h-4 ms-1" /> رفض
            </Button>
          </div>
        )}
      </div>

      {/* Reject Form */}
      {showRejectForm && (
        <Card className="border-destructive/40 bg-red-50">
          <CardContent className="p-4 space-y-3">
            <p className="font-semibold text-destructive">سبب الرفض</p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="اكتب سبب رفض الطلب بوضوح..."
              rows={3}
              className="bg-white"
              data-testid="input-reject-reason"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending ? "جاري الرفض..." : "تأكيد الرفض"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRejectForm(false)}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">حالة حساب المستخدم</p>
            <Badge className={`${userStatusInfo.color} border-0`}>{userStatusInfo.label}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">حالة الموافقة</p>
            <Badge className={`${approvalInfo.color} border-0`}>{approvalInfo.label}</Badge>
          </CardContent>
        </Card>
        {p?.pointsBalance !== undefined && (
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <div>
                <p className="font-bold">{p.pointsBalance}</p>
                <p className="text-xs text-muted-foreground">نقاط</p>
              </div>
            </CardContent>
          </Card>
        )}
        {p?.averageRating > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary fill-primary" />
              <div>
                <p className="font-bold">{p.averageRating?.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{p.reviewCount} تقييم</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Identity Images */}
      {hasImages && (
        <Card>
          <CardHeader><CardTitle className="text-base">صور التحقق من الهوية</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {p?.personalPhoto && (
                <ImageViewer src={p.personalPhoto} label="الصورة الشخصية" />
              )}
              {p?.nationalIdFront && (
                <ImageViewer src={p.nationalIdFront} label="البطاقة القومية (أمام)" />
              )}
              {p?.nationalIdBack && (
                <ImageViewer src={p.nationalIdBack} label="البطاقة القومية (خلف)" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Details */}
      {p && (
        <Card>
          <CardHeader><CardTitle className="text-base">بيانات الفني</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">رقم البطاقة: </span><span className="font-medium">{p.nationalId}</span></div>
            {u.email && <div><span className="text-muted-foreground">البريد الإلكتروني: </span>{u.email}</div>}
            <div><span className="text-muted-foreground">تاريخ التسجيل: </span>{u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-EG") : "—"}</div>

            {p.rejectionReason && (
              <div className="bg-red-50 text-red-700 rounded-xl p-3">
                <p className="font-semibold text-sm">سبب الرفض:</p>
                <p className="mt-1">{p.rejectionReason}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">الخدمات:</p>
                {!editingSvcs ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={startEditSvcs}>
                    <Edit2 className="w-3 h-3" /> تعديل
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-green-700 gap-1" onClick={saveSvcs} disabled={saving}>
                      <Save className="w-3 h-3" /> {saving ? "..." : "حفظ"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingSvcs(false)}>إلغاء</Button>
                  </div>
                )}
              </div>
              {editingSvcs ? (
                <div className="flex flex-wrap gap-1.5">
                  {allServices.map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSvc(s.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${selectedSvcs.includes(s.id) ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-primary/50"}`}
                    >
                      {s.nameAr || s.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(p?.services || []).length > 0
                    ? (p.services.map((s: any) => s && <Badge key={s.id} variant="secondary">{s.nameAr}</Badge>))
                    : <span className="text-muted-foreground text-xs">لا توجد خدمات</span>}
                </div>
              )}
            </div>

            {/* Experience */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">سنوات الخبرة:</p>
                {!editingExp ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={startEditExp}>
                    <Edit2 className="w-3 h-3" /> تعديل
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-green-700 gap-1" onClick={saveExp} disabled={savingExp}>
                      <Save className="w-3 h-3" /> {savingExp ? "..." : "حفظ"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingExp(false)}>إلغاء</Button>
                  </div>
                )}
              </div>
              {editingExp ? (
                <Select value={selectedExp} onValueChange={setSelectedExp}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="اختر سنوات الخبرة" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-medium text-sm">
                  {p?.yearsOfExperience
                    ? (EXPERIENCE_OPTIONS.find(o => o.value === String(p.yearsOfExperience))?.label || `${p.yearsOfExperience} سنوات`)
                    : <span className="text-muted-foreground text-xs">غير محدد</span>}
                </span>
              )}
            </div>

            {/* Areas grouped by governorate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">المناطق:</p>
                {!editingAreas ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={startEditAreas}>
                    <Edit2 className="w-3 h-3" /> تعديل
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-green-700 gap-1" onClick={saveAreas} disabled={saving}>
                      <Save className="w-3 h-3" /> {saving ? "..." : "حفظ"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingAreas(false)}>إلغاء</Button>
                  </div>
                )}
              </div>
              {editingAreas ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {allGovernorates.map((gov: any) => {
                    const govAreas = allAreas.filter((a: any) => a.governorateId === gov.id);
                    if (govAreas.length === 0) return null;
                    return (
                      <div key={gov.id}>
                        <p className="text-[10px] font-bold text-muted-foreground mb-1.5">{gov.nameAr}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {govAreas.map((a: any) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => toggleArea(a.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${selectedAreas.includes(a.id) ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-primary/50"}`}
                            >
                              {a.nameAr || a.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  {(p?.areas || []).length > 0 ? (
                    (() => {
                      const areasByGov: Record<string, any[]> = {};
                      (p.areas as any[]).forEach((a: any) => {
                        if (!a) return;
                        const govName = a.governorate?.nameAr || a.governorateName || "أخرى";
                        if (!areasByGov[govName]) areasByGov[govName] = [];
                        areasByGov[govName].push(a);
                      });
                      return (
                        <div className="space-y-2">
                          {Object.entries(areasByGov).map(([govName, areas]) => (
                            <div key={govName}>
                              <p className="text-[10px] font-bold text-muted-foreground mb-1">{govName}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {areas.map((a: any) => <Badge key={a.id} variant="outline" className="text-xs">{a.nameAr}</Badge>)}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-muted-foreground text-xs">لا توجد مناطق</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
