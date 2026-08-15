import { useState, useEffect } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { useLocation, Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Phone, Lock, ArrowLeft } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";
import { AuthBackground } from "@/components/ui/auth-background";

const schema_validate = (mobile: string, password: string) => {
  const errors: { mobile?: string; password?: string } = {};
  if (!mobile || mobile.length < 8) errors.mobile = "رقم الهاتف غير صحيح";
  if (!password || password.length < 6) errors.password = "كلمة المرور قصيرة جداً";
  return errors;
};

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});
  const [mounted, setMounted] = useState(false);
  const branding = useBranding();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = schema_validate(mobile, password);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    loginMutation.mutate(
      { data: { mobile, password } as any },
      {
        onSuccess: (data: any) => {
          login(data.token, data.user, data.permissions || [], data.refreshToken);
          if (data.user.role === "customer") navigate("/");
          else if (data.user.role === "technician") navigate("/technician");
          else navigate("/admin");
        },
        onError: (err: any) => {
          toast({ title: "خطأ", description: err?.data?.error || "بيانات الدخول غير صحيحة", variant: "destructive" });
        },
      }
    );
  };


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .lp { font-family: 'Cairo', sans-serif !important; }

        @keyframes authCardIn {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes authSpinner {
          to { transform: rotate(360deg); }
        }

        .lp-card {
          animation: authCardIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }

        .lp-inp {
          width: 100%;
          padding: 13px 46px 13px 46px;
          border: 1.5px solid rgba(0,0,0,0.1);
          border-radius: 14px;
          background: rgba(255,255,255,0.88);
          font-size: 15px;
          font-family: 'Cairo', sans-serif;
          color: #1a1a1a;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          text-align: right;
        }
        .lp-inp:focus {
          border-color: #F5C518;
          background: rgba(255,255,255,1);
          box-shadow: 0 0 0 4px rgba(245,197,24,0.14), 0 2px 8px rgba(0,0,0,0.04);
        }
        .lp-inp::placeholder { color: #c0b890; }
        .lp-inp-err { border-color: #e53e3e !important; box-shadow: 0 0 0 3px rgba(229,62,62,0.1) !important; }
        .lp-inp-wrap { position: relative; }
        .lp-icon-r {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%); color: #c0b890; pointer-events: none;
        }
        .lp-icon-l {
          position: absolute; left: 14px; top: 50%;
          transform: translateY(-50%); color: #c0b890;
          cursor: pointer; background: none; border: none; padding: 0;
          transition: color 0.15s; z-index:2;
        }
        .lp-icon-l:hover { color: #888; }
        .lp-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #FFD700 0%, #F5C518 45%, #E8B800 100%);
          color: #1a1a1a;
          font-family: 'Cairo', sans-serif;
          font-size: 16px;
          font-weight: 800;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 18px rgba(245,197,24,0.48), 0 1px 4px rgba(0,0,0,0.08);
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
          overflow: hidden;
        }
        .lp-btn::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 48%;
          background: linear-gradient(rgba(255,255,255,0.22), transparent);
          border-radius: 14px 14px 0 0; pointer-events: none;
        }
        .lp-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(245,197,24,0.6), 0 2px 8px rgba(0,0,0,0.1);
        }
        .lp-btn:active:not(:disabled) { transform: translateY(0) scale(0.99); }
        .lp-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .lp-footer-link {
          color: #999; text-decoration: none; font-size: 12px;
          transition: color 0.15s; font-family: 'Cairo', sans-serif;
        }
        .lp-footer-link:hover { color: #c49a00; }

        .lp-divider {
          display: flex; align-items: center; gap: 12px;
          margin: 18px 0;
        }
        .lp-divider-line { flex: 1; height: 1px; background: rgba(0,0,0,0.07); }
        .lp-divider-text { font-size: 12px; color: #c0b890; flex-shrink: 0; }

        /* ── Responsive spacing classes ── */
        .lp-main-area   { padding: 32px 16px; }
        .lp-card-body   { padding: 40px 36px; }
        .lp-logo-section { margin-bottom: 28px; }
        .lp-logo-icon-wrap {
          width: 80px; height: 80px;
          margin: 0 auto 14px;
          border-radius: 22px;
        }
        .lp-welcome-section { margin-bottom: 28px; }
        .lp-form-rows   { display: flex; flex-direction: column; gap: 16px; }

        @media (max-height: 900px) and (max-width: 540px) {
          .lp-main-area    { padding: 12px 16px; }
          .lp-card-body    { padding: 24px 24px; }
          .lp-logo-section { margin-bottom: 14px; }
          .lp-logo-icon-wrap { width: 64px; height: 64px; margin: 0 auto 8px; border-radius: 16px; }
          .lp-welcome-section { margin-bottom: 14px; }
          .lp-form-rows    { gap: 11px; }
          .lp-divider      { margin: 10px 0; }
          .lp-inp          { padding-top: 11px; padding-bottom: 11px; font-size: 14px; }
          .lp-btn          { padding: 12px; font-size: 15px; }
        }
        @media (max-height: 680px) and (max-width: 540px) {
          .lp-main-area    { padding: 8px 12px; }
          .lp-card-body    { padding: 18px 20px; }
          .lp-logo-section { margin-bottom: 10px; }
          .lp-logo-icon-wrap { width: 52px; height: 52px; margin: 0 auto 6px; border-radius: 13px; }
          .lp-welcome-section { margin-bottom: 10px; }
          .lp-form-rows    { gap: 9px; }
          .lp-divider      { margin: 8px 0; }
          .lp-inp          { padding-top: 10px; padding-bottom: 10px; font-size: 14px; }
          .lp-btn          { padding: 11px; font-size: 15px; }
        }
      `}</style>

      <AuthBackground slug="login" />

      <div
        className="lp"
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

        {/* ── HEADER ── */}
        <header style={{
          padding: "13px 28px",
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.65)",
            border: "1.5px solid rgba(0,0,0,0.07)",
            borderRadius: 10, padding: "6px 12px",
            fontSize: 13, color: "#666", cursor: "default",
          }}>
            <span>🌐</span>
            <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 600 }}>العربية</span>
          </div>

          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.1, fontFamily: "'Cairo', sans-serif" }}>
                {branding.siteNameAr}
              </span>
              <span style={{ fontSize: 11, color: "#aaa", lineHeight: 1.2 }}>{branding.siteSlogan}</span>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 12, overflow: "hidden",
              border: "2px solid rgba(245,197,24,0.6)",
              boxShadow: "0 2px 12px rgba(245,197,24,0.28)",
              flexShrink: 0,
            }}>
              <CldImg src={branding.logoUrl || "/assets/logo.png"} alt={branding.siteNameAr} width={200} eager className="w-full h-full object-cover" />
            </div>
          </Link>
        </header>

        {/* ── MAIN ── */}
        <main
          className="lp-main-area"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 5,
          }}
        >
          <div
            className="lp-card lp-card-body"
            style={{
              width: "100%",
              maxWidth: 440,
              background: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.96)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.08), 0 8px 24px rgba(245,197,24,0.1), inset 0 1px 0 rgba(255,255,255,1)",
              borderRadius: 28,
            }}
          >
            {/* Logo block */}
            <div className="lp-logo-section" style={{ textAlign: "center" }}>
              <div style={{ position: "relative", display: "inline-block", marginBottom: 0 }}>
                <div style={{
                  position: "absolute", inset: -10,
                  borderRadius: 32,
                  background: "radial-gradient(circle, rgba(245,197,24,0.38) 0%, transparent 70%)",
                  animation: "authLogoGlow 3s ease-in-out infinite",
                }} />
                <div
                  className="lp-logo-icon-wrap"
                  style={{
                    overflow: "hidden",
                    border: "2.5px solid rgba(245,197,24,0.7)",
                    boxShadow: "0 4px 20px rgba(245,197,24,0.4), 0 2px 8px rgba(0,0,0,0.08)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <img
                    src={branding.logoUrl || "/assets/logo.png"}
                    alt={branding.siteNameAr}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              </div>
              <h1 style={{
                margin: "12px 0 3px",
                fontSize: 26, fontWeight: 900, color: "#1a1a1a",
                fontFamily: "'Cairo', sans-serif",
              }}>{branding.siteNameAr}</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#bbb", fontFamily: "'Cairo', sans-serif" }}>
                {branding.siteSlogan}
              </p>
            </div>

            {/* Welcome */}
            <div className="lp-welcome-section" style={{ textAlign: "center" }}>
              <h2 style={{
                margin: "0 0 6px", fontSize: 20, fontWeight: 900,
                color: "#1a1a1a", fontFamily: "'Cairo', sans-serif",
              }}>
                مرحباً بعودتك 👋
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "#999", lineHeight: 1.6, fontFamily: "'Cairo', sans-serif" }}>
                سجل دخولك لمتابعة طلباتك وإدارة حسابك
              </p>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="lp-form-rows">
              <div>
                <label style={{ display:"block", marginBottom:7, fontSize:13, fontWeight:700, color:"#555", fontFamily:"'Cairo', sans-serif" }}>
                  رقم الهاتف
                </label>
                <div className="lp-inp-wrap">
                  <Phone size={16} className="lp-icon-r" />
                  <input
                    type="tel" placeholder="01xxxxxxxxx" value={mobile}
                    onChange={(e) => { setMobile(e.target.value); setErrors((p) => ({ ...p, mobile: undefined })); }}
                    data-testid="input-mobile"
                    className={`lp-inp${errors.mobile ? " lp-inp-err" : ""}`}
                    style={{ direction: "ltr" }} autoComplete="tel"
                  />
                </div>
                {errors.mobile && <p style={{ margin:"5px 0 0", fontSize:11, color:"#e53e3e", fontFamily:"'Cairo', sans-serif" }}>{errors.mobile}</p>}
              </div>

              <div>
                <label style={{ display:"block", marginBottom:7, fontSize:13, fontWeight:700, color:"#555", fontFamily:"'Cairo', sans-serif" }}>
                  كلمة المرور
                </label>
                <div className="lp-inp-wrap">
                  <Lock size={16} className="lp-icon-r" />
                  <input
                    type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                    data-testid="input-password"
                    className={`lp-inp${errors.password ? " lp-inp-err" : ""}`}
                    autoComplete="current-password"
                  />
                  <button type="button" className="lp-icon-l" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p style={{ margin:"5px 0 0", fontSize:11, color:"#e53e3e", fontFamily:"'Cairo', sans-serif" }}>{errors.password}</p>}
              </div>

              <div style={{ textAlign: "left" }}>
                <Link href="/forgot-password" style={{ fontSize:13, color:"#c49a00", fontWeight:600, textDecoration:"none", fontFamily:"'Cairo', sans-serif" }}>
                  نسيت كلمة المرور؟
                </Link>
              </div>

              <button type="submit" className="lp-btn" disabled={loginMutation.isPending} data-testid="button-submit">
                {loginMutation.isPending
                  ? <><div style={{ width:17,height:17,borderRadius:"50%",border:"2.5px solid rgba(0,0,0,0.25)",borderTopColor:"#1a1a1a",animation:"authSpinner 0.7s linear infinite" }} />جاري الدخول...</>
                  : <><ArrowLeft size={18} />تسجيل الدخول</>
                }
              </button>
            </form>

            <div className="lp-divider">
              <div className="lp-divider-line" />
              <span className="lp-divider-text">أو</span>
              <div className="lp-divider-line" />
            </div>

            <p style={{ margin:0, textAlign:"center", fontSize:13, color:"#999", fontFamily:"'Cairo', sans-serif" }}>
              ليس لديك حساب؟{" "}
              <Link href="/register" style={{ color:"#c49a00", fontWeight:800, textDecoration:"none" }}>
                إنشاء حساب جديد
              </Link>
            </p>
          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer style={{
          padding: "12px 24px",
          background: "rgba(255,255,255,0.68)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255,255,255,0.8)",
          textAlign: "center",
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flexWrap:"wrap", gap:"6px 8px", marginBottom:6 }}>
            {([["الشروط والأحكام","/terms"],["سياسة الخصوصية","/privacy"],["الأسئلة الشائعة","/faq"],["اتصل بنا","/contact"]] as [string,string][]).map(([label, href], i, arr) => (
              <span key={href} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Link href={href} className="lp-footer-link">{label}</Link>
                {i < arr.length - 1 && <span style={{ color:"#ddd" }}>|</span>}
              </span>
            ))}
          </div>
          <p style={{ margin:0, fontSize:12, color:"#bbb", fontFamily:"'Cairo', sans-serif" }}>
            جميع الحقوق محفوظة © 2024{" "}
            <Link href="/" style={{ color:"#c49a00", textDecoration:"none", fontWeight:700 }}>فنشها</Link>
          </p>
        </footer>
      </div>
    </>
  );
}
