import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useListAdminStaff, getListAdminStaffQueryKey, useCreateAdminStaff } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Users2, Shield, Edit2, Trash2, Key } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { API_BASE } from "@/lib/api-config";

const createSchema = z.object({
  fullName: z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
  mobile: z.string().min(8, "رقم الهاتف غير صحيح"),
  email: z.string().email("البريد غير صحيح").optional().or(z.literal("")),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  jobTitle: z.string().optional(),
});

async function apiCall(path: string, method: string, body?: any, token?: string) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

export default function AdminStaff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser, isFounder, isSuperAdmin, token, permissions, hasPermission } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<any | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newStaffPerms, setNewStaffPerms] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", mobile: "", jobTitle: "", password: "" });

  const { data: staff = [], isLoading } = useListAdminStaff({ query: { queryKey: getListAdminStaffQueryKey() } });
  const createMutation = useCreateAdminStaff();
  const staffList = Array.isArray(staff) ? staff : [];
  const canManageAssignedPermission = (key: string) =>
    isFounder || isSuperAdmin || permissions.includes(key);
  const manageablePermissionKeys = ALL_PERMISSION_KEYS.filter(canManageAssignedPermission);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { fullName: "", mobile: "", email: "", password: "", jobTitle: "" },
  });

  const togglePerm = (key: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const toggleGroupPerms = (groupKeys: string[], list: string[], setList: (v: string[]) => void) => {
    const allChecked = groupKeys.every((k) => list.includes(k));
    if (allChecked) setList(list.filter((k) => !groupKeys.includes(k)));
    else setList([...new Set([...list, ...groupKeys])]);
  };

  const onSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate(
      { data: { ...values, permissions: newStaffPerms } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() });
          toast({ title: "تم إضافة الموظف بنجاح" });
          setShowCreate(false);
          form.reset();
          setNewStaffPerms([]);
        },
        onError: (err: any) => toast({ title: "خطأ", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const openEdit = (s: any) => {
    setEditTarget(s);
    setEditForm({ fullName: s.fullName || "", mobile: s.mobile || "", jobTitle: s.jobTitle || "", password: "" });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const body: Record<string, string> = { fullName: editForm.fullName, mobile: editForm.mobile, jobTitle: editForm.jobTitle };
      if (editForm.password.trim().length >= 8) body.password = editForm.password;
      await apiCall(`/admin/staff/${editTarget.id}`, "PATCH", body, token || "");
      queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() });
      toast({ title: "تم تعديل بيانات الموظف" });
      setEditTarget(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const openPermissions = (s: any) => {
    setPermissionsTarget(s);
    setSelectedPerms(s.permissions || []);
  };

  const savePermissions = async () => {
    if (!permissionsTarget) return;
    setSavingPerms(true);
    try {
      await apiCall(`/admin/staff/${permissionsTarget.id}/permissions`, "PATCH", { permissions: selectedPerms }, token || "");
      queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() });
      toast({ title: "تم حفظ الصلاحيات" });
      setPermissionsTarget(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSavingPerms(false);
    }
  };

  const deleteStaff = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الموظف؟")) return;
    setDeletingId(id);
    try {
      await apiCall(`/admin/staff/${id}`, "DELETE", undefined, token || "");
      queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() });
      toast({ title: "تم حذف الموظف" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const PermissionCheckboxes = ({ list, setList }: { list: string[]; setList: (v: string[]) => void }) => (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {PERMISSION_GROUPS.map((group) => {
        const visiblePermissions = group.permissions.filter((p) => canManageAssignedPermission(p.key));
        if (visiblePermissions.length === 0) return null;
        const groupKeys = visiblePermissions.map((p) => p.key);
        const allChecked = groupKeys.every((k) => list.includes(k));
        const someChecked = groupKeys.some((k) => list.includes(k));
        return (
          <div key={group.group} className="border rounded-lg p-3">
            <label className="flex items-center gap-2 font-semibold text-sm mb-2 cursor-pointer">
              <Checkbox
                checked={allChecked}
                data-state={someChecked && !allChecked ? "indeterminate" : undefined}
                onCheckedChange={() => toggleGroupPerms(groupKeys, list, setList)}
              />
              {group.label}
            </label>
            <div className="grid grid-cols-2 gap-1.5 pr-4">
              {visiblePermissions.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground">
                  <Checkbox
                    checked={list.includes(p.key)}
                    onCheckedChange={() => togglePerm(p.key, list, setList)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">الموظفون</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة حسابات المديرين وصلاحياتهم</p>
        </div>
        {(isSuperAdmin || hasPermission("admin.create")) && (
          <Button onClick={() => setShowCreate(true)} data-testid="button-add-staff" className="sm:self-start">
            <PlusCircle className="w-4 h-4 ms-2" />
            إضافة موظف
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : staffList.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <Users2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>لا يوجد موظفون</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {staffList.map((s: any) => {
            const isSA = s.role === "super_admin";
            const isSelf = currentUser?.id === s.id;
            const permCount = isSA ? "كل الصلاحيات" : `${(s.permissions || []).length} صلاحية`;
            return (
              <Card key={s.id} data-testid={`row-staff-${s.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.mobile}{s.jobTitle ? ` · ${s.jobTitle}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                      <Badge className={isSA ? "bg-purple-100 text-purple-800 border-0" : "bg-blue-100 text-blue-800 border-0"}>
                        {isSA ? "مدير عام" : "مدير"}
                      </Badge>
                      {!isSA && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Shield className="w-3 h-3" />
                          {permCount}
                        </Badge>
                      )}
                      {!isSA && (isSuperAdmin || hasPermission("admin.edit") || hasPermission("admin.permissions") || hasPermission("admin.delete")) && (
                        <>
                          {(isSuperAdmin || hasPermission("admin.edit")) && (
                            <Button size="sm" variant="outline" onClick={() => openEdit(s)} data-testid={`button-edit-${s.id}`}>
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                          {!isSelf && (isSuperAdmin || hasPermission("admin.permissions")) && (
                            <Button size="sm" variant="outline" onClick={() => openPermissions(s)} data-testid={`button-perms-${s.id}`}>
                              <Key className="w-3 h-3 ms-1" />
                              الصلاحيات
                            </Button>
                          )}
                          {(isSuperAdmin || hasPermission("admin.delete")) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteStaff(s.id)}
                              disabled={deletingId === s.id}
                              data-testid={`button-delete-${s.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {!isSA && (s.permissions || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 pr-13">
                      {(s.permissions as string[]).slice(0, 6).map((k: string) => (
                        <span key={k} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{k}</span>
                      ))}
                      {(s.permissions as string[]).length > 6 && (
                        <span className="text-xs text-muted-foreground">+{(s.permissions as string[]).length - 6} أخرى</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Staff Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات {editTarget?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="mb-1.5 block">الاسم الكامل</Label>
              <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block">رقم الهاتف</Label>
              <Input value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block">المسمى الوظيفي</Label>
              <Input value={editForm.jobTitle} onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })} placeholder="اختياري" />
            </div>
            <div>
              <Label className="mb-1.5 block">كلمة مرور جديدة</Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="اتركها فارغة إن لم ترد التغيير"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>إلغاء</Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Staff Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة موظف جديد</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel>الاسم الكامل</FormLabel><FormControl><Input data-testid="input-fullname" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="mobile" render={({ field }) => (
                  <FormItem><FormLabel>رقم الهاتف</FormLabel><FormControl><Input data-testid="input-mobile" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>البريد الإلكتروني</FormLabel><FormControl><Input type="email" data-testid="input-email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>كلمة المرور</FormLabel><FormControl><Input type="password" data-testid="input-password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="jobTitle" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>المسمى الوظيفي</FormLabel><FormControl><Input placeholder="مدير خدمة عملاء" data-testid="input-job-title" {...field} /></FormControl></FormItem>
                )} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm">الصلاحيات</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setNewStaffPerms(manageablePermissionKeys)}>تحديد الكل</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setNewStaffPerms([])}>إلغاء الكل</Button>
                  </div>
                </div>
                <PermissionCheckboxes list={newStaffPerms} setList={setNewStaffPerms} />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); form.reset(); setNewStaffPerms([]); }}>إلغاء</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save">
                  {createMutation.isPending ? "جاري الإضافة..." : "إضافة الموظف"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!permissionsTarget} onOpenChange={(open) => { if (!open) setPermissionsTarget(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>صلاحيات {permissionsTarget?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">{selectedPerms.length} صلاحية محددة</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedPerms((current) => [...new Set([...current.filter((key) => !canManageAssignedPermission(key)), ...manageablePermissionKeys])])}>تحديد الكل</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPerms([])}>إلغاء الكل</Button>
            </div>
          </div>
          <PermissionCheckboxes list={selectedPerms} setList={setSelectedPerms} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setPermissionsTarget(null)}>إلغاء</Button>
            <Button onClick={savePermissions} disabled={savingPerms} data-testid="button-save-perms">
              {savingPerms ? "جاري الحفظ..." : "حفظ الصلاحيات"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
