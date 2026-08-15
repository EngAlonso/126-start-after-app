/**
 * IntroSlideshowOverlay — PWA (React)
 * ====================================
 *
 * Two-layer intro slideshow:
 *
 * Layer 1 (bottom) — background: fetched from GET /api/intro-background.
 *   Never changes, never fades, never moves.
 *   Managed entirely from the admin panel → no code changes needed.
 *
 * Layer 2 (top) — characters: transparent PNG images from GET /api/intro-screens.
 *   Animate one after another with smooth overlapping cross-fade transitions.
 *
 * === SHARED INTRO SPEC (mirrors Flutter: mobile/lib/features/intro/) =========
 * TOTAL_DURATION  = 3 000 ms  (always, regardless of image count)
 * Per-image time  : displayMs = round(TOTAL_DURATION / N)
 * Per-image fade  : fadeMs    = clamp(round(displayMs × 0.25), 30, 200)
 * Per-image hold  : holdMs    = displayMs − fadeMs
 *
 * Behaviour:
 *  • If ≥1 enabled intro image  → show background + animate characters.
 *                                 Do NOT show logo splash.
 *  • If 0 enabled intro images  → show logo splash, then fade into the app.
 *  • Background URL and character images both fetched from the API on every
 *    startup; cached in localStorage for offline resilience.
 *  • Also waits for auth-context hydration to avoid a white flash.
 * =============================================================================
 *
 * === CHARACTER ANIMATION SPEC ================================================
 * Each character PNG goes through three visual phases:
 *
 *  entering  opacity 0→1, scale 0.97→1.0 (CSS transition, duration = fadeMs)
 *  visible   opacity 1,   gentle pulse scale 1.0↔1.03 (CSS keyframe animation)
 *  leaving   opacity 1→0, scale 1.0→0.97 (CSS transition, duration = fadeMs)
 *
 * Transitions OVERLAP: the next character starts entering ≈ OVERLAP_MS before
 * the current character finishes leaving, so there is always something visible.
 * The scale animation is applied ONLY to the <img> element; the positioning
 * wrapper keeps transform: translateX(-50%) unchanged so layout is stable.
 * =============================================================================
 */

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";

// ── Shared spec constants ─────────────────────────────────────────────────────
const TOTAL_DURATION_MS = 3_000;
const OVERLAY_FADE_MS   = 200;
const CHAR_CACHE_KEY    = "fnashha_intro_urls_v1";
const BG_CACHE_KEY      = "fnashha_intro_bg_v1";
const SIZE_CACHE_KEY    = "fnashha_intro_size_v1";
const POS_CACHE_KEY     = "fnashha_intro_pos_v1";
const DEFAULT_CHAR_SIZE = 40; // % of viewport height
const DEFAULT_CHAR_POS  = 50; // vertical position 0=top 50=center 100=bottom

// ── Animation constants ───────────────────────────────────────────────────────
/** How many ms before the current character finishes fading out the next one starts fading in. */
const OVERLAP_MS = 250;
/** Duration of the subtle pulse cycle (ms). */
const PULSE_DURATION_MS = 900;
/**
 * Each image requires one browser paint frame (~16 ms) before its CSS
 * transition can fire.  This overhead is subtracted from the final hold so
 * the total slideshow duration always equals TOTAL_DURATION_MS exactly.
 */
const FRAME_MS = 16;

