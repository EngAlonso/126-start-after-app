import { useEffect, useState, useCallback } from "react";
import { Download, X, ArrowDown } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isAlreadyInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as { standalone?: boolean }).standalone === true)
  );
}

function isMobile(): boolean {
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
}

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isPwaDebug(): boolean {
  return new URLSearchParams(window.location.search).get("pwa_debug") === "1";
}

const IOS_SESSION_KEY = "fnashha_ios_install_dismissed";

// ─── Main component ───────────────────────────────────────────────────────────

export function PwaFabButton() {
  const { logoUrl, faviconUrl, siteNameAr } = useBranding();
  const iconSrc = logoUrl || faviconUrl || null;

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(
    () => new URLSearchParams(window.location.search).get("show_ios_sheet") === "1"
  );
  // iOS-specific: remember if the user closed the sheet this session.
  // sessionStorage throws SecurityError in cross-origin iframes on iOS Safari — guard it.
  const [iosDismissed, setIosDismissed] = useState(() => {
    try { return !!sessionStorage.getItem(IOS_SESSION_KEY); } catch { return false; }
  });

  useEffect(() => {
    const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
    const navStandalone = "standalone" in navigator
      ? (navigator as { standalone?: boolean }).standalone
      : "n/a (not iOS)";
    const alreadyInstalled = isAlreadyInstalled();
    const mobile = isMobile();

    console.group("[PwaFabButton] mount diagnostics");
    console.log("isMobile():", mobile);
    console.log("isAlreadyInstalled():", alreadyInstalled);
    console.log("display-mode standalone (matchMedia):", standaloneMedia);
    console.log("navigator.standalone (iOS only):", navStandalone);
    console.log("navigator.userAgent:", navigator.userAgent);
    console.log("window.location.search:", window.location.search);
    console.groupEnd();

    if (alreadyInstalled) {
      console.log("[PwaFabButton] → setInstalled(true) because isAlreadyInstalled() is true");
      setInstalled(true);
      return;
    }

    const promptHandler = (e: Event) => {
      e.preventDefault();
      console.log("[PwaFabButton] beforeinstallprompt fired — deferredPrompt captured");
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      console.log("[PwaFabButton] appinstalled event fired — hiding button");
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", promptHandler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", promptHandler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleClick = useCallback(async () => {
    try {
      if (deferredPrompt) {
        // Android / Chrome — native prompt
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setDeferredPrompt(null);
      } else {
        // iOS Safari (and any other browser without native prompt) — show sheet
        setShowInstructions(true);
      }
    } catch (err) {
      console.warn("[PwaFabButton] handleClick error:", err);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleIOSDismiss = useCallback(() => {
    try { sessionStorage.setItem(IOS_SESSION_KEY, "1"); } catch {}
    setIosDismissed(true);
    setShowInstructions(false);
  }, []);

  const debug = isPwaDebug();

  const mobileVal = isMobile();
  const alreadyInstalledVal = isAlreadyInstalled();
  const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const navStandalone =
    "standalone" in navigator
      ? String((navigator as { standalone?: boolean }).standalone)
      : "n/a (non-iOS)";

  let guardFired = "none — button renders";
  if (!mobileVal) guardFired = "isMobile() → false";
  else if (installed || alreadyInstalledVal)
    guardFired = `installed=${installed} | isAlreadyInstalled()=${alreadyInstalledVal}`;
  else if (isIOS() && iosDismissed)
    guardFired = "iOS session-dismissed";

  console.log("[PwaFabButton]", { mobileVal, alreadyInstalledVal, installed, deferredPrompt: !!deferredPrompt, debug, iosDismissed });

  if (!debug) {
    if (!mobileVal) return null;
    if (installed || alreadyInstalledVal) return null;
    // Hide FAB on iOS once user dismisses the sheet this session
    if (isIOS() && iosDismissed) return null;
  }

  const showFab = mobileVal && !installed && !alreadyInstalledVal && !(isIOS() && iosDismissed);

  return (
    <>
      {debug && (
        <PwaDiagnosticOverlay
          mobileVal={mobileVal}
          alreadyInstalledVal={alreadyInstalledVal}
          standaloneMedia={standaloneMedia}
          navStandalone={navStandalone}
          installed={installed}
          deferredPrompt={!!deferredPrompt}
          guardFired={guardFired}
        />
      )}

      {showFab && (
        <button
          onClick={handleClick}
          aria-label="تثبيت التطبيق"
          style={{
            position: "fixed",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
            right: "12px",
            zIndex: 9990,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#16a34a",
            color: "#ffffff",
            border: "none",
            borderRadius: "24px",
            padding: "8px 12px 8px 10px",
            boxShadow:
              "0 4px 16px rgba(22,163,74,0.4), 0 2px 6px rgba(0,0,0,0.12)",
            cursor: "pointer",
            fontFamily: "'Cairo', sans-serif",
            fontSize: "12px",
            fontWeight: 700,
            direction: "rtl",
            whiteSpace: "nowrap",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.06)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 6px 20px rgba(22,163,74,0.5), 0 3px 8px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 16px rgba(22,163,74,0.4), 0 2px 6px rgba(0,0,0,0.12)";
          }}
        >
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                objectFit: "contain",
                flexShrink: 0,
                background: "rgba(255,255,255,0.15)",
              }}
            />
          ) : (
            <Download size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          )}
          <span>تثبيت</span>
        </button>
      )}

      {showInstructions && (
        (isIOS() || new URLSearchParams(window.location.search).get("show_ios_sheet") === "1") ? (
          <IOSInstallSheet
            siteNameAr={siteNameAr}
            iconSrc={iconSrc}
            onClose={handleIOSDismiss}
          />
        ) : (
          <GenericInstallSheet onClose={() => setShowInstructions(false)} />
        )
      )}
    </>
  );
}

// ─── iOS Install Bottom Sheet ─────────────────────────────────────────────────

interface IOSInstallSheetProps {
  siteNameAr?: string;
  iconSrc?: string | null;
  onClose: () => void;
}

function IOSInstallSheet({ siteNameAr, iconSrc, onClose }: IOSInstallSheetProps) {
  useEffect(() => {
    const id = "fnashha-ios-sheet-anim";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = `
        @keyframes _fnashha_ios_slide_up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes _fnashha_arrow_bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(7px); }
        }
      `;
      document.head.appendChild(el);
    }
  }, []);

  const GOLD = "#c9a227";
  const DARK = "#1a1a1a";
  const LIGHT_BG = "#f8f8f8";

  const steps = [
    {
      num: "١",
      icon: <IOSShareIcon />,
      title: "اضغط زر المشاركة",
      sub: "زر ⬆ في شريط أدوات Safari بالأسفل",
      iconBg: "#e8f4ff",
    },
    {
      num: "٢",
      icon: <IOSAddToHomeIcon />,
      title: 'اختر "إضافة إلى الشاشة الرئيسية"',
      sub: "من قائمة المشاركة التي تظهر",
      iconBg: "#fff8e6",
    },
    {
      num: "٣",
      icon: <IOSAddButtonIcon />,
      title: 'اضغط "إضافة"',
      sub: "من أعلى يمين الشاشة",
      iconBg: "#edfbee",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تعليمات تثبيت التطبيق"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "22px 22px 0 0",
          padding: `16px 20px calc(env(safe-area-inset-bottom, 0px) + 28px)`,
          width: "100%",
          maxWidth: 500,
          direction: "rtl",
          fontFamily: "'Cairo', sans-serif",
          animation: "_fnashha_ios_slide_up 0.38s cubic-bezier(0.32,0.72,0,1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div
            style={{
              width: 44,
              height: 5,
              background: "#e0e0e0",
              borderRadius: 3,
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            {iconSrc && (
              <img
                src={iconSrc}
                alt={siteNameAr ?? "فنشها"}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  objectFit: "contain",
                  border: "1px solid #f0f0f0",
                  flexShrink: 0,
                }}
              />
            )}
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: DARK,
                  lineHeight: 1.3,
                }}
              >
                أضف {siteNameAr ?? "فنشها"} للشاشة الرئيسية
              </p>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 11,
                  color: "#888",
                  lineHeight: 1.4,
                }}
              >
                كتطبيق أصلي — وصول سريع بدون متصفح
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              background: "#f3f4f6",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#666",
              flexShrink: 0,
              marginRight: 8,
            }}
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Steps */}
        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid #ebebeb",
          }}
        >
          {steps.map((step, i) => (
            <div
              key={step.num}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 14px",
                background: LIGHT_BG,
                borderBottom: i < steps.length - 1 ? "1px solid #ebebeb" : "none",
              }}
            >
              {/* Step badge */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: GOLD,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 2px 6px ${GOLD}55`,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#fff",
                    fontFamily: "'Cairo', sans-serif",
                    lineHeight: 1,
                  }}
                >
                  {step.num}
                </span>
              </div>

              {/* Icon bubble */}
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: step.iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: DARK,
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: "#888",
                    lineHeight: 1.4,
                  }}
                >
                  {step.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Animated arrow + label pointing toward Safari toolbar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "16px 0 6px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: GOLD,
              fontWeight: 700,
              fontFamily: "'Cairo', sans-serif",
            }}
          >
            زر المشاركة ⬆ في أسفل المتصفح
          </p>
          <div
            style={{
              animation: "_fnashha_arrow_bounce 1.1s ease-in-out infinite",
              color: GOLD,
              display: "flex",
            }}
          >
            <ArrowDown size={22} strokeWidth={2.5} />
          </div>
        </div>

        {/* Timing note */}
        <p
          style={{
            margin: "10px 0 0",
            textAlign: "center",
            fontSize: 12,
            color: "#aaa",
            fontFamily: "'Cairo', sans-serif",
            lineHeight: 1.5,
          }}
        >
          ⏱ لن تستغرق العملية أكثر من 10 ثوانٍ.
        </p>
      </div>
    </div>
  );
}

// ─── iOS SVG Icons ────────────────────────────────────────────────────────────

function IOSShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline
        points="16 8 12 4 8 8"
        stroke="#007AFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="12" y1="4" x2="12" y2="16"
        stroke="#007AFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 10H4a1 1 0 00-1 1v8a1 1 0 001 1h16a1 1 0 001-1v-8a1 1 0 00-1-1h-3"
        stroke="#007AFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IOSAddToHomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#c9a227" strokeWidth="2"/>
      <path
        d="M12 7l-5 5h3v5h4v-5h3l-5-5z"
        fill="#c9a227"
      />
    </svg>
  );
}

function IOSAddButtonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#34c759" strokeWidth="2"/>
      <line x1="12" y1="8" x2="12" y2="16" stroke="#34c759" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="#34c759" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Generic fallback sheet (non-iOS, non-Android) ───────────────────────────

function GenericInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تعليمات تثبيت التطبيق"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: `24px 20px calc(env(safe-area-inset-bottom, 0px) + 28px)`,
          width: "100%",
          maxWidth: 480,
          direction: "rtl",
          fontFamily: "'Cairo', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#1a1a1a",
            }}
          >
            أضف التطبيق للشاشة الرئيسية
          </p>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              background: "#f3f4f6",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#666",
            }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "#444",
            fontFamily: "'Cairo', sans-serif",
            lineHeight: 1.7,
          }}
        >
          من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية».
        </p>
      </div>
    </div>
  );
}

// ─── Diagnostic overlay (debug mode only) ────────────────────────────────────

interface DiagnosticOverlayProps {
  mobileVal: boolean;
  alreadyInstalledVal: boolean;
  standaloneMedia: boolean;
  navStandalone: string;
  installed: boolean;
  deferredPrompt: boolean;
  guardFired: string;
}

function PwaDiagnosticOverlay({
  mobileVal,
  alreadyInstalledVal,
  standaloneMedia,
  navStandalone,
  installed,
  deferredPrompt,
  guardFired,
}: DiagnosticOverlayProps) {
  const ok = "#16a34a";
  const bad = "#dc2626";
  const val = (v: boolean | string) => (
    <span
      style={{
        color: typeof v === "boolean" ? (v ? bad : ok) : "#555",
        fontWeight: 700,
      }}
    >
      {String(v)}
    </span>
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        left: "8px",
        zIndex: 99999,
        background: "rgba(0,0,0,0.82)",
        color: "#f0f0f0",
        borderRadius: 10,
        padding: "10px 12px",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.8,
        maxWidth: 260,
        pointerEvents: "none",
        backdropFilter: "blur(4px)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          color: "#f5c518",
          fontWeight: 700,
          marginBottom: 4,
          fontSize: 10,
          letterSpacing: 1,
        }}
      >
        ▲ PWA DEBUG
      </div>
      <div>isMobile: {val(mobileVal)}</div>
      <div>isAlreadyInstalled: {val(alreadyInstalledVal)}</div>
      <div>standalone (media): {val(standaloneMedia)}</div>
      <div>
        navigator.standalone:{" "}
        <span style={{ color: "#555", fontWeight: 700 }}>{navStandalone}</span>
      </div>
      <div>installed (state): {val(installed)}</div>
      <div>deferredPrompt: {val(deferredPrompt)}</div>
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.15)",
          marginTop: 6,
          paddingTop: 6,
          color: guardFired.startsWith("none") ? ok : bad,
          fontSize: 10,
          lineHeight: 1.5,
        }}
      >
        guard: {guardFired}
      </div>
    </div>
  );
}
