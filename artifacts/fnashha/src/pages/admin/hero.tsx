import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useGetCmsSettings, getGetCmsSettingsQueryKey, useUpdateCmsSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Monitor, Smartphone, Palette, Type, Star, Zap, Shield, CheckCircle,
  ThumbsUp, MapPin, Users, Plus, Trash2, ChevronUp, ChevronDown, Layers,
  LayoutGrid, Wand2, Move, Upload, GripVertical, AlignCenter, Image, Apple,
} from "lucide-react";
import { uploadFile } from "@/lib/uploadMedia";
import { useAuth } from "@/contexts/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type ElemKey = "badge" | "title" | "subtitle" | "description" | "buttons" | "features";

type ElemCfg = {
  offsetX?: number; offsetY?: number;
  marginTop?: number; marginBottom?: number;
  fontSize?: number; fontWeight?: string;
  lineHeight?: string; letterSpacing?: string;
  textShadow?: string; opacity?: number;
  fontStyle?: string; textTransform?: string;
  maxWidth?: string; zIndex?: number;
};

type ElementsConfig = Partial<Record<ElemKey, ElemCfg>>;

type Highlight = { word: string; color: string };

type FeatureItem = { icon: string; text: string; show: boolean; color: string };

type HeroFormValues = {
  heroBackgroundImage: string; heroMobileImage: string;
  heroVideoUrl: string; heroVideoEnabled: string;
  heroOverlayOpacity: string;
  heroTitleAr: string; heroTitleColor: string;
  heroSubtitleAr: string; heroSubtitleColor: string;
  heroDescription: string;
  heroHighlightWord: string; heroHighlightColor: string;
  heroTextAlign: string; heroPaddingTop: string;
  heroBtnBgColor: string; heroBtnTextColor: string; heroBtnBorderRadius: string;
  heroBtnShadow: string; heroBtnPaddingX: string; heroBtnPaddingY: string;
  heroAndroidAppUrl: string; heroAndroidText: string; heroAndroidEnabled: string; heroAndroidIconUrl: string;
  heroIosAppUrl: string; heroIosText: string; heroIosEnabled: string; heroIosIconUrl: string;
  statsBackgroundImage: string;
  heroBadgeText: string; heroBadgeShow: string; heroBadgeIcon: string;
  heroBadgeColor: string; heroBadgeFontSize: string;
  heroFeaturesShow: string; heroFeaturesSpacing: string;
  heroStoreBtnMinWidth: string; heroStoreBtnFontSize: string;
  heroStoreBtnIconSize: string; heroStoreBtnGap: string;
  heroStoreBtnBorderRadius: string; heroStoreBtnPaddingX: string;
  heroStoreBtnPaddingY: string; heroStoreBtnSpacingBelow: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  { value: "Shield", label: "درع", icon: Shield },
  { value: "Star", label: "نجمة", icon: Star },
  { value: "CheckCircle", label: "صح", icon: CheckCircle },
  { value: "Zap", label: "برق", icon: Zap },
  { value: "ThumbsUp", label: "إعجاب", icon: ThumbsUp },
  { value: "MapPin", label: "موقع", icon: MapPin },
  { value: "Users", label: "أشخاص", icon: Users },
];
const ICON_MAP: Record<string, React.ElementType> = { Shield, Star, CheckCircle, Zap, ThumbsUp, MapPin, Users };

const FONT_WEIGHTS = ["300","400","500","600","700","800","900"];
const FW_LABELS: Record<string, string> = { "300":"Light","400":"Regular","500":"Medium","600":"Semi","700":"Bold","800":"Extra","900":"Black" };

const DEFAULT_FEATURES: FeatureItem[] = [
  { icon: "Shield", text: "مدفوعات آمنة", show: true, color: "" },
  { icon: "Star", text: "فنيون معتمدون", show: true, color: "" },
  { icon: "CheckCircle", text: "ضمان الجودة", show: true, color: "" },
];

const DEFAULT_DESKTOP: ElementsConfig = {
  badge:       { offsetX:0, offsetY:0, marginBottom:24 },
  title:       { offsetX:0, offsetY:0, fontSize:60, fontWeight:"900", lineHeight:"1.1", letterSpacing:"-1", textShadow:"", opacity:1 },
  subtitle:    { offsetX:0, offsetY:0, fontSize:20, fontWeight:"400", lineHeight:"1.6", letterSpacing:"0", maxWidth:"672" },
  description: { offsetX:0, offsetY:0, fontSize:16, opacity:1, maxWidth:"576" },
  buttons:     { offsetX:0, offsetY:0, marginTop:40 },
  features:    { offsetX:0, offsetY:0, marginTop:56 },
};

const DEFAULT_MOBILE: ElementsConfig = {
  badge:       { offsetX:0, offsetY:0, marginBottom:16 },
  title:       { offsetX:0, offsetY:0, fontSize:34, fontWeight:"900", lineHeight:"1.15", letterSpacing:"-0.5", textShadow:"", opacity:1 },
  subtitle:    { offsetX:0, offsetY:0, fontSize:16, fontWeight:"400", lineHeight:"1.5", letterSpacing:"0", maxWidth:"" },
  description: { offsetX:0, offsetY:0, fontSize:14, opacity:1, maxWidth:"" },
  buttons:     { offsetX:0, offsetY:0, marginTop:32 },
  features:    { offsetX:0, offsetY:0, marginTop:40 },
};

const ELEM_LABELS: Record<ElemKey, string> = {
  badge: "الشارة (Badge)", title: "العنوان الرئيسي",
  subtitle: "العنوان الفرعي", description: "الوصف الإضافي",
  buttons: "الأزرار", features: "قائمة الميزات",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function merge<T extends object>(defaults: T, overrides: Partial<T> | undefined): T {
  if (!overrides) return { ...defaults };
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    if (overrides[key] !== undefined) result[key] = overrides[key] as T[typeof key];
  }
  return result;
}

function SliderField({ label, value, min, max, step=1, unit="", onChange }: {
  label: string; value: number|string; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  const n = typeof value === "string" ? parseFloat(value)||0 : (value ?? 0);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <Label className="text-xs font-semibold">{label}</Label>
        <span className="text-xs font-bold tabular-nums bg-secondary px-1.5 py-0.5 rounded">{n}{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={n}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 accent-primary h-1.5" />
        <Input type="number" min={min} max={max} step={step} value={n}
          onChange={(e) => onChange(parseFloat(e.target.value)||0)}
          className="w-16 text-xs h-7 px-1.5 text-center" />
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-2">
        <input type="color" value={value||"#ffffff"} onChange={(e)=>onChange(e.target.value)}
          className="w-8 h-8 rounded border border-border cursor-pointer p-0.5 bg-background flex-shrink-0" />
        <Input value={value} onChange={(e)=>onChange(e.target.value)} placeholder="#000000 أو فارغ" className="flex-1 text-xs font-mono h-8" />
        {value && <button type="button" onClick={()=>onChange("")} className="text-xs text-muted-foreground hover:text-destructive flex-shrink-0">✕</button>}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div onClick={()=>onChange(!checked)} className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${checked?"bg-primary":"bg-muted-foreground/30"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked?"right-0.5":"left-0.5"}`} />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </label>
  );
}

function Sect({ title, children, open: defOpen=true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(defOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={()=>setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/40 hover:bg-secondary/60 transition-colors text-xs font-bold">
        {title}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open?"rotate-180":""}`} />
      </button>
      {open && <div className="p-3 space-y-3 bg-background">{children}</div>}
    </div>
  );
}

