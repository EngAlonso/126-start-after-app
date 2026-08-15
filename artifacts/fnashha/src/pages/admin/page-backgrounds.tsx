import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE } from "@/lib/api-config";
import { uploadFile } from "@/lib/uploadMedia";
import { useToast } from "@/hooks/use-toast";
import { usePageBgRefresh } from "@/contexts/page-backgrounds-context";
import { ImageIcon, ToggleLeft, ToggleRight, Trash2, Upload, RefreshCw, Link2, Save } from "lucide-react";

interface PageBg {
  slug: string;
  label: string;
  imageUrl: string | null;
  enabled: boolean;
  overlayOpacity: number;
  position: string;
  size: string;
  repeat: string;
  attachment: string;
}

const POSITION_OPTIONS = [
  { value: "center", label: "وسط" },
  { value: "top", label: "أعلى" },
  { value: "bottom", label: "أسفل" },
  { value: "left", label: "يسار" },
  { value: "right", label: "يمين" },
];
const SIZE_OPTIONS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
];
const REPEAT_OPTIONS = [
  { value: "no-repeat", label: "بدون تكرار" },
  { value: "repeat", label: "تكرار" },
];
const ATTACHMENT_OPTIONS = [
  { value: "scroll", label: "Scroll" },
  { value: "fixed", label: "Fixed" },
];

