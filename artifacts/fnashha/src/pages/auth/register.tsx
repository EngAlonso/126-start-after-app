import { useEffect, useState } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { Link } from "wouter";
import { User, Wrench, ChevronLeft, Shield, Star, Headphones } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";
import { AuthBackground } from "@/components/ui/auth-background";

export default function Register() {
  const [mounted, setMounted] = useState(false);
  const branding = useBranding();

  // Preserve ?ref= query param when navigating to /register/customer
  // (defense-in-depth for old referral links that land on /register instead of /r/:code)
  const refParam = new URLSearchParams(window.location.search).get("ref");
  const customerHref = refParam
    ? `/register/customer?ref=${encodeURIComponent(refParam)}`
    : "/register/customer";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .rp { font-family: 'Cairo', sans-serif !important; }

        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rp-logo   { animation: authFadeUp 0.5s ease forwards; }
        .rp-title  { animation: authFadeUp 0.5s ease 0.1s both; }
        .rp-cards  { animation: authFadeUp 0.5s ease 0.2s both; }
        .rp-bottom { animation: authFadeUp 0.5s ease 0.3s both; }
        .rp-trust  { animation: authFadeUp 0.5s ease 0.35s both; }

        .rp-card {
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.95);
          box-shadow: 0 8px 32px rgba(0,0,0,0.06), 0 2px 12px rgba(245,197,24,0.08), inset 0 1px 0 rgba(255,255,255,1);
          border-radius: 24px;
          padding: 36px 28px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
          text-decoration: none;
          color: inherit;
        }
        .rp-card:hover {
          border-color: rgba(245,197,24,0.6);
          box-shadow: 0 16px 48px rgba(245,197,24,0.22), 0 4px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1);
          transform: translateY(-5px);
        }

        .rp-icon-wrap {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fef9e7 0%, #fdf3c0 100%);
          border: 1.5px solid rgba(245,197,24,0.25);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 20px;
          box-shadow: 0 4px 16px rgba(245,197,24,0.15);
          transition: all 0.25s;
        }
        .rp-card:hover .rp-icon-wrap {
          background: linear-gradient(135deg, #fdf3c0 0%, #fbe978 100%);
          box-shadow: 0 6px 22px rgba(245,197,24,0.3);
          transform: scale(1.06);
        }

        .rp-btn {
          width: 100%;
          padding: 13px 16px;
          background: linear-gradient(135deg, #FFD700 0%, #F5C518 45%, #E8B800 100%);
          color: #1a1a1a;
          font-family: 'Cairo', sans-serif;
          font-size: 15px;
          font-weight: 800;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 24px;
          box-shadow: 0 4px 14px rgba(245,197,24,0.4);
          transition: transform 0.2s, box-shadow 0.2s;
          text-decoration: none;
          position: relative; overflow: hidden;
        }
        .rp-btn::before {
          content: ''; position: absolute; top:0; left:0; right:0; height:48%;
          background: linear-gradient(rgba(255,255,255,0.22), transparent);
          border-radius: 14px 14px 0 0; pointer-events: none;
        }
        .rp-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(245,197,24,0.5);
        }

        .rp-trust-item {
          display: flex; align-items: center; gap: 6px;
          color: #888; font-size: 13px;
          font-family: 'Cairo', sans-serif;
        }

        @media (max-width: 640px) {
          .rp-cards-grid { grid-template-columns: 1fr !important; }
          .rp-trust-row  { display: none !important; }
          .rp-page-pad   { padding: 20px 16px !important; }
          .rp-card       { padding: 22px 20px 18px !important; flex-direction: row !important; text-align: right !important; gap: 16px; }
          .rp-icon-wrap  { width: 58px !important; height: 58px !important; flex-shrink: 0; margin-bottom: 0 !important; }
          .rp-card-body  { flex: 1; }
          .rp-btn        { margin-top: 14px !important; }
        }
      `}</style>

      <AuthBackground slug="register" />

      <div
        className="rp"
        dir="rtl"
        style={{
          minHeight: "100svh",
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.3s ease",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
        }}
      >

        {/* ── TOP BAR ── */}
        <div
          className="rp-page-pad"
          style={{
            padding: "14px 32px",
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(255,255,255,0.8)",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.65)", border: "1.5px solid rgba(0,0,0,0.07)",
            borderRadius: 10, padding: "6px 12px", fontSize: 13, color: "#666",
            cursor: "default", fontFamily: "'Cairo', sans-serif", fontWeight: 600,
          }}>
            <span>🌐</span>
            <span>العربية</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>

        {/* ── MAIN ── */}
        <main
          className="rp-page-pad"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 24px 40px",
            position: "relative",
            zIndex: 5,
          }}
        >
          {/* Logo */}
          <div className="rp-logo" style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{
                position: "absolute", inset: -12,
                borderRadius: 36,
                background: "radial-gradient(circle, rgba(245,197,24,0.35) 0%, transparent 70%)",
                animation: "authLogoGlow 3.5s ease-in-out infinite",
              }} />
              <Link href="/" style={{ display: "inline-block" }}>
                <div style={{
                  width: 110, height: 110, borderRadius: 26, overflow: "hidden",
                  border: "2.5px solid rgba(245,197,24,0.65)",
                  boxShadow: "0 6px 28px rgba(245,197,24,0.35), 0 2px 10px rgba(0,0,0,0.08)",
                  position: "relative", zIndex: 1,
                }}>
                  <CldImg src={branding.logoUrl || "/assets/logo.png"} alt={branding.siteNameAr} width={200} eager
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              </Link>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "#bbb", fontFamily: "'Cairo', sans-serif" }}>
              {branding.siteSlogan}
            </p>
          </div>

          {/* Title */}
          <div className="rp-title" style={{ textAlign: "center", marginBottom: 36 }}>
            <h1 style={{
              margin: "0 0 8px",
              fontSize: "clamp(24px, 5vw, 34px)",
              fontWeight: 900, color: "#1a1a1a",
              fontFamily: "'Cairo', sans-serif", lineHeight: 1.2,
            }}>
              مرحباً بك في {branding.siteNameAr}
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: "#999", fontFamily: "'Cairo', sans-serif" }}>
              اختر نوع الحساب للمتابعة
            </p>
          </div>

          {/* Cards grid */}
          <div
            className="rp-cards rp-cards-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              width: "100%",
              maxWidth: 700,
              marginBottom: 32,
            }}
          >
            {/* Customer card */}
            <Link href={customerHref} className="rp-card" data-testid="card-register-customer">
              <div className="rp-icon-wrap">
                <User size={34} color="#C9A227" strokeWidth={1.8} />
              </div>
              <div className="rp-card-body" style={{ width: "100%" }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#1a1a1a", fontFamily: "'Cairo', sans-serif" }}>
                  عميل
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "#999", lineHeight: 1.7, fontFamily: "'Cairo', sans-serif" }}>
                  أبحث عن خدمات منزلية موثوقة وسريعة
                </p>
                <div className="rp-btn">
                  <ChevronLeft size={17} />
                  متابعة كعميل
                </div>
              </div>
            </Link>

            {/* Technician card */}
            <Link href="/register/technician" className="rp-card" data-testid="card-register-technician">
              <div className="rp-icon-wrap">
                <Wrench size={34} color="#C9A227" strokeWidth={1.8} />
              </div>
              <div className="rp-card-body" style={{ width: "100%" }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#1a1a1a", fontFamily: "'Cairo', sans-serif" }}>
                  فني
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "#999", lineHeight: 1.7, fontFamily: "'Cairo', sans-serif" }}>
                  أقدم خدماتي وأصل إلى عملاء أكثر
                </p>
                <div className="rp-btn">
                  <ChevronLeft size={17} />
                  متابعة كفني
                </div>
              </div>
            </Link>
          </div>

          {/* Already have account */}
          <div className="rp-bottom" style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#999", fontFamily: "'Cairo', sans-serif" }}>
              لديك حساب بالفعل؟{" "}
              <Link href="/login" style={{ color: "#C9A227", fontWeight: 800, textDecoration: "none", fontFamily: "'Cairo', sans-serif" }}>
                تسجيل الدخول
              </Link>
            </p>
          </div>
        </main>

        {/* ── TRUST BADGES ── */}
        <div
          className="rp-trust rp-trust-row"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            padding: "16px 32px",
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(255,255,255,0.8)",
            position: "relative",
            zIndex: 10,
          }}
        >
          {[
            { icon: <Shield size={15} color="#C9A227" />, text: "فنيون موثوقون" },
            { icon: <Star size={15} color="#C9A227" />, text: "خدمات بجودة عالية" },
            { icon: <Headphones size={15} color="#C9A227" />, text: "دعم على مدار الساعة" },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display:"flex", alignItems:"center", gap:6, color:"#888", fontSize:13, fontFamily:"'Cairo', sans-serif" }}>
              {icon}<span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
