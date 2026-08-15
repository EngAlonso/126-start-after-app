import { Link } from "wouter";
import { Phone, MessageCircle, Facebook, Instagram, Music2, Twitter } from "lucide-react";
import { useGetCmsSettings } from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { AuthBackground } from "@/components/ui/auth-background";

export default function Contact() {
  const { data: cms } = useGetCmsSettings();
  const s = cms as any;

  const hotline = s?.contactPhone || null;
  const whatsapp = s?.whatsappNumber || null;
  const hotlineSchedule = s?.hotlineSchedule || "السبت – الخميس، 9ص – 9م";
  const facebookUrl = s?.facebookUrl || null;
  const instagramUrl = s?.instagramUrl || null;
  const tiktokUrl = s?.tiktokUrl || null;
  const twitterUrl = s?.twitterUrl || null;

  const socialCards = [
    facebookUrl ? { key: "facebook",  icon: <Facebook  size={28} strokeWidth={1.8} />, label: "فيسبوك",    color: "#1877F2", bg: "#EEF3FF", href: facebookUrl  } : null,
    instagramUrl ? { key: "instagram", icon: <Instagram size={28} strokeWidth={1.8} />, label: "إنستغرام",  color: "#E1306C", bg: "#FFF0F5", href: instagramUrl } : null,
    tiktokUrl ?    { key: "tiktok",    icon: <Music2    size={28} strokeWidth={1.8} />, label: "تيك توك",   color: "#010101", bg: "#F5F5F5", href: tiktokUrl    } : null,
    twitterUrl ?   { key: "twitter",   icon: <Twitter   size={28} strokeWidth={1.8} />, label: "تويتر / X", color: "#1DA1F2", bg: "#E8F5FD", href: twitterUrl   } : null,
  ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string; color: string; bg: string; href: string }[];

  return (
    <>
    <AuthBackground slug="contact" />
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", minHeight: "100vh", background: "transparent", position: "relative", zIndex: 1 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .contact-card {
          background: #fff;
          border: 1.5px solid #ebebeb;
          border-radius: 20px;
          padding: 28px 22px;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .contact-card:hover {
          border-color: rgba(245,197,24,0.45);
          box-shadow: 0 8px 28px rgba(245,197,24,0.12), 0 2px 10px rgba(0,0,0,0.05);
          transform: translateY(-3px);
        }
        .contact-icon-wrap {
          width: 64px; height: 64px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }
        .cta-primary {
          background: #25D366; color: #fff;
          font-weight: 800; font-family: 'Cairo', sans-serif;
          font-size: 16px; padding: 14px 36px;
          border: none; border-radius: 14px; cursor: pointer;
          text-decoration: none; display: inline-flex; align-items: center; gap: 10px;
          transition: all 0.2s;
        }
        .cta-primary:hover { background: #1ebe5c; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,211,102,0.38); }
        .cta-secondary {
          background: #fff; color: #1a1a1a;
          font-weight: 800; font-family: 'Cairo', sans-serif;
          font-size: 16px; padding: 14px 36px;
          border: 2px solid #ebebeb; border-radius: 14px; cursor: pointer;
          text-decoration: none; display: inline-flex; align-items: center; gap: 10px;
          transition: all 0.2s;
        }
        .cta-secondary:hover { border-color: #F5C518; background: #fef9e7; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(245,197,24,0.2); }
        @media (max-width: 600px) {
          .contact-grid { grid-template-columns: 1fr 1fr !important; }
          .cta-row { flex-direction: column !important; align-items: stretch !important; }
          .cta-primary, .cta-secondary { justify-content: center; }
        }
      `}</style>

      <SiteHeader />

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 40px" }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fef9e7", border: "1.5px solid rgba(245,197,24,0.35)", borderRadius: 24, padding: "6px 18px", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#c49a00", fontFamily: "'Cairo', sans-serif" }}>نحن هنا لمساعدتك</span>
          </div>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 900, color: "#fff", margin: "0 0 12px", fontFamily: "'Cairo', sans-serif" }}>
            اتصل بنا
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", margin: 0, fontFamily: "'Cairo', sans-serif", lineHeight: 1.7 }}>
            تواصل معنا عبر أي قناة تناسبك — نرد في أقرب وقت ممكن
          </p>
        </div>

        {/* Direct contact cards: hotline + whatsapp */}
        <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div className="contact-card">
            <div className="contact-icon-wrap" style={{ background: "#FEF9E7" }}>
              <Phone size={28} color="#F5C518" strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#1a1a1a", marginBottom: 6, fontFamily: "'Cairo', sans-serif" }}>الخط الساخن</div>
            {hotline ? (
              <a href={`tel:${hotline}`} style={{ fontSize: 20, fontWeight: 900, color: "#F5C518", textDecoration: "none", fontFamily: "'Cairo', sans-serif", direction: "ltr", display: "block" }}>
                {hotline}
              </a>
            ) : (
              <span style={{ fontSize: 14, color: "#bbb", fontFamily: "'Cairo', sans-serif" }}>—</span>
            )}
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 6, fontFamily: "'Cairo', sans-serif" }}>{hotlineSchedule}</div>
          </div>

          <div className="contact-card">
            <div className="contact-icon-wrap" style={{ background: "#F0FFF6" }}>
              <MessageCircle size={28} color="#25D366" strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#1a1a1a", marginBottom: 6, fontFamily: "'Cairo', sans-serif" }}>واتساب</div>
            {whatsapp ? (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" style={{ fontSize: 20, fontWeight: 900, color: "#25D366", textDecoration: "none", fontFamily: "'Cairo', sans-serif", direction: "ltr", display: "block" }}>
                {whatsapp}
              </a>
            ) : (
              <span style={{ fontSize: 14, color: "#bbb", fontFamily: "'Cairo', sans-serif" }}>—</span>
            )}
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 6, fontFamily: "'Cairo', sans-serif" }}>رد فوري على واتساب</div>
          </div>
        </div>

        {/* Social media cards */}
        {socialCards.length > 0 && (
          <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: socialCards.length <= 2 ? `repeat(${socialCards.length}, 1fr)` : socialCards.length === 4 ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 40 }}>
            {socialCards.map((card) => (
              <a key={card.key} href={card.href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <div className="contact-card" style={{ cursor: "pointer" }}>
                  <div className="contact-icon-wrap" style={{ background: card.bg }}>
                    <span style={{ color: card.color }}>{card.icon}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#1a1a1a", fontFamily: "'Cairo', sans-serif" }}>{card.label}</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* CTA buttons */}
        <div className="cta-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="cta-primary">
              <MessageCircle size={20} />
              تواصل عبر واتساب
            </a>
          )}
          {hotline && (
            <a href={`tel:${hotline}`} className="cta-secondary">
              <Phone size={20} />
              اتصل الآن
            </a>
          )}
          {!whatsapp && !hotline && (
            <div style={{ textAlign: "center", color: "#aaa", fontFamily: "'Cairo', sans-serif", fontSize: 14, padding: "20px 0" }}>
              بيانات التواصل لم تُضف بعد — يمكن إضافتها من لوحة الإدارة
            </div>
          )}
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
          جميع الحقوق محفوظة © {new Date().getFullYear()}{" "}
          <Link href="/" style={{ color: "#c49a00", textDecoration: "none", fontWeight: 700 }}>فنشها</Link>
        </p>
      </footer>
    </div>
    </>
  );
}
