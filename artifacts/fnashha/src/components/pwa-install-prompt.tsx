import { useEffect, useState, useCallback } from "react";
import { X, Download } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";

const LS_KEY = "fnashha_pwa_dismissed_at";
const SNOOZE_DAYS = 7;
const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;

function isMobile(): boolean {
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
}

function isAlreadyInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < SNOOZE_MS;
  } catch {
    return false;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const { logoUrl, siteNameAr } = useBranding();
  const iconSrc = logoUrl || "/assets/logo.png";

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (!isMobile()) return;
    if (isAlreadyInstalled()) return;
    if (isDismissedRecently()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
      setTimeout(() => setAnimateIn(true), 50);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const handler = () => setVisible(false);
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  const handleDismiss = useCallback(() => {
    try { localStorage.setItem(LS_KEY, String(Date.now())); } catch {}
    setAnimateIn(false);
    setTimeout(() => setVisible(false), 300);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setAnimateIn(false);
      setTimeout(() => setVisible(false), 300);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="تثبيت التطبيق"
      style={{
        position: "fixed",
        bottom: `calc(env(safe-area-inset-bottom, 0px) + 12px)`,
        left: "12px",
        right: "12px",
        zIndex: 9999,
        transform: animateIn ? "translateY(0)" : "translateY(120%)",
        opacity: animateIn ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.34,1.2,0.64,1), opacity 0.25s ease",
        pointerEvents: animateIn ? "auto" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#ffffff",
          border: "1.5px solid #e9c64a",
          borderRadius: "16px",
          padding: "12px 14px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          direction: "rtl",
        }}
      >
        <img
          src={iconSrc}
          alt={siteNameAr}
          style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, objectFit: "contain" }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 700,
            color: "#1a1a1a",
            fontFamily: "'Cairo', sans-serif",
            lineHeight: 1.3,
          }}>
            أضف فنشها لشاشتك الرئيسية
          </p>
          <p style={{
            margin: "2px 0 0",
            fontSize: "11px",
            color: "#666",
            fontFamily: "'Cairo', sans-serif",
            lineHeight: 1.3,
          }}>
            وصول سريع بدون متصفح
          </p>
        </div>

        <button
          onClick={handleInstall}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "#f5c518",
            color: "#1a1a1a",
            border: "none",
            borderRadius: "10px",
            padding: "7px 12px",
            fontSize: "12px",
            fontWeight: 700,
            fontFamily: "'Cairo', sans-serif",
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <Download size={13} strokeWidth={2.5} />
          تثبيت
        </button>

        <button
          onClick={handleDismiss}
          aria-label="إغلاق"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: "8px",
            padding: "4px",
            cursor: "pointer",
            color: "#999",
            flexShrink: 0,
          }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
