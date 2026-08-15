import { Fragment } from "react";
import { ClipboardList, MessageSquare, UserCheck, ThumbsUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STEPS: { icon: LucideIcon; step: string; title: string; desc: string }[] = [
  {
    icon: ClipboardList,
    step: "01",
    title: "أنشئ طلبك",
    desc: "اختر الخدمة واكتب تفاصيل المشكلة وأضف الصور أو التسجيل الصوتي.",
  },
  {
    icon: MessageSquare,
    step: "02",
    title: "استقبل عروض الفنيين",
    desc: "سيصلك عروض أسعار من أفضل الفنيين في منطقتك.",
  },
  {
    icon: UserCheck,
    step: "03",
    title: "اختر الفني المناسب",
    desc: "قارن الأسعار والتقييمات واختر أفضل فني.",
  },
  {
    icon: ThumbsUp,
    step: "04",
    title: "نفذ الخدمة وقيّم الفني",
    desc: "بعد انتهاء العمل قيّم تجربتك وساعد العملاء الآخرين.",
  },
];

const BADGE: React.CSSProperties = {
  position: "absolute",
  top: -19,
  right: 24,
  width: 42,
  height: 42,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #F5C518 0%, #C9A227 55%, #A87F00 100%)",
  border: "2.5px solid #fff",
  boxShadow: "0 0 0 4px rgba(245,197,24,0.18), 0 6px 18px rgba(200,162,39,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 900,
  color: "#1a1a1a",
  fontFamily: "'Cairo', sans-serif",
  zIndex: 10,
  letterSpacing: "-0.01em",
};

const CARD_BASE: React.CSSProperties = {
  position: "relative",
  background: "rgba(255,255,255,0.9)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1.5px solid rgba(245,197,24,0.2)",
  borderRadius: 28,
  textAlign: "center",
  boxShadow: "0 4px 28px rgba(0,0,0,0.055), 0 1px 6px rgba(0,0,0,0.03)",
  transition: "transform 280ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 280ms ease, border-color 280ms ease",
  cursor: "default",
};

function hoverIn(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  el.style.transform = "translateY(-8px)";
  el.style.boxShadow = "0 28px 64px rgba(245,197,24,0.17), 0 10px 28px rgba(0,0,0,0.08)";
  el.style.borderColor = "rgba(245,197,24,0.45)";
}
function hoverOut(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  el.style.transform = "translateY(0)";
  el.style.boxShadow = "0 4px 28px rgba(0,0,0,0.055), 0 1px 6px rgba(0,0,0,0.03)";
  el.style.borderColor = "rgba(245,197,24,0.2)";
}
function mobileIn(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  el.style.transform = "translateX(-4px)";
  el.style.boxShadow = "0 8px 32px rgba(245,197,24,0.15), 0 4px 12px rgba(0,0,0,0.06)";
  el.style.borderColor = "rgba(245,197,24,0.4)";
}
function mobileOut(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  el.style.transform = "translateX(0)";
  el.style.boxShadow = "0 2px 16px rgba(0,0,0,0.05)";
  el.style.borderColor = "rgba(245,197,24,0.2)";
}

export function HowItWorksSteps() {
  return (
    <>
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <div style={{
          display: "inline-flex", alignItems: "center",
          background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.28)",
          borderRadius: 100, padding: "6px 22px", marginBottom: 20,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#B8880A", fontFamily: "'Cairo', sans-serif", letterSpacing: "0.02em" }}>دليلك خطوة بخطوة</span>
        </div>
        <h2 style={{ fontSize: "clamp(28px,5vw,40px)", fontWeight: 900, color: "#1a1a1a", margin: "0 0 10px", fontFamily: "'Cairo', sans-serif" }}>كيف يعمل؟</h2>
        <p style={{ fontSize: 17, color: "#888", margin: 0, fontFamily: "'Cairo', sans-serif" }}>أربع خطوات بسيطة للحصول على أفضل خدمة</p>
      </div>

      {/* ── Desktop: RTL flex row with connectors (lg+) ── */}
      <div className="hidden lg:flex items-stretch" style={{ direction: "rtl", gap: 0 }}>
        {STEPS.map(({ icon: Icon, step, title, desc }, i) => (
          <Fragment key={step}>
            <div
              className="group flex-1"
              style={{ ...CARD_BASE, padding: "48px 28px 38px" }}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
            >
              <div style={BADGE}>{step}</div>
              <div
                className="group-hover:scale-110"
                style={{
                  width: 88, height: 88, borderRadius: "50%",
                  background: "linear-gradient(140deg, rgba(245,197,24,0.13) 0%, rgba(245,197,24,0.05) 100%)",
                  border: "1.5px solid rgba(245,197,24,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "16px auto 26px", flexShrink: 0,
                  transition: "transform 280ms cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <Icon className="w-10 h-10 transition-colors duration-300 group-hover:text-amber-600" style={{ color: "#C9A227" }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: "#1a1a1a", marginBottom: 10, fontFamily: "'Cairo', sans-serif" }}>{title}</h3>
              <p style={{ fontSize: 14, color: "#888", lineHeight: 1.85, margin: 0, fontFamily: "'Cairo', sans-serif" }}>{desc}</p>
            </div>

            {i < STEPS.length - 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 52, flexShrink: 0, padding: "0 2px" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M9.5 2L4.5 7L9.5 12" stroke="#C9A227" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ width: 26, height: 1.5, background: "linear-gradient(to right, rgba(201,162,39,0.55), rgba(201,162,39,0.12))" }} />
                </div>
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {/* ── Tablet: 2×2 grid (sm → lg) ── */}
      <div className="hidden sm:grid lg:hidden grid-cols-2 gap-6">
        {STEPS.map(({ icon: Icon, step, title, desc }) => (
          <div
            key={step}
            className="group"
            style={{ ...CARD_BASE, padding: "44px 24px 36px" }}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            <div style={{ ...BADGE, top: -18, right: 22 }}>{step}</div>
            <div
              className="group-hover:scale-110"
              style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(140deg, rgba(245,197,24,0.13) 0%, rgba(245,197,24,0.05) 100%)",
                border: "1.5px solid rgba(245,197,24,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "16px auto 24px",
                transition: "transform 280ms cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              <Icon className="w-9 h-9 transition-colors duration-300 group-hover:text-amber-600" style={{ color: "#C9A227" }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: "#1a1a1a", marginBottom: 10, fontFamily: "'Cairo', sans-serif" }}>{title}</h3>
            <p style={{ fontSize: 14, color: "#888", lineHeight: 1.85, margin: 0, fontFamily: "'Cairo', sans-serif" }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Mobile: vertical stack with downward connectors ── */}
      <div className="flex sm:hidden flex-col" style={{ gap: 0 }}>
        {STEPS.map(({ icon: Icon, step, title, desc }, i) => (
          <Fragment key={step}>
            <div
              className="group"
              style={{
                position: "relative",
                background: "rgba(255,255,255,0.95)",
                border: "1.5px solid rgba(245,197,24,0.2)",
                borderRadius: 22, padding: "24px 18px 22px",
                display: "flex", alignItems: "center", gap: 16,
                boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                transition: "transform 250ms ease, box-shadow 250ms ease, border-color 250ms ease",
              }}
              onMouseEnter={mobileIn}
              onMouseLeave={mobileOut}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "linear-gradient(140deg, rgba(245,197,24,0.14) 0%, rgba(245,197,24,0.06) 100%)",
                  border: "1.5px solid rgba(245,197,24,0.24)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon style={{ width: 28, height: 28, color: "#C9A227" }} />
                </div>
                <div style={{
                  position: "absolute", top: -8, right: -8,
                  width: 26, height: 26, borderRadius: "50%",
                  background: "linear-gradient(135deg, #F5C518, #C9A227)",
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 3px rgba(245,197,24,0.2), 0 3px 10px rgba(200,162,39,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, color: "#1a1a1a", fontFamily: "'Cairo', sans-serif",
                }}>
                  {step}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: "#1a1a1a", marginBottom: 5, fontFamily: "'Cairo', sans-serif" }}>{title}</h3>
                <p style={{ fontSize: 13, color: "#888", lineHeight: 1.75, margin: 0, fontFamily: "'Cairo', sans-serif" }}>{desc}</p>
              </div>
            </div>

            {i < STEPS.length - 1 && (
              <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: 1.5, height: 16, background: "linear-gradient(to bottom, rgba(201,162,39,0.55), rgba(201,162,39,0.25))" }} />
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                    <path d="M1 1L6 7L11 1" stroke="#C9A227" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </>
  );
}
