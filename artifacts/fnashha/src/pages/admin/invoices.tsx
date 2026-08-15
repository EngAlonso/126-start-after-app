/**
 * Admin Invoices List — shows all generated invoices with search and filter.
 * Route: /admin/invoices
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FileText, Search, Eye, Loader2, ReceiptText, Users } from "lucide-react";
import { useAdminListState } from "@/hooks/use-admin-list-state";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function AdminInvoices() {
  const { token, isSuperAdmin, hasPermission } = useAuth();
  const { toast } = useToast();
  const { params, updateQuery } = useAdminListState();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const search = params.get("search") || "";
  const typeFilter = (params.get("type") || "all") as "all" | "customer" | "technician";
  const page = Math.max(1, Number(params.get("page") || "1"));
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE_URL}/api/invoices/list?page=${page}&limit=${PAGE_SIZE}&type=${typeFilter}&search=${encodeURIComponent(search)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setInvoices(d); })
      .catch(() => toast({ title: "تعذر تحميل الفواتير", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [page, typeFilter, search]);

  const canView = isSuperAdmin
    || hasPermission("invoices.view_customer")
    || hasPermission("invoices.view_technician");

  if (!canView) {
    return (
      <div className="p-6 text-center text-muted-foreground">ليس لديك صلاحية عرض الفواتير</div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-primary" />
            الفواتير
          </h1>
          <p className="text-sm text-muted-foreground mt-1">جميع الفواتير المُنشأة من الطلبات المكتملة</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الفاتورة أو رقم الطلب..."
                value={search}
                onChange={(e) => updateQuery({ search: e.target.value || null, page: null }, { replace: true })}
                className="pr-9"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "customer", "technician"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={typeFilter === t ? "default" : "outline"}
                  onClick={() => updateQuery({ type: t === "all" ? null : t, page: null })}
                >
                  {t === "all" ? "الكل" : t === "customer" ? "فاتورة عميل" : "إشعار فني"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد فواتير بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const snap = inv.snapshot_data ?? {};
            const isCustomer = inv.invoice_type === "customer";
            const invoiceNumber = isCustomer ? snap.invoiceNumber : snap.settlementNumber;
            const canViewThis = isSuperAdmin
              || (isCustomer  && hasPermission("invoices.view_customer"))
              || (!isCustomer && hasPermission("invoices.view_technician"));

            return (
              <Card key={inv.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isCustomer ? "bg-yellow-100" : "bg-indigo-100"}`}>
                        {isCustomer
                          ? <Users className="w-4 h-4 text-yellow-700" />
                          : <FileText className="w-4 h-4 text-indigo-700" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{invoiceNumber}</span>
                          <Badge className={isCustomer
                            ? "bg-yellow-100 text-yellow-800 border-yellow-300 text-xs"
                            : "bg-indigo-100 text-indigo-800 border-indigo-300 text-xs"
                          }>
                            {isCustomer ? "فاتورة عميل" : "إشعار فني"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          طلب #{inv.request_id} · {formatDate(inv.created_at)}
                        </div>
                        {isCustomer && snap.customerName && (
                          <div className="text-xs text-muted-foreground">العميل: {snap.customerName}</div>
                        )}
                        {!isCustomer && snap.technicianName && (
                          <div className="text-xs text-muted-foreground">الفني: {snap.technicianName}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={inv.status === "active" ? "text-green-700 border-green-300 bg-green-50" : "text-red-700 border-red-300 bg-red-50"}>
                        {inv.status === "active" ? "سارية" : "ملغاة"}
                      </Badge>
                      {canViewThis && (
                        <Link href={`/admin/invoices/${inv.id}`}>
                          <Button size="sm" variant="outline" className="gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            عرض
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => updateQuery({ page: page - 1 })}>السابق</Button>
            <span className="text-sm px-3 py-1.5 text-muted-foreground">صفحة {page}</span>
            <Button size="sm" variant="outline" disabled={invoices.length < PAGE_SIZE} onClick={() => updateQuery({ page: page + 1 })}>التالي</Button>
          </div>
        </div>
      )}
    </div>
  );
}