function computeTiming(n: number) {
  const displayMs = Math.round(TOTAL_DURATION_MS / Math.max(n, 1));
  const fadeMs    = Math.min(Math.max(Math.round(displayMs * 0.25), 30), 200);
  return { displayMs, fadeMs, holdMs: displayMs - fadeMs };
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadCharCache(): string[] {
  try {
    const raw = localStorage.getItem(CHAR_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch { return []; }
}
function saveCharCache(urls: string[]) {
  try { localStorage.setItem(CHAR_CACHE_KEY, JSON.stringify(urls)); } catch {}
}
function loadBgCache(): string | null {
  try { return localStorage.getItem(BG_CACHE_KEY) || null; } catch { return null; }
}
function saveBgCache(url: string) {
  try { localStorage.setItem(BG_CACHE_KEY, url); } catch {}
}
function clearBgCache() {
  try { localStorage.removeItem(BG_CACHE_KEY); } catch {}
}
function loadSizeCache(): number {
  try {
    const raw = localStorage.getItem(SIZE_CACHE_KEY);
    return raw ? Math.max(10, Math.min(100, parseInt(raw, 10))) : DEFAULT_CHAR_SIZE;
  } catch { return DEFAULT_CHAR_SIZE; }
}
function saveSizeCache(size: number) {
  try { localStorage.setItem(SIZE_CACHE_KEY, String(size)); } catch {}
}
function loadPosCache(): number {
  try {
    const raw = localStorage.getItem(POS_CACHE_KEY);
    return raw ? Math.max(0, Math.min(100, parseInt(raw, 10))) : DEFAULT_CHAR_POS;
  } catch { return DEFAULT_CHAR_POS; }
}
function savePosCache(pos: number) {
  try { localStorage.setItem(POS_CACHE_KEY, String(pos)); } catch {}
}

// ── API fetchers ──────────────────────────────────────────────────────────────
async function fetchIntroUrls(): Promise<string[]> {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const resp = await fetch(`${base}/api/intro-screens`, { signal: AbortSignal.timeout(8_000) });
  if (!resp.ok) return [];
  const data = await resp.json() as Array<{ imageUrl?: string; image_url?: string }>;
  return data.map((d) => d.imageUrl ?? d.image_url ?? "").filter(Boolean);
}

interface IntroSettings {
  bgUrl:             string | null;
  characterSize:     number; // % of viewport height, 10–100
  characterPosition: number; // vertical position 0=top 50=center 100=bottom
}

async function fetchIntroSettings(): Promise<IntroSettings> {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const resp = await fetch(`${base}/api/intro-background`, { signal: AbortSignal.timeout(8_000) });
  if (!resp.ok) return { bgUrl: null, characterSize: DEFAULT_CHAR_SIZE, characterPosition: DEFAULT_CHAR_POS };
  const data = await resp.json() as {
    backgroundUrl?:     string | null;
    characterSize?:     number;
    characterPosition?: number;
  };
  return {
    bgUrl:             data.backgroundUrl || null,
    characterSize:     typeof data.characterSize     === "number"
                         ? Math.max(10, Math.min(100, data.characterSize))
                         : DEFAULT_CHAR_SIZE,
    characterPosition: typeof data.characterPosition === "number"
                         ? Math.max(0, Math.min(100, data.characterPosition))
                         : DEFAULT_CHAR_POS,
  };
}

// ── Layer state machine ───────────────────────────────────────────────────────
/**
 * Each character lives as an independent layer so two can be on-screen at once
 * during the overlap window.
 *
 * phase lifecycle:  'pre' → 'entering' → 'visible' → 'leaving' → (removed)
 *
 *  'pre'      Added to DOM at opacity 0 / scale 0.97 before the animation fires.
 *             One rAF is needed for the browser to paint it before we change phase.
 *  'entering' CSS transition fires: opacity 0→1, scale 0.97→1
 *  'visible'  CSS keyframe pulse runs: scale gently oscillates 1.0↔1.03
 *  'leaving'  CSS transition fires: opacity 1→0, scale 1→0.97
 */
type LayerPhase = "pre" | "entering" | "visible" | "leaving";
type Layer = { id: number; url: string; phase: LayerPhase };

// ── Component ─────────────────────────────────────────────────────────────────
export default function IntroSlideshowOverlay() {
  const { isHydrating } = useAuth();

  const [urls, setUrls]                     = useState<string[]>([]);
  const [bgUrl, setBgUrl]                   = useState<string | null>(null);
  const [charSize, setCharSize]             = useState<number>(() => loadSizeCache());
  const [charPos, setCharPos]               = useState<number>(() => loadPosCache());
  const [layers, setLayers]                 = useState<Layer[]>([]);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [mounted, setMounted]               = useState(true);
  const [fetchDone, setFetchDone]           = useState(false);

  const hydrationDoneRef = useRef(false);
  const allShownRef      = useRef(false);
  const dismissedRef     = useRef(false);
  const idRef            = useRef(0);

  const tryDismiss = () => {
    if (dismissedRef.current)      return;
    if (!hydrationDoneRef.current) return;
    if (!allShownRef.current)      return;
    dismissedRef.current = true;
    setOverlayVisible(false);
    setTimeout(() => setMounted(false), OVERLAY_FADE_MS + 50);
  };

  // Gate 1 — auth hydration
  useEffect(() => {
    if (!isHydrating) {
      hydrationDoneRef.current = true;
      tryDismiss();
    }
  }, [isHydrating]);

  // Fetch both character images and background in parallel.
  // Cache-first for characters (fast paint); background cached for offline.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cachedChars = loadCharCache();
      if (cachedChars.length > 0 && !cancelled) setUrls(cachedChars);
      const cachedBg = loadBgCache();
      if (cachedBg && !cancelled) setBgUrl(cachedBg);

      const [freshChars, freshSettings] = await Promise.allSettled([
        fetchIntroUrls(),
        fetchIntroSettings(),
      ]);

      if (!cancelled) {
        if (freshChars.status === "fulfilled" && freshChars.value.length > 0) {
          setUrls(freshChars.value);
          saveCharCache(freshChars.value);
        }
        if (freshSettings.status === "fulfilled") {
          const { bgUrl: bg, characterSize: sz, characterPosition: pos } = freshSettings.value;
          setBgUrl(bg);
          setCharSize(sz);
          setCharPos(pos);
          saveSizeCache(sz);
          savePosCache(pos);
          if (bg) saveBgCache(bg); else clearBgCache();
        }
        setFetchDone(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Gate 2 — slideshow
  useEffect(() => {
    if (!fetchDone) return;

    if (urls.length === 0) {
      allShownRef.current = true;
      tryDismiss();
      return;
    }

    let alive = true;
    allShownRef.current = false;
    setLayers([]);

    const { fadeMs, holdMs } = computeTiming(urls.length);
    // Clamp overlap so it never exceeds the fade duration.
    const overlapMs = Math.min(OVERLAP_MS, Math.floor(fadeMs * 0.8));

    // Helper: add a new layer at 'pre' phase, return its id.
    function addLayer(url: string): number {
      const id = ++idRef.current;
      setLayers((prev) => [...prev, { id, url, phase: "pre" }]);
      return id;
    }

    // Helper: transition a layer to a new phase.
    function setPhase(id: number, phase: LayerPhase) {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, phase } : l)),
      );
    }

    // Helper: remove a fully-faded layer from the DOM.
    function removeLayer(id: number) {
      setLayers((prev) => prev.filter((l) => l.id !== id));
    }

    async function runSlideshow() {
      if (!alive) return;

      // ── Show first character ──────────────────────────────────────────────
      const firstId = addLayer(urls[0]);
      // One rAF so the browser paints the 'pre' state before the transition fires.
      await raf();
      if (!alive) return;
      setPhase(firstId, "entering");
      await delay(fadeMs);
      if (!alive) return;
      setPhase(firstId, "visible");

      // ── Cycle through remaining characters ────────────────────────────────
      let currentId = firstId;

      for (let i = 1; i < urls.length; i++) {
        if (!alive) return;

        // Hold the current character.  We subtract overlapMs here so that the
        // total per-image slot stays at displayMs even with the overlap window.
        await delay(holdMs - overlapMs);
        if (!alive) return;

        // Pre-load the next character at opacity 0.
        const nextId = addLayer(urls[i]);
        await raf();
        if (!alive) return;

        // Start BOTH transitions simultaneously:
        //   current  → leaving  (fade out + zoom out)
        //   next     → entering (fade in  + zoom in)
        setPhase(currentId, "leaving");
        setPhase(nextId, "entering");

        // Wait for the full cross-fade to complete.
        await delay(fadeMs + overlapMs);
        if (!alive) return;

        // Remove the old character from the DOM.
        removeLayer(currentId);
        // Activate the pulse on the new character.
        setPhase(nextId, "visible");

        currentId = nextId;
      }

      // Hold the last character for the remaining budget so the total runtime
      // equals TOTAL_DURATION_MS.  Each of the N images consumed one FRAME_MS
      // paint delay; we recover that debt here in one lump sum.
      const tailMs = Math.max(0, holdMs - urls.length * FRAME_MS);
      await delay(tailMs);
      if (!alive) return;

      // All characters shown — dismiss gates take over.
      allShownRef.current = true;
      tryDismiss();
    }

    runSlideshow();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDone, urls]);

  if (!mounted) return null;

  const hasImages      = urls.length > 0;
  const { fadeMs }     = hasImages ? computeTiming(urls.length) : { fadeMs: 200 };
  const base           = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const showLogoSplash = fetchDone && !hasImages;

  return (
    <div
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        9999,
        background:    "#000000",
        opacity:       overlayVisible ? 1 : 0,
        transition:    `opacity ${OVERLAY_FADE_MS}ms ease-in-out`,
        pointerEvents: overlayVisible ? "all" : "none",
        overflow:      "hidden",
      }}
    >
      {/* ── Injected keyframes for the character pulse animation ─────────── */}
      <style>{`
        @keyframes intro-char-pulse {
          0%,  100% { transform: scale(1.00); }
          50%        { transform: scale(1.03); }
        }
      `}</style>

      {/* ── Logo splash — only when no character images are configured ──── */}
      {showLogoSplash && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 24,
        }}>
          <img
            src={`${base}/assets/logo.png`}
            alt="فنشها"
            style={{ width: 120, height: 120, objectFit: "contain" }}
          />
        </div>
      )}

      {/* ── Layer 1 — fixed background (admin-managed, never fades) ──────── */}
      {hasImages && bgUrl && (
        <img
          src={bgUrl}
          alt=""
          aria-hidden
          style={{
            position:       "absolute",
            inset:          0,
            width:          "100%",
            height:         "100%",
            objectFit:      "cover",
            objectPosition: "center",
            opacity:        1,
          }}
        />
      )}

      {/* ── Layer 2 — animated character PNGs (one per active layer) ─────── */}
      {/*                                                                       */}
      {/* Each layer is absolutely positioned at the same spot so they stack.  */}
      {/* Opacity and enter/exit scale live on the WRAPPER (CSS transition).   */}
      {/* The pulse animation lives on the IMG (CSS keyframe) so the wrapper   */}
      {/* transform: translateX(-50%) is never disrupted.                      */}
      {hasImages && layers.map((layer) => {
        const { opacity, wrapperScale } = phaseToStyle(layer.phase);
        const isPulsing = layer.phase === "visible";

        return (
          <div
            key={layer.id}
            style={{
              position:   "absolute",
              left:       "50%",
              top:        `calc(${charPos}vh - ${charSize / 2}vh)`,
              transform:  `translateX(-50%) scale(${wrapperScale})`,
              opacity,
              transition: `opacity ${fadeMs}ms ease-in-out, transform ${fadeMs}ms ease-in-out`,
              // Pulse override: when leaving, CSS transition takes priority over
              // the animation because we also set transform here. On 'visible'
              // we reset transform to "none" and let the keyframe run freely.
              willChange: "opacity, transform",
            }}
          >
            <img
              src={layer.url}
              alt=""
              aria-hidden
              style={{
                height:    `${charSize}vh`,
                width:     "auto",
                maxWidth:  "90vw",
                objectFit: "contain",
                // Pulse animation only when fully visible.
                animation: isPulsing
                  ? `intro-char-pulse ${PULSE_DURATION_MS}ms ease-in-out infinite`
                  : "none",
                display:   "block",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a layer phase to its CSS opacity + wrapper scale (for enter/exit zoom). */
function phaseToStyle(phase: LayerPhase): { opacity: number; wrapperScale: number } {
  switch (phase) {
    case "pre":      return { opacity: 0, wrapperScale: 0.97 };
    case "entering": return { opacity: 1, wrapperScale: 1.00 };
    case "visible":  return { opacity: 1, wrapperScale: 1.00 };
    case "leaving":  return { opacity: 0, wrapperScale: 0.97 };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait one animation frame so the browser commits the current render. */
function raf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