function MediaUploadField({ label, hint, value, onChange, accept, testId, type="image" }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  accept: string; testId: string; type?: "image"|"video";
}) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const maxMB = type==="video"?30:10;
    if (file.size > maxMB*1024*1024) { setError(`الحد ${maxMB} MB`); return; }
    setError(""); setUploading(true); setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
    uploadFile(file, token||"", setProgress)
      .then((url)=>{ onChange(url); setUploading(false); })
      .catch(()=>{ setError("فشل الرفع"); setUploading(false); });
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold block">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="border border-dashed border-border rounded-lg p-2.5 space-y-2 bg-secondary/10">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={()=>inputRef.current?.click()} disabled={uploading} className="h-7 text-xs" data-testid={testId}>
            <Upload className="w-3 h-3 ml-1" />
            {uploading?`${progress}%`:type==="video"?"رفع فيديو":"رفع صورة"}
          </Button>
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Input value={value} onChange={(e)=>onChange(e.target.value)} placeholder="أو ألصق رابطاً مباشراً..." className="text-xs h-7" />
        {value && !uploading && type==="image" && <img src={value} alt="" className="w-full h-14 object-cover rounded" onError={(e)=>((e.target as HTMLImageElement).style.display="none")} />}
        {value && !uploading && type==="video" && <video src={value} className="w-full rounded max-h-14" muted />}
      </div>
    </div>
  );
}

