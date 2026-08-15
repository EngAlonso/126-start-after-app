import { useListActivityLogs, getListActivityLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText, Clock, User } from "lucide-react";

export default function AdminLogs() {
  const { data: logs = [], isLoading } = useListActivityLogs(undefined, {
    query: { queryKey: getListActivityLogsQueryKey() },
  });

  const logList = Array.isArray(logs) ? logs : [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">سجل الأنشطة</h1>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : logList.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد سجلات</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-4 px-4 py-3 text-xs font-semibold text-muted-foreground bg-muted/30">
                <span>الإجراء</span>
                <span>المسؤول</span>
                <span>التفاصيل</span>
                <span>الوقت</span>
              </div>
              {logList.map((log: any) => (
                <div key={log.id} className="grid grid-cols-4 px-4 py-3 items-center text-sm" data-testid={`row-log-${log.id}`}>
                  <span className="font-medium">{log.action}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <User className="w-3 h-3" />
                    {log.admin?.fullName || "—"}
                  </span>
                  <span className="text-muted-foreground truncate">{log.details || "—"}</span>
                  <span className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Clock className="w-3 h-3" />
                    {new Date(log.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
