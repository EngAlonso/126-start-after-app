import { useState } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Search, RefreshCw, Trash2, ChevronLeft, AlertTriangle, UserCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function AdminRejectedTechnicians() {
  const { toast } = useToast();
  const { token, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { params, updateQuery } = useAdminListState();
  const search = params.get("search") || "";
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const { data: rejected = [], isLoading } = useQuery({
    queryKey: ["rejectedTechnicians"],
    queryFn: () => apiCall("/technicians/rejected", "GET", undefined, token || ""),
  });

  const filtered = (rejected as any[]).filter((t: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.user?.fullName?.toLowerCase().includes(q) ||
      t.user?.mobile?.includes(q) ||
      t.nationalId?.includes(q)
    );
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["rejectedTechnicians"] });

  const handleRestore = async (userId: number) => {
    setLoading(true);
    try {
      await apiCall(`/technicians/${userId}/restore`, "POST", {}, token || "");
      toast({ title: "تم استعادة الفني", description: "تم نقل الفني إلى قائمة الانتظار للمراجعة" });
      invalidate();
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
      invalidate();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">الفنيون المرفوضون</h1>
        <p className="text-muted-foreground text-sm mt-1">
          أرشيف الفنيين الذين رُفضت طلباتهم — {(rejected as any[]).length} فني
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو الهاتف أو رقم البطاقة..."
          value={search}
          onChange={(e) => updateQuery({ search: e.target.value || null }, { replace: true })}
          className="pr-9"
          data-testid="input-search"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">{search ? "لا توجد نتائج" : "لا يوجد فنيون مرفوضون"}</p>
            <p className="text-sm mt-1">ستظهر هنا طلبات الفنيين المرفوضة بشكل دائم</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((tech: any) => (
            <Card key={tech.id} data-testid={`card-rejected-${tech.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Photo */}
                  <div className="flex-shrink-0">
                    {tech.personalPhoto ? (
                      <CldImg src={tech.personalPhoto} alt="" width={96} className="w-12 h-12 rounded-full object-cover border" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border">
                        <span className="text-base font-bold text-muted-foreground">{tech.user?.fullName?.[0] || "?"}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold">{tech.user?.fullName}</p>
                      <Badge className="bg-red-100 text-red-800 border-0 text-xs">مرفوض</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{tech.user?.mobile}</p>
                    <p className="text-xs text-muted-foreground">بطاقة: {tech.nationalId}</p>
                    {tech.rejectionReason && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg p-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>سبب الرفض: {tech.rejectionReason}</span>
                      </div>
                    )}
                    {tech.rejectedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        تاريخ الرفض: {new Date(tech.rejectedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
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

                {/* ID Photos */}
                {(tech.nationalIdFront || tech.nationalIdBack) && (
                  <div className="mt-3 pt-3 border-t flex gap-2">
                    {tech.nationalIdFront && (
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">بطاقة - أمامي</p>
                        <CldImg src={tech.nationalIdFront} alt="بطاقة أمامي" width={400} className="w-full h-20 object-cover rounded-lg border" />
                      </div>
                    )}
                    {tech.nationalIdBack && (
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">بطاقة - خلفي</p>
                        <CldImg src={tech.nationalIdBack} alt="بطاقة خلفي" width={400} className="w-full h-20 object-cover rounded-lg border" />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