function TypoControls({ cfg, onChange }: { cfg: ElemCfg; onChange: (p: Partial<ElemCfg>) => void }) {
  return (
    <div className="space-y-3">
      <SliderField label="حجم الخط" value={cfg.fontSize||16} min={8} max={120} unit="px" onChange={(v)=>onChange({fontSize:v})} />
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">وزن الخط</Label>
        <div className="flex flex-wrap gap-1">
          {FONT_WEIGHTS.map((w)=>(
            <button key={w} type="button" onClick={()=>onChange({fontWeight:w})}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${cfg.fontWeight===w?"bg-primary text-primary-foreground":"bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}>
              {FW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>
      <SliderField label="ارتفاع السطر" value={parseFloat(cfg.lineHeight||"1.5")} min={0.7} max={3} step={0.05} onChange={(v)=>onChange({lineHeight:String(v)})} />
      <SliderField label="تباعد الحروف" value={parseFloat(cfg.letterSpacing||"0")} min={-5} max={15} step={0.5} unit="px" onChange={(v)=>onChange({letterSpacing:String(v)})} />
      <SliderField label="الشفافية" value={Math.round((cfg.opacity??1)*100)} min={0} max={100} unit="%" onChange={(v)=>onChange({opacity:v/100})} />
      <div className="flex gap-2">
        <button type="button" onClick={()=>onChange({fontStyle:cfg.fontStyle==="italic"?"normal":"italic"})}
          className={`flex-1 py-1.5 rounded text-xs font-medium italic transition-colors ${cfg.fontStyle==="italic"?"bg-primary text-primary-foreground":"bg-secondary text-secondary-foreground"}`}>
          مائل
        </button>
        <button type="button" onClick={()=>onChange({textTransform:cfg.textTransform==="uppercase"?"none":"uppercase"})}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${cfg.textTransform==="uppercase"?"bg-primary text-primary-foreground":"bg-secondary text-secondary-foreground"}`}>
          UPPER
        </button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">ظل النص</Label>
        <Input value={cfg.textShadow||""} onChange={(e)=>onChange({textShadow:e.target.value})}
          placeholder="0 2px 8px rgba(0,0,0,0.5)" className="text-xs h-7 font-mono" />
      </div>
    </div>
  );
}

function PosControls({ cfg, onChange }: { cfg: ElemCfg; onChange: (p: Partial<ElemCfg>) => void }) {
  return (
    <div className="space-y-3">
      <SliderField label="إزاحة أفقية X" value={cfg.offsetX||0} min={-500} max={500} unit="px" onChange={(v)=>onChange({offsetX:v})} />
      <SliderField label="إزاحة رأسية Y" value={cfg.offsetY||0} min={-300} max={300} unit="px" onChange={(v)=>onChange({offsetY:v})} />
      <SliderField label="هامش علوي" value={cfg.marginTop||0} min={0} max={200} unit="px" onChange={(v)=>onChange({marginTop:v})} />
      <SliderField label="هامش سفلي" value={cfg.marginBottom||0} min={0} max={200} unit="px" onChange={(v)=>onChange({marginBottom:v})} />
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">الحد الأقصى للعرض</Label>
        <div className="flex items-center gap-2">
          <Input value={cfg.maxWidth||""} onChange={(e)=>onChange({maxWidth:e.target.value})}
            placeholder="672px أو 80% أو فارغ" className="flex-1 text-xs h-7 font-mono" />
          {cfg.maxWidth && <button type="button" onClick={()=>onChange({maxWidth:""})} className="text-xs text-muted-foreground hover:text-destructive">✕</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────

const PREV_W_DESK = 1200;
const PREV_H_DESK = 580;
const PREV_W_MOB  = 390;
const PREV_H_MOB  = 680;

function HeroPreview({
  values, elemCfg, highlights, features, isDragMode, isDesktop, onElemDrag,
}: {
  values: HeroFormValues;
  elemCfg: ElementsConfig;
  highlights: Highlight[];
  features: FeatureItem[];
  isDragMode: boolean;
  isDesktop: boolean;
  onElemDrag: (key: ElemKey, absX: number, absY: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth - 32;
      const base = isDesktop ? PREV_W_DESK : PREV_W_MOB;
      setScale(Math.min(1, w / base));
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [isDesktop]);

  const baseW = isDesktop ? PREV_W_DESK : PREV_W_MOB;
  const baseH = isDesktop ? PREV_H_DESK : PREV_H_MOB;

  const hasBgVideo = values.heroVideoEnabled==="true" && !!values.heroVideoUrl;
  const hasBgImage = !!values.heroBackgroundImage;
  const hasBg = hasBgVideo || hasBgImage;
  const overlayOpacity = parseFloat(values.heroOverlayOpacity||"55")/100;
  const textAlign = values.heroTextAlign||"center";
  const flexDir = textAlign==="start"?"flex-end":textAlign==="end"?"flex-start":"center";
  const textDir = textAlign==="start"?"right":textAlign==="end"?"left":"center";

  const titleText = values.heroTitleAr||"احصل على خدمة احترافية مع فنشها";
  const defaultTxtStyle: React.CSSProperties = values.heroTitleColor ? {color:values.heroTitleColor} : hasBg ? {color:"white"} : {};

  const renderTitle = () => {
    const lines = titleText.replace(/\\n/g,"\n").split("\n");
    const renderLine = (text: string, li: number) => {
      if (!highlights.length) return <span key={li} style={defaultTxtStyle}>{text}</span>;
      const matches: Array<{start:number;end:number;color:string}> = [];
      highlights.forEach(({word,color}) => {
        const idx = text.indexOf(word);
        if (idx>=0) matches.push({start:idx,end:idx+word.length,color:color||"hsl(var(--primary))"});
      });
      matches.sort((a,b)=>a.start-b.start);
      const parts: React.ReactNode[] = [];
      let pos=0;
      matches.forEach(({start,end,color},i)=>{
        if (start>pos) parts.push(<span key={`t${i}`} style={defaultTxtStyle}>{text.slice(pos,start)}</span>);
        parts.push(<span key={`h${i}`} style={{color}}>{text.slice(start,end)}</span>);
        pos=end;
      });
      if (pos<text.length) parts.push(<span key="tail" style={defaultTxtStyle}>{text.slice(pos)}</span>);
      return <span key={li}>{parts}</span>;
    };
    return <>{lines.map((line,i)=><span key={i}>{renderLine(line,i)}{i<lines.length-1&&<br/>}</span>)}</>;
  };

  const get = (k: ElemKey): ElemCfg => ({ ...(DEFAULT_DESKTOP[k]||{}), ...(elemCfg[k]||{}) });
  const dragStyle: React.CSSProperties = isDragMode ? {cursor:"grab",outline:"2px dashed rgba(255,255,255,0.5)",outlineOffset:"2px"} : {};

  const startDrag = (key: ElemKey) => (e: React.MouseEvent) => {
    if (!isDragMode) return;
    e.preventDefault();
    const origX = elemCfg[key]?.offsetX||0;
    const origY = elemCfg[key]?.offsetY||0;
    const sx = e.clientX; const sy = e.clientY;
    const onMove = (me: MouseEvent) => {
      onElemDrag(key, Math.round(origX+(me.clientX-sx)/scale), Math.round(origY+(me.clientY-sy)/scale));
    };
    const onUp = () => { document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); };
    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
  };

  const tc = get("title"); const sc = get("subtitle");
  const bc = get("badge"); const dc = get("description");
  const btc = get("buttons"); const fc = get("features");
  const BadgeIcon = ICON_MAP[values.heroBadgeIcon||"Zap"]||Zap;
  const showBadge = values.heroBadgeShow!=="false";
  const showFeat = values.heroFeaturesShow!=="false";
  const btnBgColor = values.heroBtnBgColor||"";
  const btnTxtColor = values.heroBtnTextColor||"";
  const btnRadius = `${values.heroBtnBorderRadius||"16"}px`;
  const btnPadV = values.heroBtnPaddingY||"12"; const btnPadH = values.heroBtnPaddingX||"24";
  const btnShadow = values.heroBtnShadow||"";
  const ptExtra = parseInt(values.heroPaddingTop||"0")||0;
  const androidIconUrl = values.heroAndroidIconUrl||"";
  const iosIconUrl = values.heroIosIconUrl||"";
  const showAndroid = values.heroAndroidEnabled==="true" && !!values.heroAndroidAppUrl;
  const showIos = values.heroIosEnabled==="true" && !!values.heroIosAppUrl;
  const showAppBtns = showAndroid || showIos;
  const storeBtnRadius = `${values.heroStoreBtnBorderRadius||"16"}px`;
  const storeBtnPadV = values.heroStoreBtnPaddingY||"10"; const storeBtnPadH = values.heroStoreBtnPaddingX||"18";
  const storeBtnMinWidth = `${values.heroStoreBtnMinWidth||"170"}px`;
  const storeBtnFontSize = parseInt(values.heroStoreBtnFontSize||"13");
  const storeBtnIconSize = parseInt(values.heroStoreBtnIconSize||"24");
  const storeBtnGap = parseInt(values.heroStoreBtnGap||"14");
  const storeBtnSpacingBelow = parseInt(values.heroStoreBtnSpacingBelow||"0");

  const elemPill = (label: string) => isDragMode ? (
    <div style={{fontSize:"9px",color:"rgba(255,255,255,0.55)",display:"flex",alignItems:"center",gap:"3px",marginBottom:"2px"}}>
      <GripVertical style={{width:"9px",height:"9px"}} />{label}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className="w-full">
      {isDragMode && (
        <div className="mb-2 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10">
          <Move className="w-3.5 h-3.5" />
          وضع السحب مفعّل — اسحب أي عنصر لتغيير موضعه
        </div>
      )}
      <div style={{width:`${baseW*scale}px`,height:`${baseH*scale}px`,position:"relative",overflow:"hidden",margin:"0 auto",borderRadius:"12px",boxShadow:"0 4px 32px rgba(0,0,0,0.18)"}}>
        <div style={{
          width:`${baseW}px`,height:`${baseH}px`,
          transform:`scale(${scale})`,transformOrigin:"top left",
          position:"relative",overflow:"hidden",
          background:hasBg?undefined:"linear-gradient(135deg,hsl(43 80% 57% / 0.2),hsl(var(--background)) 60%)",
        }}>
          {hasBgVideo ? (
            <video src={values.heroVideoUrl} autoPlay muted loop playsInline style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />
          ) : hasBgImage ? (
            <img src={values.heroBackgroundImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />
          ) : null}
          {hasBg && <div style={{position:"absolute",inset:0,background:`rgba(0,0,0,${overlayOpacity})`}} />}

          <div style={{
            position:"absolute",inset:0,
            paddingTop:`${80+ptExtra}px`,paddingBottom:"48px",
            paddingLeft:"48px",paddingRight:"48px",
            display:"flex",flexDirection:"column",
            alignItems:flexDir as any,textAlign:textDir as any,
            direction:"rtl",
          }}>
            {showBadge && (
              <div onMouseDown={startDrag("badge")} style={{
                transform:`translate(${bc.offsetX||0}px,${bc.offsetY||0}px)`,
                marginBottom:`${bc.marginBottom||24}px`,
                display:"inline-flex",alignItems:"center",gap:"6px",
                borderRadius:"100px",padding:"5px 14px",
                background:hasBg?"rgba(255,255,255,0.15)":"hsl(var(--primary)/0.1)",
                color:values.heroBadgeColor||(hasBg?"white":"hsl(var(--primary))"),
                fontSize:`${values.heroBadgeFontSize||14}px`,fontWeight:600,
                ...dragStyle,
              }}>
                {elemPill("badge")}
                <BadgeIcon style={{width:"15px",height:"15px",flexShrink:0}} />
                <span>{values.heroBadgeText||"منصة الخدمات المنزلية الأولى في مصر"}</span>
              </div>
            )}

            <div onMouseDown={startDrag("title")} style={{
              transform:`translate(${tc.offsetX||0}px,${tc.offsetY||0}px)`,
              maxWidth:tc.maxWidth||undefined,marginBottom:"20px",
              ...dragStyle,
            }}>
              {elemPill("العنوان")}
              <div style={{
                fontSize:`${tc.fontSize||60}px`,fontWeight:tc.fontWeight||"900",
                lineHeight:tc.lineHeight||"1.1",
                letterSpacing:`${tc.letterSpacing||"-1"}px`,
                textShadow:tc.textShadow||undefined,opacity:tc.opacity??1,
                fontStyle:tc.fontStyle||undefined,textTransform:(tc.textTransform||"none") as any,
              }}>
                {renderTitle()}
              </div>
            </div>

            <div onMouseDown={startDrag("subtitle")} style={{
              transform:`translate(${sc.offsetX||0}px,${sc.offsetY||0}px)`,
              maxWidth:sc.maxWidth||"672px",marginBottom:"14px",
              ...dragStyle,
            }}>
              {elemPill("العنوان الفرعي")}
              <div style={{
                fontSize:`${sc.fontSize||20}px`,lineHeight:sc.lineHeight||"1.6",
                letterSpacing:`${sc.letterSpacing||"0"}px`,
                color:values.heroSubtitleColor||(hasBg?"rgba(255,255,255,0.82)":undefined),
                opacity:sc.opacity??1,fontWeight:sc.fontWeight||"400",
              }}>
                {values.heroSubtitleAr||"احصل على عروض أسعار من أفضل الفنيين في منطقتك"}
              </div>
            </div>

            {values.heroDescription && (
              <div onMouseDown={startDrag("description")} style={{
                transform:`translate(${dc.offsetX||0}px,${dc.offsetY||0}px)`,
                maxWidth:dc.maxWidth||"576px",marginBottom:"14px",
                fontSize:`${dc.fontSize||16}px`,opacity:dc.opacity??1,
                color:hasBg?"rgba(255,255,255,0.7)":undefined,
                ...dragStyle,
              }}>
                {elemPill("الوصف")}
                {values.heroDescription}
              </div>
            )}

            <div onMouseDown={startDrag("buttons")} style={{
              transform:`translate(${btc.offsetX||0}px,${btc.offsetY||0}px)`,
              marginTop:`${btc.marginTop||40}px`,
              marginBottom: showAppBtns && storeBtnSpacingBelow > 0 ? `${storeBtnSpacingBelow}px` : undefined,
              display:"flex",gap:`${showAppBtns ? storeBtnGap : 14}px`,flexWrap:"wrap",
              justifyContent:flexDir as any,
              ...dragStyle,
            }}>
              {elemPill("الأزرار")}
              {showAppBtns ? (
                <>
                  {showAndroid && (
                    <div style={{display:"inline-flex",alignItems:"center",gap:"10px",
                      padding:`${storeBtnPadV}px ${storeBtnPadH}px`,borderRadius:storeBtnRadius,fontWeight:700,fontSize:`${storeBtnFontSize}px`,cursor:"default",
                      minWidth:storeBtnMinWidth,
                      background:btnBgColor||"#111",color:btnTxtColor||"white",boxShadow:btnShadow||undefined}}>
                      {androidIconUrl ? (
                        <img src={androidIconUrl} alt="" style={{width:`${storeBtnIconSize}px`,height:`${storeBtnIconSize}px`,objectFit:"contain",flexShrink:0}} />
                      ) : (
                        <svg width={storeBtnIconSize} height={storeBtnIconSize} viewBox="0 0 48 48" fill="none" style={{flexShrink:0}}>
                          <path d="M7.2 4.8c-.8.4-1.2 1.2-1.2 2.4v33.6c0 1.2.4 2 1.2 2.4l.2.1 18.8-18.8v-.4L7.4 4.7z" fill="#4FC3F7"/>
                          <path d="M32.3 30.2l-6.1-6.2v-.5l6.1-6.1.1.1 7.2 4.1c2.1 1.2 2.1 3.1 0 4.2l-7.2 4.1z" fill="#FFD740"/>
                          <path d="M32.4 30.1L26.2 24 7.2 43c.7.7 1.8.8 3.1.1l22.1-13z" fill="#F44336"/>
                          <path d="M32.4 17.9L10.3 4.9C9 4.2 7.9 4.3 7.2 5l19 19 6.2-6.1z" fill="#69F0AE"/>
                        </svg>
                      )}
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:"9px",opacity:0.6,lineHeight:1}}>احصل عليه من</div>
                        <div style={{fontWeight:700,fontSize:`${storeBtnFontSize}px`}}>{values.heroAndroidText||"Google Play"}</div>
                      </div>
                    </div>
                  )}
                  {showIos && (
                    <div style={{display:"inline-flex",alignItems:"center",gap:"10px",
                      padding:`${storeBtnPadV}px ${storeBtnPadH}px`,borderRadius:storeBtnRadius,fontWeight:700,fontSize:`${storeBtnFontSize}px`,cursor:"default",
                      minWidth:storeBtnMinWidth,
                      background:btnBgColor||"#111",color:btnTxtColor||"white",boxShadow:btnShadow||undefined}}>
                      {iosIconUrl ? (
                        <img src={iosIconUrl} alt="" style={{width:`${storeBtnIconSize}px`,height:`${storeBtnIconSize}px`,objectFit:"contain",flexShrink:0}} />
                      ) : (
                        <Apple style={{width:`${storeBtnIconSize}px`,height:`${storeBtnIconSize}px`,flexShrink:0}} />
                      )}
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:"9px",opacity:0.6,lineHeight:1}}>تنزيل على</div>
                        <div style={{fontWeight:700,fontSize:`${storeBtnFontSize}px`}}>{values.heroIosText||"App Store"}</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{
                    display:"inline-flex",alignItems:"center",gap:"8px",
                    padding:`${btnPadV}px ${btnPadH}px`,borderRadius:btnRadius,
                    fontWeight:700,fontSize:"15px",cursor:"default",
                    background:btnBgColor||"hsl(var(--primary))",
                    color:btnTxtColor||"white",boxShadow:btnShadow||undefined,
                  }}>
                    أنا عميل — ابدأ الآن
                  </div>
                  <div style={{
                    display:"inline-flex",alignItems:"center",gap:"8px",
                    padding:`${btnPadV}px ${btnPadH}px`,borderRadius:btnRadius,
                    fontWeight:700,fontSize:"15px",cursor:"default",
                    border:"1px solid rgba(255,255,255,0.3)",
                    color:hasBg?"white":undefined,
                    background:hasBg?"rgba(255,255,255,0.1)":"transparent",
                  }}>
                    أنا فني — انضم إلينا
                  </div>
                </>
              )}
            </div>

            {showFeat && (() => {
              const visible = features.filter(f=>f.show!==false);
              if (!visible.length) return null;
              return (
                <div onMouseDown={startDrag("features")} style={{
                  transform:`translate(${fc.offsetX||0}px,${fc.offsetY||0}px)`,
                  marginTop:`${fc.marginTop||56}px`,
                  display:"flex",flexWrap:"wrap",gap:"28px",
                  justifyContent:flexDir as any,
                  color:hasBg?"rgba(255,255,255,0.82)":undefined,
                  ...dragStyle,
                }}>
                  {elemPill("الميزات")}
                  {visible.map((f,i)=>{
                    const FI = ICON_MAP[f.icon]||Shield;
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:"7px",color:f.color||undefined}}>
                        <FI style={{width:"18px",height:"18px",color:"hsl(var(--primary))"}} />
                        <span style={{fontWeight:600,fontSize:"13px"}}>{f.text}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminHero() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useGetCmsSettings({ query: { queryKey: getGetCmsSettingsQueryKey() } });
  const updateMutation = useUpdateCmsSettings();
  const s = settings as any;

  const [features, setFeatures] = useState<FeatureItem[]>(DEFAULT_FEATURES);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [desktopCfg, setDesktopCfg] = useState<ElementsConfig>(DEFAULT_DESKTOP);
  const [mobileCfg, setMobileCfg] = useState<ElementsConfig>(DEFAULT_MOBILE);
  const [activeDevice, setActiveDevice] = useState<"desktop"|"mobile">("desktop");
  const [isDragMode, setIsDragMode] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const activeCfg = activeDevice==="desktop" ? desktopCfg : mobileCfg;
  const setActiveCfg = activeDevice==="desktop" ? setDesktopCfg : setMobileCfg;

  const updateElemCfg = (key: ElemKey, patch: Partial<ElemCfg>) => {
    setActiveCfg(prev => ({ ...prev, [key]: { ...(prev[key]||{}), ...patch } }));
  };

  const form = useForm<HeroFormValues>({
    defaultValues: {
      heroBackgroundImage:"", heroMobileImage:"", heroVideoUrl:"", heroVideoEnabled:"false",
      heroOverlayOpacity:"55",
      heroTitleAr:"", heroTitleColor:"", heroSubtitleAr:"", heroSubtitleColor:"",
      heroDescription:"", heroHighlightWord:"", heroHighlightColor:"",
      heroTextAlign:"center", heroPaddingTop:"0",
      heroBtnBgColor:"", heroBtnTextColor:"", heroBtnBorderRadius:"16",
      heroBtnShadow:"", heroBtnPaddingX:"24", heroBtnPaddingY:"12",
      heroAndroidAppUrl:"", heroAndroidText:"", heroAndroidEnabled:"false", heroAndroidIconUrl:"",
      heroIosAppUrl:"", heroIosText:"", heroIosEnabled:"false", heroIosIconUrl:"",
      statsBackgroundImage:"",
      heroBadgeText:"", heroBadgeShow:"true", heroBadgeIcon:"Zap",
      heroBadgeColor:"", heroBadgeFontSize:"14",
      heroFeaturesShow:"true", heroFeaturesSpacing:"56",
      heroStoreBtnMinWidth:"170", heroStoreBtnFontSize:"13",
      heroStoreBtnIconSize:"24", heroStoreBtnGap:"14",
      heroStoreBtnBorderRadius:"16", heroStoreBtnPaddingX:"18",
      heroStoreBtnPaddingY:"10", heroStoreBtnSpacingBelow:"0",
    },
  });

  useEffect(() => {
    if (!s) return;
    form.reset({
      heroBackgroundImage: s.heroBackgroundImage||"",
      heroMobileImage: s.heroMobileImage||"",
      heroVideoUrl: s.heroVideoUrl||"",
      heroVideoEnabled: s.heroVideoEnabled||"false",
      heroOverlayOpacity: s.heroOverlayOpacity||"55",
      heroTitleAr: s.heroTitleAr||"",
      heroTitleColor: s.heroTitleColor||"",
      heroSubtitleAr: s.heroSubtitleAr||"",
      heroSubtitleColor: s.heroSubtitleColor||"",
      heroDescription: s.heroDescription||"",
      heroHighlightWord: s.heroHighlightWord||"",
      heroHighlightColor: s.heroHighlightColor||"",
      heroTextAlign: s.heroTextAlign||"center",
      heroPaddingTop: s.heroPaddingTop||"0",
      heroBtnBgColor: s.heroBtnBgColor||"",
      heroBtnTextColor: s.heroBtnTextColor||"",
      heroBtnBorderRadius: s.heroBtnBorderRadius||"16",
      heroBtnShadow: s.heroBtnShadow||"",
      heroBtnPaddingX: s.heroBtnPaddingX||"24",
      heroBtnPaddingY: s.heroBtnPaddingY||"12",
      heroAndroidAppUrl: s.heroAndroidAppUrl||"",
      heroAndroidText: s.heroAndroidText||"",
      heroAndroidEnabled: s.heroAndroidEnabled||"false",
      heroAndroidIconUrl: s.heroAndroidIconUrl||"",
      heroIosAppUrl: s.heroIosAppUrl||"",
      heroIosText: s.heroIosText||"",
      heroIosEnabled: s.heroIosEnabled||"false",
      heroIosIconUrl: s.heroIosIconUrl||"",
      statsBackgroundImage: s.statsBackgroundImage||"",
      heroBadgeText: s.heroBadgeText||"",
      heroBadgeShow: s.heroBadgeShow||"true",
      heroBadgeIcon: s.heroBadgeIcon||"Zap",
      heroBadgeColor: s.heroBadgeColor||"",
      heroBadgeFontSize: s.heroBadgeFontSize||"14",
      heroFeaturesShow: s.heroFeaturesShow||"true",
      heroFeaturesSpacing: s.heroFeaturesSpacing||"56",
      heroStoreBtnMinWidth: s.heroStoreBtnMinWidth||"170",
      heroStoreBtnFontSize: s.heroStoreBtnFontSize||"13",
      heroStoreBtnIconSize: s.heroStoreBtnIconSize||"24",
      heroStoreBtnGap: s.heroStoreBtnGap||"14",
      heroStoreBtnBorderRadius: s.heroStoreBtnBorderRadius||"16",
      heroStoreBtnPaddingX: s.heroStoreBtnPaddingX||"18",
      heroStoreBtnPaddingY: s.heroStoreBtnPaddingY||"10",
      heroStoreBtnSpacingBelow: s.heroStoreBtnSpacingBelow||"0",
    });
    try { if (s.heroFeaturesJson) setFeatures(JSON.parse(s.heroFeaturesJson)); } catch {}
    try {
      if (s.heroHighlightsJson) setHighlights(JSON.parse(s.heroHighlightsJson));
      else if (s.heroHighlightWord) setHighlights([{word:s.heroHighlightWord,color:s.heroHighlightColor||""}]);
    } catch {}
    try { if (s.heroElementsConfig) setDesktopCfg(prev => merge(prev, JSON.parse(s.heroElementsConfig))); } catch {}
    try { if (s.heroElementsConfigMobile) setMobileCfg(prev => merge(prev, JSON.parse(s.heroElementsConfigMobile))); } catch {}
  }, [s]);

  const values = form.watch();

  const save = () => {
    const formVals = form.getValues();
    const payload = {
      ...formVals,
      heroFeaturesJson: JSON.stringify(features),
      heroHighlightsJson: JSON.stringify(highlights),
      heroElementsConfig: JSON.stringify(desktopCfg),
      heroElementsConfigMobile: JSON.stringify(mobileCfg),
    };
    updateMutation.mutate(
      { data: payload as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCmsSettingsQueryKey() });
          toast({ title: "✅ تم الحفظ بنجاح" });
        },
        onError: () => toast({ title: "❌ خطأ في الحفظ", variant:"destructive" }),
      }
    );
  };

  const videoEnabled = values.heroVideoEnabled==="true";
  const androidEnabled = values.heroAndroidEnabled==="true";
  const iosEnabled = values.heroIosEnabled==="true";
  const badgeShow = values.heroBadgeShow!=="false";
  const featuresShow = values.heroFeaturesShow!=="false";
  const badgeIcon = values.heroBadgeIcon;
  const textAlign = values.heroTextAlign||"center";
  const btnRadius = values.heroBtnBorderRadius||"16";

  const addFeature = () => setFeatures([...features, {icon:"Shield",text:"ميزة جديدة",show:true,color:""}]);
  const removeFeature = (i: number) => setFeatures(features.filter((_,idx)=>idx!==i));
  const moveUp = (i: number) => { if (i===0) return; const next=[...features]; [next[i-1],next[i]]=[next[i],next[i-1]]; setFeatures(next); };
  const moveDown = (i: number) => { if (i===features.length-1) return; const next=[...features]; [next[i],next[i+1]]=[next[i+1],next[i]]; setFeatures(next); };
  const updateFeature = (i: number, patch: Partial<FeatureItem>) => setFeatures(features.map((f,idx)=>idx===i?{...f,...patch}:f));

  const addHighlight = () => setHighlights([...highlights, {word:"",color:"#f5d400"}]);
  const removeHighlight = (i: number) => setHighlights(highlights.filter((_,idx)=>idx!==i));
  const updateHighlight = (i: number, patch: Partial<Highlight>) => setHighlights(highlights.map((h,idx)=>idx===i?{...h,...patch}:h));

  const elemKeys: ElemKey[] = ["badge","title","subtitle","description","buttons","features"];

  return (
    <div dir="rtl" style={{height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",background:"var(--background)"}}>
      {/* ── Top Bar ── */}
      <div style={{padding: isNarrow ? "6px 10px" : "8px 16px",borderBottom:"1px solid hsl(var(--border))",display:"flex",flexDirection: isNarrow ? "column" : "row",alignItems: isNarrow ? "stretch" : "center",gap: isNarrow ? "6px" : "10px",flexShrink:0,background:"var(--background)"}}>
        {/* Row 1 (always): title + save */}
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span className="font-black text-sm flex-1">🎨 محرر الهيرو المرئي</span>
          <Button type="button" size="sm" onClick={save} disabled={updateMutation.isPending} className="h-7 px-3 font-bold text-xs flex-shrink-0">
            {updateMutation.isPending?"جاري...":"💾 حفظ"}
          </Button>
        </div>

        {/* Row 2 on narrow / inline on wide: device toggle + drag mode */}
        <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
          {/* Device Toggle */}
          <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5 flex-1">
            {(["desktop","mobile"] as const).map((d)=>(
              <button key={d} type="button" onClick={()=>setActiveDevice(d)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors flex-1 justify-center ${activeDevice===d?"bg-background shadow text-foreground":"text-muted-foreground hover:text-foreground"}`}>
                {d==="desktop"?<Monitor className="w-3.5 h-3.5"/>:<Smartphone className="w-3.5 h-3.5"/>}
                <span className="hidden sm:inline">{d==="desktop"?"ديسكتوب":"موبايل"}</span>
                <span className="inline sm:hidden">{d==="desktop"?"كمبيوتر":"موبايل"}</span>
              </button>
            ))}
          </div>

          {/* Drag Mode */}
          <button type="button" onClick={()=>setIsDragMode(!isDragMode)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors border flex-shrink-0 ${isDragMode?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:text-foreground"}`}>
            <Move className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{isDragMode?"✓ وضع السحب":"تفعيل السحب"}</span>
            <span className="inline sm:hidden">{isDragMode?"✓ سحب":"سحب"}</span>
          </button>

          {!isNarrow && (
            <Button type="button" size="sm" onClick={save} disabled={updateMutation.isPending} className="h-8 px-4 font-bold text-xs">
              {updateMutation.isPending?"جاري الحفظ...":"💾 حفظ التغييرات"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Body: Controls + Preview ── */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection: isNarrow ? "column" : "row"}}>
        {/* Left: Controls */}
        <div style={{width: isNarrow ? "100%" : "380px",overflowY:"auto",borderLeft: isNarrow ? "none" : "1px solid hsl(var(--border))",borderBottom: isNarrow ? "1px solid hsl(var(--border))" : "none",flexShrink:0,background:"var(--background)",maxHeight: isNarrow ? "58%" : undefined}}>
          <Form {...form}>
            <form className="p-3">
              <Tabs defaultValue="bg" dir="rtl">
                <TabsList className="grid grid-cols-3 h-auto gap-0.5 p-0.5 mb-3 w-full">
                  {[
                    {v:"bg",icon:<Monitor className="w-3.5 h-3.5"/>,l:"الخلفية"},
                    {v:"content",icon:<Type className="w-3.5 h-3.5"/>,l:"المحتوى"},
                    {v:"typo",icon:<Wand2 className="w-3.5 h-3.5"/>,l:"الطباعة"},
                    {v:"pos",icon:<AlignCenter className="w-3.5 h-3.5"/>,l:"الموضع"},
                    {v:"btns",icon:<Layers className="w-3.5 h-3.5"/>,l:"الأزرار"},
                    {v:"feats",icon:<LayoutGrid className="w-3.5 h-3.5"/>,l:"الميزات"},
                  ].map(({v,icon,l})=>(
                    <TabsTrigger key={v} value={v} className="flex flex-col gap-0.5 py-1.5 text-[10px] h-auto">
                      {icon}{l}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ── Tab: Background ── */}
                <TabsContent value="bg" className="space-y-3 mt-0">
                  <Sect title="🖼️ صورة الخلفية">
                    <FormField control={form.control} name="heroBackgroundImage" render={({field})=>(
                      <MediaUploadField label="صورة الخلفية (ديسكتوب)" hint="1920×700px" value={field.value} onChange={field.onChange} accept="image/*" testId="upload-hero-bg" />
                    )} />
                    <FormField control={form.control} name="heroMobileImage" render={({field})=>(
                      <MediaUploadField label="صورة الخلفية (موبايل)" hint="1080×1600px" value={field.value} onChange={field.onChange} accept="image/*" testId="upload-hero-mobile" />
                    )} />
                  </Sect>
                  <Sect title="🎬 فيديو الخلفية">
                    <Toggle checked={videoEnabled} onChange={(v)=>form.setValue("heroVideoEnabled",v?"true":"false")} label="تفعيل الفيديو بدلاً من الصورة" />
                    {videoEnabled && (
                      <FormField control={form.control} name="heroVideoUrl" render={({field})=>(
                        <MediaUploadField label="فيديو الخلفية (MP4)" hint="الحد الأقصى 30 MB" value={field.value} onChange={field.onChange} accept="video/mp4,video/webm" testId="upload-hero-video" type="video" />
                      )} />
                    )}
                  </Sect>
                  <Sect title="🌑 الطبقة المعتمة">
                    <SliderField label="نسبة التعتيم" value={parseInt(values.heroOverlayOpacity||"55")} min={0} max={90} step={5} unit="%" onChange={(v)=>form.setValue("heroOverlayOpacity",String(v))} />
                  </Sect>
                  <Sect title="📊 خلفية قسم الإحصائيات" open={false}>
                    <FormField control={form.control} name="statsBackgroundImage" render={({field})=>(
                      <MediaUploadField label="صورة الخلفية" hint="1920×600px" value={field.value} onChange={field.onChange} accept="image/*" testId="upload-stats-bg" />
                    )} />
                  </Sect>
                </TabsContent>

                {/* ── Tab: Content ── */}
                <TabsContent value="content" className="space-y-3 mt-0">
                  <Sect title="✍️ النصوص الرئيسية">
                    <FormField control={form.control} name="heroTitleAr" render={({field})=>(
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">العنوان الرئيسي</FormLabel>
                        <p className="text-[11px] text-muted-foreground">اكتب \n لفصل السطور</p>
                        <FormControl><Textarea rows={2} placeholder="احصل على خدمة احترافية مع فنشها" className="text-sm resize-none" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="heroSubtitleAr" render={({field})=>(
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">العنوان الفرعي</FormLabel>
                        <FormControl><Textarea rows={2} placeholder="احصل على عروض أسعار من أفضل الفنيين..." className="text-sm resize-none" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="heroDescription" render={({field})=>(
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">وصف إضافي (اختياري)</FormLabel>
                        <FormControl><Textarea rows={2} placeholder="نص تفصيلي أسفل العنوان..." className="text-sm resize-none" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">محاذاة النصوص</Label>
                      <div className="flex gap-1.5">
                        {[
                          {v:"center",icon:<AlignCenter className="w-3.5 h-3.5"/>,l:"وسط"},
                          {v:"start",icon:<AlignCenter className="w-3.5 h-3.5 rotate-180"/>,l:"يمين"},
                          {v:"end",icon:<AlignCenter className="w-3.5 h-3.5"/>,l:"يسار"},
                        ].map(({v,icon,l})=>(
                          <button key={v} type="button" onClick={()=>form.setValue("heroTextAlign",v)}
                            className={`flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors ${textAlign===v?"bg-primary text-primary-foreground":"bg-secondary text-secondary-foreground"}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FormField control={form.control} name="heroTitleColor" render={({field})=>(
                        <ColorInput label="لون العنوان الرئيسي" hint="اتركه فارغاً للون التلقائي" value={field.value} onChange={field.onChange} />
                      )} />
                    </div>
                    <div>
                      <FormField control={form.control} name="heroSubtitleColor" render={({field})=>(
                        <ColorInput label="لون العنوان الفرعي" value={field.value} onChange={field.onChange} />
                      )} />
                    </div>
                    <SliderField label="حشوة علوية إضافية" value={parseInt(values.heroPaddingTop||"0")} min={0} max={200} step={8} unit="px" onChange={(v)=>form.setValue("heroPaddingTop",String(v))} />
                  </Sect>

                  <Sect title="🏷️ شارة الهيرو (Badge)">
                    <Toggle checked={badgeShow} onChange={(v)=>form.setValue("heroBadgeShow",v?"true":"false")} label="إظهار الشارة" />
                    {badgeShow && (<>
                      <FormField control={form.control} name="heroBadgeText" render={({field})=>(
                        <FormItem><FormLabel className="text-xs font-semibold">نص الشارة</FormLabel>
                        <FormControl><Input placeholder="منصة الخدمات المنزلية الأولى في مصر" className="text-xs h-8" {...field} /></FormControl></FormItem>
                      )} />
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">أيقونة الشارة</Label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {ICON_OPTIONS.map(({value,label,icon:Icon})=>(
                            <button key={value} type="button" onClick={()=>form.setValue("heroBadgeIcon",value)}
                              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${badgeIcon===value?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:border-primary/50"}`}>
                              <Icon className="w-3.5 h-3.5"/>{label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <FormField control={form.control} name="heroBadgeColor" render={({field})=>(
                        <ColorInput label="لون الشارة" hint="فارغ = تلقائي" value={field.value} onChange={field.onChange} />
                      )} />
                      <SliderField label="حجم خط الشارة" value={parseInt(values.heroBadgeFontSize||"14")} min={10} max={24} unit="px" onChange={(v)=>form.setValue("heroBadgeFontSize",String(v))} />
                    </>)}
                  </Sect>

                  <Sect title="✨ تمييز كلمات متعددة">
                    <p className="text-[11px] text-muted-foreground">يمكنك تمييز أكثر من كلمة في العنوان بألوان مختلفة</p>
                    <div className="space-y-2">
                      {highlights.map((h,i)=>(
                        <div key={i} className="flex items-center gap-2 p-2 bg-secondary/20 rounded-lg">
                          <input type="color" value={h.color||"#f5d400"} onChange={(e)=>updateHighlight(i,{color:e.target.value})}
                            className="w-7 h-7 rounded cursor-pointer border border-border p-0.5 flex-shrink-0" />
                          <Input value={h.word} onChange={(e)=>updateHighlight(i,{word:e.target.value})}
                            placeholder="اكتب الكلمة هنا" className="flex-1 text-xs h-7" />
                          <button type="button" onClick={()=>removeHighlight(i)} className="text-destructive hover:bg-destructive/10 p-1 rounded flex-shrink-0">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addHighlight} className="w-full h-7 text-xs">
                      <Plus className="w-3 h-3 ml-1" /> إضافة كلمة مميزة
                    </Button>
                  </Sect>
                </TabsContent>

                {/* ── Tab: Typography ── */}
                <TabsContent value="typo" className="space-y-3 mt-0">
                  <p className="text-[11px] text-muted-foreground px-1">
                    التغييرات تنطبق على <strong>{activeDevice==="desktop"?"الديسكتوب":"الموبايل"}</strong>
                  </p>
                  {(["title","subtitle","description","badge"] as ElemKey[]).map((k)=>(
                    <Sect key={k} title={ELEM_LABELS[k]} open={k==="title"}>
                      <TypoControls cfg={activeCfg[k]||{}} onChange={(p)=>updateElemCfg(k,p)} />
                    </Sect>
                  ))}
                </TabsContent>

                {/* ── Tab: Position ── */}
                <TabsContent value="pos" className="space-y-3 mt-0">
                  <p className="text-[11px] text-muted-foreground px-1">
                    التغييرات تنطبق على <strong>{activeDevice==="desktop"?"الديسكتوب":"الموبايل"}</strong>
                  </p>
                  {elemKeys.map((k)=>(
                    <Sect key={k} title={ELEM_LABELS[k]} open={false}>
                      <PosControls cfg={activeCfg[k]||{}} onChange={(p)=>updateElemCfg(k,p)} />
                    </Sect>
                  ))}
                  <div className="p-3 bg-secondary/20 rounded-xl text-[11px] text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">💡 نصيحة</p>
                    <p>فعّل "وضع السحب" من الأعلى ثم اسحب أي عنصر مباشرة في المعاينة لتغيير موضعه</p>
                  </div>
                </TabsContent>

                {/* ── Tab: Buttons ── */}
                <TabsContent value="btns" className="space-y-3 mt-0">
                  <Sect title="🎨 تصميم أزرار التسجيل">
                    <FormField control={form.control} name="heroBtnBgColor" render={({field})=>(
                      <ColorInput label="لون خلفية الزر الأساسي" hint="فارغ = لون الموقع" value={field.value} onChange={field.onChange} />
                    )} />
                    <FormField control={form.control} name="heroBtnTextColor" render={({field})=>(
                      <ColorInput label="لون نص الزر" value={field.value} onChange={field.onChange} />
                    )} />
                    <SliderField label="حواف الزر (border-radius)" value={parseInt(btnRadius)} min={0} max={40} step={2} unit="px" onChange={(v)=>form.setValue("heroBtnBorderRadius",String(v))} />
                    <SliderField label="حشوة أفقية (Padding X)" value={parseInt(values.heroBtnPaddingX||"24")} min={8} max={80} step={4} unit="px" onChange={(v)=>form.setValue("heroBtnPaddingX",String(v))} />
                    <SliderField label="حشوة رأسية (Padding Y)" value={parseInt(values.heroBtnPaddingY||"12")} min={4} max={40} step={2} unit="px" onChange={(v)=>form.setValue("heroBtnPaddingY",String(v))} />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">الظل (box-shadow)</Label>
                      <Input value={values.heroBtnShadow} onChange={(e)=>form.setValue("heroBtnShadow",e.target.value)}
                        placeholder="0 4px 20px rgba(0,0,0,0.3)" className="text-xs h-7 font-mono" />
                    </div>
                    <div className="flex justify-center">
                      <div style={{
                        display:"inline-flex",alignItems:"center",padding:`${values.heroBtnPaddingY||"12"}px ${values.heroBtnPaddingX||"24"}px`,
                        borderRadius:`${btnRadius}px`,fontWeight:700,fontSize:"14px",
                        background:values.heroBtnBgColor||"hsl(var(--primary))",
                        color:values.heroBtnTextColor||"white",
                        boxShadow:values.heroBtnShadow||undefined,
                      }}>
                        معاينة الزر
                      </div>
                    </div>
                  </Sect>

                  <Sect title="📱 أزرار تطبيقات المتجر">
                    <div className="space-y-3 p-3 bg-secondary/20 rounded-xl border border-border">
                      <div className="flex items-center gap-2 font-semibold text-xs">
                        <div className="w-4 h-4 rounded bg-green-600 flex items-center justify-center text-white text-[9px] font-black">G</div>
                        Google Play
                      </div>
                      <Toggle checked={androidEnabled} onChange={(v)=>form.setValue("heroAndroidEnabled",v?"true":"false")} label="تفعيل زر Google Play" />
                      {androidEnabled && (<>
                        <FormField control={form.control} name="heroAndroidAppUrl" render={({field})=>(
                          <FormItem><FormLabel className="text-xs">رابط Google Play</FormLabel><FormControl><Input placeholder="https://play.google.com/..." className="text-xs h-7" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="heroAndroidText" render={({field})=>(
                          <FormItem><FormLabel className="text-xs">نص الزر</FormLabel><FormControl><Input placeholder="Google Play" className="text-xs h-7" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="heroAndroidIconUrl" render={({field})=>(
                          <MediaUploadField label="أيقونة مخصصة (اختياري)" hint="PNG/SVG مقاس 64×64" value={field.value} onChange={field.onChange} accept="image/*" testId="upload-android-icon" />
                        )} />
                      </>)}
                    </div>

                    <div className="space-y-3 p-3 bg-secondary/20 rounded-xl border border-border">
                      <div className="flex items-center gap-2 font-semibold text-xs">
                        <Apple className="w-4 h-4" /> App Store
                      </div>
                      <Toggle checked={iosEnabled} onChange={(v)=>form.setValue("heroIosEnabled",v?"true":"false")} label="تفعيل زر App Store" />
                      {iosEnabled && (<>
                        <FormField control={form.control} name="heroIosAppUrl" render={({field})=>(
                          <FormItem><FormLabel className="text-xs">رابط App Store</FormLabel><FormControl><Input placeholder="https://apps.apple.com/..." className="text-xs h-7" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="heroIosText" render={({field})=>(
                          <FormItem><FormLabel className="text-xs">نص الزر</FormLabel><FormControl><Input placeholder="App Store" className="text-xs h-7" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="heroIosIconUrl" render={({field})=>(
                          <MediaUploadField label="أيقونة مخصصة (اختياري)" hint="PNG/SVG مقاس 64×64" value={field.value} onChange={field.onChange} accept="image/*" testId="upload-ios-icon" />
                        )} />
                      </>)}
                    </div>
                  </Sect>

                  <Sect title="📐 أبعاد أزرار المتجر">
                    <SliderField label="الحد الأدنى للعرض" value={parseInt(values.heroStoreBtnMinWidth||"170")} min={120} max={320} step={10} unit="px" onChange={(v)=>form.setValue("heroStoreBtnMinWidth",String(v))} />
                    <SliderField label="حجم خط النص" value={parseInt(values.heroStoreBtnFontSize||"13")} min={10} max={20} unit="px" onChange={(v)=>form.setValue("heroStoreBtnFontSize",String(v))} />
                    <SliderField label="حجم الأيقونة" value={parseInt(values.heroStoreBtnIconSize||"24")} min={16} max={40} unit="px" onChange={(v)=>form.setValue("heroStoreBtnIconSize",String(v))} />
                    <SliderField label="المسافة بين الزرين" value={parseInt(values.heroStoreBtnGap||"14")} min={4} max={48} step={2} unit="px" onChange={(v)=>form.setValue("heroStoreBtnGap",String(v))} />
                    <SliderField label="حواف الزر" value={parseInt(values.heroStoreBtnBorderRadius||"16")} min={0} max={40} step={2} unit="px" onChange={(v)=>form.setValue("heroStoreBtnBorderRadius",String(v))} />
                    <SliderField label="حشوة أفقية داخلية" value={parseInt(values.heroStoreBtnPaddingX||"18")} min={8} max={60} step={2} unit="px" onChange={(v)=>form.setValue("heroStoreBtnPaddingX",String(v))} />
                    <SliderField label="حشوة رأسية داخلية" value={parseInt(values.heroStoreBtnPaddingY||"10")} min={4} max={32} step={2} unit="px" onChange={(v)=>form.setValue("heroStoreBtnPaddingY",String(v))} />
                    <SliderField label="مسافة أسفل الأزرار" value={parseInt(values.heroStoreBtnSpacingBelow||"0")} min={0} max={80} step={4} unit="px" onChange={(v)=>form.setValue("heroStoreBtnSpacingBelow",String(v))} />
                  </Sect>
                </TabsContent>

                {/* ── Tab: Features ── */}
                <TabsContent value="feats" className="space-y-3 mt-0">
                  <Sect title="⭐ قائمة الميزات">
                    <Toggle checked={featuresShow} onChange={(v)=>form.setValue("heroFeaturesShow",v?"true":"false")} label="إظهار قائمة الميزات" />
                    {featuresShow && (<>
                      <SliderField label="المسافة العلوية" value={parseInt(values.heroFeaturesSpacing||"56")} min={16} max={120} step={8} unit="px" onChange={(v)=>{
                        form.setValue("heroFeaturesSpacing",String(v));
                        setDesktopCfg(prev=>({...prev,features:{...(prev.features||{}),marginTop:v}}));
                        setMobileCfg(prev=>({...prev,features:{...(prev.features||{}),marginTop:v}}));
                      }} />
                      <div className="space-y-2">
                        {features.map((feat,i)=>{
                          const FIcon=ICON_MAP[feat.icon]||Shield;
                          return (
                            <div key={i} className={`p-3 rounded-xl border-2 ${feat.show?"border-border":"border-dashed border-border/40 opacity-60"} bg-secondary/10 space-y-2`}>
                              <div className="flex items-center gap-2">
                                <FIcon className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="flex-1 font-semibold text-xs truncate">{feat.text||"ميزة"}</span>
                                <div className="flex gap-0.5">
                                  <button type="button" onClick={()=>moveUp(i)} disabled={i===0} className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary disabled:opacity-30"><ChevronUp className="w-3 h-3"/></button>
                                  <button type="button" onClick={()=>moveDown(i)} disabled={i===features.length-1} className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary disabled:opacity-30"><ChevronDown className="w-3 h-3"/></button>
                                  <button type="button" onClick={()=>removeFeature(i)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive"><Trash2 className="w-3 h-3"/></button>
                                </div>
                              </div>
                              <Toggle checked={feat.show} onChange={(v)=>updateFeature(i,{show:v})} label="إظهار" />
                              <Input value={feat.text} onChange={(e)=>updateFeature(i,{text:e.target.value})} placeholder="نص الميزة" className="text-xs h-7" />
                              <div className="grid grid-cols-4 gap-1">
                                {ICON_OPTIONS.map(({value,label,icon:Icon})=>(
                                  <button key={value} type="button" onClick={()=>updateFeature(i,{icon:value})}
                                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded border text-[10px] transition-all ${feat.icon===value?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>
                                    <Icon className="w-3 h-3"/>{label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <input type="color" value={feat.color||"#888888"} onChange={(e)=>updateFeature(i,{color:e.target.value})}
                                  className="w-7 h-7 rounded cursor-pointer border border-border p-0.5 flex-shrink-0" />
                                <Input value={feat.color} onChange={(e)=>updateFeature(i,{color:e.target.value})}
                                  placeholder="لون (اختياري)" className="flex-1 text-xs h-7 font-mono" />
                                {feat.color && <button type="button" onClick={()=>updateFeature(i,{color:""})} className="text-xs text-muted-foreground hover:text-destructive">✕</button>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={addFeature} className="w-full h-7 text-xs">
                        <Plus className="w-3 h-3 ml-1"/>إضافة ميزة
                      </Button>
                    </>)}
                  </Sect>
                </TabsContent>
              </Tabs>
            </form>
          </Form>
        </div>

        {/* Right: Preview */}
        <div style={{flex:1,overflowY:"auto",background:"hsl(var(--secondary)/0.3)",padding:"16px",display:"flex",flexDirection:"column",gap:"12px"}}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" />
              معاينة مباشرة — {activeDevice==="desktop"?"ديسكتوب (1200px)":"موبايل (390px)"}
            </span>
            <span className="text-[10px] text-muted-foreground">كل تغيير يظهر فوراً قبل الحفظ</span>
          </div>
          <HeroPreview
            values={values}
            elemCfg={activeCfg}
            highlights={highlights}
            features={features}
            isDragMode={isDragMode}
            isDesktop={activeDevice==="desktop"}
            onElemDrag={(key,absX,absY)=>updateElemCfg(key,{offsetX:absX,offsetY:absY})}
          />
        </div>
      </div>
    </div>
  );
}
