import { CldImg } from "@/components/ui/cld-img";
import { Link } from "wouter";
import { useBranding } from "@/contexts/branding-context";
import { SiteHeader } from "@/components/site-header";
import { AuthBackground } from "@/components/ui/auth-background";
import { HowItWorksSteps } from "@/components/how-it-works-steps";

export default function HowItWorks() {
  const branding = useBranding();
  return (
    <>
      <AuthBackground slug="how-it-works" />
      <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", minHeight: "100vh", background: "transparent", position: "relative", zIndex: 1 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; }
          .hiw-cta-btn {
            background: #F5C518; color: #1a1a1a;
            font-weight: 800; font-family: 'Cairo', sans-serif;
            font-size: 15px; padding: 13px 36px;
            border: none; border-radius: 14px; cursor: pointer;
            text-decoration: none; display: inline-block;
            transition: background 0.18s, transform 0.18s, box-shadow 0.18s;
          }
          .hiw-cta-btn:hover {
            background: #e0b000;
            transform: translateY(-1px);
            box-shadow: 0 8px 24px rgba(245,197,24,0.38);
          }
        `}</style>

        <SiteHeader />

        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 32px" }}>
          <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 900, color: "#1a1a1a", textAlign: "center", margin: "0 0 24px", fontFamily: "'Cairo', sans-serif" }}>
            كيف تعمل فنشها؟
          </h1>
          <HowItWorksSteps />

          {/* CTA card */}
          <div style={{
            textAlign: "center",
            background: "#fff",
            border: "1.5px solid #f0f0e8",
            borderRadius: 22,
            padding: "24px 32px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
            marginTop: 32,
          }}>
            <Link href="/" style={{ display: "inline-block", marginBottom: 16 }}>
            <div style={{
              width: 70, height: 70, borderRadius: 18, overflow: "hidden",
              border: "2px solid rgba(245,197,24,0.5)",
              boxShadow: "0 4px 16px rgba(245,197,24,0.2)",
            }}>
              <CldImg
                src={branding.logoUrl || "/assets/logo.png"}
                alt={branding.siteNameAr}
                width={200}
                eager
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            </Link>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 10px", fontFamily: "'Cairo', sans-serif" }}>
              جاهز تطلب فنيك؟
            </h2>
            <p style={{ fontSize: 14, color: "#888", margin: "0 0 28px", fontFamily: "'Cairo', sans-serif" }}>
              سجّل الآن وابدأ باستقبال عروض من فنيين معتمدين في منطقتك
            </p>
            <Link href="/register/customer" className="hiw-cta-btn">
              ابدأ الآن
            </Link>
          </div>
        </main>

        <footer style={{ padding: "16px 32px", borderTop: "1px solid #ebebeb", background: "#fff", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "6px 8px", marginBottom: 8 }}>
            {([["الرئيسية", "/"], ["الشروط والأحكام", "/terms"], ["سياسة الخصوصية", "/privacy"], ["الأسئلة الشائعة", "/faq"], ["اتصل بنا", "/contact"]] as [string, string][]).map(([label, href], i, arr) => (
              <span key={href} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link href={href} style={{ color: "#888", textDecoration: "none", fontSize: 13, fontFamily: "'Cairo', sans-serif" }}>{label}</Link>
                {i < arr.length - 1 && <span style={{ color: "#ddd" }}>|</span>}
              </span>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#bbb", fontFamily: "'Cairo', sans-serif" }}>
            جميع الحقوق محفوظة © 2024{" "}
            <Link href="/" style={{ color: "#c49a00", textDecoration: "none", fontWeight: 700 }}>فنشها</Link>
          </p>
        </footer>
      </div>
    </>
  );
}
