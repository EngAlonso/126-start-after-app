import { useState } from "react";
import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Users, UserX, UserCheck, Edit2, ShieldBan, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
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
  pending:   { label: "معلق",    cls: "bg-gray-100 text-gray-800" },
  rejected:  { label: "مرفوض",  cls: "bg-red-100 text-red-800" },
};

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { token } = useAuth();
  const { params, updateQuery } = useAdminListState();
  const search = params.get("search") || "";
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editFullName, setEditFullName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // Ban state
  const [banType, setBanType] = useState<"temporary" | "permanent">("temporary");
  const [banDays, setBanDays] = useState("7");
  const [banReason, setBanReason] = useState("");

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data, isLoading } = useListUsers(
    { role: "customer", search: search || undefined } as any,
    { query: { queryKey: getListUsersQueryKey({ role: "customer", search: search || undefined } as any) } }
  );
  const users = (data as any)?.data || [];

  const openManage = (user: any) => {
    setSelected(user);
    setEditFullName(user.fullName || "");
    setEditMobile(user.mobile || "");
    setEditEmail(user.email || "");
    setEditPassword("");
    setBanType("temporary");
    setBanDays("7");
    setBanReason("");
    setDeleteConfirm(false);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: getListUsersQueryKey({ role: "customer" } as any) });

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
      toast({ title: "تم تحديث بيانات العميل" });
      invalidate();
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
      invalidate();
      setSelected(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminDelete = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await apiCall(`/users/${selected.id}`, "DELETE", undefined, token || "");
      toast({ title: "تم حذف الحساب بنجاح" });
      invalidate();
      setSelected(null);
      setDeleteConfirm(false);
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
      toast({ title: "تم رفع الإيقاف عن الحساب" });
      invalidate();
      setSelected(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">إدارة العملاء</h1>
          <p className="text-muted-foreground text-sm mt-1">قائمة جميع العملاء المسجلين</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو الهاتف..."
          value={search}
          onChange={(e) => updateQuery({ search: e.target.value || null }, { replace: true })}
          className="pr-9"
          data-testid="input-search"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا يوجد مستخدمون</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-5 px-4 py-3 text-xs font-semibold text-muted-foreground bg-muted/30">
                <span>الاسم</span>
                <span>الهاتف</span>
                <span>البريد</span>
                <span>الحالة</span>
                <span>إجراءات</span>
              </div>
              {users.map((user: any) => {
                const st = STATUS_LABEL[user.status] || { label: user.status, cls: "bg-gray-100 text-gray-800" };
                const isBanned = user.status === "banned" || user.status === "suspended";
                return (
                  <div key={user.id} className="grid grid-cols-5 px-4 py-3 items-center text-sm" data-testid={`row-user-${user.id}`}>
                    <span className="font-medium">{user.fullName}</span>
                    <span className="text-muted-foreground">{user.mobile}</span>
                    <span className="text-muted-foreground text-xs">{user.email || "—"}</span>
                    <span>
                      <Badge className={`${st.cls} border-0 text-xs`}>{st.label}</Badge>
                      {user.bannedUntil && user.status === "suspended" && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          حتى {new Date(user.bannedUntil).toLocaleDateString("ar-EG")}
                        </p>
                      )}
                    </span>
                    <span className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openManage(user)} data-testid={`button-manage-${user.id}`}>
                        <Edit2 className="w-3 h-3 ms-1" />
                        إدارة
                      </Button>
                      {isBanned ? (
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleUnban(user.id)} disabled={loading} data-testid={`button-unban-${user.id}`}>
                          <ShieldCheck className="w-3 h-3 ms-1" />
                          رفع الإيقاف
                        </Button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage User Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
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
                <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="mt-1" data-testid="input-edit-name" />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input value={editMobile} onChange={(e) => setEditMobile(e.target.value)} className="mt-1" data-testid="input-edit-mobile" />
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="mt-1" data-testid="input-edit-email" />
              </div>
              <div>
                <Label>كلمة مرور جديدة <span className="text-muted-foreground text-xs">(اتركه فارغاً للإبقاء على الحالية)</span></Label>
                <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="mt-1" placeholder="••••••••" data-testid="input-edit-password" />
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
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
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
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
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
                    <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} className="mt-1" rows={2} placeholder="اكتب سبب الإيقاف..." data-testid="input-ban-reason" />
                  </div>
                  <Button variant="destructive" className="w-full" onClick={handleBan} disabled={loading} data-testid="button-confirm-ban">
                    <UserX className="w-4 h-4 ms-2" />
                    {loading ? "جاري التنفيذ..." : banType === "permanent" ? "حظر دائم" : `إيقاف لمدة ${banDays} أيام`}
                  </Button>
                </>
              )}
            </TabsContent>
            <TabsContent value="delete" className="space-y-3 mt-4">
              {!deleteConfirm ? (
                <div className="text-center space-y-3 py-2">
                  <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
                  <p className="font-medium">حذف حساب العميل</p>
                  <p className="text-sm text-muted-foreground">سيتم تعطيل الحساب ومنع صاحبه من تسجيل الدخول. لا يمكن التراجع عن هذا الإجراء.</p>
                  <Button variant="destructive" className="w-full" onClick={() => setDeleteConfirm(true)} data-testid="button-open-delete-confirm">
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
                    <Button variant="destructive" className="flex-1" onClick={handleAdminDelete} disabled={loading} data-testid="button-confirm-delete">
                      {loading ? "جاري الحذف..." : "نعم، احذف الحساب"}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
