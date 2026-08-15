import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Database, Download, Trash2, Upload, RefreshCw, FileSpreadsheet,
  Table2, ChevronLeft, ChevronRight, AlertTriangle, ShieldAlert,
  Archive, RotateCcw, FileDown, Search, Eye, BarChart3,
} from "lucide-react";

const getToken = () => localStorage.getItem("fnashha_token") || "";
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "خطأ غير معروف" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
};

const downloadFile = async (url: string, filename: string) => {
  const token = getToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("فشل التنزيل");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (d: string) => new Date(d).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });

const AR_TABLE_NAMES: Record<string, string> = {
  users: "المستخدمون", technician_profiles: "ملفات الفنيين", services: "الخدمات",
  governorates: "المحافظات", areas: "المناطق", service_requests: "طلبات الخدمة",
  offers: "العروض (طلبات الفنيين)", messages: "الرسائل", ratings: "التقييمات",
  point_transactions: "معاملات النقاط", commission_ranges: "نطاقات العمولة",
  support_tickets: "تذاكر الدعم", notifications: "الإشعارات", banners: "البانرات والعروض",
  cms_settings: "إعدادات CMS", activity_logs: "سجل الأنشطة", audit_trail: "مسار التدقيق",
  price_adjustments: "تعديلات السعر", technician_services: "خدمات الفنيين",
  technician_areas: "مناطق الفنيين", admin_permissions: "صلاحيات الإدارة",
  ticket_replies: "ردود التذاكر",
};

type BackupMeta = { id: string; fileName: string; createdAt: string; sizeBytes: number; type: string; tableCount: number; totalRecords: number };
type DbOverview = { tableCount: number; totalRecords: number; tableCounts: Record<string, number>; lastBackup: string | null };
type TableData = { columns: string[]; rows: any[]; total: number; page: number; limit: number; totalPages: number };
type ValidationResult = { valid: boolean; backupDate: string; summary: { table: string; count: number }[]; totalRecords: number };
type RestoreReportRow = { table: string; found: number; inserted: number; skipped: number; failed: number; errors: string[] };
type RestoreResult = { success: boolean; tablesRestored: number; totalInserted: number; totalFailed: number; report: RestoreReportRow[] };

// ─── BACKUP TAB ───────────────────────────────────────────────────────────────

