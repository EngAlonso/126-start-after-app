import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Coins, Search, ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Link } from "wouter";
import { useAdminListState } from "@/hooks/use-admin-list-state";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
async function apiCall(path: string, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

const SORT_OPTIONS = [
  { value: "lifetime_earned", label: "الأعلى كسباً" },
  { value: "coins_balance",   label: "أعلى رصيد" },
  { value: "pending_coins",   label: "أعلى معلق" },
  { value: "lifetime_used",   label: "الأكثر استخداماً" },
  { value: "created_at",      label: "الأحدث" },
];

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

export default function AdminLoyaltyWallets() {
  const { token } = useAuth();
  const { params, updateQuery } = useAdminListState();
  const search = params.get("search") || "";
  const inputVal = params.get("searchInput") ?? search;
  const page = Math.max(1, Number(params.get("page") || "1"));
  const sort = params.get("sort") || "lifetime_earned";

  const { data, isLoading } = useQuery({
    queryKey: ["adminLoyaltyWallets", page, search, sort],
    queryFn: () => apiCall(`/loyalty/admin/wallets?page=${page}&limit=20&search=${encodeURIComponent(search)}&sort=${sort}`, token || ""),
    retry: false,
    placeholderData: (prev) => prev,
  });

  const wallets: any[] = data?.wallets ?? [];
  const total: number  = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  function doSearch() {
    updateQuery({ search: inputVal.trim() || null, searchInput: null, page: null }, { replace: true });
  }

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">محافظ العملاء</h1>
        <Badge variant="secondary" className="mr-auto">{fmt(total)} محفظة</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 flex-1 min-w-[200px]">
          <Input
            placeholder="بحث بالاسم أو الجوال..."
            value={inputVal}
            onChange={(e) => updateQuery({ searchInput: e.target.value || null }, { replace: true })}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            className="h-9"
          />
          <Button size="sm" onClick={doSearch} className="h-9">
            <Search className="w-4 h-4" />
          </Button>
        </div>
        <select
          value={sort}
          onChange={(e) => updateQuery({ sort: e.target.value, page: null })}
          className="border rounded-md px-2 h-9 text-sm bg-background"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : wallets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد محافظ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right p-3">العميل</th>
                    <th className="text-center p-3">الرصيد المتاح</th>
                    <th className="text-center p-3">معلق</th>
                    <th className="text-center p-3">محجوز</th>
                    <th className="text-center p-3">مكتسب (كل الوقت)</th>
                    <th className="text-center p-3">مستخدم</th>
                    <th className="text-center p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((w: any) => (
                    <tr key={w.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <p className="font-medium">{w.userName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{w.userMobile}</p>
                      </td>
                      <td className="p-3 text-center font-bold text-green-600">{fmt(w.coinsBalance)}</td>
                      <td className="p-3 text-center text-yellow-600">{fmt(w.pendingCoins)}</td>
                      <td className="p-3 text-center text-blue-600">{fmt(w.reservedCoins)}</td>
                      <td className="p-3 text-center">{fmt(w.lifetimeEarned)}</td>
                      <td className="p-3 text-center text-muted-foreground">{fmt(w.lifetimeUsed)}</td>
                      <td className="p-3 text-center">
                        <Link href={`/admin/loyalty/wallets/${w.userId}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            التفاصيل
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => updateQuery({ page: page - 1 })}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => updateQuery({ page: page + 1 })}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
