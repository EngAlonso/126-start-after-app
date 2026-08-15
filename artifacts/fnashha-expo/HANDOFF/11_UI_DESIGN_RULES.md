# 11 — UI Design Rules

---

## Brand Colors

Primary palette is in `constants/colors.ts` and accessed via `useColors()`.

| Token | Light | Dark |
|---|---|---|
| `primary` | `#E9B73A` (amber) | `#E9B73A` |
| `background` | `#F8F6F0` | `#0F1117` |
| `card` | `#FFFFFF` | `#1A1E27` |
| `foreground` | `#1A1A1A` | `#F1F1F1` |
| `mutedForeground` | `#6B7280` | `#9CA3AF` |
| `border` | `#E5E7EB` | `#2D3340` |

Always call `useColors()` — never hardcode `#F8F6F0` or other palette values directly in component code.

---

## Typography

Font family: **Cairo** (Arabic). Loaded via `expo-font` in `app/_layout.tsx`.

| Weight | Value |
|---|---|
| 400 | Regular |
| 500 | Medium |
| 600 | SemiBold |
| 700 | Bold |

Always specify `fontFamily: 'Cairo_600SemiBold'` (or the appropriate weight) — never rely on system font fallbacks.

---

## Icons

`@expo/vector-icons` → **Feather** icon set. Usage:

```ts
import { Feather } from '@expo/vector-icons';
<Feather name="check-circle" size={20} color={colors.primary} />
```

Do NOT mix icon sets (e.g. MaterialIcons, Ionicons) within the same screen for consistency.

---

## Dark Mode

Theme is managed by `ThemeContext`. Access current theme:

```ts
const { isDark } = useTheme();
const colors = useColors();
```

`isDark` is persisted to `AsyncStorage` under the key `fnashha_theme_mode`.

When writing conditional styles, use `isDark` as the switch — never call `useColorScheme()` from React Native directly, as that would ignore the user's in-app toggle.

---

## ⚠️ Android Elevation / White Rectangle Bug

**Rule:** Any `View` with `elevation > 0` MUST have an explicit `backgroundColor`. If it wraps a `LinearGradient`, set the outer `View`'s `backgroundColor` to match the gradient's first color.

### Two-Layer Pattern (Required)

```tsx
// CORRECT — outer has elevation + backgroundColor, inner clips overflow
<View style={[styles.cardOuter, { backgroundColor: '#FFFBEB' }]}>
  <LinearGradient style={styles.cardInner} colors={['#FFFBEB', '#FEF9EC']}>
    {/* content */}
  </LinearGradient>
</View>
```

```ts
// StyleSheet
cardOuter: {
  elevation: 4,
  borderRadius: 16,
  // NO overflow: 'hidden' here
},
cardInner: {
  borderRadius: 16,
  padding: 16,
  overflow: 'hidden',  // clips decorative circles — only on the inner layer
},
```

### What NOT to Do

```tsx
// ❌ WRONG — elevation + overflow:'hidden' on the same View = white rectangle
<View style={{ elevation: 4, overflow: 'hidden', borderRadius: 16 }}>
  ...
</View>

// ❌ WRONG — elevation with no backgroundColor wrapping a LinearGradient
<View style={{ elevation: 4 }}>
  <LinearGradient ...>...</LinearGradient>
</View>
```

### Specific Files Fixed (July 2026)

| File | Element Fixed |
|---|---|
| `components/HowToRequest.tsx` | `howSectionOuter` — removed `overflow:hidden`, added themed `backgroundColor` |
| `app/(customer)/account.tsx` | `profileOuter` — `backgroundColor: '#FFFBEB'` |
| `app/(customer)/my-page.tsx` | `emptyCard` — `backgroundColor: '#FFFBEB'` |
| `app/tech-ratings.tsx` | Split `summaryCard` into outer (elevation+bg) + inner LinearGradient |
| `app/(technician)/index.tsx` | `recentStyles.wrapper` — `backgroundColor: theme.gradStart` |
| `app/(technician)/my-page.tsx` | `cardStyles.wrapper` — `backgroundColor: theme.gradStart` |

---

## Dark Mode — LinearGradient Cards

When a card gradient must be readable in both themes, use `isDark`-aware color pairs. Example from the technician wallet screen:

```ts
// Available-points card gradient
colors={isDark
  ? (lowPoints ? ['#2D1E00', '#1A1000'] : ['#1A1500', '#201C00'])
  : (lowPoints ? ['#FEF3C7', '#FFFBEB'] : ['#FEF9EC', '#FFFDF5'])}

// Text inside the card
color: isDark ? '#E9B73A' : '#92400E'   // balance number
color: isDark ? '#D97706' : colors.mutedForeground  // subtitle
```

Without this, light-colored text (`colors.foreground`) on a light-yellow gradient becomes invisible in dark mode.

---

## RequestCard — Alternating Accent Colors

`RequestCard` accepts an `accentIndex` prop for alternating amber / blue stripe colors:

```ts
// Even index → amber accent; odd index → blue accent
accentIndex={index}
```

`cardBg = outerBg` (opaque, same as the outer background) — this eliminates Android white-rectangle artifacts. Do NOT use a semi-transparent tint for `cardBg`.

---

## Skeleton / Loading States

Use `SkeletonList` and `RequestCardSkeletonList` from `components/SkeletonCard.tsx` for loading states. Never use `ActivityIndicator` as a standalone loading replacement on list screens.

```ts
import { SkeletonList, RequestCardSkeletonList } from '@/components/SkeletonCard';

if (isLoading) return <SkeletonList count={5} />;
```

---

## Empty States

Use `EmptyState` from `components/EmptyState.tsx` — never write custom inline empty-state UI.

```ts
import EmptyState from '@/components/EmptyState';

if (!data?.length) return <EmptyState message="لا توجد طلبات" />;
```

---

## Tab Bar Padding

All scroll content inside a tab screen must include padding to clear the custom tab bar:

```ts
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

// contentContainerStyle of ScrollView / FlatList:
contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
```

---

## ConfirmDialog

Use `ConfirmDialog` + `useConfirm()` instead of `Alert.alert()` for user confirmations — ensures a consistent, cross-platform modal design.

```ts
const { confirm, ConfirmDialog } = useConfirm();

// In component:
const ok = await confirm({ title: 'تأكيد', message: 'هل أنت متأكد؟' });
if (ok) { /* proceed */ }

// In JSX:
<ConfirmDialog />
```

---

*Last updated: July 2026*
