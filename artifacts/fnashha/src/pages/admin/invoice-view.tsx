/**
 * Admin Invoice View — printable, PDF-downloadable, WhatsApp-ready.
 * Accessible only to admins with the relevant invoice permissions.
 * Route: /admin/invoices/:id
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useBranding } from "@/contexts/branding-context";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Printer, Download, MessageCircle, CheckCircle2, Loader2, FileText } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function formatPhone(mobile: string): string {
  let digits = (mobile ?? "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) digits = "20" + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("1"))   digits = "20" + digits;
  return digits;
}

async function generateQr(text: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, { width: 120, margin: 1, color: { dark: "#1a1a1a", light: "#ffffff" } });
}

// ─── Printable Customer Invoice Template ─────────────────────────────────────
function CustomerInvoiceTemplate({ snap, qrUrl, branding }: {
  snap: Record<string, any>;
  qrUrl: string;
  branding: any;
}) {
  return (
    <div className="invoice-page" dir="rtl">
      {/* Header */}
      <div className="inv-header">
        <div className="inv-brand">
          <div className="inv-logo-wrap">
            <SiteLogo size={48} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
          </div>
          <div>
            <div className="inv-brand-name">{branding.siteNameAr || "فنشها"}</div>
            <div className="inv-brand-tag">خدمات منزلية موثوقة</div>
          </div>
        </div>
        <div className="inv-type-block">
          <div className="inv-type-label">فاتورة خدمة</div>
          <div className="inv-number">{snap.invoiceNumber}</div>
        </div>
      </div>

      {/* Meta row */}
      <div className="inv-meta-row">
        <div className="inv-meta-item">
          <span className="inv-meta-key">رقم الطلب</span>
          <span className="inv-meta-val">#{snap.requestId}</span>
        </div>
        <div className="inv-meta-item">
          <span className="inv-meta-key">تاريخ الإصدار</span>
          <span className="inv-meta-val">{formatDate(snap.completionDate)}</span>
        </div>
        <div className="inv-meta-item">
          <span className="inv-meta-key">حالة الطلب</span>
          <span className="inv-meta-val inv-status">✓ مكتمل</span>
        </div>
      </div>

      {/* Parties */}
      <div className="inv-parties">
        <div className="inv-party">
          <div className="inv-party-title">العميل</div>
          <div className="inv-party-name">{snap.customerName || "—"}</div>
        </div>
        <div className="inv-party-divider" />
        <div className="inv-party inv-party-right">
          <div className="inv-party-title">الفني المُنفِّذ</div>
          <div className="inv-party-name">{snap.technicianName || "—"}</div>
        </div>
      </div>

      {/* Details table */}
      <table className="inv-table">
        <tbody>
          <tr>
            <td className="inv-td-key">الخدمة</td>
            <td className="inv-td-val">{snap.serviceName || "—"}</td>
            <td className="inv-td-key">المحافظة</td>
            <td className="inv-td-val">{snap.governorateName || "—"}</td>
          </tr>
          <tr>
            <td className="inv-td-key">المنطقة</td>
            <td className="inv-td-val">{snap.areaName || "—"}</td>
            <td className="inv-td-key">طريقة الدفع</td>
            <td className="inv-td-val">{snap.paymentMethod || "كاش"}</td>
          </tr>
          <tr>
            <td className="inv-td-key">تاريخ الطلب</td>
            <td className="inv-td-val">{formatDate(snap.requestDate)}</td>
            <td className="inv-td-key">تاريخ الإتمام</td>
            <td className="inv-td-val">{formatDate(snap.completionDate)}</td>
          </tr>
        </tbody>
      </table>

      {/* Pricing */}
      <div className="inv-pricing">
        <div className="inv-price-row">
          <span className="inv-price-label">سعر الخدمة</span>
          <span className="inv-price-val">{parseFloat(snap.agreedPrice || "0").toFixed(2)} جنيه</span>
        </div>
        {snap.customerPayableAmount && parseFloat(snap.customerPayableAmount) !== parseFloat(snap.agreedPrice) && (
          <>
            <div className="inv-price-row inv-discount">
              <span className="inv-price-label">خصم عملات فنشها</span>
              <span className="inv-price-val inv-discount-val">
                -{(parseFloat(snap.agreedPrice) - parseFloat(snap.customerPayableAmount)).toFixed(2)} جنيه
              </span>
            </div>
            <div className="inv-price-row inv-total">
              <span className="inv-price-label">المبلغ المدفوع</span>
              <span className="inv-price-val">{parseFloat(snap.customerPayableAmount).toFixed(2)} جنيه</span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="inv-footer">
        <div className="inv-qr-block">
          {qrUrl && <img src={qrUrl} alt="QR Code" className="inv-qr-img" />}
          <div className="inv-qr-caption">تحقق من الفاتورة</div>
        </div>
        <div className="inv-thank-you">
          <div className="inv-ty-main">شكراً لاختياركم فنشها ❤️</div>
          <div className="inv-ty-sub">نحرص دائماً على تقديم أفضل الخدمات</div>
        </div>
      </div>

      <div className="inv-foot-line">
        هذه وثيقة رسمية — رقم الفاتورة: {snap.invoiceNumber}
      </div>
    </div>
  );
}

