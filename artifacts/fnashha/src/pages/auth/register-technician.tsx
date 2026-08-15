import { useState, useRef, useEffect } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import {
  useRegisterTechnician, useListServices, useListGovernorates, useListAreas,
} from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  User, Lock, Camera, Upload, CheckCircle2, MapPin, Briefcase,
  FileText, X, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Check, Eye, EyeOff, Phone, CreditCard, Star, ArrowLeft,
} from "lucide-react";
import { uploadFileLocal } from "@/lib/uploadMedia";
import { ImagePicker } from "@/components/ui/image-picker";
import { useBranding } from "@/contexts/branding-context";
import { AuthBackground } from "@/components/ui/auth-background";

/* ── Schema (unchanged) ────────────────────────────────── */
const schema = z.object({
  fullName: z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
  mobile: z.string().min(8, "رقم الهاتف غير صحيح"),
  nationalId: z.string().min(1, "الرقم القومي مطلوب").regex(/^\d{14}$/, "يجب أن يتكون الرقم القومي من 14 رقمًا"),
  password: z.string().min(6, "كلمة المرور قصيرة جداً"),
  confirmPassword: z.string(),
  yearsOfExperience: z.string().min(1, "اختر سنوات الخبرة"),
  acceptTerms: z.boolean().refine((v) => v === true, "يجب الموافقة على الشروط والأحكام"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "كلمتا المرور غير متطابقتان",
  path: ["confirmPassword"],
});

const EXPERIENCE_OPTIONS = [
  { value: "1", label: "سنة واحدة" },
  { value: "2", label: "سنتان" },
  { value: "3", label: "3 سنوات" },
  { value: "5", label: "5 سنوات" },
  { value: "7", label: "7 سنوات" },
  { value: "10", label: "10 سنوات" },
  { value: "15", label: "15 سنة" },
  { value: "20", label: "20 سنة أو أكثر" },
];

const STEP_META = [
  { label: "البيانات الشخصية" },
  { label: "المعلومات المهنية" },
  { label: "المستندات" },
  { label: "المراجعة" },
];

/* ── ImageUploadCard ────────────────────────────────────── */
function ImageUploadCard({
  label, value, onChange, required, testId, compact, category,
}: {
  label: string; value: string | null;
  onChange: (v: string | null) => void;
  required?: boolean; testId?: string; compact?: boolean; category?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const h = compact ? 110 : 130;

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true); setUploadError("");
    try { const url = await uploadFileLocal(file, null, category || "profiles"); onChange(url); }
    catch { setUploadError("فشل الرفع، حاول مرة أخرى"); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#666", textAlign: "center", fontFamily: "'Cairo', sans-serif" }}>
        {label} {required && <span style={{ color: "#e53e3e" }}>*</span>}
      </p>
      <div style={{ position: "relative" }} className="group">
        <ImagePicker onFiles={handleFiles} captureMode="environment" disabled={uploading || !!value}>
          <button
            type="button"
            data-testid={testId}
            disabled={uploading}
            style={{
              width: "100%", height: h,
              borderRadius: 14,
              border: value ? "1.5px solid rgba(245,197,24,0.35)" : "2px dashed rgba(0,0,0,0.15)",
              background: value ? "transparent" : "rgba(255,255,255,0.7)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              cursor: value ? "default" : "pointer",
              overflow: "hidden",
              transition: "border-color 0.2s, background 0.2s",
              padding: 0,
            }}
            onMouseEnter={e => { if (!value) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,197,24,0.6)"; }}
            onMouseLeave={e => { if (!value) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.15)"; }}
          >
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid rgba(245,197,24,0.3)", borderTopColor: "#F5C518", animation: "authSpinner 0.7s linear infinite" }} />
                <span style={{ fontSize: 10, color: "#aaa", fontFamily: "'Cairo', sans-serif" }}>جاري الرفع...</span>
              </div>
            ) : value ? (
              <CldImg src={value} alt={label} width={800} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#bbb" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Upload size={16} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Cairo', sans-serif" }}>اضغط للرفع</span>
              </div>
            )}
          </button>
        </ImagePicker>
        {value && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
            borderRadius: 14, opacity: 0, transition: "opacity 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }} className="img-overlay">
            <ImagePicker onFiles={handleFiles} captureMode="environment">
              <button type="button"
                style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Cairo', sans-serif" }}>
                <RefreshCw size={11} />استبدال
              </button>
            </ImagePicker>
            <button type="button" onClick={() => onChange(null)}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(229,62,62,0.9)", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Cairo', sans-serif" }}>
              <X size={11} />حذف
            </button>
          </div>
        )}
      </div>
      {uploadError && <p style={{ margin: 0, fontSize: 10, color: "#e53e3e", textAlign: "center", fontFamily: "'Cairo', sans-serif" }}>{uploadError}</p>}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */
