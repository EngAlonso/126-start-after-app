import { Link } from "wouter";
import DOMPurify from "dompurify";
import { CldImg } from "@/components/ui/cld-img";
import { useGetCmsSettings } from "@workspace/api-client-react";
import { useBranding } from "@/contexts/branding-context";
import { AuthBackground } from "@/components/ui/auth-background";

const DEFAULT_SECTIONS = [
  { title: "1. قبول الشروط", content: "باستخدامك لمنصة فنشها، فأنت توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي من هذه الشروط، يرجى التوقف عن استخدام المنصة فوراً." },
  { title: "2. وصف الخدمة", content: "فنشها هي منصة وساطة إلكترونية تربط العملاء بالفنيين المعتمدين في مجالات الصيانة المنزلية كالكهرباء والسباكة والتكييف والنجارة والنقاشة وغيرها. المنصة لا تتولى تقديم الخدمات مباشرةً، بل تسهّل عملية التواصل وتبادل عروض الأسعار." },
  { title: "3. تسجيل الحساب", content: "يجب أن يكون عمر المستخدم 18 عاماً أو أكثر. يلتزم المستخدم بتقديم معلومات صحيحة ودقيقة عند التسجيل، والحفاظ على سرية بيانات حسابه. أي نشاط يجري من خلال حسابك يُعدّ مسؤوليتك الكاملة." },
  { title: "4. سياسة الاستخدام المقبول", content: "يُحظر استخدام المنصة لأي غرض غير مشروع أو ضار. لا يجوز نشر محتوى مسيء أو مضلل. لا يجوز التلاعب بنظام التقييمات أو المراجعات. تحتفظ فنشها بحق تعليق أو إلغاء أي حساب ينتهك هذه السياسة." },
  { title: "5. المدفوعات والعمولات", content: "تتقاضى المنصة عمولة على كل طلب مكتمل وفق نسب محددة معلنة. جميع المدفوعات تتم عبر قنوات آمنة ومعتمدة. في حالة النزاعات المتعلقة بالمدفوعات، يرجى التواصل مع فريق الدعم خلال 7 أيام من تاريخ المعاملة." },
  { title: "6. التعديلات على الشروط", content: "تحتفظ فنشها بحق تعديل هذه الشروط في أي وقت. سيتم إشعار المستخدمين بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل التطبيق. استمرار استخدام المنصة بعد التعديل يُعدّ قبولاً ضمنياً للشروط المحدّثة." },
  { title: "7. تحديد المسؤولية", content: "لا تتحمل فنشها مسؤولية جودة الخدمات المقدمة من الفنيين. المنصة لا تضمن توفر الفنيين في جميع الأوقات. في حالة أي نزاع بين العميل والفني، تسعى المنصة للوساطة ولكن قرارها غير ملزم قانونياً." },
];

export default function Terms() {
  const { data: cms } = useGetCmsSettings();
  const s = cms as any;
  const cmsContent = s?.termsConditions;
  const branding = useBranding();

  return (
    <>
    <AuthBackground slug="terms" />
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", minHeight: "100vh", background: "transparent", position: "relative", zIndex: 1 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');`}</style>

      <header style={{ padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderBottom: "1px solid #f0f0e8" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", border: "2px solid #F5C518" }}>
            <CldImg src={branding.logoUrl || "/assets/logo.png"} alt={branding.siteNameAr} width={200} eager className="w-full h-full object-cover" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>{branding.siteNameAr}</div>
        </Link>
        <Link href="/login" style={{ background: "#F5C518", color: "#1a1a1a", fontWeight: 700, padding: "8px 20px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>
          تسجيل الدخول
        </Link>
      </header>

      <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 24px 60px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>الشروط والأحكام</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, marginBottom: 36 }}>آخر تحديث: يناير 2024</p>

        {cmsContent ? (
          <div
            style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #f0f0e8", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", fontSize: 14, color: "#555", lineHeight: 1.9, whiteSpace: "pre-wrap" }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cmsContent) }}
          />
        ) : (
          DEFAULT_SECTIONS.map((section) => (
            <section key={section.title} style={{ marginBottom: 24, background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #f0f0e8", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1a1a1a", marginBottom: 10 }}>{section.title}</h2>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.9, margin: 0 }}>{section.content}</p>
            </section>
          ))
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
