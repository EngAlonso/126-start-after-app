import { useEffect, useState, useCallback } from "react";
import { CldImg } from "@/components/ui/cld-img";
import { useGetCmsSettings } from "@workspace/api-client-react";
import { AuthBackground } from "@/components/ui/auth-background";
import { Link } from "wouter";

function useDeviceType() {
  const ua = navigator.userAgent;
  return {
    isAndroid: /Android/i.test(ua),
    isIOS: /iPhone|iPad|iPod/i.test(ua),
  };
}

function usePwaInstalled() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return standalone || iosStandalone;
}

const AndroidIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
    <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5S11 23.33 11 22.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V9H6v9zm-2.5-9C2.67 9 2 9.67 2 10.5v7c0 .83.67 1.5 1.5 1.5S5 18.33 5 17.5v-7C5 9.67 4.33 9 3.5 9zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zM15.53 3.16l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 2c-1.1 0-2.15.23-3.09.63L7.43 1.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3A5.9 5.9 0 005 9h14a5.9 5.9 0 00-3.47-5.84zM10 6H9V5h1v1zm5 0h-1V5h1v1z"/>
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

function randomBetween(a: number, b: number, seed: number) {
  const x = Math.sin(seed) * 10000;
  return a + (x - Math.floor(x)) * (b - a);
}