// ─── Printable Technician Settlement Template ─────────────────────────────────
function TechnicianSettlementTemplate({ snap, qrUrl, branding }: {
  snap: Record<string, any>;
  qrUrl: string;
  branding: any;
}) {
  return (
    <div className="invoice-page" dir="rtl">
      {/* Header */}
      <div className="inv-header">
        <div className="inv-brand">
          <div className="inv-logo-wrap">
            <SiteLogo size={48} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
          </div>
          <div>
            <div className="inv-brand-name">{branding.siteNameAr || "فنشها"}</div>
            <div className="inv-brand-tag">خدمات منزلية موثوقة</div>
          </div>
        </div>
        <div className="inv-type-block inv-type-tech">
          <div className="inv-type-label">إشعار تسوية فني</div>
          <div className="inv-number">{snap.settlementNumber}</div>
        </div>
      </div>

      {/* Meta row */}
      <div className="inv-meta-row">
        <div className="inv-meta-item">
          <span className="inv-meta-key">رقم الطلب</span>
          <span className="inv-meta-val">#{snap.requestId}</span>
        </div>
        <div className="inv-meta-item">
          <span className="inv-meta-key">تاريخ التسوية</span>
          <span className="inv-meta-val">{formatDate(snap.completionDate)}</span>
        </div>
        <div className="inv-meta-item">
          <span className="inv-meta-key">طريقة الدفع</span>
          <span className="inv-meta-val">{snap.paymentMethod || "كاش"}</span>
        </div>
      </div>

      {/* Parties */}
      <div className="inv-parties">
        <div className="inv-party">
          <div className="inv-party-title">الفني</div>
          <div className="inv-party-name">{snap.technicianName || "—"}</div>
        </div>
        <div className="inv-party-divider" />
        <div className="inv-party inv-party-right">
          <div className="inv-party-title">العميل</div>
          <div className="inv-party-name">{snap.customerName || "—"}</div>
        </div>
      </div>

      {/* Details table */}
      <table className="inv-table">
        <tbody>
          <tr>
            <td className="inv-td-key">الخدمة</td>
            <td className="inv-td-val" colSpan={3}>{snap.serviceName || "—"}</td>
          </tr>
          <tr>
            <td className="inv-td-key">تاريخ الإتمام</td>
            <td className="inv-td-val">{formatDate(snap.completionDate)}</td>
            <td className="inv-td-key">طريقة الدفع</td>
            <td className="inv-td-val">{snap.paymentMethod || "كاش"}</td>
          </tr>
        </tbody>
      </table>

      {/* Financial details */}
      <div className="inv-pricing">
        <div className="inv-price-row">
          <span className="inv-price-label">سعر الخدمة</span>
          <span className="inv-price-val">{parseFloat(snap.agreedPrice || "0").toFixed(2)} جنيه</span>
        </div>
      </div>

      {/* Points section */}
      <div className="inv-points-block">
        <div className="inv-points-title">تفاصيل النقاط</div>
        <div className="inv-points-grid">
          <div className="inv-point-cell">
            <div className="inv-point-label">النقاط قبل</div>
            <div className="inv-point-val">{snap.pointsBefore ?? 0}</div>
          </div>
          <div className="inv-point-cell inv-point-deduct">
            <div className="inv-point-label">النقاط المخصومة</div>
            <div className="inv-point-val">-{snap.pointsDeducted ?? 0}</div>
          </div>
          <div className="inv-point-cell inv-point-after">
            <div className="inv-point-label">النقاط بعد</div>
            <div className="inv-point-val">{snap.pointsAfter ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="inv-footer">
        <div className="inv-qr-block">
          {qrUrl && <img src={qrUrl} alt="QR Code" className="inv-qr-img" />}
          <div className="inv-qr-caption">تحقق من الإشعار</div>
        </div>
        <div className="inv-thank-you">
          <div className="inv-ty-main">شكراً لتعاونكم مع فنشها ❤️</div>
          <div className="inv-ty-sub">نقدر مجهودكم ونحرص على حقوقكم</div>
        </div>
      </div>

      <div className="inv-foot-line">
        هذه وثيقة رسمية — رقم الإشعار: {snap.settlementNumber}
      </div>
    </div>
  );
}

// ─── Print styles (injected as a <style> tag) ─────────────────────────────────
const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden !important; }
    .invoice-print-area, .invoice-print-area * { visibility: visible !important; }
    .invoice-print-area { position: fixed; top: 0; left: 0; width: 210mm; }
    .no-print { display: none !important; }
  }

  .invoice-page {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    direction: rtl;
    background: #fff;
    color: #1a1a1a;
    width: 170mm;
    min-height: 240mm;
    margin: 0 auto;
    padding: 24px 28px;
    box-sizing: border-box;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    font-size: 13px;
  }

  .inv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 2px solid #f5c518;
  }
  .inv-brand { display: flex; align-items: center; gap: 10px; }
  .inv-logo-wrap {
    width: 48px; height: 48px;
    border-radius: 8px;
    border: 2px solid #f5c51840;
    overflow: hidden;
    flex-shrink: 0;
  }
  .inv-brand-name { font-weight: 900; font-size: 18px; color: #1a1a1a; }
  .inv-brand-tag { font-size: 11px; color: #6b7280; }

  .inv-type-block {
    text-align: left;
    background: linear-gradient(135deg, #f5c518, #e6b800);
    border-radius: 8px;
    padding: 10px 16px;
  }
  .inv-type-tech {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff;
  }
  .inv-type-label { font-size: 11px; font-weight: 600; color: rgba(0,0,0,0.6); }
  .inv-type-tech .inv-type-label { color: rgba(255,255,255,0.8); }
  .inv-number { font-size: 14px; font-weight: 800; color: #1a1a1a; direction: ltr; }
  .inv-type-tech .inv-number { color: #fff; }

  .inv-meta-row {
    display: flex;
    gap: 0;
    background: #f9fafb;
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 16px;
  }
  .inv-meta-item { flex: 1; }
  .inv-meta-key { display: block; font-size: 10px; color: #9ca3af; margin-bottom: 2px; }
  .inv-meta-val { font-weight: 700; font-size: 13px; }
  .inv-status { color: #059669; }

  .inv-parties {
    display: flex;
    gap: 0;
    background: #fef9e7;
    border: 1px solid #f5c518;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .inv-party { flex: 1; }
  .inv-party-right { text-align: left; }
  .inv-party-divider { width: 1px; background: #f5c518; margin: 0 16px; flex-shrink: 0; }
  .inv-party-title { font-size: 10px; color: #9ca3af; margin-bottom: 4px; }
  .inv-party-name { font-weight: 700; font-size: 14px; }

  .inv-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  .inv-td-key {
    background: #f3f4f6;
    padding: 8px 12px;
    font-size: 11px;
    color: #6b7280;
    font-weight: 600;
    width: 25%;
    border: 1px solid #e5e7eb;
  }
  .inv-td-val {
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    width: 25%;
    border: 1px solid #e5e7eb;
  }

  .inv-pricing {
    background: #f9fafb;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .inv-price-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #e5e7eb;
  }
  .inv-price-row:last-child { border-bottom: none; }
  .inv-price-label { font-size: 12px; color: #6b7280; }
  .inv-price-val { font-weight: 800; font-size: 15px; color: #1a1a1a; }
  .inv-discount .inv-price-label { color: #059669; }
  .inv-discount-val { color: #059669 !important; }
  .inv-total .inv-price-val { color: #f5c518; font-size: 18px; }

  .inv-points-block {
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .inv-points-title { font-weight: 700; font-size: 12px; color: #4338ca; margin-bottom: 10px; }
  .inv-points-grid { display: flex; gap: 8px; }
  .inv-point-cell {
    flex: 1;
    background: #fff;
    border-radius: 6px;
    padding: 8px;
    text-align: center;
    border: 1px solid #e0e7ff;
  }
  .inv-point-deduct { background: #fef2f2; border-color: #fecaca; }
  .inv-point-after { background: #f0fdf4; border-color: #bbf7d0; }
  .inv-point-label { font-size: 10px; color: #9ca3af; margin-bottom: 4px; }
  .inv-point-val { font-weight: 800; font-size: 16px; color: #1a1a1a; }
  .inv-point-deduct .inv-point-val { color: #dc2626; }
  .inv-point-after .inv-point-val { color: #059669; }

  .inv-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 2px solid #f5c518;
    margin-top: 16px;
  }
  .inv-qr-block { text-align: center; }
  .inv-qr-img { width: 80px; height: 80px; border-radius: 6px; border: 1px solid #e5e7eb; }
  .inv-qr-caption { font-size: 9px; color: #9ca3af; margin-top: 4px; }
  .inv-thank-you { text-align: left; }
  .inv-ty-main { font-size: 16px; font-weight: 800; color: #1a1a1a; }
  .inv-ty-sub { font-size: 11px; color: #9ca3af; margin-top: 4px; }

  .inv-foot-line {
    text-align: center;
    font-size: 10px;
    color: #d1d5db;
    margin-top: 12px;
    padding-top: 8px;
    direction: rtl;
  }
`;

// ─── Main page component ──────────────────────────────────────────────────────
export default function AdminInvoiceView({ id }: { id: string }) {
  const { hasPermission, isSuperAdmin, token } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [invoice, setInvoice]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [qrUrl, setQrUrl]         = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const invoiceId = parseInt(id);

  // Derived
  const snap: Record<string, any> = invoice?.snapshot_data ?? {};
  const isCustomer    = invoice?.invoice_type === "customer";
  const isTechnician  = invoice?.invoice_type === "technician";
  const invoiceNumber = isCustomer ? snap.invoiceNumber : snap.settlementNumber;
  const mobile        = isCustomer ? snap.customerMobile : snap.technicianMobile;

  // Permission helpers
  const canView     = isSuperAdmin || hasPermission(isCustomer ? "invoices.view_customer"      : "invoices.view_technician");
  const canPrint    = isSuperAdmin || hasPermission(isCustomer ? "invoices.print_customer"     : "invoices.print_technician");
  const canDownload = isSuperAdmin || hasPermission(isCustomer ? "invoices.download_customer"  : "invoices.download_technician");
  const canWhatsApp = isSuperAdmin || hasPermission(isCustomer ? "invoices.whatsapp_customer"  : "invoices.whatsapp_technician");

  // ── Fetch invoice & log viewed ───────────────────────────────────────────────
  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    fetch(`${BASE_URL}/api/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (data?.error) { toast({ title: "خطأ", description: data.error, variant: "destructive" }); return; }
        setInvoice(data);
        // Log viewed
        fetch(`${BASE_URL}/api/invoices/${invoiceId}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "viewed" }),
        }).catch(() => {});
      })
      .catch(() => toast({ title: "تعذر تحميل الفاتورة", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  // ── Generate QR code ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!invoiceNumber) return;
    const verifyUrl = `${window.location.origin}${BASE_URL}/invoice/verify/${invoiceNumber}`;
    generateQr(verifyUrl).then(setQrUrl).catch(() => {});
  }, [invoiceNumber]);

  // ── Print ────────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
    fetch(`${BASE_URL}/api/invoices/${invoiceId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "printed" }),
    }).catch(() => {});
  };

  // ── Download PDF ──────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF }   = await import("jspdf");

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pdfW  = pdf.internal.pageSize.getWidth();
      const ratio = canvas.width / canvas.height;
      const pdfH  = pdfW / ratio;

      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);

      const typeLabel = isCustomer ? "Customer" : "Technician";
      pdf.save(`${invoiceNumber}-${typeLabel}.pdf`);

      // Log activity
      fetch(`${BASE_URL}/api/invoices/${invoiceId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "downloaded" }),
      }).catch(() => {});
    } catch {
      toast({ title: "خطأ في إنشاء PDF", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  // ── WhatsApp ──────────────────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    if (!mobile) { toast({ title: "رقم الهاتف غير متوفر", variant: "destructive" }); return; }

    const phone = formatPhone(mobile);
    const message = isCustomer
      ? `السلام عليكم،\nمرفق فاتورة الطلب رقم ${invoiceNumber}\nشكراً لاختياركم فنشها ❤️`
      : `السلام عليكم،\nمرفق إشعار تسوية الطلب رقم #${snap.requestId}\nشكراً لتعاونكم مع فنشها ❤️`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");

    fetch(`${BASE_URL}/api/invoices/${invoiceId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "whatsapp_opened" }),
    }).catch(() => {});
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 text-center text-muted-foreground">الفاتورة غير موجودة</div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6 text-center text-muted-foreground">ليس لديك صلاحية عرض هذه الفاتورة</div>
    );
  }

  const requestId = snap.requestId;

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      {/* Inject print + invoice styles */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* ── Top action bar (hidden in print) ── */}
      <div className="no-print bg-white border-b border-border sticky top-0 z-10 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          {/* Back */}
          <Link href={`/admin/requests/${requestId}`}>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowRight className="w-4 h-4" />
              العودة للطلب #{requestId}
            </Button>
          </Link>

          {/* Type badge */}
          <div className="flex items-center gap-2">
            <Badge className={isCustomer ? "bg-yellow-100 text-yellow-800 border-yellow-300" : "bg-indigo-100 text-indigo-800 border-indigo-300"}>
              <FileText className="w-3 h-3 ml-1" />
              {isCustomer ? "فاتورة عميل" : "إشعار تسوية فني"}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{invoiceNumber}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {canPrint && (
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1">
                <Printer className="w-3.5 h-3.5" />
                طباعة
              </Button>
            )}
            {canDownload && (
              <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={pdfLoading} className="gap-1">
                {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                تنزيل PDF
              </Button>
            )}
            {canWhatsApp && mobile && (
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleWhatsApp}>
                <MessageCircle className="w-3.5 h-3.5" />
                واتساب
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Invoice template (printable area) ── */}
      <div className="invoice-print-area py-8 px-4">
        <div ref={invoiceRef} className="max-w-3xl mx-auto">
          {isCustomer ? (
            <CustomerInvoiceTemplate snap={snap} qrUrl={qrUrl} branding={branding} />
          ) : (
            <TechnicianSettlementTemplate snap={snap} qrUrl={qrUrl} branding={branding} />
          )}
        </div>
      </div>

      {/* ── Status badge row (no-print) ── */}
      <div className="no-print max-w-3xl mx-auto px-4 pb-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {invoice.last_printed_at && (
            <span className="flex items-center gap-1"><Printer className="w-3 h-3" /> آخر طباعة: {formatDate(invoice.last_printed_at)}</span>
          )}
          {invoice.last_download_at && (
            <span className="flex items-center gap-1"><Download className="w-3 h-3" /> آخر تنزيل: {formatDate(invoice.last_download_at)}</span>
          )}
          {invoice.last_whatsapp_at && (
            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> آخر إرسال واتساب: {formatDate(invoice.last_whatsapp_at)}</span>
          )}
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> الفاتورة سارية</span>
        </div>
      </div>
    </div>
  );
}
