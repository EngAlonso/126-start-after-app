/**
 * Public Invoice Verification Page — accessible via QR code.
 * Shows ONLY non-sensitive data: invoice number, request ID, type, date, status.
 * Route: /invoice/verify/:invoiceNumber
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SiteLogo } from "@/components/site-logo";
import { useBranding } from "@/contexts/branding-context";
import { CheckCircle2, XCircle, Loader2, FileText } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function InvoiceVerify({ invoiceNumber }: { invoiceNumber: string }) {
  const branding = useBranding();
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!invoiceNumber) { setLoading(false); setError(true); return; }
    fetch(`${BASE_URL}/api/invoices/verify/${encodeURIComponent(invoiceNumber)}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [invoiceNumber]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-white to-amber-50 p-4"
      dir="rtl"
    >
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-yellow-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/40 flex-shrink-0">
            <SiteLogo size={40} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <p className="font-black text-white text-lg leading-none">{branding.siteNameAr || "فنشها"}</p>
            <p className="text-yellow-100 text-xs mt-0.5">نظام التحقق من الفواتير</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جاري التحقق...</p>
            </div>
          )}

          {!loading && (error || !data) && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="w-12 h-12 text-red-500" />
              <p className="font-bold text-red-700">تعذر التحقق</p>
              <p className="text-sm text-muted-foreground">تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Valid/Invalid badge */}
              {data.valid ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-5">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-800 text-sm">فاتورة سارية ✓</p>
                    <p className="text-xs text-green-600">هذه الفاتورة أصيلة وصادرة من فنشها</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-800 text-sm">{data.valid === false && data.message ? data.message : "فاتورة غير سارية"}</p>
                    <p className="text-xs text-red-600">لم يتم العثور على هذه الفاتورة أو أنها ملغاة</p>
                  </div>
                </div>
              )}

              {/* Details */}
              {data.invoiceNumber && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">تفاصيل الفاتورة</span>
                  </div>

                  {[
                    { label: "رقم الفاتورة",   value: data.invoiceNumber, mono: true },
                    { label: "رقم الطلب",       value: `#${data.requestId}` },
                    { label: "نوع المستند",     value: data.invoiceType },
                    { label: "الحالة",           value: data.status },
                    { label: "تاريخ الإصدار",   value: formatDate(data.issuedDate) },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 text-center">
          <p className="text-xs text-muted-foreground">
            هذه الصفحة للتحقق من صحة الفاتورة فقط.
            لا تُعرض أي بيانات شخصية حساسة.
          </p>
          <Link href="/" className="text-xs text-primary font-medium mt-2 block hover:underline">
            العودة لفنشها
          </Link>
        </div>
      </div>
    </div>
  );
}
