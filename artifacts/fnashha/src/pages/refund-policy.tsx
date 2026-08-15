import { Link } from "wouter";
import DOMPurify from "dompurify";
import { CldImg } from "@/components/ui/cld-img";
import { useGetCmsSettings } from "@workspace/api-client-react";
import { useBranding } from "@/contexts/branding-context";
import { AuthBackground } from "@/components/ui/auth-background";

export default function RefundPolicy() {
  const { data: cms } = useGetCmsSettings();
  const s = cms as any;
  const content = s?.refundPolicy;
  const branding = useBranding();

  return (
    <>
    <AuthBackground slug="refund-policy" defaultSrc="/assets/bg-refund.png" />
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", minHeight: "100vh", background: "transparent", position: "relative", zIndex: 1 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');`}</style>

      <header style={{ padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderBottom: "1px solid #f0f0e8" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", border: "2px solid #F5C518" }}>
            <CldImg src={branding.logoUrl || "/assets/logo.png"} alt={branding.siteNameAr} width={200} eager style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>{branding.siteNameAr}</div>
        </Link>
        <Link href="/login" style={{ background: "#F5C518", color: "#1a1a1a", fontWeight: 700, padding: "8px 20px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>
          تسجيل الدخول
        </Link>
      </header>

      <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 24px 60px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>سياسة الاسترداد</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, marginBottom: 36 }}>آخر تحديث: يناير 2024</p>

        {content ? (
          <div
            style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #f0f0e8", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", fontSize: 14, color: "#555", lineHeight: 1.9, whiteSpace: "pre-wrap" }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
          />
        ) : (
          <>
            {[
              {
                title: "1. شروط الاسترداد",
                content: "يمكن طلب الاسترداد خلال 24 ساعة من إتمام الخدمة في حالة وجود خلل جوهري في الخدمة المقدمة أو عدم الالتزام بالمواصفات المتفق عليها مع الفني.",
              },
              {
                title: "2. حالات الاسترداد المقبولة",
                content: "الخدمة لم تُنجز وفق ما تم الاتفاق عليه. وجود عيوب واضحة في العمل المنجز. فشل الفني في الحضور دون إبلاغ مسبق.",
              },
              {
                title: "3. حالات لا يُقبل فيها الاسترداد",
                content: "رضا العميل عن الخدمة ثم تغيير رأيه لاحقاً. طلبات الاسترداد بعد مرور أكثر من 24 ساعة من إتمام الخدمة. الخلافات الناتجة عن تغيير نطاق العمل بعد البدء.",
              },
              {
                title: "4. كيفية تقديم طلب الاسترداد",
                content: "تواصل مع فريق الدعم عبر صفحة الدعم داخل التطبيق أو عبر البريد الإلكتروني. قدم تفاصيل الطلب والمشكلة بوضوح. سيراجع الفريق طلبك خلال 48 ساعة عمل.",
              },
              {
                title: "5. مدة معالجة الاسترداد",
                content: "عند الموافقة على طلب الاسترداد، تتم معالجته خلال 5-7 أيام عمل، وتُعاد الأموال بنفس وسيلة الدفع المستخدمة في المعاملة الأصلية.",
              },
            ].map((section) => (
              <section key={section.title} style={{ marginBottom: 24, background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #f0f0e8", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1a1a1a", marginBottom: 10 }}>{section.title}</h2>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.9, margin: 0 }}>{section.content}</p>
              </section>
            ))}
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/contact" style={{ color: "#c49a00", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
            للاستفسار، تواصل معنا ←
          </Link>
        </div>
      </main>

      <PageFooter />
    </div>
    </>
  );
}

function PageFooter() {
  return (
    <footer style={{ padding: "16px 40px", borderTop: "1px solid #f0f0e8", background: "#fff", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "8px 4px", marginBottom: 8 }}>
        {[["الشروط والأحكام", "/terms"], ["سياسة الخصوصية", "/privacy"], ["سياسة الاسترداد", "/refund-policy"], ["الأسئلة الشائعة", "/faq"], ["اتصل بنا", "/contact"]].map(([label, href]) => (
          <span key={href} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link href={href} style={{ color: "#777", textDecoration: "none", fontSize: 13 }}>{label}</Link>
            <span style={{ color: "#ddd", marginRight: 4 }}>|</span>
          </span>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>جميع الحقوق محفوظة © 2024 فنشها</p>
    </footer>
  );
}
