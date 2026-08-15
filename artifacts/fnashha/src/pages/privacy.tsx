import { Link } from "wouter";
import DOMPurify from "dompurify";
import { CldImg } from "@/components/ui/cld-img";
import { useBranding } from "@/contexts/branding-context";
import { useGetCmsSettings } from "@workspace/api-client-react";
import { AuthBackground } from "@/components/ui/auth-background";

const DEFAULT_SECTIONS = [
  { title: "1. البيانات التي نجمعها", content: "نجمع المعلومات التي تقدمها عند التسجيل مثل الاسم ورقم الهاتف والبريد الإلكتروني والعنوان. كما نجمع بيانات الاستخدام مثل الطلبات المقدمة، والتقييمات، وسجل المحادثات داخل المنصة." },
  { title: "2. كيف نستخدم بياناتك", content: "نستخدم بياناتك لتقديم خدمات المنصة وتحسينها، والتواصل معك بشأن طلباتك، وإرسال إشعارات مهمة. لا نبيع بياناتك الشخصية لأي طرف ثالث تحت أي ظرف." },
  { title: "3. مشاركة البيانات", content: "نشارك بياناتك فقط مع الفنيين المعنيين بطلبك لتمكينهم من تقديم العروض. قد نشارك بيانات مجهولة الهوية لأغراض تحليلية. في حالة الطوارئ القانونية، قد نكشف عن البيانات وفقاً للمتطلبات القانونية." },
  { title: "4. أمان البيانات", content: "نستخدم تشفير SSL/TLS لحماية البيانات المنقولة. يتم تخزين كلمات المرور بصورة مشفرة ولا يمكن الاطلاع عليها. نجري مراجعات دورية لأنظمة الأمان لضمان حماية بياناتك." },
  { title: "5. ملفات تعريف الارتباط (Cookies)", content: "نستخدم ملفات تعريف الارتباط لتحسين تجربتك، وتذكّر تفضيلاتك، وتحليل استخدام المنصة. يمكنك التحكم في إعدادات الكوكيز من خلال متصفحك، لكن ذلك قد يؤثر على بعض الوظائف." },
  { title: "6. حقوقك", content: "يحق لك الاطلاع على بياناتك الشخصية المحفوظة لدينا، وطلب تصحيح أي معلومات غير دقيقة. يمكنك طلب حذف حسابك وبياناتك المرتبطة به في أي وقت عبر التواصل مع الدعم." },
  { title: "7. التواصل بشأن الخصوصية", content: "إذا كان لديك أي استفسار أو شكوى تتعلق بخصوصية بياناتك، يرجى التواصل معنا عبر صفحة 'اتصل بنا'. سيتم الرد على جميع الاستفسارات خلال 3 أيام عمل." },
];

export default function Privacy() {
  const { data: cms } = useGetCmsSettings();
  const s = cms as any;
  const cmsContent = s?.privacyPolicy;
  const branding = useBranding();

  return (
    <>
    <AuthBackground slug="privacy" />
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
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>سياسة الخصوصية</h1>
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
