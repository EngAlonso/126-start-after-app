---
name: Fnashha Expo RTL direction fix
description: Explicit direction:'rtl' required on every screen root; I18nManager is no-op on Expo Web; key structural patterns for RTL-safe components.
---

## Rule
`I18nManager.forceRTL(true)` in `_layout.tsx` only works on native. For RTL to work on Expo Web and to be explicit on native, every screen root View must include `direction: 'rtl'` in its style (cast as `any` since TypeScript `ViewStyle` sometimes flags it).

**Why:** Expo Web ignores `I18nManager`; without explicit `direction`, flex rows remain LTR on web, breaking the Arabic layout.

**How to apply:** Add `direction: 'rtl' as any` to the outermost `<View style={{ flex: 1, backgroundColor: ... }}>` of each screen. For components used inside screens (like RequestCard), apply it to the flex-row container, not the outermost wrapper.

## RequestInfoCard / showPhone pattern
`RequestInfoCard` is a sub-component of `RequestDetailScreen`. Any derived boolean from the outer screen (e.g., `showPhone = isCustomer || isSelectedTech`) must be passed as a prop:
- Call site: `<RequestInfoCard request={request} colors={colors} showPhone={showPhone} />`
- Definition: `function RequestInfoCard({ request, colors, showPhone }: { ...; showPhone: boolean })`

**Why:** Sub-component functions in the same file don't close over the parent component's render-time locals; they are separate function declarations.

## RequestCard white rectangle
`cardBg = outerBg` (opaque, same as outer) eliminates Android white-rectangle artifacts. The previous semi-transparent tint (`accent.bg + '08'`) was imperceptible but caused artifacts in some Android versions. Always declare `outerBg` BEFORE `cardBg` in the variable order.

## RTL flex-row child order
With `direction: 'rtl'`, the first child in a `flexDirection: 'row'` appears on the RIGHT (physical right = leading in RTL). To get name RIGHT + time LEFT: put name first, time last. To get icon RIGHT + text LEFT: put icon first, text last.

## requests.tsx initialScrollIndex
FlatList `initialScrollIndex={initTabIdx}` + `useState(initTabIdx)` replaces the old `useEffect+setTimeout+scrollToIndex` pattern. Requires `getItemLayout` on the FlatList (already present). The FlatList only mounts when `pageHeight > 0`, so `initialScrollIndex` applies on first render — no flash, no race condition.
