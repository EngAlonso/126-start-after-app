import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  RocketIcon, RefreshCw, Trash2, Settings, ScrollText, Server, Cpu,
  Users2, Clock, CheckCircle2, XCircle, ShieldAlert, Loader2,
} from "lucide-react";
import { clearFrontendCache, forcePwaUpdate, reloadAppConfiguration } from "@/lib/maintenance-client";

const getToken = () => { try { return localStorage.getItem("fnashha_token") || ""; } catch { return ""; } };
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "خطأ غير معروف" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
};

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—";

interface MaintenanceStatus {
  frontendVersion: string;
  backendVersion: string;
  swVersion: number;
  buildTimestamp: string;
  lastDeploymentAt: string | null;
  connectedClients: { admins: number; users: number; uniqueUsers: number };
}

interface MaintenanceLogEntry {
  id: number;
  action: string;
  adminName: string;
  result: "success" | "failed";
  details: string | null;
  createdAt: string;
}

type ConfirmAction = "deploy" | "clear_cache" | "force_pwa" | "reload_config" | null;

export default function AdminSystemMaintenance() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [busyAction, setBusyAction] = useState<ConfirmAction>(null);

  const { data: status, isLoading } = useQuery<MaintenanceStatus>({
    queryKey: ["maintenance-status"],
    queryFn: () => apiFetch("/api/admin/maintenance/status"),
    refetchInterval: 15_000,
  });

  const { data: logsData } = useQuery<{ logs: MaintenanceLogEntry[] }>({
    queryKey: ["maintenance-logs"],
    queryFn: () => apiFetch("/api/admin/maintenance/logs"),
    refetchInterval: 15_000,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["maintenance-status"] });
    qc.invalidateQueries({ queryKey: ["maintenance-logs"] });
  };

  const runDeploy = async () => {
    setBusyAction("deploy");
    try {
      await apiFetch("/api/admin/maintenance/deploy", { method: "POST" });
      toast({ title: "تم النشر بنجاح", description: "تم نشر نسخة جديدة وإخطار جميع المستخدمين المتصلين" });
      refreshAll();
    } catch (err: any) {
      toast({ title: "فشل النشر", description: err.message, variant: "destructive" });
    } finally {
      setBusyAction(null);
      setConfirmAction(null);
    }
  };

  const runClearCache = async () => {
    setBusyAction("clear_cache");
    try {
      const result = await clearFrontendCache(qc);
      if (result.success) {
        toast({ title: "تم مسح الكاش", description: result.details });
        refreshAll();
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast({ title: "فشل مسح الكاش", description: result.details, variant: "destructive" });
      }
    } finally {
      setBusyAction(null);
      setConfirmAction(null);
    }
  };

  const runForcePwa = async () => {
    setBusyAction("force_pwa");
    try {
      const result = await forcePwaUpdate();
      toast({
        title: result.success ? "تم التحقق من التحديثات" : "فشل التحديث",
        description: result.details,
        variant: result.success ? undefined : "destructive",
      });
      refreshAll();
    } finally {
      setBusyAction(null);
      setConfirmAction(null);
    }
  };

  const runReloadConfig = async () => {
    setBusyAction("reload_config");
    try {
      const result = await reloadAppConfiguration(qc);
      toast({
        title: result.success ? "تم إعادة التحميل" : "فشل إعادة التحميل",
        description: result.details,
        variant: result.success ? undefined : "destructive",
      });
      refreshAll();
    } finally {
      setBusyAction(null);
      setConfirmAction(null);
    }
  };

  const confirmMap: Record<Exclude<ConfirmAction, null>, { title: string; desc: string; action: () => void }> = {
    deploy: {
      title: "نشر تحديث وإجبار جميع المستخدمين على التحديث؟",
      desc: "سيتم إصدار نسخة جديدة من Service Worker وإخطار جميع الأجهزة المتصلة حالياً بضرورة التحديث تلقائياً.",
      action: runDeploy,
    },
    clear_cache: {
      title: "مسح كاش المتصفح الأمامي؟",
      desc: "سيتم مسح Cache Storage و IndexedDB وكاش React Query في هذا المتصفح فقط، ثم إعادة تحميل الصفحة. لن يتم مسح الحسابات أو قاعدة البيانات أو الملفات المرفوعة.",
      action: runClearCache,
    },
    force_pwa: {
      title: "إجبار تحديث الـ PWA؟",
      desc: "سيتم التحقق من وجود نسخة أحدث من Service Worker، وتفعيلها فوراً إن وُجدت، ثم إعادة تحميل الصفحة.",
      action: runForcePwa,
    },
    reload_config: {
      title: "إعادة تحميل إعدادات النظام؟",
      desc: "سيتم إعادة تحميل إعدادات CMS والعلامة التجارية وإعدادات التطبيق من قاعدة البيانات دون إعادة تشغيل الخادم.",
      action: runReloadConfig,
    },
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            صيانة النظام
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            إدارة نشر الواجهة الأمامية، تحديثات العملاء، والكاش — للمدير العام فقط
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          تحديث
        </Button>
      </div>

      {/* Section 1 — Frontend Deployment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-base flex items-center gap-2">
            <RocketIcon className="w-4 h-4 text-primary" />
            نشر الواجهة الأمامية (Frontend Deployment)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs md:text-sm">
            <InfoBox label="إصدار الواجهة الأمامية" value={status?.frontendVersion} loading={isLoading} />
            <InfoBox label="إصدار Service Worker" value={status ? `v${status.swVersion}` : undefined} loading={isLoading} />
            <InfoBox label="وقت البناء" value={status ? formatDate(status.buildTimestamp) : undefined} loading={isLoading} />
            <InfoBox label="آخر نشر" value={status ? formatDate(status.lastDeploymentAt) : undefined} loading={isLoading} />
            <InfoBox
              label="العملاء المتصلون"
              value={status ? `${status.connectedClients.uniqueUsers + status.connectedClients.admins} جلسة نشطة` : undefined}
              loading={isLoading}
            />
          </div>
          <Button
            className="w-full md:w-auto gap-2"
            onClick={() => setConfirmAction("deploy")}
            disabled={busyAction !== null}
          >
            {busyAction === "deploy" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RocketIcon className="w-4 h-4" />}
            نشر وإجبار تحديث العملاء
          </Button>
        </CardContent>
      </Card>

      {/* Section 2 — Client Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-base flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-primary" />
            صيانة العملاء (Client Maintenance)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => setConfirmAction("clear_cache")}
            disabled={busyAction !== null}
          >
            {busyAction === "clear_cache" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            مسح كاش الواجهة الأمامية
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => setConfirmAction("force_pwa")}
            disabled={busyAction !== null}
          >
            {busyAction === "force_pwa" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            إجبار تحديث PWA
          </Button>
        </CardContent>
      </Card>

      {/* Section 3 — Application Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            إعدادات التطبيق (Application Configuration)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setConfirmAction("reload_config")}
            disabled={busyAction !== null}
          >
            {busyAction === "reload_config" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            إعادة تحميل إعدادات النظام
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            يعيد تحميل إعدادات CMS والعلامة التجارية وإعدادات التطبيق دون الحاجة لإعادة تشغيل الخادم.
          </p>
        </CardContent>
      </Card>

      {/* Section 4 — Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-base flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            التشخيصات (Diagnostics)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs md:text-sm">
          <InfoBox label="إصدار الواجهة الأمامية" value={status?.frontendVersion} loading={isLoading} />
          <InfoBox label="إصدار الخادم الخلفي" value={status?.backendVersion} loading={isLoading} />
          <InfoBox label="إصدار Service Worker" value={status ? `v${status.swVersion}` : undefined} loading={isLoading} />
          <InfoBox label="وقت البناء" value={status ? formatDate(status.buildTimestamp) : undefined} loading={isLoading} />
          <InfoBox
            label="العملاء المتصلون"
            value={status ? `مدراء: ${status.connectedClients.admins} — مستخدمون: ${status.connectedClients.uniqueUsers}` : undefined}
            loading={isLoading}
            icon={<Users2 className="w-3.5 h-3.5" />}
          />
          <InfoBox label="آخر نشر" value={status ? formatDate(status.lastDeploymentAt) : undefined} loading={isLoading} icon={<Clock className="w-3.5 h-3.5" />} />
        </CardContent>
      </Card>

      {/* Section 5 — Maintenance Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-base flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            سجل الصيانة (Maintenance Log)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!logsData?.logs || logsData.logs.length === 0 ? (
            <p className="text-xs md:text-sm text-muted-foreground text-center py-6">لا توجد إجراءات صيانة مسجلة بعد</p>
          ) : (
            <div className="space-y-2">
              {logsData.logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border">
                  {log.result === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs md:text-sm font-medium truncate">{log.action}</p>
                      <Badge variant={log.result === "success" ? "default" : "destructive"} className="text-[10px] flex-shrink-0">
                        {log.result === "success" ? "نجح" : "فشل"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {log.adminName} — {formatDate(log.createdAt)}
                    </p>
                    {log.details && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{log.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog for every action */}
      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          {confirmAction && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  {confirmMap[confirmAction].title}
                </DialogTitle>
                <DialogDescription>{confirmMap[confirmAction].desc}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={busyAction !== null}>
                  إلغاء
                </Button>
                <Button onClick={confirmMap[confirmAction].action} disabled={busyAction !== null} className="gap-2">
                  {busyAction !== null && <Loader2 className="w-4 h-4 animate-spin" />}
                  تأكيد
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoBox({ label, value, loading, icon }: { label: string; value?: string; loading?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="p-2.5 rounded-lg border border-border bg-muted/30">
      <p className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className="text-xs md:text-sm font-semibold mt-0.5 truncate">
        {loading ? "..." : value ?? "—"}
      </p>
    </div>
  );
}
