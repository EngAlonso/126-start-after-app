---
name: Fnashha visual hero builder
description: Hero builder admin page, element config structure, and the critical rendering pattern for the public landing page.
---

## Admin builder
- Path: `/admin/hero` (artifacts/fnashha/src/pages/admin/hero.tsx)
- Elementor-style: 380px control panel + live preview (HeroPreview component)
- 6 tabs: background / content / typography / position / buttons / features
- Saves to CMS keys: `heroElementsConfig` (desktop) and `heroElementsConfigMobile` (mobile) as JSON strings
- Related keys in CMS_KEYS whitelist (api-server/src/routes/cms.ts): heroElementsConfig, heroElementsConfigMobile, heroHighlightsJson, heroAndroidIconUrl, heroIosIconUrl, heroBtnShadow, heroBtnPaddingX, heroBtnPaddingY

## ElemCfg structure
Each element (badge, title, subtitle, description, buttons, features) has: offsetX, offsetY, marginTop, marginBottom, fontSize, fontWeight, lineHeight, letterSpacing, textShadow, opacity, fontStyle, textTransform, maxWidth, zIndex.

## CRITICAL: Public homepage rendering pattern
**Problem**: Applying typography via `getTypoStyle()` on a `<h1>` that also has Tailwind classes (e.g. `text-5xl font-black leading-tight`) causes the typography styles to be ignored. This is a Tailwind v4 (`@import "tailwindcss"` + `@tailwindcss/vite`) interaction where class-based utilities interfere with inline styles on the same element.

**Second bug (silent ReferenceError)**: The `elemCfg` IIFE inside the hero section used `isMobile`, but the `Landing` component never called `useIsMobile()`. The variable existed only in sibling components. Every render threw `ReferenceError: isMobile is not defined`, the catch block silently returned `HERO_ELEM_DEFAULTS`, and all saved values were discarded. Fix: add `const isMobile = useIsMobile();` at the top of the `Landing` component body (hooks must be at the top level, not inside IIFEs). Always check the `catch` block of elemCfg: it swallows any exception silently.

**Fix**: Mirror the admin preview's TWO-LAYER structure exactly:
1. Outer `div` with `transform: translate(offsetX, offsetY)` and margin/maxWidth — NO Tailwind classes
2. Inner `div` with all typography as pure inline styles (fontSize, fontWeight, lineHeight, letterSpacing, etc.) — NO Tailwind classes

**Why**: The admin preview uses plain `div` wrappers with zero Tailwind classes. Applying styles on elements that also carry Tailwind utility classes causes invisible conflicts in Tailwind v4, even though inline styles technically win in the CSS cascade. The structural separation eliminates any possible interference.

**Pattern in landing.tsx** (lines ~560-790 in the hero IIFE):
- Content container: `position: absolute, inset: 0, display: flex, flexDirection: column` (matches preview)
- Each element: outer div (transform + margins) → inner div (font styles) — no className on either
- `elemCfg` built by merging HERO_ELEM_DEFAULTS with parsed heroElementsConfig JSON

## elemCfg building in landing.tsx
```tsx
const elemCfg = (() => {
  const desktopRaw = JSON.parse(s?.heroElementsConfig || "{}");
  const mobileRaw  = JSON.parse(s?.heroElementsConfigMobile || "{}");
  const raw = isMobile ? merge(desktopRaw, mobileRaw) : desktopRaw;
  // merge with HERO_ELEM_DEFAULTS for robustness
  return Object.fromEntries(Object.keys(HERO_ELEM_DEFAULTS).map(k => [k, { ...HERO_ELEM_DEFAULTS[k], ...(raw[k] || {}) }]));
})();
```