function BackupTab() {
  const { toast } = useToast();
  const { isSuperAdmin, hasPermission } = useAuth();
  const canCreate   = isSuperAdmin || hasPermission("backup.create");
  const canDownload = isSuperAdmin || hasPermission("backup.download");
  const canDelete   = isSuperAdmin || hasPermission("backup.delete");
  const canRestore  = isSuperAdmin || hasPermission("backup.restore");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: backups = [], isLoading: loadingBackups } = useQuery<BackupMeta[]>({
    queryKey: ["db-backups"],
    queryFn: () => apiFetch("/api/admin/db/backups"),
    enabled: canDownload,
  });

  const handleCreate = async () => {
    setCreating(true);
    try {
      const meta: BackupMeta = await apiFetch("/api/admin/db/backup", { method: "POST" });
      qc.invalidateQueries({ queryKey: ["db-backups"] });
      toast({ title: `✅ تم إنشاء النسخة الاحتياطية — ${formatBytes(meta.sizeBytes)}` });
      // Auto-download
      setDownloading(meta.id);
      await downloadFile(`/api/admin/db/backups/${meta.id}/download`, meta.fileName);
      setDownloading(null);
    } catch (e: any) {
      toast({ title: e.message || "حدث خطأ", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (b: BackupMeta) => {
    setDownloading(b.id);
    try {
      await downloadFile(`/api/admin/db/backups/${b.id}/download`, b.fileName);
    } catch (e: any) {
      toast({ title: e.message || "فشل التنزيل", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/db/backups/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["db-backups"] }); toast({ title: "تم حذف النسخة الاحتياطية" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleValidate = async () => {
    if (!restoreFile) return;
    setValidating(true);
    setValidation(null);
    try {
      const fd = new FormData();
      fd.append("backup", restoreFile);
      const token = getToken();
      const res = await fetch("/api/admin/db/restore/validate", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "الملف غير صالح");
      setValidation(data);
      toast({ title: "✅ الملف صالح للاستعادة" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile || confirmPhrase !== "أنا متأكد") return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      const fd = new FormData();
      fd.append("backup", restoreFile);
      fd.append("confirm", "أنا متأكد");
      const token = getToken();
      const res = await fetch("/api/admin/db/restore/apply", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data: RestoreResult & { error?: string; detail?: string } = await res.json();
      if (!res.ok) {
        // Show the real backend error (detail) not the generic Arabic wrapper
        const realError = data.detail ? `${data.error}\n\n${data.detail}` : (data.error || "فشلت الاستعادة");
        // If there's a partial report, still surface it so the user can see which step failed
        if (data.report && data.report.length > 0) {
          setRestoreResult({ ...data, success: false, tablesRestored: 0, totalInserted: 0, totalFailed: 0 } as any);
        }
        throw new Error(realError);
      }
      setRestoreResult(data);
      if (data.totalInserted === 0) {
        toast({ title: "⚠️ اكتملت الاستعادة لكن لم يُدرج أي سجل — راجع التقرير", variant: "destructive" });
      } else if (data.totalFailed > 0) {
        toast({ title: `⚠️ استُعيد ${data.totalInserted} سجل مع ${data.totalFailed} خطأ — راجع التقرير`, variant: "destructive" });
      } else {
        toast({ title: `✅ تمت الاستعادة — ${data.totalInserted} سجل في ${data.tablesRestored} جدول` });
      }
      qc.invalidateQueries({ queryKey: ["db-backups"] });
      qc.invalidateQueries({ queryKey: ["db-overview"] });
    } catch (e: any) {
      // Show the full real error including backend detail — do NOT suppress it
      console.error("[RESTORE frontend]", e.message);
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const handleCloseRestoreDialog = () => {
    setRestoreOpen(false);
    setValidation(null);
    setRestoreFile(null);
    setConfirmPhrase("");
    setRestoreResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Create Backup — backup.create only */}
      {canCreate && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Archive className="w-5 h-5 text-primary" />
              إنشاء نسخة احتياطية جديدة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              ينشئ نسخة احتياطية كاملة لجميع الجداول ({Object.keys(AR_TABLE_NAMES).length} جدول) ويحفظها ويُنزّلها تلقائياً.
            </p>
            <Button onClick={handleCreate} disabled={creating} size="lg" className="w-full sm:w-auto">
              {creating ? <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />جاري الإنشاء...</> : <><Archive className="w-4 h-4 ml-2" />إنشاء نسخة احتياطية وتنزيلها</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Backup History — backup.download only */}
      {canDownload && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="w-5 h-5 text-primary" />
                سجل النسخ الاحتياطية
              </CardTitle>
              <Badge variant="secondary">{backups.length} نسخة</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loadingBackups ? (
              <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
            ) : backups.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Archive className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد نسخ احتياطية بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/20 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" title={b.fileName}>{b.fileName}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{formatDate(b.createdAt)}</span>
                        <Badge variant="outline" className="text-xs">{formatBytes(b.sizeBytes)}</Badge>
                        <Badge variant="secondary" className="text-xs">{b.totalRecords} سجل</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleDownload(b)} disabled={downloading === b.id}>
                        {downloading === b.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </Button>
                      {canDelete && (
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(b.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Restore — backup.restore only */}
      {canRestore && (
        <>
        <Card className="border-amber-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-amber-700">
            <RotateCcw className="w-5 h-5" />
            استعادة نسخة احتياطية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">سيتم حذف البيانات الحالية واستبدالها بمحتوى النسخة الاحتياطية. تُنشأ نسخة أمان تلقائياً قبل الاستعادة.</p>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={e => { setRestoreFile(e.target.files?.[0] || null); setValidation(null); }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 ml-2" />
              اختر ملف النسخة الاحتياطية (.zip)
            </Button>
            {restoreFile && <span className="text-sm text-muted-foreground truncate max-w-xs">{restoreFile.name}</span>}
          </div>
          {restoreFile && (
            <Button variant="outline" onClick={handleValidate} disabled={validating}>
              {validating ? <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />جاري التحقق...</> : <><Eye className="w-4 h-4 ml-2" />تحقق من الملف</>}
            </Button>
          )}
          {validation && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                <p className="text-sm font-semibold text-green-800 mb-1">✅ الملف صالح</p>
                <p className="text-xs text-green-700">تاريخ النسخة: {formatDate(validation.backupDate)}</p>
                <p className="text-xs text-green-700">إجمالي السجلات: {validation.totalRecords.toLocaleString("ar-EG")}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {validation.summary.filter(s => s.count > 0).map(s => (
                  <div key={s.table} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2 text-xs">
                    <span className="text-muted-foreground truncate">{AR_TABLE_NAMES[s.table] || s.table}</span>
                    <Badge variant="secondary" className="text-xs shrink-0 mr-1">{s.count}</Badge>
                  </div>
                ))}
              </div>
              <Button variant="destructive" onClick={() => setRestoreOpen(true)} className="w-full">
                <RotateCcw className="w-4 h-4 ml-2" />
                استعادة هذه النسخة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={restoreOpen} onOpenChange={handleCloseRestoreDialog}>
        <DialogContent dir="rtl" className={restoreResult ? "max-w-2xl" : "max-w-sm"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {restoreResult ? "تقرير الاستعادة" : "تأكيد الاستعادة"}
            </DialogTitle>
          </DialogHeader>

          {restoreResult ? (
            <div className="space-y-4">
              {/* Summary banner */}
              <div className={`p-3 rounded-lg border text-sm flex flex-wrap gap-4 ${restoreResult.totalInserted === 0 ? "bg-destructive/10 border-destructive/30" : restoreResult.totalFailed > 0 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-green-500/10 border-green-500/30"}`}>
                <span>📊 <strong>{restoreResult.tablesRestored}</strong> جدول استُعيد</span>
                <span>✅ <strong>{restoreResult.totalInserted}</strong> سجل أُدرج</span>
                {restoreResult.totalFailed > 0 && <span className="text-destructive">❌ <strong>{restoreResult.totalFailed}</strong> سجل فشل</span>}
              </div>

              {/* Per-table report */}
              <div className="max-h-96 overflow-y-auto border rounded-lg divide-y text-xs">
                {restoreResult.report.filter(r => r.found > 0 || r.failed > 0).map(r => (
                  <div key={r.table} className={`px-3 py-2 flex flex-col gap-1 ${r.failed > 0 ? "bg-destructive/5" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{AR_TABLE_NAMES[r.table] || r.table}</span>
                      <div className="flex gap-2 text-muted-foreground">
                        <span>وُجد: {r.found}</span>
                        <span className="text-green-600">أُدرج: {r.inserted}</span>
                        {r.skipped > 0 && <span>تخطى: {r.skipped}</span>}
                        {r.failed > 0 && <span className="text-destructive font-bold">فشل: {r.failed}</span>}
                      </div>
                    </div>
                    {r.errors.slice(0, 3).map((err, i) => (
                      <p key={i} className="text-destructive text-xs break-all bg-destructive/5 rounded px-2 py-1">{err}</p>
                    ))}
                    {r.errors.length > 3 && <p className="text-muted-foreground text-xs">... و{r.errors.length - 3} خطأ آخر</p>}
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button onClick={handleCloseRestoreDialog} className="w-full">إغلاق</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">ستُحذف جميع البيانات الحالية. اكتب <strong className="text-foreground">أنا متأكد</strong> للمتابعة.</p>
              <Input value={confirmPhrase} onChange={e => setConfirmPhrase(e.target.value)} placeholder="اكتب: أنا متأكد" className="mt-2" />
              <DialogFooter className="gap-2 mt-2">
                <Button variant="destructive" onClick={handleRestore} disabled={confirmPhrase !== "أنا متأكد" || restoring} className="flex-1">
                  {restoring ? <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />جاري الاستعادة...</> : "استعادة البيانات"}
                </Button>
                <Button variant="outline" onClick={handleCloseRestoreDialog}>إلغاء</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}

// ─── DB MANAGEMENT TAB ────────────────────────────────────────────────────────

function DbManagementTab() {
  const { toast } = useToast();
  const [browsingTable, setBrowsingTable] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [searchQuery] = useState("");
  const [resetAction, setResetAction] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: overview, isLoading: loadingOverview, refetch: refetchOverview } = useQuery<DbOverview>({
    queryKey: ["db-overview"],
    queryFn: () => apiFetch("/api/admin/db/overview"),
  });

  const { data: tableData, isLoading: loadingTable } = useQuery<TableData>({
    queryKey: ["db-table", browsingTable, tablePage],
    queryFn: () => apiFetch(`/api/admin/db/tables/${browsingTable}?page=${tablePage}&limit=50`),
    enabled: !!browsingTable,
  });

  const handleDownloadCsv = async (table: string) => {
    setDownloading(table + "_csv");
    try {
      await downloadFile(`/api/admin/db/export/csv/${table}`, `${table}.csv`);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadXlsx = async (report: string, filename: string) => {
    setDownloading(report + "_xlsx");
    try {
      await downloadFile(`/api/admin/db/export/xlsx/${report}`, filename);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleReset = async () => {
    if (!resetAction || resetConfirm !== "أنا متأكد") return;
    setResetLoading(true);
    try {
      await apiFetch("/api/admin/db/reset", { method: "POST", body: JSON.stringify({ action: resetAction, confirm: "أنا متأكد" }) });
      toast({ title: "✅ تمت عملية التهيئة بنجاح" });
      setResetAction(null);
      setResetConfirm("");
      refetchOverview();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  const sortedTables = overview ? Object.entries(overview.tableCounts).sort((a, b) => b[1] - a[1]) : [];

  const RESET_ACTIONS = [
    { id: "requests", label: "مسح طلبات الخدمة", description: "يحذف كل الطلبات والعروض والرسائل والتقييمات", color: "text-orange-600" },
    { id: "banners", label: "مسح البانرات والعروض", description: "يحذف كل البانرات والعروض الترويجية", color: "text-orange-600" },
    { id: "customers", label: "مسح بيانات العملاء", description: "يحذف كل العملاء وطلباتهم", color: "text-red-600" },
    { id: "technicians", label: "مسح بيانات الفنيين", description: "يحذف كل الفنيين وملفاتهم", color: "text-red-600" },
    { id: "full", label: "إعادة تهيئة كاملة", description: "يحذف كل البيانات ماعدا حسابات الإدارة", color: "text-destructive font-bold" },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">نظرة عامة على قاعدة البيانات</h3>
          <Button size="sm" variant="outline" onClick={() => refetchOverview()}>
            <RefreshCw className="w-3.5 h-3.5 ml-1.5" />تحديث
          </Button>
        </div>
        {loadingOverview ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "عدد الجداول", value: overview?.tableCount || 0, icon: Table2 },
              { label: "إجمالي السجلات", value: (overview?.totalRecords || 0).toLocaleString("ar-EG"), icon: Database },
              { label: "آخر نسخة احتياطية", value: overview?.lastBackup ? new Date(overview.lastBackup).toLocaleDateString("ar-EG") : "لا يوجد", icon: Archive },
              { label: "المزود", value: "Replit PostgreSQL", icon: BarChart3 },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="border-border/60">
                <CardContent className="p-4 text-center">
                  <Icon className="w-5 h-5 text-primary mx-auto mb-1.5" />
                  <p className="text-xl font-black text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Table Browser */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Table2 className="w-5 h-5 text-primary" />
            متصفح الجداول
            <Badge variant="secondary" className="mr-auto">{sortedTables.length} جدول</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {browsingTable ? (
            <div className="space-y-3">
              <div className="flex items-center flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setBrowsingTable(null); setTablePage(1); }}>
                  <ChevronRight className="w-4 h-4 ml-1" />
                  رجوع
                </Button>
                <span className="font-bold truncate max-w-[120px] sm:max-w-none">{AR_TABLE_NAMES[browsingTable] || browsingTable}</span>
                <Badge variant="secondary">{tableData?.total?.toLocaleString("ar-EG") || 0} سجل</Badge>
                <Badge variant="outline" className="text-xs">قراءة فقط</Badge>
                <Button size="sm" variant="ghost" className="mr-auto" onClick={() => handleDownloadCsv(browsingTable)} disabled={downloading === browsingTable + "_csv"}>
                  <FileDown className="w-3.5 h-3.5 ml-1" />
                  CSV
                </Button>
              </div>
              {loadingTable ? (
                <div className="h-48 bg-muted rounded-xl animate-pulse" />
              ) : tableData && tableData.rows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>{tableData.columns.map(c => <th key={c} className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">{c}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tableData.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          {tableData.columns.map(c => {
                            let v = row[c];
                            if (v === null || v === undefined) v = "—";
                            else if (typeof v === "boolean") v = v ? "✓" : "✗";
                            else if (typeof v === "string" && v.startsWith("data:")) v = "[base64]";
                            else v = String(v).slice(0, 60) + (String(v).length > 60 ? "…" : "");
                            return <td key={c} className="px-3 py-2 text-foreground whitespace-nowrap" title={String(row[c] ?? "")}>{v}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">الجدول فارغ</div>
              )}
              {tableData && tableData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePage <= 1}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">{tablePage} / {tableData.totalPages}</span>
                  <Button size="sm" variant="outline" onClick={() => setTablePage(p => Math.min(tableData.totalPages, p + 1))} disabled={tablePage >= tableData.totalPages}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {loadingOverview ? [1,2,3,4,5,6].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />) :
              sortedTables.map(([table, count]) => (
                <button
                  key={table}
                  onClick={() => { setBrowsingTable(table); setTablePage(1); }}
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-right"
                >
                  <span className="text-sm font-medium text-foreground truncate">{AR_TABLE_NAMES[table] || table}</span>
                  <Badge variant="secondary" className="text-xs shrink-0 mr-2">{count.toLocaleString("ar-EG")}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Center */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            مركز التصدير
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Professional XLSX reports */}
          <div>
            <h4 className="text-sm font-bold text-foreground mb-3">تقارير XLSX المهنية</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: "technicians", label: "تقرير الفنيين", desc: "ملخص + بيانات + مستندات (3 أوراق)", file: "technicians_report.xlsx" },
                { id: "customers", label: "تقرير العملاء", desc: "ملخص + بيانات (ورقتان)", file: "customers_report.xlsx" },
                { id: "requests", label: "تقرير الطلبات", desc: "كل طلبات الخدمة مع التفاصيل", file: "requests_report.xlsx" },
                { id: "services", label: "تقرير الخدمات", desc: "الخدمات مع إحصائيات الطلبات", file: "services_report.xlsx" },
                { id: "full", label: "تقرير النظام الشامل", desc: "جميع الجداول في ملف واحد", file: "full_system_report.xlsx" },
              ].map(r => (
                <div key={r.id} className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-secondary/10">
                  <div>
                    <p className="font-semibold text-sm">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => handleDownloadXlsx(r.id, r.file)} disabled={downloading === r.id + "_xlsx"}>
                    {downloading === r.id + "_xlsx" ? <RefreshCw className="w-3.5 h-3.5 ml-1.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 ml-1.5" />}
                    تنزيل XLSX
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* CSV export by table */}
          <div>
            <h4 className="text-sm font-bold text-foreground mb-3">تصدير CSV — أي جدول</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(AR_TABLE_NAMES).map(([table, label]) => (
                <Button key={table} size="sm" variant="ghost" className="h-9 text-xs justify-start border border-border/50 hover:border-primary/40"
                  onClick={() => handleDownloadCsv(table)} disabled={downloading === table + "_csv"}>
                  {downloading === table + "_csv" ? <RefreshCw className="w-3 h-3 ml-1 animate-spin" /> : <FileDown className="w-3 h-3 ml-1 text-primary" />}
                  {label.slice(0, 18)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Tools */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <ShieldAlert className="w-5 h-5" />
            أدوات إعادة التهيئة
            <Badge variant="destructive" className="mr-auto text-xs">خطر</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-destructive/5 rounded-xl border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive/90">تُنشئ نسخة احتياطية تلقائية قبل كل عملية. كل عملية تتطلب كتابة <strong>أنا متأكد</strong> يدوياً في مربع التأكيد.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RESET_ACTIONS.map(a => (
              <button key={a.id} onClick={() => { setResetAction(a.id); setResetConfirm(""); }}
                className="text-right p-3 rounded-xl border border-border hover:border-destructive/50 hover:bg-destructive/5 transition-all">
                <p className={`text-sm font-semibold ${a.color}`}>{a.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={!!resetAction} onOpenChange={v => { if (!v) { setResetAction(null); setResetConfirm(""); } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              {RESET_ACTIONS.find(a => a.id === resetAction)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{RESET_ACTIONS.find(a => a.id === resetAction)?.description}.</p>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
              ⚡ ستُنشأ نسخة احتياطية تلقائية قبل تنفيذ العملية.
            </div>
            <div>
              <label className="text-sm font-medium">اكتب: <span className="font-bold text-destructive">أنا متأكد</span></label>
              <Input value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} placeholder="أنا متأكد" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="destructive" onClick={handleReset} disabled={resetConfirm !== "أنا متأكد" || resetLoading} className="flex-1">
              {resetLoading ? <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />جاري التنفيذ...</> : "تنفيذ العملية"}
            </Button>
            <Button variant="outline" onClick={() => setResetAction(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* suppress unused var */}
      <span className="hidden">{searchQuery}</span>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AdminDatabase() {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"backup" | "manage">("backup");

  // Safety: non-SA cannot view manage tab even if state gets corrupted
  const safeTab = (!isSuperAdmin && activeTab === "manage") ? "backup" : activeTab;

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-black text-foreground">الداتا بيز</h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة قاعدة البيانات، النسخ الاحتياطية، والتصدير</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {/* Tab 1 — backup: always visible */}
        <button onClick={() => setActiveTab("backup")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            safeTab === "backup" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Archive className="w-4 h-4" />
          النسخ الاحتياطي
        </button>
        {/* Tab 2 — manage: Super Admin ONLY */}
        {isSuperAdmin && (
          <button onClick={() => setActiveTab("manage")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              safeTab === "manage" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Database className="w-4 h-4" />
            إدارة قاعدة البيانات
          </button>
        )}
      </div>

      {safeTab === "backup" ? <BackupTab /> : <DbManagementTab />}
    </div>
  );
}
