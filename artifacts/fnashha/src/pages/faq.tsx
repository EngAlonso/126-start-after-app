import { useState } from "react";
import DOMPurify from "dompurify";
import { CldImg } from "@/components/ui/cld-img";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { useGetCmsSettings } from "@workspace/api-client-react";
import { useBranding } from "@/contexts/branding-context";
import { AuthBackground } from "@/components/ui/auth-background";

const DEFAULT_FAQS = [
  { q: "ما هي فنشها؟", a: "فنشها هي منصة إلكترونية تربط العملاء بالفنيين المعتمدين في مجالات الصيانة المنزلية. نتيح لك طلب خدمة، واستقبال عروض أسعار من أكثر من فني، واختيار الأنسب لك." },
  { q: "كيف أطلب خدمة؟", a: "بعد تسجيل الدخول، انقر على 'طلب جديد'، اختر نوع الخدمة واكتب وصفاً للمشكلة وحدد موعداً مناسباً. سيصلك عروض من الفنيين المعتمدين في منطقتك." },
  { q: "هل الفنيون معتمدون وموثوقون؟", a: "نعم، جميع الفنيين على منصتنا يمرون بعملية تحقق صارمة تشمل التحقق من الهوية والمؤهلات والخبرة العملية. كما يتم تقييمهم بعد كل طلب من قِبل العملاء." },
  { q: "كيف يتم الدفع؟", a: "الدفع يكون مباشرةً مع الفني عند إتمام الخدمة، نقداً أو بطاقة حسب الاتفاق. تتقاضى المنصة عمولة تُخصم من مدفوعات الفني." },
  { q: "ماذا أفعل إذا لم أكن راضياً عن الخدمة؟", a: "يمكنك تقديم شكوى مباشرةً من خلال تفاصيل الطلب. سيقوم فريق الدعم لدينا بمراجعة الشكوى والتواصل معك في غضون 24 ساعة." },
  { q: "هل يمكنني إلغاء طلب بعد إرساله؟", a: "يمكن إلغاء الطلب قبل قبول أي عرض مجاناً. بعد قبول عرض الفني، يُرجى التواصل مع الفني مباشرةً للاتفاق، مع مراعاة سياسة الإلغاء المتفق عليها." },
  { q: "ما هي المناطق المغطاة؟", a: "تغطي فنشها حالياً معظم المحافظات المصرية. يمكنك التحقق من تغطية منطقتك عند إنشاء الطلب، ونعمل باستمرار على توسعة نطاق الخدمة." },
  { q: "كيف أصبح فنياً على المنصة؟", a: "انقر على 'إنشاء حساب' ثم اختر 'تسجيل كفني'. ستُطلب منك المستندات اللازمة وستمر بعملية مراجعة وموافقة يُنجزها فريقنا." },
  { q: "هل بياناتي آمنة؟", a: "نعم، نحن نأخذ أمان بياناتك بجدية تامة. جميع البيانات مشفرة ومحمية، ولا نشارك معلوماتك الشخصية مع أطراف ثالثة. اطلع على سياسة الخصوصية لمزيد من التفاصيل." },
  { q: "كيف أتواصل مع فريق الدعم؟", a: "يمكنك التواصل معنا عبر صفحة 'اتصل بنا'، أو من خلال نظام الدعم داخل التطبيق بعد تسجيل الدخول. نحرص على الرد خلال 24 ساعة." },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const { data: cms } = useGetCmsSettings();
  const s = cms as any;
  const cmsContent = s?.faqContent;
  const branding = useBranding();

  return (
    <>
    <AuthBackground slug="faq" />
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", minHeight: "100vh", background: "transparent", position: "relative", zIndex: 1 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        .faq-item { transition: all 0.2s ease; cursor: pointer; }
        .faq-item:hover { border-color: #F5C518 !important; }
        .faq-chevron { transition: transform 0.25s ease; }
      `}</style>

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
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 10 }}>الأسئلة الشائعة</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 15 }}>إجابات على أكثر الأسئلة شيوعاً حول منصة فنشها</p>
        </div>

        {cmsContent ? (
          <div
            style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #f0f0e8", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", fontSize: 14, color: "#555", lineHeight: 1.9, whiteSpace: "pre-wrap" }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cmsContent) }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DEFAULT_FAQS.map((faq, i) => (
              <div
                key={i}
                className="faq-item"
                onClick={() => setOpen(open === i ? null : i)}
                style={{ background: "#fff", border: "1.5px solid " + (open === i ? "#F5C518" : "#f0f0e8"), borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
              >
                <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{faq.q}</span>
                  <ChevronDown size={18} color="#888" className="faq-chevron" style={{ flexShrink: 0, transform: open === i ? "rotate(180deg)" : "rotate(0)" }} />
                </div>
                {open === i && (
                  <div style={{ padding: "0 22px 18px", fontSize: 14, color: "#555", lineHeight: 1.85 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 40, background: "#fff", borderRadius: 16, padding: "28px 24px", border: "1px solid #f0f0e8" }}>
          <p style={{ fontSize: 15, color: "#555", marginBottom: 14 }}>لم تجد إجابة لسؤالك؟</p>
          <Link href="/contact" style={{ background: "#F5C518", color: "#1a1a1a", fontWeight: 800, padding: "10px 28px", borderRadius: 12, textDecoration: "none", fontSize: 14 }}>
            تواصل مع الدعم
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