export default function QrPage() {
  const { data: settings } = useGetCmsSettings();
  const s = settings as any;
  const { isAndroid, isIOS } = useDeviceType();
  const isPwaInstalled = usePwaInstalled();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const routeElements = [
      document.documentElement,
      document.body,
      document.getElementById("root"),
    ];

    routeElements.forEach((element) => element?.classList.add("qr-page"));

    return () => {
      routeElements.forEach((element) => element?.classList.remove("qr-page"));
    };
  }, []);

  useEffect(() => {
    const title = s?.qrPageTitle || "فنشها";
    document.title = title;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = s?.qrPageDescription || "صيانة بيتك بضغطة زر";
  }, [s?.qrPageTitle, s?.qrPageDescription]);

  const logoUrl = s?.logoUrl || null;
  const pageTitle = s?.qrPageTitle || "مرحباً بك في فنشها";
  const welcomeText = s?.qrPageWelcome || "حمّل التطبيق الآن أو تابعنا على منصات التواصل الاجتماعي";
  const descriptionText = s?.qrPageDescription || "";

  const socialLinks = [
    { key: "qrFacebookUrl",  label: "فيسبوك",    icon: <FacebookIcon />,  color: "#1877F2", bg: "rgba(24,119,242,0.1)"  },
    { key: "qrWhatsappUrl",  label: "واتساب",    icon: <WhatsAppIcon />,  color: "#25D366", bg: "rgba(37,211,102,0.1)"  },
    { key: "qrInstagramUrl", label: "انستجرام",  icon: <InstagramIcon />, color: "#E1306C", bg: "rgba(225,48,108,0.1)"  },
    { key: "qrTiktokUrl",    label: "تيك توك",   icon: <TikTokIcon />,    color: "#010101", bg: "rgba(0,0,0,0.08)"      },
    { key: "qrTwitterUrl",   label: "X (تويتر)", icon: <XIcon />,         color: "#000000", bg: "rgba(0,0,0,0.08)"      },
  ].filter(({ key }) => !!s?.[key]);

  const showDownloadSection = !isPwaInstalled && (s?.qrAndroidUrl || s?.qrIosUrl);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: pageTitle, url });
        return;
      } catch {
        // user cancelled — no fallback needed
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [pageTitle]);

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <>
    <AuthBackground slug="qr" defaultSrc="/assets/bg-qr.png" />
    <div dir="rtl" className="qr-page-shell" style={{
      minHeight: "100dvh",
      position: "relative",
      overflow: "hidden",
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "'Cairo', 'Segoe UI', sans-serif",
      zIndex: 1,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        @keyframes qrEnter {
          from{opacity:0;transform:translateY(28px) scale(0.97)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }
        @keyframes qrFadeIn {
          from{opacity:0;transform:translateY(14px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes qrPulse {
          0%,100%{box-shadow:0 0 0 0 rgba(245,197,24,0.35)}
          50%{box-shadow:0 0 0 10px rgba(245,197,24,0)}
        }
        @keyframes qrOpenApp {
          0%,100%{box-shadow:0 4px 20px rgba(245,197,24,0.45)}
          50%{box-shadow:0 4px 32px rgba(245,197,24,0.7)}
        }
        .qr-btn {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          cursor: pointer;
          text-decoration: none;
          display: flex;
        }
        .qr-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.14) !important; }
        .qr-btn:active { transform: translateY(0) scale(0.98); }
        .qr-social-btn {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          cursor: pointer;
          text-decoration: none;
          display: flex;
        }
        .qr-social-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.12) !important; }
        .qr-social-btn:active { transform: scale(0.97); }
        .qr-share-btn {
          transition: transform 0.15s ease, background 0.15s ease;
          cursor: pointer;
          border: none;
        }
        .qr-share-btn:hover { transform: translateY(-1px); }
        .qr-share-btn:active { transform: scale(0.97); }
        @media (prefers-reduced-motion: reduce) {
          *{animation-duration:0.001ms!important;transition-duration:0.001ms!important}
        }
      `}</style>

      {/* Card */}
      <div className="qr-page-card" style={{
        position: "relative",
        zIndex: 10,
        width: "100%",
        maxWidth: 420,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(22px)",
        WebkitBackdropFilter: "blur(22px)",
        border: "1.5px solid rgba(255,255,255,0.95)",
        borderRadius: 28,
        boxShadow: "0 24px 64px rgba(0,0,0,0.13), 0 0 0 1px rgba(245,197,24,0.12)",
        padding: "36px 28px 28px",
        animation: "qrEnter 0.55s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>

        {/* Logo + header */}
        <div className="qr-page-header" style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:20, animation:"qrFadeIn 0.5s ease 0.1s both" }}>
          <Link href="/" className="qr-page-logo-link" style={{ display: "inline-block", marginBottom: 10 }}>
          {logoUrl ? (
            <CldImg className="qr-page-logo" src={logoUrl} alt="Fnashha" width={168} eager style={{ width:84, height:84, borderRadius:20, objectFit:"contain", boxShadow:"0 4px 16px rgba(0,0,0,0.1)" }} />
          ) : (
            <div className="qr-page-logo" style={{ width:84, height:84, borderRadius:20, background:"linear-gradient(135deg,#F5C518,#E8A800)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 16px rgba(245,197,24,0.35)", fontSize:36 }}>
              🔧
            </div>
          )}
          </Link>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"#1a1a1a", letterSpacing:0.5 }}>{pageTitle}</h1>
          {welcomeText && (
            <p style={{ margin:"8px 0 0", fontSize:14, color:"#666", textAlign:"center", lineHeight:1.6, fontWeight:500 }}>{welcomeText}</p>
          )}
          {descriptionText && (
            <p style={{ margin:"6px 0 0", fontSize:13, color:"#999", textAlign:"center", lineHeight:1.5 }}>{descriptionText}</p>
          )}
        </div>

        <div className="qr-page-content" style={{ animation:"qrFadeIn 0.5s ease 0.2s both" }}>

          {/* ── Smart Install Button (PWA already installed) ── */}
          {isPwaInstalled && (s?.qrAndroidUrl || s?.qrIosUrl) && (
            <div className="qr-page-section" style={{ marginBottom:20 }}>
              <div className="qr-page-section-heading" style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ flex:1, height:1, background:"rgba(0,0,0,0.08)" }} />
                <span style={{ fontSize:12, color:"#aaa", fontWeight:600, whiteSpace:"nowrap" }}>التطبيق</span>
                <div style={{ flex:1, height:1, background:"rgba(0,0,0,0.08)" }} />
              </div>
              <a
                href={`${import.meta.env.BASE_URL || "/"}`.replace(/\/$/, "") + "/"}
                className="qr-btn"
                style={{
                  alignItems:"center",
                  justifyContent:"center",
                  gap:14,
                  padding:"16px 22px",
                  borderRadius:16,
                  background: "linear-gradient(135deg,#F5C518,#E8A800)",
                  border: "none",
                  animation: "qrOpenApp 2.5s ease infinite",
                  width:"100%",
                  boxSizing:"border-box",
                }}
              >
                <span style={{ color:"#fff" }}><HomeIcon /></span>
                <span style={{ fontSize:17, fontWeight:800, color:"#fff" }}>فتح التطبيق</span>
              </a>
            </div>
          )}

          {/* ── Download buttons (browser / not installed) ── */}
          {showDownloadSection && (
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ flex:1, height:1, background:"rgba(0,0,0,0.08)" }} />
                <span style={{ fontSize:12, color:"#aaa", fontWeight:600, whiteSpace:"nowrap" }}>تحميل التطبيق</span>
                <div style={{ flex:1, height:1, background:"rgba(0,0,0,0.08)" }} />
              </div>
              <div className="qr-page-store-buttons" style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {s?.qrAndroidUrl && (
                  <a href={s.qrAndroidUrl} target="_blank" rel="noopener noreferrer" className="qr-btn qr-page-store-btn" style={{
                    alignItems:"center", gap:14, padding:"14px 18px", borderRadius:16,
                    background: isAndroid ? "linear-gradient(135deg,#3DDC84,#2CB36A)" : "rgba(61,220,132,0.09)",
                    border: isAndroid ? "none" : "1.5px solid rgba(61,220,132,0.3)",
                    boxShadow: isAndroid ? "0 4px 20px rgba(61,220,132,0.35)" : "none",
                    animation: isAndroid ? "qrPulse 2.5s ease infinite" : "none",
                  }}>
                    <span style={{ color: isAndroid ? "#fff" : "#3DDC84", flexShrink:0 }}><AndroidIcon /></span>
                    <div style={{ flex:1, textAlign:"right" }}>
                      <div style={{ fontSize:15, fontWeight:700, color: isAndroid ? "#fff" : "#1a1a1a" }}>تحميل للأندرويد</div>
                      <div style={{ fontSize:12, color: isAndroid ? "rgba(255,255,255,0.8)" : "#888", marginTop:1 }}>Google Play</div>
                    </div>
                    {isAndroid && <span style={{ background:"rgba(255,255,255,0.22)", borderRadius:8, padding:"3px 9px", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>مقترح</span>}
                  </a>
                )}
                {s?.qrIosUrl && (
                  <a href={s.qrIosUrl} target="_blank" rel="noopener noreferrer" className="qr-btn qr-page-store-btn" style={{
                    alignItems:"center", gap:14, padding:"14px 18px", borderRadius:16,
                    background: isIOS ? "linear-gradient(135deg,#0D96F6,#0A74CA)" : "rgba(13,150,246,0.09)",
                    border: isIOS ? "none" : "1.5px solid rgba(13,150,246,0.3)",
                    boxShadow: isIOS ? "0 4px 20px rgba(13,150,246,0.35)" : "none",
                    animation: isIOS ? "qrPulse 2.5s ease infinite" : "none",
                  }}>
                    <span style={{ color: isIOS ? "#fff" : "#0D96F6", flexShrink:0 }}><AppleIcon /></span>
                    <div style={{ flex:1, textAlign:"right" }}>
                      <div style={{ fontSize:15, fontWeight:700, color: isIOS ? "#fff" : "#1a1a1a" }}>تحميل للآيفون</div>
                      <div style={{ fontSize:12, color: isIOS ? "rgba(255,255,255,0.8)" : "#888", marginTop:1 }}>App Store</div>
                    </div>
                    {isIOS && <span style={{ background:"rgba(255,255,255,0.22)", borderRadius:8, padding:"3px 9px", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>مقترح</span>}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Social Links ── */}
          {socialLinks.length > 0 && (
            <div className="qr-page-section" style={{ marginBottom:20 }}>
              <div className="qr-page-section-heading" style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ flex:1, height:1, background:"rgba(0,0,0,0.08)" }} />
                <span style={{ fontSize:12, color:"#aaa", fontWeight:600, whiteSpace:"nowrap" }}>تابعنا على</span>
                <div style={{ flex:1, height:1, background:"rgba(0,0,0,0.08)" }} />
              </div>
              <div className="qr-page-social-grid" style={{ display:"grid", gridTemplateColumns: socialLinks.length === 1 ? "1fr" : "1fr 1fr", gap:10 }}>
                {socialLinks.map(({ key, label, icon, color, bg }, idx) => (
                  <a
                    key={key}
                    href={s[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="qr-social-btn"
                    style={{
                      alignItems:"center", gap:10, padding:"13px 14px", borderRadius:14,
                      background: bg, border:`1.5px solid ${color}22`, boxShadow:`0 2px 8px ${color}11`,
                      gridColumn: socialLinks.length % 2 !== 0 && idx === socialLinks.length - 1 ? "1 / -1" : undefined,
                    }}
                  >
                    <span style={{ color, flexShrink:0 }}>{icon}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:"#1a1a1a" }}>{label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Share section ── */}
          <div className="qr-page-share" style={{ borderTop:"1px solid rgba(0,0,0,0.07)", paddingTop:16, display:"flex", alignItems:"center", justifyContent:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, color:"#bbb", fontWeight:600 }}>مشاركة الصفحة</span>
            <button
              className="qr-share-btn"
              onClick={handleShare}
              style={{
                display:"flex", alignItems:"center", gap:8,
                padding:"9px 18px", borderRadius:12,
                background: copied ? "rgba(34,197,94,0.12)" : "rgba(245,197,24,0.12)",
                border: `1.5px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(245,197,24,0.4)"}`,
                color: copied ? "#16a34a" : "#b45309",
                fontSize:14, fontWeight:700,
                fontFamily:"'Cairo', sans-serif",
                cursor:"pointer",
              }}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
                  تم النسخ!
                </>
              ) : hasNativeShare ? (
                <><ShareIcon /> مشاركة</>
              ) : (
                <><CopyIcon /> نسخ الرابط</>
              )}
            </button>
          </div>
        </div>

        {/* Footer brand */}
        <div className="qr-page-footer" style={{ marginTop:20, textAlign:"center", animation:"qrFadeIn 0.5s ease 0.4s both" }}>
          <span style={{ fontSize:12, color:"#bbb", fontWeight:500 }}>© فنشها — صيانة بيتك بضغطة زر</span>
        </div>
      </div>
    </div>
    </>
  );
}
