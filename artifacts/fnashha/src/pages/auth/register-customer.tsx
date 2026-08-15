import { useState, useEffect } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegisterCustomer } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Lock, Eye, EyeOff, ArrowLeft, ChevronRight, Gift } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";
import { AuthBackground } from "@/components/ui/auth-background";

const schema = z.object({
  fullName: z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
  mobile: z.string().min(8, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  confirmPassword: z.string(),
  referredBy: z.string().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "كلمتا المرور غير متطابقتان",
  path: ["confirmPassword"],
});

export default function RegisterCustomer() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterCustomer();
  const branding = useBranding();
  const [mounted, setMounted] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const requestParams = new URLSearchParams(window.location.search);
  const serviceId = requestParams.get("serviceId");
  const governorateId = requestParams.get("governorateId");
  const areaId = requestParams.get("areaId");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Read referral code from URL query param (?ref=CODE)
  const refFromUrl = new URLSearchParams(window.location.search).get("ref") ?? "";

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", mobile: "", password: "", confirmPassword: "", referredBy: refFromUrl.toUpperCase() },
  });

  // Keep the field in sync if the URL param changes after mount
  useEffect(() => {
    if (refFromUrl) {
      form.setValue("referredBy", refFromUrl.toUpperCase());
    }
  }, [refFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (values: z.infer<typeof schema>) => {
    const { confirmPassword: _, ...rest } = values;
    const data: Record<string, unknown> = { ...rest };
    if (!data.referredBy) delete data.referredBy; // omit empty string
    registerMutation.mutate(
      { data: data as any },
      {
        onSuccess: (res: any) => {
          login(res.token, res.user, [], res.refreshToken);
          const hasRequestContext = [serviceId, governorateId, areaId].every((value) => /^\d+$/.test(value || ""));
          navigate(
            hasRequestContext
              ? `/customer/requests/new?serviceId=${serviceId}&governorateId=${governorateId}&areaId=${areaId}`
              : "/customer",
          );
        },
        onError: (err: any) => {
          const msg = err?.data?.error || "حدث خطأ";
          toast({ title: "خطأ في التسجيل", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const labelStyle: React.CSSProperties = {
    display: "block", marginBottom: 7, fontSize: 13, fontWeight: 700,
    color: "#555", fontFamily: "'Cairo', sans-serif",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .rc { font-family: 'Cairo', sans-serif !important; }

        @keyframes authCardIn {
          from { opacity: 0; transform: translateY(26px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes authSpinner { to { transform: rotate(360deg); } }

        .rc-card { animation: authCardIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        .rc-inp {
          width: 100%;
          padding: 13px 46px;
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
        .rc-inp:focus {
          border-color: #F5C518;
          background: rgba(255,255,255,1);
          box-shadow: 0 0 0 4px rgba(245,197,24,0.14), 0 2px 8px rgba(0,0,0,0.04);
        }
        .rc-inp::placeholder { color: #c0b890; }
        .rc-inp-no-icon { padding: 13px 16px; }
        .rc-inp-wrap { position: relative; }
        .rc-icon-r {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%); color: #c0b890; pointer-events: none;
        }
        .rc-icon-l {
          position: absolute; left: 14px; top: 50%;
          transform: translateY(-50%); color: #c0b890;
          cursor: pointer; background: none; border: none; padding: 0;
          transition: color 0.15s; z-index: 2;
        }
        .rc-icon-l:hover { color: #888; }

        .rc-btn {
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
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 18px rgba(245,197,24,0.48), 0 1px 4px rgba(0,0,0,0.08);
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative; overflow: hidden; margin-top: 4px;
        }
        .rc-btn::before {
          content: ''; position: absolute; top:0; left:0; right:0; height:48%;
          background: linear-gradient(rgba(255,255,255,0.22), transparent);
          border-radius: 14px 14px 0 0; pointer-events: none;
        }
        .rc-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(245,197,24,0.6), 0 2px 8px rgba(0,0,0,0.1);
        }
        .rc-btn:active:not(:disabled) { transform: translateY(0) scale(0.99); }
        .rc-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        /* override shadcn FormMessage */
        .rc [data-slot="form-message"] {
          font-family: 'Cairo', sans-serif !important;
          font-size: 11px !important;
          margin-top: 4px;
        }

        .rc-ref-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: rgba(245,197,24,0.12); border: 1.5px solid rgba(245,197,24,0.4);
          border-radius: 8px; padding: 4px 10px;
          font-size: 12px; font-weight: 700; color: #b08800;
          font-family: 'Cairo', sans-serif; direction: ltr;
          letter-spacing: 0.05em;
        }
      `}</style>

      <AuthBackground slug="register-customer" />

      <div
        className="rc"
        dir="rtl"
        style={{
          minHeight: "100svh",
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.3s ease",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
        }}
      >

        {/* ── Back link ── */}
        <div style={{ width: "100%", maxWidth: 440, marginBottom: 12, position: "relative", zIndex: 5 }}>
          <Link href="/register" style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            color: "#999", fontSize: 13, textDecoration: "none",
            fontFamily: "'Cairo', sans-serif", fontWeight: 600,
            transition: "color 0.15s",
          }}>
            <ChevronRight size={15} />
            العودة لاختيار نوع الحساب
          </Link>
        </div>

        {/* ── Glass Card ── */}
        <div
          className="rc-card"
          style={{
            width: "100%",
            maxWidth: 440,
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.96)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.08), 0 8px 24px rgba(245,197,24,0.1), inset 0 1px 0 rgba(255,255,255,1)",
            borderRadius: 28,
            padding: "36px 32px 28px",
            position: "relative",
            zIndex: 5,
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{
                position: "absolute", inset: -10, borderRadius: 30,
                background: "radial-gradient(circle, rgba(245,197,24,0.36) 0%, transparent 70%)",
                animation: "authLogoGlow 3s ease-in-out infinite",
              }} />
              <Link href="/" style={{ display: "inline-block" }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 18, overflow: "hidden",
                  border: "2.5px solid rgba(245,197,24,0.65)",
                  boxShadow: "0 4px 20px rgba(245,197,24,0.38), 0 2px 8px rgba(0,0,0,0.07)",
                  position: "relative", zIndex: 1,
                }}>
                  <CldImg src={branding.logoUrl || "/assets/logo.png"} alt={branding.siteNameAr} width={200} eager
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              </Link>
            </div>
            <h1 style={{
              margin: "12px 0 4px", fontSize: 22, fontWeight: 900,
              color: "#1a1a1a", fontFamily: "'Cairo', sans-serif",
            }}>
              تسجيل عميل جديد
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#bbb", fontFamily: "'Cairo', sans-serif" }}>
              أنشئ حسابك وابدأ باستقبال العروض
            </p>

            {/* Referral badge when arriving via referral link */}
            {refFromUrl && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
                <span className="rc-ref-badge">
                  <Gift size={13} />
                  دُعيت عبر كود إحالة
                </span>
              </div>
            )}
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <label style={labelStyle}>الاسم الكامل</label>
                  <div className="rc-inp-wrap">
                    <User size={16} className="rc-icon-r" />
                    <FormControl>
                      <input {...field} type="text" placeholder="أحمد محمد" className="rc-inp" data-testid="input-fullname" autoComplete="name" />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem>
                  <label style={labelStyle}>رقم الهاتف</label>
                  <div className="rc-inp-wrap">
                    <Phone size={16} className="rc-icon-r" />
                    <FormControl>
                      <input {...field} type="tel" placeholder="01xxxxxxxxx" className="rc-inp" data-testid="input-mobile" autoComplete="tel" style={{ direction: "ltr" }} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <label style={labelStyle}>كلمة المرور</label>
                  <div className="rc-inp-wrap">
                    <Lock size={16} className="rc-icon-r" />
                    <FormControl>
                      <input {...field} type={showPass ? "text" : "password"} placeholder="••••••••" className="rc-inp" data-testid="input-password" autoComplete="new-password" />
                    </FormControl>
                    <button type="button" className="rc-icon-l" onClick={() => setShowPass(v => !v)} aria-label="toggle password">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <label style={labelStyle}>تأكيد كلمة المرور</label>
                  <div className="rc-inp-wrap">
                    <Lock size={16} className="rc-icon-r" />
                    <FormControl>
                      <input {...field} type={showConfirm ? "text" : "password"} placeholder="••••••••" className="rc-inp" data-testid="input-confirm-password" autoComplete="new-password" />
                    </FormControl>
                    <button type="button" className="rc-icon-l" onClick={() => setShowConfirm(v => !v)} aria-label="toggle confirm password">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Optional referral code field */}
              <FormField control={form.control} name="referredBy" render={({ field }) => (
                <FormItem>
                  <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 5 }}>
                    <Gift size={13} style={{ color: "#c49a00" }} />
                    كود الإحالة
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#bbb" }}>(اختياري)</span>
                  </label>
                  <div className="rc-inp-wrap">
                    <Gift size={16} className="rc-icon-r" style={{ color: "#c49a00" }} />
                    <FormControl>
                      <input
                        {...field}
                        type="text"
                        placeholder="FN-XXXXXX"
                        className="rc-inp"
                        data-testid="input-referral"
                        autoComplete="off"
                        style={{ textTransform: "uppercase", letterSpacing: "0.08em", direction: "ltr", textAlign: "center" }}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <button type="submit" className="rc-btn" disabled={registerMutation.isPending} data-testid="button-submit">
                {registerMutation.isPending
                  ? <><div style={{ width:17,height:17,borderRadius:"50%",border:"2.5px solid rgba(0,0,0,0.25)",borderTopColor:"#1a1a1a",animation:"authSpinner 0.7s linear infinite" }} />جاري التسجيل...</>
                  : <><ArrowLeft size={18} />إنشاء الحساب</>
                }
              </button>
            </form>
          </Form>

          {/* Footer links */}
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#999", fontFamily: "'Cairo', sans-serif" }}>
              لديك حساب؟{" "}
              <Link href="/login" style={{ color: "#c49a00", fontWeight: 700, textDecoration: "none" }}>تسجيل الدخول</Link>
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#bbb", lineHeight: 1.6, fontFamily: "'Cairo', sans-serif" }}>
              بالتسجيل، أنت توافق على{" "}
              <Link href="/terms" style={{ color: "#c49a00", textDecoration: "none" }}>الشروط والأحكام</Link>
              {" "}و{" "}
              <Link href="/privacy" style={{ color: "#c49a00", textDecoration: "none" }}>سياسة الخصوصية</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