function PageCard({ bg, token, onUpdate, refresh }: { bg: PageBg; token: string | null; onUpdate: (updated: PageBg) => void; refresh: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<PageBg>(bg);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  async function patch(fields: Partial<PageBg>) {
    const next = { ...local, ...fields };
    setLocal(next);
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/page-backgrounds/${local.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      onUpdate(data);
      refresh();
    } catch {
      toast({ title: "خطأ", description: "فشل حفظ الإعدادات", variant: "destructive" });
      setLocal(local);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadPct(0);
    try {
      const url = await uploadFile(file, token, setUploadPct);
      await patch({ imageUrl: url });
      toast({ title: "تم الرفع", description: "تم رفع الصورة بنجاح" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  async function handleRemoveImage() {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/page-backgrounds/${local.slug}/image`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setLocal((p) => ({ ...p, imageUrl: null }));
      onUpdate(data);
      refresh();
      toast({ title: "تم الحذف", description: "تم إزالة الصورة" });
    } catch {
      toast({ title: "خطأ", description: "فشل إزالة الصورة", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 8,
    border: "1px solid #e5e7eb", background: "#fff",
    fontSize: 13, outline: "none", fontFamily: "Cairo, sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block",
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "1px solid #f0f0e8",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden",
    }}>
      <div style={{ position: "relative", height: 140, background: "#1a1a1a", overflow: "hidden" }}>
        {local.imageUrl ? (
          <img
            src={local.imageUrl}
            alt={local.label}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 1 - local.overlayOpacity / 100 }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#555", flexDirection: "column", gap: 8 }}>
            <ImageIcon size={32} />
            <span style={{ fontSize: 12 }}>لا توجد صورة</span>
          </div>
        )}
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: local.enabled ? "#16a34a" : "#dc2626",
          color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700,
        }}>
          {local.enabled ? "مفعّل" : "معطّل"}
        </div>
      </div>

      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{local.label}</h3>
          <button
            onClick={() => patch({ enabled: !local.enabled })}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: local.enabled ? "#16a34a" : "#9ca3af" }}
            title={local.enabled ? "تعطيل" : "تفعيل"}
          >
            {local.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {[{ label: "رفع صورة", icon: <Upload size={12} />, mode: false }, { label: "رابط URL", icon: <Link2 size={12} />, mode: true }].map(({ label, icon, mode }) => (
            <button
              key={String(mode)}
              onClick={() => setUrlMode(mode)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "6px 0", borderRadius: 8, border: urlMode === mode ? "2px solid #16a34a" : "1.5px solid #e5e7eb",
                background: urlMode === mode ? "#f0fdf4" : "#fff", color: urlMode === mode ? "#16a34a" : "#6b7280",
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Cairo, sans-serif",
              }}
            >{icon}{label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {!urlMode ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || saving}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 0", borderRadius: 10, border: "1.5px dashed #d1d5db",
                  background: uploading ? "#f9fafb" : "#fff", color: "#374151",
                  fontSize: 12, fontWeight: 700, cursor: uploading ? "wait" : "pointer",
                  fontFamily: "Cairo, sans-serif",
                }}
              >
                {uploading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />{uploadPct}%</> : <><Upload size={14} />رفع صورة</>}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://example.com/image.jpg"
                style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                dir="ltr"
              />
              <button
                onClick={async () => { const u = urlDraft.trim(); if (!u) return; await patch({ imageUrl: u }); setUrlDraft(""); setUrlMode(false); toast({ title: "تم الحفظ" }); }}
                disabled={saving || !urlDraft.trim()}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "8px 12px",
                  borderRadius: 10, border: "none", background: "#16a34a", color: "#fff",
                  fontSize: 12, fontWeight: 700, cursor: saving || !urlDraft.trim() ? "not-allowed" : "pointer",
                  opacity: saving || !urlDraft.trim() ? 0.6 : 1, fontFamily: "Cairo, sans-serif",
                }}
              ><Save size={14} />حفظ</button>
            </>
          )}

          {local.imageUrl && (
            <button
              onClick={handleRemoveImage}
              disabled={saving}
              title="إزالة الصورة"
              style={{
                padding: "8px 12px", borderRadius: 10, border: "1.5px solid #fecaca",
                background: "#fff5f5", color: "#dc2626", cursor: "pointer",
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>شفافية الطبقة ({local.overlayOpacity}%)</label>
          <input
            type="range" min={0} max={80} step={1}
            value={local.overlayOpacity}
            onChange={(e) => setLocal((p) => ({ ...p, overlayOpacity: +e.target.value }))}
            onMouseUp={() => patch({ overlayOpacity: local.overlayOpacity })}
            onTouchEnd={() => patch({ overlayOpacity: local.overlayOpacity })}
            style={{ width: "100%", accentColor: "#F5C518" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
            <span>0%</span><span>80%</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>الموضع</label>
            <select value={local.position} onChange={(e) => patch({ position: e.target.value })} style={inputStyle}>
              {POSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>الحجم</label>
            <select value={local.size} onChange={(e) => patch({ size: e.target.value })} style={inputStyle}>
              {SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>التكرار</label>
            <select value={local.repeat} onChange={(e) => patch({ repeat: e.target.value })} style={inputStyle}>
              {REPEAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>الثبات</label>
            <select value={local.attachment} onChange={(e) => patch({ attachment: e.target.value })} style={inputStyle}>
              {ATTACHMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {saving && <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280", textAlign: "center" }}>جارٍ الحفظ…</div>}
      </div>
    </div>
  );
}

export default function AdminPageBackgrounds() {
  const { token } = useAuth();
  const { toast } = useToast();
  const refresh = usePageBgRefresh();
  const [items, setItems] = useState<PageBg[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/page-backgrounds`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => {
        toast({ title: "خطأ", description: "فشل تحميل الخلفيات", variant: "destructive" });
        setLoading(false);
      });
  }, [token]);

  function handleUpdate(updated: PageBg) {
    setItems((prev) => prev ? prev.map((p) => p.slug === updated.slug ? updated : p) : prev);
  }

  return (
    <div dir="rtl" style={{ padding: "28px 32px", fontFamily: "Cairo, sans-serif", minHeight: "100vh", background: "#fafaf7" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: 0 }}>خلفيات الصفحات</h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
          تحكم كامل في خلفية كل صفحة عامة — رفع، استبدال، تعطيل، والتحكم في المظهر
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0", color: "#6b7280" }}>
          <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20,
        }}>
          {(items || []).map((bg) => (
            <PageCard key={bg.slug} bg={bg} token={token} onUpdate={handleUpdate} refresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
