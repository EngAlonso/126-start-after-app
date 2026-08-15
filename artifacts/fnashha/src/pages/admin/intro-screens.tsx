import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE } from "@/lib/api-config";
import { uploadFile } from "@/lib/uploadMedia";
import { useToast } from "@/hooks/use-toast";
import {
  Image, Trash2, Upload, RefreshCw, ToggleLeft, ToggleRight,
  GripVertical, Eye, X, Plus, Layers,
} from "lucide-react";

interface IntroScreen {
  id: number;
  imageUrl: string;
  displayOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function PreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, right: 20, background: "none",
          border: "none", color: "#fff", cursor: "pointer",
        }}
      >
        <X size={28} />
      </button>
      <img
        src={url}
        alt="معاينة"
        style={{ maxHeight: "90vh", maxWidth: "90vw", borderRadius: 12, objectFit: "contain" }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function AdminIntroScreens() {
  const { token } = useAuth() as any;
  const { toast } = useToast();

  // ── Character images state ─────────────────────────────────────────────────
  const [items, setItems]           = useState<IntroScreen[]>([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [uploadPct, setUploadPct]   = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);
  const replaceIdRef                = useRef<number | null>(null);
  const replaceFileRef              = useRef<HTMLInputElement>(null);

  // ── Background image state ─────────────────────────────────────────────────
  const [bgUrl, setBgUrl]           = useState<string | null>(null);
  const [bgLoading, setBgLoading]   = useState(true);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgUploadPct, setBgUploadPct] = useState(0);
  const bgFileRef                   = useRef<HTMLInputElement>(null);

  // ── Character size state ───────────────────────────────────────────────────
  const [charSize, setCharSize]             = useState<number>(40);
  const [charSizeSaving, setCharSizeSaving] = useState(false);

  // ── Character position state ───────────────────────────────────────────────
  const [charPos, setCharPos]               = useState<number>(50);
  const [charPosSaving, setCharPosSaving]   = useState(false);

  // drag state
  const dragIdxRef  = useRef<number | null>(null);
  const overIdxRef  = useRef<number | null>(null);

  // ── Load character images ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/intro-screens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error();
      setItems(await r.json());
    } catch {
      toast({ title: "خطأ", description: "فشل تحميل الشاشات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  // ── Load background URL + character size ──────────────────────────────────
  const loadBg = useCallback(async () => {
    setBgLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/intro-background`);
      if (!r.ok) throw new Error();
      const data = await r.json();
      setBgUrl(data.backgroundUrl ?? null);
      if (typeof data.characterSize     === "number") setCharSize(data.characterSize);
      if (typeof data.characterPosition === "number") setCharPos(data.characterPosition);
    } catch {
      // Non-fatal — values stay at defaults
    } finally {
      setBgLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadBg(); }, [load, loadBg]);

  // ── Character position: save ──────────────────────────────────────────────
  async function saveCharPos(val: number) {
    setCharPosSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/cms/settings`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ introCharacterPosition: String(val) }),
      });
      if (!r.ok) throw new Error();
      setCharPos(val);
      toast({ title: "تم الحفظ", description: `موضع الشخصية: ${val}%` });
    } catch {
      toast({ title: "خطأ", description: "فشل حفظ الموضع", variant: "destructive" });
    } finally {
      setCharPosSaving(false);
    }
  }

  // ── Character size: save ──────────────────────────────────────────────────
  async function saveCharSize(val: number) {
    setCharSizeSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/cms/settings`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ introCharacterSize: String(val) }),
      });
      if (!r.ok) throw new Error();
      setCharSize(val);
      toast({ title: "تم الحفظ", description: `حجم الشخصية: ${val}%` });
    } catch {
      toast({ title: "خطأ", description: "فشل حفظ الحجم", variant: "destructive" });
    } finally {
      setCharSizeSaving(false);
    }
  }

  // ── Background: upload / replace ──────────────────────────────────────────
  async function handleBgUpload(file: File) {
    setBgUploading(true);
    setBgUploadPct(0);
    try {
      const url = await uploadFile(file, token, setBgUploadPct);
      const r = await fetch(`${API_BASE}/api/cms/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ introBackgroundUrl: url }),
      });
      if (!r.ok) throw new Error();
      const settings = await r.json();
      setBgUrl(settings.introBackgroundUrl || null);
      toast({ title: "تم الحفظ", description: "تم رفع صورة الخلفية بنجاح" });
    } catch {
      toast({ title: "خطأ", description: "فشل رفع الخلفية", variant: "destructive" });
    } finally {
      setBgUploading(false);
      setBgUploadPct(0);
    }
  }

  // ── Background: delete ────────────────────────────────────────────────────
  async function handleBgDelete() {
    if (!window.confirm("هل أنت متأكد من حذف صورة الخلفية؟")) return;
    try {
      const r = await fetch(`${API_BASE}/api/cms/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ introBackgroundUrl: "" }),
      });
      if (!r.ok) throw new Error();
      setBgUrl(null);
      toast({ title: "تم الحذف", description: "تم حذف صورة الخلفية" });
    } catch {
      toast({ title: "خطأ", description: "فشل حذف الخلفية", variant: "destructive" });
    }
  }

  // ── Character images: upload new ──────────────────────────────────────────
  async function handleNewUpload(file: File) {
    setUploading(true);
    setUploadPct(0);
    try {
      const url = await uploadFile(file, token, setUploadPct);
      const r = await fetch(`${API_BASE}/api/admin/intro-screens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "تم الإضافة", description: "تمت إضافة الصورة بنجاح" });
      await load();
    } catch {
      toast({ title: "خطأ", description: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  // ── Character images: replace ─────────────────────────────────────────────
  async function handleReplace(id: number, file: File) {
    setSaving(true);
    try {
      const url = await uploadFile(file, token, () => {});
      const r = await fetch(`${API_BASE}/api/admin/intro-screens/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "تم الاستبدال", description: "تم استبدال الصورة بنجاح" });
      await load();
    } catch {
      toast({ title: "خطأ", description: "فشل استبدال الصورة", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Character images: toggle enabled ──────────────────────────────────────
  async function toggleEnabled(item: IntroScreen) {
    try {
      const r = await fetch(`${API_BASE}/api/admin/intro-screens/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      if (!r.ok) throw new Error();
      setItems((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, enabled: !s.enabled } : s))
      );
    } catch {
      toast({ title: "خطأ", description: "فشل تحديث الحالة", variant: "destructive" });
    }
  }

  // ── Character images: delete ──────────────────────────────────────────────
  async function deleteItem(id: number) {
    if (!window.confirm("هل أنت متأكد من حذف هذه الشاشة؟")) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/intro-screens/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error();
      toast({ title: "تم الحذف" });
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast({ title: "خطأ", description: "فشل الحذف", variant: "destructive" });
    }
  }

  // ── Drag & drop reorder ───────────────────────────────────────────────────
  function onDragStart(idx: number) { dragIdxRef.current = idx; }
  function onDragEnter(idx: number) { overIdxRef.current = idx; }
  function onDragEnd() {
    const from = dragIdxRef.current;
    const to   = overIdxRef.current;
    if (from === null || to === null || from === to) { dragIdxRef.current = null; overIdxRef.current = null; return; }

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reordered = next.map((s, i) => ({ ...s, displayOrder: i }));
    setItems(reordered);
    dragIdxRef.current = null;
    overIdxRef.current = null;

    fetch(`${API_BASE}/api/admin/intro-screens/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: reordered.map((s) => ({ id: s.id, displayOrder: s.displayOrder })) }),
    }).catch(() =>
      toast({ title: "خطأ", description: "فشل حفظ الترتيب", variant: "destructive" })
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{ padding: "28px 32px", fontFamily: "Cairo, sans-serif", minHeight: "100vh", background: "#fafaf7" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'); @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: 0 }}>شاشات الترحيب</h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
          إدارة خلفية الاستعراض التمهيدي وصور الشخصيات
        </p>
      </div>

      {/* ── Background image section ──────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderRadius: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
        border: "2px solid #e5e7eb", marginBottom: 36, overflow: "hidden",
      }}>
        {/* Section header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "#f5c518", borderRadius: 10, padding: 8, display: "flex" }}>
              <Layers size={18} color="#000" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>صورة الخلفية</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
                الطبقة الثابتة خلف شخصيات الاستعراض — لا تتحرك ولا تتلاشى أبدًا
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {bgUrl && (
              <button
                onClick={() => setPreviewUrl(bgUrl)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb",
                  background: "#fff", cursor: "pointer", fontSize: 13,
                  fontFamily: "Cairo, sans-serif", color: "#374151",
                }}
              >
                <Eye size={15} /> معاينة
              </button>
            )}
            <button
              onClick={() => bgFileRef.current?.click()}
              disabled={bgUploading}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#FAAB18", cursor: bgUploading ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "Cairo, sans-serif", color: "#000",
              }}
            >
              {bgUploading
                ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> {bgUploadPct}%</>
                : <><Upload size={15} /> {bgUrl ? "استبدال الخلفية" : "رفع خلفية"}</>
              }
            </button>
            {bgUrl && (
              <button
                onClick={handleBgDelete}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8, border: "1px solid #fecaca",
                  background: "#fff5f5", cursor: "pointer", fontSize: 13,
                  fontFamily: "Cairo, sans-serif", color: "#ef4444",
                }}
              >
                <Trash2 size={15} /> حذف
              </button>
            )}
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBgUpload(f); e.target.value = ""; }}
            />
          </div>
        </div>

        {/* Background preview area */}
        <div style={{ padding: "20px 24px" }}>
          {bgLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px 0", color: "#9ca3af" }}>
              <RefreshCw size={22} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : bgUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Thumbnail */}
              <div style={{
                width: 100, height: 160, borderRadius: 12, overflow: "hidden",
                border: "2px solid #FAAB18", flexShrink: 0, cursor: "pointer",
              }} onClick={() => setPreviewUrl(bgUrl)}>
                <img
                  src={bgUrl}
                  alt="الخلفية"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>
                  ✓ خلفية مُعيَّنة
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", wordBreak: "break-all", maxWidth: 400 }}>
                  {bgUrl}
                </div>
                {bgUploading && (
                  <div style={{ marginTop: 10, background: "#e5e7eb", borderRadius: 6, overflow: "hidden", width: 200 }}>
                    <div style={{ height: 4, background: "#FAAB18", width: `${bgUploadPct}%`, transition: "width 0.2s" }} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
              <Layers size={36} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>
                لا توجد خلفية — سيتم عرض شاشة شعار التطبيق إذا لم تكن هناك صور شخصيات
              </p>
              <p style={{ fontSize: 12, color: "#d1d5db", marginTop: 6 }}>
                ارفع صورة خلفية واحدة (JPEG أو PNG) لتظهر خلف شخصيات الاستعراض على جميع المنصات
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Character size section ───────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderRadius: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
        border: "2px solid #e5e7eb", marginBottom: 36, overflow: "hidden",
      }}>
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ background: "#f5c518", borderRadius: 10, padding: 8, display: "flex" }}>
            <Layers size={18} color="#000" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>حجم الشخصية</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
              ارتفاع الشخصية كنسبة مئوية من ارتفاع الشاشة — يطبَّق تلقائيًا على Android وiOS والويب
            </div>
          </div>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 240 }}>
            <input
              type="range"
              min={10} max={100} step={5}
              value={charSize}
              onChange={(e) => setCharSize(Number(e.target.value))}
              style={{ flex: 1, accentColor: "#FAAB18", cursor: "pointer" }}
            />
            <div style={{
              minWidth: 60, textAlign: "center",
              fontSize: 22, fontWeight: 900, color: "#1a1a1a",
            }}>
              {charSize}%
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[20, 30, 40, 50, 60, 70, 80].map((v) => (
              <button
                key={v}
                onClick={() => setCharSize(v)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "2px solid",
                  borderColor: charSize === v ? "#FAAB18" : "#e5e7eb",
                  background: charSize === v ? "#fff8e1" : "#fff",
                  color: charSize === v ? "#92400e" : "#6b7280",
                  fontWeight: charSize === v ? 800 : 400,
                  cursor: "pointer", fontSize: 13,
                  fontFamily: "Cairo, sans-serif",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {v}%
              </button>
            ))}
          </div>
          <button
            onClick={() => saveCharSize(charSize)}
            disabled={charSizeSaving}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 22px", borderRadius: 8, border: "none",
              background: "#FAAB18", cursor: charSizeSaving ? "not-allowed" : "pointer",
              fontSize: 14, fontWeight: 700, fontFamily: "Cairo, sans-serif", color: "#000",
            }}
          >
            {charSizeSaving
              ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />
              : null
            }
            حفظ
          </button>
        </div>
      </div>

      {/* ── Character position section ────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderRadius: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
        border: "2px solid #e5e7eb", marginBottom: 36, overflow: "hidden",
      }}>
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ background: "#f5c518", borderRadius: 10, padding: 8, display: "flex" }}>
            <Layers size={18} color="#000" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>موضع الشخصية العمودي</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
              0 = أعلى الشاشة · 50 = وسط الشاشة · 100 = أسفل الشاشة
            </div>
          </div>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {/* Slider + number input row — both stay in sync */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            {/* Axis labels */}
            <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 32, textAlign: "center" }}>أعلى</span>
            <input
              type="range"
              min={0} max={100} step={1}
              value={charPos}
              onChange={(e) => setCharPos(Number(e.target.value))}
              style={{ flex: 1, minWidth: 160, accentColor: "#FAAB18", cursor: "pointer" }}
            />
            <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 32, textAlign: "center" }}>أسفل</span>
            {/* Numeric input — synced with slider */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min={0} max={100} step={1}
                value={charPos}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                  setCharPos(v);
                }}
                style={{
                  width: 64, textAlign: "center", padding: "6px 8px",
                  borderRadius: 8, border: "2px solid #e5e7eb",
                  fontSize: 16, fontWeight: 800, fontFamily: "Cairo, sans-serif",
                  color: "#1a1a1a", outline: "none",
                }}
              />
              <span style={{ fontSize: 14, color: "#6b7280" }}>%</span>
            </div>
          </div>
          {/* Preset quick-picks */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
              {([
                { v: 0,   label: "أعلى" },
                { v: 25,  label: "25%" },
                { v: 50,  label: "وسط" },
                { v: 75,  label: "75%" },
                { v: 100, label: "أسفل" },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setCharPos(v)}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "2px solid",
                    borderColor: charPos === v ? "#FAAB18" : "#e5e7eb",
                    background:  charPos === v ? "#fff8e1" : "#fff",
                    color:       charPos === v ? "#92400e" : "#6b7280",
                    fontWeight:  charPos === v ? 800 : 400,
                    cursor: "pointer", fontSize: 13,
                    fontFamily: "Cairo, sans-serif",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => saveCharPos(charPos)}
              disabled={charPosSaving}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 22px", borderRadius: 8, border: "none",
                background: "#FAAB18", cursor: charPosSaving ? "not-allowed" : "pointer",
                fontSize: 14, fontWeight: 700, fontFamily: "Cairo, sans-serif", color: "#000",
              }}
            >
              {charPosSaving && <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />}
              حفظ
            </button>
          </div>
        </div>
      </div>

      {/* ── Character images section ──────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>صور الشخصيات</h2>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            صور PNG بخلفية شفافة — تتناوب فوق خلفية الاستعراض · رتّبها بالسحب
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => load()}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb",
              background: "#fff", cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13, fontFamily: "Cairo, sans-serif", color: "#374151",
            }}
          >
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
            تحديث
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: "#FAAB18", cursor: uploading ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "Cairo, sans-serif", color: "#000",
            }}
          >
            {uploading
              ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> {uploadPct}%</>
              : <><Plus size={15} /> إضافة صورة</>
            }
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNewUpload(f); e.target.value = ""; }}
          />
          <input
            ref={replaceFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && replaceIdRef.current !== null) handleReplace(replaceIdRef.current, f);
              e.target.value = "";
              replaceIdRef.current = null;
            }}
          />
        </div>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div style={{ marginBottom: 16, background: "#e5e7eb", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: 6, background: "#FAAB18", width: `${uploadPct}%`, transition: "width 0.2s" }} />
        </div>
      )}

      {/* Character images grid */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0", color: "#9ca3af" }}>
          <RefreshCw size={28} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
          <Image size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.4 }} />
          <p style={{ fontSize: 15 }}>لا توجد شاشات ترحيب بعد — أضف صورة للبدء</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
          {items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              style={{
                background: "#fff",
                borderRadius: 14,
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                overflow: "hidden",
                border: "2px solid",
                borderColor: item.enabled ? "#FAAB18" : "#e5e7eb",
                opacity: item.enabled ? 1 : 0.65,
                cursor: "grab",
                transition: "box-shadow 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ position: "relative", aspectRatio: "9/16", overflow: "hidden", background: "#f3f4f6" }}>
                <img
                  src={item.imageUrl}
                  alt={`شاشة ${idx + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,0.65)", color: "#fff",
                  borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700,
                }}>
                  #{idx + 1}
                </div>
                <div style={{
                  position: "absolute", top: 8, left: 8,
                  background: "rgba(0,0,0,0.5)", color: "#fff",
                  borderRadius: 8, padding: "4px", display: "flex", cursor: "grab",
                }}>
                  <GripVertical size={14} />
                </div>
              </div>

              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => toggleEnabled(item)}
                  title={item.enabled ? "إيقاف" : "تفعيل"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: item.enabled ? "#10b981" : "#9ca3af", padding: 2 }}
                >
                  {item.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => setPreviewUrl(item.imageUrl)}
                  title="معاينة"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2 }}
                >
                  <Eye size={17} />
                </button>
                <button
                  onClick={() => { replaceIdRef.current = item.id; replaceFileRef.current?.click(); }}
                  title="استبدال الصورة"
                  disabled={saving}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", padding: 2 }}
                >
                  <Upload size={17} />
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => deleteItem(item.id)}
                  title="حذف"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && <PreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  );
}