export default function RegisterTechnician() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegisterTechnician();
  const branding = useBranding();

  const [step, setStep] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const [animDir, setAnimDir] = useState<"fwd" | "bwd">("fwd");
  const [mounted, setMounted] = useState(false);
  const [registered, setRegistered] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [expandedGovIds, setExpandedGovIds] = useState<Set<number>>(new Set());
  const [showAllServices, setShowAllServices] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [personalPhoto, setPersonalPhoto] = useState<string | null>(null);
  const [nationalIdFront, setNationalIdFront] = useState<string | null>(null);
  const [nationalIdBack, setNationalIdBack] = useState<string | null>(null);

  const { data: services = [] } = useListServices();
  const { data: governorates = [] } = useListGovernorates();
  const { data: allAreasData = [] } = useListAreas(undefined as any);

  const activeServices = (services as any[]).filter((s: any) => s.isActive);
  const activeGovernorates = (governorates as any[]).filter((g: any) => g.isActive !== false);
  const allAreas = (Array.isArray(allAreasData) ? allAreasData : []).filter((a: any) => a.isActive !== false);
  const areasByGov = activeGovernorates.reduce<Record<number, { gov: any; areas: any[] }>>((acc, gov) => {
    const govAreas = allAreas.filter((a: any) => a.governorateId === gov.id);
    if (govAreas.length > 0) acc[gov.id] = { gov, areas: govAreas };
    return acc;
  }, {});

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", mobile: "", nationalId: "", password: "", confirmPassword: "", yearsOfExperience: "", acceptTerms: false },
  });
  const vals = form.watch();

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  const goTo = (target: number) => {
    setAnimDir(target > step ? "fwd" : "bwd");
    setAnimKey(k => k + 1);
    setStep(target);
  };
  const goNext = () => goTo(step + 1);
  const goPrev = () => goTo(step - 1);

  const handleNext = async () => {
    if (step === 1) {
      const ok = await form.trigger(["fullName", "mobile", "nationalId", "password", "confirmPassword"]);
      if (!ok) return;
      goNext();
    } else if (step === 2) {
      if (selectedServiceIds.length === 0) { toast({ title: "اختر خدمة واحدة على الأقل", variant: "destructive" }); return; }
      const ok = await form.trigger(["yearsOfExperience"]);
      if (!ok) return;
      if (selectedAreaIds.length === 0) { toast({ title: "اختر منطقة تغطية واحدة على الأقل", variant: "destructive" }); return; }
      goNext();
    } else if (step === 3) {
      if (!nationalIdFront || !nationalIdBack) {
        toast({ title: "صور البطاقة القومية مطلوبة", description: "يرجى رفع صورة الوجه الأمامي والخلفي", variant: "destructive" });
        return;
      }
      goNext();
    } else if (step === 4) {
      form.handleSubmit(onSubmit)();
    }
  };

  const toggleService = (id: number) => setSelectedServiceIds(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);
  const toggleArea = (id: number) => setSelectedAreaIds(p => p.includes(id) ? p.filter(a => a !== id) : [...p, id]);
  const toggleGov = (id: number) => setExpandedGovIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllInGov = (areas: any[]) => {
    const ids = areas.map(a => a.id);
    const all = ids.every(id => selectedAreaIds.includes(id));
    setSelectedAreaIds(p => all ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])]);
  };

  const onSubmit = (values: z.infer<typeof schema>) => {
    registerMutation.mutate(
      {
        data: {
          fullName: values.fullName, mobile: values.mobile, nationalId: values.nationalId,
          password: values.password, personalPhoto: personalPhoto || undefined,
          nationalIdFront: nationalIdFront!, nationalIdBack: nationalIdBack!,
          serviceIds: selectedServiceIds, areaIds: selectedAreaIds,
          primaryAreaId: selectedAreaIds[0],
          yearsOfExperience: parseInt(values.yearsOfExperience),
        } as any,
      },
      {
        onSuccess: () => setRegistered(true),
        onError: (err: any) => toast({ title: "خطأ في التسجيل", description: err?.data?.error || "حدث خطأ، حاول مرة أخرى", variant: "destructive" }),
      }
    );
  };


  const lblStyle: React.CSSProperties = {
    display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: "#555", fontFamily: "'Cairo', sans-serif",
  };
  const inpWrap: React.CSSProperties = { position: "relative" };
  const iconR: React.CSSProperties = { position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: "#c0b890", pointerEvents: "none" };
  const iconL: React.CSSProperties = { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#c0b890", cursor: "pointer", background: "none", border: "none", padding: 0, zIndex: 2 };

  /* ─── Success screen ─────────────────────────────── */
  if (registered) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
          *, *::before, *::after { box-sizing: border-box; }
          @keyframes authCardIn { from{opacity:0;transform:translateY(26px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
          @keyframes authSpinner { to{transform:rotate(360deg)} }
          .rt-success { animation: authCardIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; font-family:'Cairo',sans-serif!important; }
          .rt-gold-btn { width:100%;padding:14px;background:linear-gradient(135deg,#FFD700 0%,#F5C518 45%,#E8B800 100%);color:#1a1a1a;font-family:'Cairo',sans-serif;font-size:15px;font-weight:800;border:none;border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 18px rgba(245,197,24,0.48);transition:transform 0.2s,box-shadow 0.2s;position:relative;overflow:hidden; }
          .rt-gold-btn::before{content:'';position:absolute;top:0;left:0;right:0;height:48%;background:linear-gradient(rgba(255,255,255,0.22),transparent);border-radius:14px 14px 0 0;pointer-events:none;}
          .rt-gold-btn:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(245,197,24,0.6);}
        `}</style>
        <AuthBackground slug="register-technician" />
        <div dir="rtl" style={{ minHeight:"100svh",background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px",position:"relative",zIndex:1,overflow:"hidden" }}>
          <div className="rt-success" style={{width:"100%",maxWidth:440,background:"rgba(255,255,255,0.84)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.96)",boxShadow:"0 24px 64px rgba(0,0,0,0.08),0 8px 24px rgba(245,197,24,0.1)",borderRadius:28,padding:"40px 32px",textAlign:"center",position:"relative",zIndex:5}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#e8f9ef 0%,#d0f0e0 100%)",border:"1.5px solid rgba(34,197,94,0.25)",boxShadow:"0 4px 20px rgba(34,197,94,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
              <CheckCircle2 style={{width:40,height:40,color:"#16a34a"}} />
            </div>
            <h1 style={{margin:"0 0 10px",fontSize:22,fontWeight:900,color:"#1a1a1a",fontFamily:"'Cairo',sans-serif"}}>تم تقديم طلبك بنجاح!</h1>
            <p style={{margin:"0 0 20px",color:"#888",lineHeight:1.7,fontSize:14,fontFamily:"'Cairo',sans-serif"}}>سيتم مراجعة بياناتك وصورك من قبل فريق الإدارة.<br/>سيتم إشعارك عند الموافقة على حسابك.</p>
            <div style={{background:"rgba(251,191,36,0.1)",border:"1px solid rgba(245,197,24,0.25)",borderRadius:16,padding:"14px 16px",textAlign:"right",marginBottom:24}}>
              <p style={{margin:"0 0 4px",fontWeight:700,fontSize:13,color:"#92400e",fontFamily:"'Cairo',sans-serif"}}>ملاحظة مهمة:</p>
              <p style={{margin:0,fontSize:13,color:"#92400e",lineHeight:1.6,fontFamily:"'Cairo',sans-serif"}}>لن تتمكن من تسجيل الدخول حتى تتم الموافقة على حسابك من قبل الإدارة.</p>
            </div>
            <button className="rt-gold-btn" onClick={() => navigate("/login")}>العودة لتسجيل الدخول</button>
          </div>
        </div>
      </>
    );
  }

  /* ─── Wizard layout ──────────────────────────────── */
  const progressPct = ((step - 1) / 3) * 100;

  const getServiceName = (id: number) => (activeServices.find((s: any) => s.id === id) as any)?.nameAr || "";
  const getExperienceLabel = (v: string) => EXPERIENCE_OPTIONS.find(o => o.value === v)?.label || "";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .rt { font-family: 'Cairo', sans-serif !important; }

        @keyframes authSpinner { to{transform:rotate(360deg)} }
        @keyframes stepSlideFwd { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes stepSlideBwd { from{opacity:0;transform:translateX(-40px)} to{opacity:1;transform:translateX(0)} }

        .rt-inp {
          width:100%; padding:12px 44px; border:1.5px solid rgba(0,0,0,0.1); border-radius:13px;
          background:rgba(255,255,255,0.88); font-size:14px; font-family:'Cairo',sans-serif;
          color:#1a1a1a; outline:none; transition:border-color 0.2s,box-shadow 0.2s,background 0.2s; text-align:right;
        }
        .rt-inp:focus { border-color:#F5C518; background:rgba(255,255,255,1); box-shadow:0 0 0 4px rgba(245,197,24,0.14); }
        .rt-inp::placeholder { color:#c0b890; }

        .rt-select [data-slot="select-trigger"] {
          background:rgba(255,255,255,0.88)!important; border:1.5px solid rgba(0,0,0,0.1)!important;
          border-radius:13px!important; font-family:'Cairo',sans-serif!important; font-size:14px!important;
          padding:12px 14px!important; height:auto!important;
        }
        .rt-select [data-slot="select-trigger"]:focus { border-color:#F5C518!important; box-shadow:0 0 0 4px rgba(245,197,24,0.14)!important; }
        .rt [data-slot="form-message"] { font-family:'Cairo',sans-serif!important; font-size:11px!important; margin-top:3px; }
        .rt [data-slot="form-label"] { font-family:'Cairo',sans-serif!important; }

        .rt-gold-btn {
          width:100%; padding:13px; background:linear-gradient(135deg,#FFD700 0%,#F5C518 45%,#E8B800 100%);
          color:#1a1a1a; font-family:'Cairo',sans-serif; font-size:15px; font-weight:800;
          border:none; border-radius:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;
          box-shadow:0 4px 16px rgba(245,197,24,0.45); transition:transform 0.2s,box-shadow 0.2s;
          position:relative; overflow:hidden; flex:2;
        }
        .rt-gold-btn::before { content:''; position:absolute; top:0;left:0;right:0;height:48%; background:linear-gradient(rgba(255,255,255,0.2),transparent); border-radius:14px 14px 0 0; pointer-events:none; }
        .rt-gold-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 26px rgba(245,197,24,0.6); }
        .rt-gold-btn:active:not(:disabled) { transform:scale(0.99); }
        .rt-gold-btn:disabled { opacity:0.65; cursor:not-allowed; }

        .rt-ghost-btn {
          flex:1; padding:13px; background:rgba(255,255,255,0.75);
          border:1.5px solid rgba(0,0,0,0.1); border-radius:14px; cursor:pointer;
          font-size:14px; font-weight:700; color:#666; font-family:'Cairo',sans-serif;
          display:flex; align-items:center; justify-content:center; gap:6px;
          transition:background 0.18s,border-color 0.18s;
        }
        .rt-ghost-btn:hover { background:rgba(255,255,255,0.95); border-color:rgba(0,0,0,0.18); }

        .rt-scrollable::-webkit-scrollbar { width:4px; }
        .rt-scrollable::-webkit-scrollbar-track { background:transparent; }
        .rt-scrollable::-webkit-scrollbar-thumb { background:rgba(245,197,24,0.3); border-radius:2px; }
        .rt-scrollable::-webkit-scrollbar-thumb:hover { background:rgba(245,197,24,0.6); }

        .img-overlay:hover { opacity:1!important; }

        .rt-review-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:9px 0; border-bottom:1px solid rgba(0,0,0,0.05);
          font-family:'Cairo',sans-serif;
        }
        .rt-review-row:last-child { border-bottom:none; padding-bottom:0; }
        .rt-review-section {
          background:rgba(255,255,255,0.7); border:1px solid rgba(0,0,0,0.07);
          border-radius:16px; padding:14px 16px; margin-bottom:12px;
        }
        .rt-review-section-header {
          display:flex; align-items:center; justify-content:space-between;
          margin-bottom:10px;
        }
        .rt-review-edit-btn {
          font-family:'Cairo',sans-serif; font-size:12px; font-weight:700;
          color:#c49a00; background:rgba(245,197,24,0.1); border:1px solid rgba(245,197,24,0.25);
          border-radius:8px; padding:4px 10px; cursor:pointer; transition:background 0.15s;
        }
        .rt-review-edit-btn:hover { background:rgba(245,197,24,0.2); }
      `}</style>

      <AuthBackground slug="register-technician" />

      <div
        className="rt"
        dir="rtl"
        style={{
          minHeight: "100svh",
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >

        {/* ── Back link ── */}
        <div style={{width:"100%",maxWidth:520,marginBottom:10,position:"relative",zIndex:5}}>
          <Link href="/register" style={{display:"inline-flex",alignItems:"center",gap:4,color:"#aaa",fontSize:13,textDecoration:"none",fontFamily:"'Cairo',sans-serif",fontWeight:600}}>
            <ChevronRight size={14} />العودة لاختيار نوع الحساب
          </Link>
        </div>

        {/* ── GLASS CARD ── */}
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            maxHeight: "calc(100svh - 80px)",
            background: "rgba(255,255,255,0.84)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.96)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.08), 0 8px 24px rgba(245,197,24,0.1), inset 0 1px 0 rgba(255,255,255,1)",
            borderRadius: 28,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            zIndex: 5,
          }}
        >
          {/* ── Card header: logo + step indicator ── */}
          <div style={{padding:"20px 24px 0",flexShrink:0}}>

            {/* Logo row */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
              <div style={{position:"relative",flexShrink:0}}>
                <div style={{position:"absolute",inset:-6,borderRadius:18,background:"radial-gradient(circle,rgba(245,197,24,0.3) 0%,transparent 70%)",animation:"authLogoGlow 3s ease-in-out infinite"}} />
                <Link href="/" style={{ display: "inline-block" }}>
                  <div style={{width:44,height:44,borderRadius:12,overflow:"hidden",border:"2px solid rgba(245,197,24,0.6)",boxShadow:"0 3px 14px rgba(245,197,24,0.35)",position:"relative",zIndex:1}}>
                    <CldImg src={branding.logoUrl||"/assets/logo.png"} alt="" width={200} eager style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
                  </div>
                </Link>
              </div>
              <div>
                <div style={{fontSize:16,fontWeight:900,color:"#1a1a1a",fontFamily:"'Cairo',sans-serif",lineHeight:1.1}}>تسجيل فني جديد</div>
                <div style={{fontSize:12,color:"#bbb",fontFamily:"'Cairo',sans-serif",marginTop:2}}>{STEP_META[step-1].label} — الخطوة {step} من 4</div>
              </div>
            </div>

            {/* Step circles */}
            <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
              {STEP_META.map((s, i) => (
                <div key={i} style={{display:"flex",alignItems:"center",flex: i < 3 ? "1" : "0"}}>
                  <div style={{
                    width:30,height:30,borderRadius:"50%",flexShrink:0,
                    background: i+1 < step ? "linear-gradient(135deg,#FFD700,#E8B800)" : i+1===step ? "linear-gradient(135deg,#FFD700,#E8B800)" : "rgba(0,0,0,0.06)",
                    border: i+1===step ? "2.5px solid transparent" : "none",
                    boxShadow: i+1===step ? "0 0 0 3px rgba(245,197,24,0.2),0 4px 12px rgba(245,197,24,0.4)" : i+1<step ? "0 2px 8px rgba(245,197,24,0.3)" : "none",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:800,
                    color: i+1<=step ? "#1a1a1a" : "#ccc",
                    transition:"all 0.35s ease",
                    zIndex:2,position:"relative",
                  }}>
                    {i+1 < step ? <Check size={14} strokeWidth={3} /> : <span style={{fontFamily:"'Cairo',sans-serif"}}>{i+1}</span>}
                  </div>
                  {i < 3 && (
                    <div style={{flex:1,height:2,background:i+1<step?"linear-gradient(90deg,#F5C518,#FFD700)":"rgba(0,0,0,0.08)",transition:"background 0.4s ease",margin:"0 4px"}} />
                  )}
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{height:3,background:"rgba(0,0,0,0.07)",borderRadius:2,overflow:"hidden",marginBottom:4}}>
              <div style={{
                height:"100%",
                width:`${progressPct}%`,
                background:"linear-gradient(90deg,#FFD700,#F5C518)",
                borderRadius:2,
                transition:"width 0.5s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>

            {/* Step labels */}
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              {STEP_META.map((s, i) => (
                <span key={i} style={{
                  fontSize:9,fontWeight:i+1<=step?700:400,
                  color:i+1===step?"#C9A227":i+1<step?"#aaa":"#d0d0d0",
                  fontFamily:"'Cairo',sans-serif",textAlign:"center",width:"25%",
                  transition:"color 0.3s",
                }}>{s.label}</span>
              ))}
            </div>
          </div>

          {/* ── Scrollable step content ── */}
          <div
            className="rt-scrollable"
            style={{flex:1,overflowY:"auto",padding:"0 24px"}}
          >
            <Form {...form}>
              <form id="rt-form" onSubmit={form.handleSubmit(onSubmit)}>
                <div
                  key={animKey}
                  style={{
                    animation: animDir==="fwd"
                      ? "stepSlideFwd 0.32s cubic-bezier(0.4,0,0.2,1) forwards"
                      : "stepSlideBwd 0.32s cubic-bezier(0.4,0,0.2,1) forwards",
                    paddingBottom: 8,
                  }}
                >

                  {/* ══ STEP 1: Personal Info ══════════════════════ */}
                  {step===1 && (
                    <div style={{display:"flex",flexDirection:"column",gap:14}}>
                      <div style={{marginBottom:4}}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,rgba(245,197,24,0.12),rgba(245,197,24,0.06))",border:"1px solid rgba(245,197,24,0.2)",borderRadius:12,padding:"6px 12px"}}>
                          <User size={14} color="#C9A227" />
                          <span style={{fontSize:13,fontWeight:800,color:"#C9A227",fontFamily:"'Cairo',sans-serif"}}>البيانات الشخصية</span>
                        </div>
                      </div>

                      <FormField control={form.control} name="fullName" render={({field}) => (
                        <FormItem>
                          <label style={lblStyle}>الاسم الكامل <span style={{color:"#e53e3e"}}>*</span></label>
                          <div style={inpWrap}>
                            <User size={15} style={iconR} />
                            <FormControl><input {...field} type="text" placeholder="محمد أحمد" className="rt-inp" data-testid="input-fullname" autoComplete="name" /></FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="mobile" render={({field}) => (
                        <FormItem>
                          <label style={lblStyle}>رقم الهاتف <span style={{color:"#e53e3e"}}>*</span></label>
                          <div style={inpWrap}>
                            <Phone size={15} style={iconR} />
                            <FormControl><input {...field} type="tel" placeholder="01xxxxxxxxx" className="rt-inp" data-testid="input-mobile" autoComplete="tel" style={{direction:"ltr"}} /></FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="nationalId" render={({field}) => (
                        <FormItem>
                          <label style={lblStyle}>رقم البطاقة القومية <span style={{color:"#e53e3e"}}>*</span></label>
                          <div style={inpWrap}>
                            <CreditCard size={15} style={iconR} />
                            <FormControl><input {...field} type="text" placeholder="14 رقماً" className="rt-inp" data-testid="input-national-id" inputMode="numeric" maxLength={14} onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 14))} /></FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        <FormField control={form.control} name="password" render={({field}) => (
                          <FormItem>
                            <label style={lblStyle}>كلمة المرور <span style={{color:"#e53e3e"}}>*</span></label>
                            <div style={inpWrap}>
                              <Lock size={15} style={iconR} />
                              <FormControl><input {...field} type={showPass?"text":"password"} placeholder="••••••" className="rt-inp" data-testid="input-password" autoComplete="new-password" /></FormControl>
                              <button type="button" style={iconL} onClick={()=>setShowPass(v=>!v)}>{showPass?<EyeOff size={14}/>:<Eye size={14}/>}</button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="confirmPassword" render={({field}) => (
                          <FormItem>
                            <label style={lblStyle}>تأكيد المرور <span style={{color:"#e53e3e"}}>*</span></label>
                            <div style={inpWrap}>
                              <Lock size={15} style={iconR} />
                              <FormControl><input {...field} type={showConfirm?"text":"password"} placeholder="••••••" className="rt-inp" data-testid="input-confirm-password" autoComplete="new-password" /></FormControl>
                              <button type="button" style={iconL} onClick={()=>setShowConfirm(v=>!v)}>{showConfirm?<EyeOff size={14}/>:<Eye size={14}/>}</button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  )}

                  {/* ══ STEP 2: Professional ═══════════════════════ */}
                  {step===2 && (
                    <div style={{display:"flex",flexDirection:"column",gap:16}}>
                      <div>
                        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,rgba(245,197,24,0.12),rgba(245,197,24,0.06))",border:"1px solid rgba(245,197,24,0.2)",borderRadius:12,padding:"6px 12px",marginBottom:14}}>
                          <Briefcase size={14} color="#C9A227" />
                          <span style={{fontSize:13,fontWeight:800,color:"#C9A227",fontFamily:"'Cairo',sans-serif"}}>المعلومات المهنية</span>
                        </div>

                        {/* Services */}
                        <label style={{...lblStyle,marginBottom:10}}>
                          الخدمات المقدمة <span style={{color:"#e53e3e"}}>*</span>
                          {selectedServiceIds.length>0 && <span style={{marginRight:6,fontSize:11,background:"rgba(245,197,24,0.18)",color:"#b8860b",borderRadius:6,padding:"2px 7px",fontFamily:"'Cairo',sans-serif",fontWeight:700}}>{selectedServiceIds.length} محددة</span>}
                        </label>
                        {activeServices.length===0 ? (
                          <p style={{fontSize:12,color:"#bbb",textAlign:"center",fontFamily:"'Cairo',sans-serif",padding:"12px 0"}}>لا توجد خدمات متاحة حالياً</p>
                        ) : (
                          <>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                              {(showAllServices?activeServices:activeServices.slice(0,6)).map((service:any)=>{
                                const sel=selectedServiceIds.includes(service.id);
                                return (
                                  <button key={service.id} type="button" onClick={()=>toggleService(service.id)}
                                    data-testid={`service-card-${service.id}`}
                                    style={{
                                      position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                                      padding:"10px 6px",borderRadius:14,
                                      border:sel?"2px solid #F5C518":"1.5px solid rgba(0,0,0,0.09)",
                                      background:sel?"rgba(245,197,24,0.1)":"rgba(255,255,255,0.7)",
                                      cursor:"pointer",transition:"all 0.18s",textAlign:"center",
                                      boxShadow:sel?"0 2px 10px rgba(245,197,24,0.2)":"none",
                                    }}>
                                    {sel && <div style={{position:"absolute",top:5,left:5,width:16,height:16,borderRadius:"50%",background:"#F5C518",display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={10} strokeWidth={3} color="#1a1a1a"/></div>}
                                    {service.image ? (
                                      <CldImg src={service.image} alt={service.nameAr} width={80} style={{width:40,height:40,objectFit:"contain",borderRadius:service.iconShape==="circle"?"50%":service.iconShape==="rounded"?"10px":"8px"}} />
                                    ) : (
                                      <div style={{width:40,height:40,borderRadius:10,background:sel?"rgba(245,197,24,0.2)":"rgba(0,0,0,0.05)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                        <Briefcase size={18} color={sel?"#C9A227":"#ccc"} />
                                      </div>
                                    )}
                                    <span style={{fontSize:10,fontWeight:sel?700:500,color:sel?"#b8860b":"#555",lineHeight:1.3,fontFamily:"'Cairo',sans-serif"}}>{service.nameAr}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {activeServices.length>6 && (
                              <button type="button" onClick={()=>setShowAllServices(p=>!p)}
                                style={{marginTop:8,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontSize:12,color:"#C9A227",fontWeight:700,background:"rgba(245,197,24,0.08)",border:"1px solid rgba(245,197,24,0.2)",borderRadius:10,padding:"7px",cursor:"pointer",fontFamily:"'Cairo',sans-serif",transition:"background 0.15s"}}>
                                {showAllServices?<><ChevronUp size={13}/>عرض أقل</>:<><ChevronDown size={13}/>عرض المزيد ({activeServices.length-6} خدمة)</>}
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Experience */}
                      <FormField control={form.control} name="yearsOfExperience" render={({field})=>(
                        <FormItem className="rt-select">
                          <label style={lblStyle}>سنوات الخبرة <span style={{color:"#e53e3e"}}>*</span></label>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-experience">
                                <SelectValue placeholder="اختر سنوات الخبرة" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {EXPERIENCE_OPTIONS.map(opt=>(
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {/* Areas */}
                      <div>
                        <label style={{...lblStyle,marginBottom:10}}>
                          مناطق التغطية <span style={{color:"#e53e3e"}}>*</span>
                          {selectedAreaIds.length>0 && <span style={{marginRight:6,fontSize:11,background:"rgba(245,197,24,0.18)",color:"#b8860b",borderRadius:6,padding:"2px 7px",fontFamily:"'Cairo',sans-serif",fontWeight:700}}>{selectedAreaIds.length} منطقة</span>}
                        </label>
                        {Object.keys(areasByGov).length===0 ? (
                          <p style={{fontSize:12,color:"#bbb",textAlign:"center",fontFamily:"'Cairo',sans-serif",padding:"12px 0"}}>لا توجد مناطق متاحة حالياً</p>
                        ) : (
                          <div style={{border:"1.5px solid rgba(0,0,0,0.08)",borderRadius:14,overflow:"hidden"}}>
                            {Object.values(areasByGov).map(({gov,areas}:any,idx:number)=>{
                              const isExpanded=expandedGovIds.has(gov.id);
                              const selCount=areas.filter((a:any)=>selectedAreaIds.includes(a.id)).length;
                              const allSel=selCount===areas.length&&areas.length>0;
                              return (
                                <div key={gov.id} style={{borderBottom:idx<Object.keys(areasByGov).length-1?"1px solid rgba(0,0,0,0.06)":"none"}}>
                                  <button type="button" onClick={()=>toggleGov(gov.id)}
                                    style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"right"}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      <span style={{fontSize:13,fontWeight:700,color:"#333",fontFamily:"'Cairo',sans-serif"}}>{gov.nameAr}</span>
                                      {selCount>0&&<span style={{fontSize:10,background:"#F5C518",color:"#1a1a1a",borderRadius:10,padding:"1px 7px",fontWeight:800,fontFamily:"'Cairo',sans-serif"}}>{selCount}</span>}
                                    </div>
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      {isExpanded&&<span role="button" tabIndex={0}
                                        onClick={e=>{e.stopPropagation();toggleAllInGov(areas);}}
                                        onKeyDown={e=>e.key==="Enter"&&(e.stopPropagation(),toggleAllInGov(areas))}
                                        style={{fontSize:10,color:"#C9A227",fontWeight:700,cursor:"pointer",fontFamily:"'Cairo',sans-serif"}}>
                                        {allSel?"إلغاء الكل":"اختيار الكل"}
                                      </span>}
                                      {isExpanded?<ChevronUp size={15} color="#aaa"/>:<ChevronDown size={15} color="#aaa"/>}
                                    </div>
                                  </button>
                                  {isExpanded&&(
                                    <div style={{padding:"4px 14px 10px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                                      {areas.map((area:any)=>{
                                        const sel=selectedAreaIds.includes(area.id);
                                        return (
                                          <button key={area.id} type="button" onClick={()=>toggleArea(area.id)}
                                            data-testid={`area-btn-${area.id}`}
                                            style={{display:"flex",alignItems:"center",gap:6,fontSize:12,padding:"7px 10px",borderRadius:10,border:sel?"1.5px solid #F5C518":"1px solid rgba(0,0,0,0.08)",background:sel?"rgba(245,197,24,0.1)":"rgba(255,255,255,0.7)",color:sel?"#b8860b":"#555",fontWeight:sel?700:500,cursor:"pointer",transition:"all 0.15s",fontFamily:"'Cairo',sans-serif",textAlign:"right"}}>
                                            <span style={{width:14,height:14,borderRadius:4,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",border:sel?"none":"1px solid rgba(0,0,0,0.2)",background:sel?"#F5C518":"transparent",transition:"all 0.15s"}}>
                                              {sel&&<Check size={9} strokeWidth={3} color="#1a1a1a"/>}
                                            </span>
                                            {area.nameAr||area.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ══ STEP 3: Documents ══════════════════════════ */}
                  {step===3 && (
                    <div style={{display:"flex",flexDirection:"column",gap:16}}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,rgba(245,197,24,0.12),rgba(245,197,24,0.06))",border:"1px solid rgba(245,197,24,0.2)",borderRadius:12,padding:"6px 12px"}}>
                        <Camera size={14} color="#C9A227" />
                        <span style={{fontSize:13,fontWeight:800,color:"#C9A227",fontFamily:"'Cairo',sans-serif"}}>المستندات المطلوبة</span>
                      </div>

                      {/* National ID */}
                      <div>
                        <label style={{...lblStyle,marginBottom:10}}>
                          البطاقة القومية <span style={{color:"#e53e3e"}}>*</span>
                        </label>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                          <ImageUploadCard label="الوجه الأمامي" value={nationalIdFront} onChange={setNationalIdFront} required testId="upload-national-id-front" category="national-ids" />
                          <ImageUploadCard label="الوجه الخلفي" value={nationalIdBack} onChange={setNationalIdBack} required testId="upload-national-id-back" category="national-ids" />
                        </div>
                        {(!nationalIdFront||!nationalIdBack) && (
                          <p style={{margin:"8px 0 0",fontSize:11,color:"#aaa",textAlign:"center",fontFamily:"'Cairo',sans-serif"}}>صورتا البطاقة القومية مطلوبتان للتحقق من هويتك</p>
                        )}
                        {(nationalIdFront&&nationalIdBack) && (
                          <p style={{margin:"8px 0 0",fontSize:11,color:"#16a34a",textAlign:"center",fontFamily:"'Cairo',sans-serif",fontWeight:700}}>✓ تم رفع صورتا البطاقة القومية</p>
                        )}
                      </div>

                      {/* Personal photo */}
                      <div>
                        <label style={{...lblStyle,marginBottom:10}}>
                          الصورة الشخصية <span style={{fontSize:11,color:"#bbb",fontWeight:500}}>اختيارية</span>
                        </label>
                        <div style={{maxWidth:160}}>
                          <ImageUploadCard label="صورة شخصية" value={personalPhoto} onChange={setPersonalPhoto} testId="upload-personal-photo" category="profiles" />
                        </div>
                      </div>

                      {/* Tips */}
                      <div style={{background:"rgba(245,197,24,0.07)",border:"1px solid rgba(245,197,24,0.15)",borderRadius:12,padding:"10px 14px"}}>
                        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#92400e",fontFamily:"'Cairo',sans-serif"}}>💡 نصائح لصور أفضل:</p>
                        <ul style={{margin:0,padding:"0 16px",fontSize:11,color:"#92400e",lineHeight:1.8,fontFamily:"'Cairo',sans-serif"}}>
                          <li>تأكد من وضوح البيانات في صور البطاقة</li>
                          <li>استخدم إضاءة جيدة عند التصوير</li>
                          <li>تأكد من عدم وجود انعكاس ضوئي على البطاقة</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* ══ STEP 4: Review + Terms ══════════════════════ */}
                  {step===4 && (
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,rgba(34,197,94,0.1),rgba(34,197,94,0.05))",border:"1px solid rgba(34,197,94,0.2)",borderRadius:12,padding:"6px 12px",marginBottom:2}}>
                        <CheckCircle2 size={14} color="#16a34a" />
                        <span style={{fontSize:13,fontWeight:800,color:"#16a34a",fontFamily:"'Cairo',sans-serif"}}>مراجعة البيانات قبل الإرسال</span>
                      </div>

                      {/* Personal */}
                      <div className="rt-review-section">
                        <div className="rt-review-section-header">
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <User size={13} color="#C9A227" />
                            <span style={{fontSize:13,fontWeight:800,color:"#333",fontFamily:"'Cairo',sans-serif"}}>البيانات الشخصية</span>
                          </div>
                          <button type="button" className="rt-review-edit-btn" onClick={()=>goTo(1)}>تعديل</button>
                        </div>
                        {[
                          ["الاسم الكامل", vals.fullName],
                          ["رقم الهاتف", vals.mobile],
                          ["رقم البطاقة القومية", vals.nationalId],
                          ["كلمة المرور", "••••••••"],
                        ].map(([lbl,val])=>(
                          <div key={lbl} className="rt-review-row">
                            <span style={{fontSize:12,color:"#aaa"}}>{lbl}</span>
                            <span style={{fontSize:13,fontWeight:600,color:"#333",direction:lbl==="رقم الهاتف"?"ltr":"rtl"}}>{val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Professional */}
                      <div className="rt-review-section">
                        <div className="rt-review-section-header">
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <Briefcase size={13} color="#C9A227" />
                            <span style={{fontSize:13,fontWeight:800,color:"#333",fontFamily:"'Cairo',sans-serif"}}>المعلومات المهنية</span>
                          </div>
                          <button type="button" className="rt-review-edit-btn" onClick={()=>goTo(2)}>تعديل</button>
                        </div>
                        <div className="rt-review-row">
                          <span style={{fontSize:12,color:"#aaa"}}>الخدمات المحددة</span>
                          <span style={{fontSize:13,fontWeight:600,color:"#333"}}>{selectedServiceIds.length} خدمة</span>
                        </div>
                        {selectedServiceIds.length>0 && (
                          <div style={{display:"flex",flexWrap:"wrap",gap:5,paddingTop:6,paddingBottom:4}}>
                            {selectedServiceIds.map(id=>(
                              <span key={id} style={{fontSize:11,background:"rgba(245,197,24,0.15)",color:"#b8860b",borderRadius:8,padding:"3px 8px",fontFamily:"'Cairo',sans-serif",fontWeight:600}}>{getServiceName(id)}</span>
                            ))}
                          </div>
                        )}
                        <div className="rt-review-row">
                          <span style={{fontSize:12,color:"#aaa"}}>سنوات الخبرة</span>
                          <span style={{fontSize:13,fontWeight:600,color:"#333"}}>{getExperienceLabel(vals.yearsOfExperience)}</span>
                        </div>
                        <div className="rt-review-row">
                          <span style={{fontSize:12,color:"#aaa"}}>مناطق التغطية</span>
                          <span style={{fontSize:13,fontWeight:600,color:"#333"}}>{selectedAreaIds.length} منطقة</span>
                        </div>
                      </div>

                      {/* Documents */}
                      <div className="rt-review-section">
                        <div className="rt-review-section-header">
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <Camera size={13} color="#C9A227" />
                            <span style={{fontSize:13,fontWeight:800,color:"#333",fontFamily:"'Cairo',sans-serif"}}>المستندات</span>
                          </div>
                          <button type="button" className="rt-review-edit-btn" onClick={()=>goTo(3)}>تعديل</button>
                        </div>
                        <div style={{display:"flex",gap:10,marginTop:4}}>
                          {[
                            {label:"البطاقة (أمام)",img:nationalIdFront,required:true},
                            {label:"البطاقة (خلف)",img:nationalIdBack,required:true},
                            {label:"صورة شخصية",img:personalPhoto,required:false},
                          ].map(({label,img,required})=>(
                            <div key={label} style={{flex:1,textAlign:"center"}}>
                              <div style={{
                                height:60,borderRadius:10,overflow:"hidden",marginBottom:4,
                                border:img?"1.5px solid rgba(245,197,24,0.35)":"1.5px dashed rgba(0,0,0,0.15)",
                                background:img?"transparent":"rgba(0,0,0,0.03)",
                                display:"flex",alignItems:"center",justifyContent:"center",
                              }}>
                                {img ? <CldImg src={img} width={800} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={label}/> : <span style={{fontSize:18}}>{required?"❌":"—"}</span>}
                              </div>
                              <span style={{fontSize:10,color:"#aaa",fontFamily:"'Cairo',sans-serif"}}>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Terms */}
                      <FormField control={form.control} name="acceptTerms" render={({field})=>(
                        <FormItem>
                          <div style={{display:"flex",alignItems:"flex-start",gap:10,background:"rgba(245,197,24,0.06)",border:"1px solid rgba(245,197,24,0.15)",borderRadius:14,padding:"12px 14px"}}>
                            <button type="button" role="checkbox" aria-checked={field.value}
                              onClick={()=>field.onChange(!field.value)}
                              data-testid="checkbox-terms"
                              style={{
                                marginTop:1,width:20,height:20,borderRadius:5,flexShrink:0,
                                display:"flex",alignItems:"center",justifyContent:"center",
                                border:field.value?"2px solid #F5C518":"2px solid rgba(0,0,0,0.2)",
                                background:field.value?"#F5C518":"transparent",
                                cursor:"pointer",transition:"all 0.15s",
                              }}>
                              {field.value&&<Check size={11} strokeWidth={3} color="#1a1a1a"/>}
                            </button>
                            <p style={{fontSize:13,color:"#555",lineHeight:1.6,fontFamily:"'Cairo',sans-serif",margin:0}}>
                              أوافق على{" "}
                              <Link href="/terms" style={{color:"#c49a00",fontWeight:700,textDecoration:"none"}}>الشروط والأحكام</Link>
                              {" "}و{" "}
                              <Link href="/privacy" style={{color:"#c49a00",fontWeight:700,textDecoration:"none"}}>سياسة الخصوصية</Link>
                              {" "}الخاصة بمنصة {branding.siteNameAr}
                            </p>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <p style={{textAlign:"center",fontSize:12,color:"#aaa",fontFamily:"'Cairo',sans-serif",margin:"4px 0 0"}}>
                        لديك حساب؟{" "}
                        <Link href="/login" style={{color:"#c49a00",fontWeight:700,textDecoration:"none"}}>تسجيل الدخول</Link>
                      </p>
                    </div>
                  )}

                </div>
              </form>
            </Form>
          </div>

          {/* ── Fixed nav footer ── */}
          <div style={{
            padding:"14px 24px 18px",
            flexShrink:0,
            borderTop:"1px solid rgba(0,0,0,0.06)",
            background:"rgba(255,255,255,0.8)",
            backdropFilter:"blur(8px)",
          }}>
            <div style={{display:"flex",gap:10}}>
              {step>1 && (
                <button type="button" className="rt-ghost-btn" onClick={goPrev}>
                  <ChevronRight size={16} />السابق
                </button>
              )}
              <button
                type="button"
                className="rt-gold-btn"
                onClick={handleNext}
                disabled={registerMutation.isPending}
                data-testid={step===4?"button-submit":undefined}
                style={{flex: step>1 ? 2 : 1}}
              >
                {registerMutation.isPending ? (
                  <><div style={{width:17,height:17,borderRadius:"50%",border:"2.5px solid rgba(0,0,0,0.2)",borderTopColor:"#1a1a1a",animation:"authSpinner 0.7s linear infinite"}} />جاري الإرسال...</>
                ) : step===4 ? (
                  <><ArrowLeft size={17} />إرسال طلب الانضمام</>
                ) : (
                  <>التالي <ChevronLeft size={17} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
