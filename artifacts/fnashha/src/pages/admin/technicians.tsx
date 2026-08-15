import { useState } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { Link } from "wouter";
import {
  useListUsers, getListUsersQueryKey,
  useListPendingTechnicians, getListPendingTechniciansQueryKey,
  useApproveTechnician, useRejectTechnician,
  useListServices, useListGovernorates, useListAreas,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, CheckCircle, XCircle, ChevronLeft, Edit2, ShieldBan, ShieldCheck, UserX, RefreshCw, Trash2, AlertTriangle, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useAdminUnread } from "@/contexts/admin-unread-context";
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

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:    { label: "نشط",     cls: "bg-green-100 text-green-800" },
  suspended: { label: "موقوف",   cls: "bg-yellow-100 text-yellow-800" },
  banned:    { label: "محظور",   cls: "bg-red-100 text-red-800" },
  pending:   { label: "بانتظار الموافقة", cls: "bg-blue-100 text-blue-800" },
  rejected:  { label: "مرفوض",  cls: "bg-red-100 text-red-800" },
};

export default function AdminTechnicians() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { token, isSuperAdmin } = useAuth();
  const { isSeenLocally } = useAdminUnread();
  const { params, updateQuery } = useAdminListState();

  const emptyFilter = { search: "", serviceId: "all", governorateId: "all", areaId: "all" };
  type TabKey = "all" | "pending" | "approved" | "rejected";
  const requestedTab = params.get("tab");
  const activeTab: TabKey =
    requestedTab === "all" || requestedTab === "approved" || requestedTab === "rejected"
      ? requestedTab
      : "pending";
  const filters = {
    search: params.get("search") || emptyFilter.search,
    serviceId: params.get("serviceId") || emptyFilter.serviceId,
    governorateId: params.get("governorateId") || emptyFilter.governorateId,
    areaId: params.get("areaId") || emptyFilter.areaId,
  };
  const setF = (key: keyof typeof emptyFilter, value: string) =>
    updateQuery(
      {
        [key]: value === "all" ? null : value,
        ...(key === "governorateId" ? { areaId: null } : {}),
        page: null,
      },
      { replace: key === "search" },
    );

  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const [editFullName, setEditFullName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [banType, setBanType] = useState<"temporary" | "permanent">("temporary");
  const [banDays, setBanDays] = useState("7");
  const [banReason, setBanReason] = useState("");

  const [deleteConfirmTech, setDeleteConfirmTech] = useState(false);

  const { data: pendingTechs = [], isLoading: pendingLoading } = useListPendingTechnicians({
    query: { queryKey: getListPendingTechniciansQueryKey() },
  });
  const { data, isLoading: allLoading } = useListUsers(
    { role: "technician", search: filters.search || undefined } as any,
    { query: { queryKey: [...getListUsersQueryKey({ role: "technician" } as any), filters.search] } }
  );
  const { data: approvedTechs = [], isLoading: approvedLoading } = useQuery({
    queryKey: ["approvedTechnicians"],
    queryFn: () => apiCall("/technicians/approved", "GET", undefined, token || ""),
    enabled: !!token,
  });
  const { data: rejectedTechs = [], isLoading: rejectedLoading } = useQuery({
    queryKey: ["rejectedTechnicians"],
    queryFn: () => apiCall("/technicians/rejected", "GET", undefined, token || ""),
    enabled: !!token,
  });

  const { data: servicesList = [] } = useListServices();
  const { data: governoratesList = [] } = useListGovernorates();
  const { data: areasList = [] } = useListAreas();
  const services = Array.isArray(servicesList) ? servicesList : (servicesList as any)?.data || [];
  const governorates = Array.isArray(governoratesList) ? governoratesList : (governoratesList as any)?.data || [];
  const areas = Array.isArray(areasList) ? areasList : (areasList as any)?.data || [];

  const allTechs = (data as any)?.data || [];
  const pending = Array.isArray(pendingTechs) ? pendingTechs : [];
  const approved = Array.isArray(approvedTechs) ? approvedTechs : [];
  const rejected = Array.isArray(rejectedTechs) ? rejectedTechs : [];
  const page = Math.max(1, Number(params.get("page") || "1"));
  const PAGE_SIZE = 10;

  const applyFilters = (list: any[], tab: TabKey, isUser = false) => {
    const f = filters;
    return list.filter(item => {
      const name: string  = isUser ? (item.fullName || "") : (item.user?.fullName || "");
      const phone: string = isUser ? (item.mobile   || "") : (item.user?.mobile   || "");
      if (f.search && !name.includes(f.search) && !phone.includes(f.search)) return false;
      if (f.serviceId !== "all") {
        const svc = item.services as any[] | undefined;
        if (!svc?.some((s: any) => String(s.id) === f.serviceId || String(s.serviceId) === f.serviceId)) return false;
      }
      if (f.governorateId !== "all") {
        const ar = item.areas as any[] | undefined;
        if (!ar?.some((a: any) => String(a.governorate?.id ?? a.governorateId) === f.governorateId)) return false;
      }
      if (f.areaId !== "all") {
        const ar = item.areas as any[] | undefined;
        if (!ar?.some((a: any) => String(a.id) === f.areaId || String(a.areaId) === f.areaId)) return false;
      }
      return true;
    });
  };

  const FilterBar = ({ tab }: { tab: TabKey }) => {
    const f = filters;
    const filteredAreas = f.governorateId !== "all"
      ? areas.filter((a: any) => String(a.governorateId) === f.governorateId)
      : areas;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-4 bg-muted/30 rounded-xl border">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            value={f.search}
            onChange={e => setF("search", e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={f.serviceId} onValueChange={v => setF("serviceId", v)}>
          <SelectTrigger><SelectValue placeholder="الخدمة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الخدمات</SelectItem>
            {services.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.nameAr || s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={f.governorateId} onValueChange={v => setF("governorateId", v)}>
          <SelectTrigger><SelectValue placeholder="المحافظة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المحافظات</SelectItem>
            {governorates.map((g: any) => (
              <SelectItem key={g.id} value={String(g.id)}>{g.nameAr || g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={f.areaId} onValueChange={v => setF("areaId", v)}>
          <SelectTrigger><SelectValue placeholder="المنطقة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المناطق</SelectItem>
            {filteredAreas.map((a: any) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.nameAr || a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const Pagination = ({ total }: { total: number }) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-4">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 1}
          onClick={() => updateQuery({ page: page - 1 })}
        >
          السابق
        </Button>
        <span className="text-sm text-muted-foreground">
          صفحة {Math.min(page, totalPages)} من {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => updateQuery({ page: page + 1 })}
        >
          التالي
        </Button>
      </div>
    );
  };

  const pendingFiltered = applyFilters(pending, "pending");
  const approvedFiltered = applyFilters(approved, "approved");
  const rejectedFiltered = applyFilters(rejected, "rejected");
  const allFiltered = applyFilters(allTechs, "all", true);
  const pageItems = <T,>(items: T[]) => {
    const start = (Math.max(1, page) - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  };

  const approveMutation = useApproveTechnician();
  const rejectMutation = useRejectTechnician();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListUsersQueryKey({ role: "technician" } as any) });
    qc.invalidateQueries({ queryKey: getListPendingTechniciansQueryKey() });
    qc.invalidateQueries({ queryKey: ["approvedTechnicians"] });
    qc.invalidateQueries({ queryKey: ["rejectedTechnicians"] });
  };

  const handleApprove = (id: number) => {
    approveMutation.mutate(
      { id },
      {
        onSuccess: () => { invalidateAll(); toast({ title: "تم الموافقة على الفني" }); },
        onError: (err: any) => toast({ title: "خطأ", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleReject = (id: number, reason?: string) => {
    rejectMutation.mutate(
      { id, data: { reason: reason || "لم يستوف الشروط" } as any },
      {
        onSuccess: () => { invalidateAll(); toast({ title: "تم رفض الطلب" }); },
      }
    );
  };

  const openManage = (user: any) => {
    setSelected(user);
    setEditFullName(user.fullName || "");
    setEditMobile(user.mobile || "");
    setEditEmail(user.email || "");
    setEditPassword("");
    setBanType("temporary");
    setBanDays("7");
    setBanReason("");
    setDeleteConfirmTech(false);
  };

  const handleSoftDeleteTech = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await apiCall(`/users/${selected.id}`, "DELETE", undefined, token || "");
      toast({ title: "تم حذف حساب الفني بنجاح" });
      invalidateAll();
      setSelected(null);
      setDeleteConfirmTech(false);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await apiCall(`/users/${selected.id}/admin-edit`, "PATCH", {
        fullName: editFullName,
        mobile: editMobile,
        email: editEmail,
        newPassword: editPassword || undefined,
      }, token || "");
      toast({ title: "تم تحديث بيانات الفني" });
      invalidateAll();
      setSelected(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async () => {
    if (!selected || !banReason.trim()) {
      toast({ title: "يرجى كتابة سبب الإيقاف", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiCall(`/users/${selected.id}/ban`, "POST", {
        type: banType,
        days: banType === "temporary" ? parseInt(banDays) : undefined,
        reason: banReason,
      }, token || "");
      toast({ title: banType === "permanent" ? "تم حظر الحساب بشكل دائم" : `تم إيقاف الحساب لمدة ${banDays} أيام` });
      invalidateAll();
      setSelected(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (id: number) => {
    setLoading(true);
    try {
      await apiCall(`/users/${id}/unban`, "POST", {}, token || "");
      toast({ title: "تم رفع الإيقاف" });
      invalidateAll();
      setSelected(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (userId: number) => {
    setLoading(true);
    try {
      await apiCall(`/technicians/${userId}/restore`, "POST", {}, token || "");
      toast({ title: "تم استعادة الفني", description: "تم نقله إلى قائمة الانتظار" });
      invalidateAll();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePermanent = async (userId: number) => {
    setLoading(true);
    try {
      await apiCall(`/technicians/${userId}/permanent-delete`, "DELETE", undefined, token || "");
      toast({ title: "تم الحذف النهائي" });
      setConfirmDelete(null);
      invalidateAll();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">إدارة الفنيين</h1>
        <p className="text-muted-foreground text-sm mt-1">مراجعة وإدارة الفنيين المسجلين</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => updateQuery({ tab: value === "pending" ? null : value, page: null })}
      >
        <TabsList className="mb-5 flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="pending" data-testid="tab-pending">
            بانتظار الموافقة {pending.length > 0 && <Badge className="mr-1 bg-primary/10 text-primary text-xs">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">تم الموافقة</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">المرفوضون</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">كل الفنيين</TabsTrigger>
        </TabsList>

        {/* Pending tab */}
        <TabsContent value="pending">
          <FilterBar tab="pending" />
          <div className="space-y-3">
            {pendingLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)
            ) : pendingFiltered.length === 0 ? (
              <Card><CardContent className="py-14 text-center text-muted-foreground">لا توجد نتائج</CardContent></Card>
            ) : (
              pageItems(pendingFiltered).map((t: any) => {
                const unread = !t.adminSeen && !isSeenLocally("technicians", t.userId);
                return (
                <Card key={t.id} className={unread ? "border-primary/60 bg-primary/[0.03]" : ""} data-testid={`card-pending-${t.id}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-start gap-2">
                      {unread && <span className="inline-block mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      <div>
                        <p className={unread ? "font-bold" : "font-semibold"}>{t.user?.fullName}</p>
                        <p className="text-sm text-muted-foreground">{t.user?.mobile}</p>
                        <p className="text-xs text-muted-foreground">رقم البطاقة: {t.nationalId}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/admin/technicians/${t.userId}`}>
                        <Button size="sm" variant="outline" data-testid={`button-view-${t.id}`}>
                          <ChevronLeft className="w-3 h-3" />
                        </Button>
                      </Link>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApprove(t.userId)} disabled={approveMutation.isPending} data-testid={`button-approve-${t.id}`}>
                        <CheckCircle className="w-3 h-3 ms-1" /> موافقة
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(t.userId)} disabled={rejectMutation.isPending} data-testid={`button-reject-${t.id}`}>
                        <XCircle className="w-3 h-3 ms-1" /> رفض
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
              })
            )}
          </div>
          <Pagination total={pendingFiltered.length} />
        </TabsContent>

        {/* Approved tab */}
        <TabsContent value="approved">
          <FilterBar tab="approved" />
          <div className="space-y-3">
            {approvedLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)
            ) : approvedFiltered.length === 0 ? (
              <Card><CardContent className="py-14 text-center text-muted-foreground">لا توجد نتائج</CardContent></Card>
            ) : (
              pageItems(approvedFiltered).map((t: any) => (
                <Card key={t.id} data-testid={`card-approved-${t.id}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {t.personalPhoto ? (
                        <CldImg src={t.personalPhoto} alt="" width={80} className="w-10 h-10 rounded-full object-cover border" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center border">
                          <span className="text-sm font-bold text-green-700">{t.user?.fullName?.[0] || "?"}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{t.user?.fullName}</p>
                        <p className="text-sm text-muted-foreground">{t.user?.mobile}</p>
                        <Badge className="bg-green-100 text-green-800 border-0 text-xs mt-0.5">موافق عليه</Badge>
                      </div>
                    </div>
                    <Link href={`/admin/technicians/${t.userId}`}>
                      <Button size="sm" variant="outline">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <Pagination total={approvedFiltered.length} />
        </TabsContent>

        {/* Rejected tab */}
        <TabsContent value="rejected">
          <FilterBar tab="rejected" />
          <div className="space-y-3">
            {rejectedLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)
            ) : rejectedFiltered.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">لا توجد نتائج</p>
                </CardContent>
              </Card>
            ) : (
              pageItems(rejectedFiltered).map((tech: any) => (
                <Card key={tech.id} data-testid={`card-rejected-${tech.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {tech.personalPhoto ? (
                          <CldImg src={tech.personalPhoto} alt="" width={96} className="w-12 h-12 rounded-full object-cover border" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border">
                            <span className="text-base font-bold text-muted-foreground">{tech.user?.fullName?.[0] || "?"}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold">{tech.user?.fullName}</p>
                          <Badge className="bg-red-100 text-red-800 border-0 text-xs">مرفوض</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{tech.user?.mobile}</p>
                        {tech.rejectionReason && (
                          <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg p-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>سبب الرفض: {tech.rejectionReason}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Link href={`/admin/technicians/${tech.userId}`}>
                          <Button size="sm" variant="outline" className="w-full">
                            <ChevronLeft className="w-3 h-3 ms-1" />
                            عرض
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700 border-green-300 hover:bg-green-50 w-full"
                          onClick={() => handleRestore(tech.userId)}
                          disabled={loading}
                          data-testid={`button-restore-${tech.id}`}
                        >
                          <RefreshCw className="w-3 h-3 ms-1" />
                          استعادة
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            onClick={() => setConfirmDelete(tech)}
                            disabled={loading}
                            data-testid={`button-delete-${tech.id}`}
                          >
                            <Trash2 className="w-3 h-3 ms-1" />
                            حذف
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <Pagination total={rejectedFiltered.length} />
        </TabsContent>

        {/* All tab */}
        <TabsContent value="all">
          <FilterBar tab="all" />
          <div className="space-y-2">
            {allLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)
            ) : pageItems(allFiltered).map((user: any) => {
              const st = STATUS_LABEL[user.status] || { label: user.status, cls: "bg-gray-100 text-gray-800" };
              const isBanned = user.status === "banned" || user.status === "suspended";
              return (
                <Card key={user.id} className="hover:border-primary/30 transition-all" data-testid={`row-tech-${user.id}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.fullName}</p>
                      <p className="text-sm text-muted-foreground">{user.mobile}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${st.cls} border-0 text-xs`}>{st.label}</Badge>
                      <Link href={`/admin/technicians/${user.id}`}>
                        <Button size="sm" variant="ghost">
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => openManage(user)} data-testid={`button-manage-${user.id}`}>
                        <Edit2 className="w-3 h-3 ms-1" /> إدارة
                      </Button>
                      {isBanned && (
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleUnban(user.id)} disabled={loading} data-testid={`button-unban-${user.id}`}>
                          <ShieldCheck className="w-3 h-3 ms-1" /> رفع الإيقاف
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination total={allFiltered.length} />
        </TabsContent>
      </Tabs>

      {/* Manage Technician Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setDeleteConfirmTech(false); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إدارة حساب: {selected?.fullName}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="edit">
            <TabsList className="w-full">
              <TabsTrigger value="edit" className="flex-1">تعديل البيانات</TabsTrigger>
              <TabsTrigger value="ban" className="flex-1">إيقاف / حظر</TabsTrigger>
              <TabsTrigger value="delete" className="flex-1 text-destructive data-[state=active]:text-destructive">حذف</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-3 mt-4">
              <div>
                <Label>الاسم الكامل</Label>
                <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input value={editMobile} onChange={(e) => setEditMobile(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>كلمة مرور جديدة <span className="text-muted-foreground text-xs">(اتركه فارغاً)</span></Label>
                <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="mt-1" placeholder="••••••••" />
              </div>
              <Button className="w-full" onClick={handleEdit} disabled={loading}>
                {loading ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </TabsContent>

            <TabsContent value="ban" className="space-y-3 mt-4">
              {(selected?.status === "banned" || selected?.status === "suspended") ? (
                <div className="text-center space-y-3">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <ShieldBan className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="font-medium text-red-800">الحساب موقوف</p>
                    {selected?.suspensionReason && <p className="text-sm text-red-600 mt-1">السبب: {selected.suspensionReason}</p>}
                    {selected?.bannedUntil && selected?.status === "suspended" && (
                      <p className="text-xs text-red-500 mt-1">حتى: {new Date(selected.bannedUntil).toLocaleDateString("ar-EG")}</p>
                    )}
                  </div>
                  <Button variant="outline" className="w-full text-green-700 border-green-300" onClick={() => handleUnban(selected?.id)} disabled={loading}>
                    <ShieldCheck className="w-4 h-4 ms-2" />
                    رفع الإيقاف
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label>نوع الإيقاف</Label>
                    <Select value={banType} onValueChange={(v: any) => setBanType(v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="temporary">مؤقت</SelectItem>
                        <SelectItem value="permanent">دائم</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {banType === "temporary" && (
                    <div>
                      <Label>المدة</Label>
                      <Select value={banDays} onValueChange={setBanDays}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">يوم واحد</SelectItem>
                          <SelectItem value="3">3 أيام</SelectItem>
                          <SelectItem value="7">أسبوع</SelectItem>
                          <SelectItem value="14">أسبوعان</SelectItem>
                          <SelectItem value="30">شهر</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>سبب الإيقاف <span className="text-destructive">*</span></Label>
                    <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} className="mt-1" rows={2} placeholder="اكتب سبب الإيقاف..." />
                  </div>
                  <Button variant="destructive" className="w-full" onClick={handleBan} disabled={loading}>
                    <UserX className="w-4 h-4 ms-2" />
                    {loading ? "جاري التنفيذ..." : banType === "permanent" ? "حظر دائم" : `إيقاف لمدة ${banDays} أيام`}
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="delete" className="space-y-3 mt-4">
              {!deleteConfirmTech ? (
                <div className="text-center space-y-3 py-2">
                  <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
                  <p className="font-medium">حذف حساب الفني</p>
                  <p className="text-sm text-muted-foreground">سيتم تعطيل الحساب ومنع صاحبه من تسجيل الدخول. لا يمكن التراجع عن هذا الإجراء.</p>
                  <Button variant="destructive" className="w-full" onClick={() => setDeleteConfirmTech(true)}>
                    <Trash2 className="w-4 h-4 ms-2" />
                    حذف الحساب
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-center">
                    <p className="font-semibold text-red-800">هل أنت متأكد من حذف حساب</p>
                    <p className="text-red-700 font-bold mt-1">{selected?.fullName}؟</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="destructive" className="flex-1" onClick={handleSoftDeleteTech} disabled={loading}>
                      {loading ? "جاري الحذف..." : "نعم، احذف الحساب"}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmTech(false)} disabled={loading}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              تأكيد الحذف النهائي
            </DialogTitle>
            <DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بيانات الفني نهائياً من النظام.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-destructive/10 rounded-lg">
            <p className="font-semibold">{confirmDelete?.user?.fullName}</p>
            <p className="text-sm text-muted-foreground">{confirmDelete?.user?.mobile}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="destructive" onClick={() => handleDeletePermanent(confirmDelete?.userId)} disabled={loading} className="flex-1">
              {loading ? "جاري الحذف..." : "حذف نهائي"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
