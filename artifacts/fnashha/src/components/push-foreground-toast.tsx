/**
 * PushForegroundToast
 * ====================
 * Displays a small in-app toast whenever a push notification arrives while
 * the app is already open (foreground delivery).
 *
 * Architecture:
 *  • capacitor-bridge.ts dispatches  window.CustomEvent("fnashha:push-foreground")
 *    from the Capacitor pushNotificationReceived listener.
 *  • This component listens for that event, adds the notification to local
 *    state, auto-dismisses after 4 s, and allows tap-to-navigate via the
 *    existing push-navigation deep-link system.
 *
 * Design:
 *  • Fixed top-center overlay, RTL, z-50 (above all content, below modals)
 *  • Slide-in from top, slide-out up — via framer-motion
 *  • Matches Fnashha green (#16a34a) design tokens
 *  • Works on web too (no-op — bridge only fires in native builds)
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, MessageCircle, Tag, CheckCircle2, Megaphone, X } from "lucide-react";
import { navigateFromPush } from "@/lib/push-navigation";
import type { PushNotificationData } from "@/lib/push-notifications";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PushForegroundDetail {
  title: string;
  body: string;
  data: PushNotificationData;
}

interface ToastItem extends PushForegroundDetail {
  id: number;
}

const AUTO_DISMISS_MS = 4000;
let _nextId = 0;

// ─── Icon mapping by notification type ───────────────────────────────────────

function NotifIcon({ type }: { type?: string }) {
  const cls = "w-5 h-5";
  switch (type) {
    case "new_message":      return <MessageCircle className={cls} />;
    case "new_offer":
    case "offer_accepted":   return <Tag className={cls} />;
    case "request_completed":return <CheckCircle2 className={cls} />;
    case "announcement":     return <Megaphone className={cls} />;
    default:                 return <Bell className={cls} />;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PushForegroundToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { title, body, data } = (e as CustomEvent<PushForegroundDetail>).detail;
      const id = _nextId++;
      setToasts((prev) => [...prev, { id, title, body, data }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    };

    window.addEventListener("fnashha:push-foreground", handler);
    return () => window.removeEventListener("fnashha:push-foreground", handler);
  }, [dismiss]);

  return (
    <div
      className="fixed top-4 inset-x-3 z-50 flex flex-col gap-2 items-center pointer-events-none"
      dir="rtl"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-sm pointer-events-auto"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => { dismiss(toast.id); navigateFromPush(toast.data); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  dismiss(toast.id);
                  navigateFromPush(toast.data);
                }
              }}
              className="
                flex items-start gap-3 w-full
                bg-white border border-green-100
                rounded-2xl shadow-lg shadow-black/10
                px-4 py-3 cursor-pointer
                hover:bg-green-50 transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500
              "
            >
              {/* Coloured icon bubble */}
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center mt-0.5">
                <NotifIcon type={toast.data.type} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-semibold text-gray-900 leading-snug truncate">
                  {toast.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                  {toast.body}
                </p>
              </div>

              {/* Dismiss button */}
              <button
                aria-label="إغلاق"
                onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
                className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5 -mr-1"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
