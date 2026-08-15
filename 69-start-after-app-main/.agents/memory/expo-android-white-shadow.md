---
name: Expo Android white shadow / white rectangle fix
description: How to eliminate the white inner rectangle that appears behind elevated gradient cards on Android in the Expo app.
---

## The Rule
Any `View` with `elevation > 0` MUST have an explicit `backgroundColor`. If it wraps a `LinearGradient`, use the gradient's first color (e.g. `'#FFFBEB'`) as the `backgroundColor` on the outer View.

## Why
Android's hardware elevation shadow layer is drawn *behind* the View's own background. When `backgroundColor` is transparent (default) the shadow layer bleeds through as a white rectangle.

## Two patterns to use

### Pattern A — Plain outer View wraps LinearGradient
```tsx
// Outer View: has elevation + backgroundColor
<View style={[styles.cardOuter, { backgroundColor: '#FFFBEB' }]}>
  {/* Inner LinearGradient: handles overflow clipping and decorative circles */}
  <LinearGradient style={styles.cardInner}>…</LinearGradient>
</View>
```
`cardOuter` → elevation, borderRadius, shadow*, **no overflow:'hidden'**  
`cardInner` → borderRadius, padding, **overflow:'hidden'** (clips decorative circles)

### Pattern B — Inline in JSX when theme is dynamic
```tsx
style={[styles.wrapper, { shadowColor: theme.shadowColor, backgroundColor: theme.gradStart }]}
```

## What to NEVER do
- `elevation` + `overflow: 'hidden'` on the **same** View — this creates the white rectangle directly.
- `elevation` on a View with no `backgroundColor` that wraps a LinearGradient.

## Files fixed (as of July 2026)
- `components/HowToRequest.tsx` → `howSectionOuter` (removed overflow:hidden, added dark/light backgroundColor in JSX)
- `app/(customer)/account.tsx` → `profileOuter` (backgroundColor '#FFFBEB' in StyleSheet)
- `app/(customer)/my-page.tsx` → `emptyCard` (backgroundColor '#FFFBEB' in StyleSheet)
- `app/tech-ratings.tsx` → split `summaryCard` into `summaryCardOuter` (elevation + backgroundColor) + inner LinearGradient (overflow:hidden, no elevation)
- `app/(technician)/index.tsx` → `recentStyles.wrapper` (backgroundColor: theme.gradStart in JSX)
- `app/(technician)/my-page.tsx` → `cardStyles.wrapper` (backgroundColor: theme.gradStart in JSX)
