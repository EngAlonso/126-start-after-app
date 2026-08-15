# 12 — RTL Guide

---

## Why RTL is Non-Trivial in This App

The app is fully Arabic (RTL). React Native's `I18nManager.forceRTL(true)` (set in `app/_layout.tsx`) works on **native builds only**. Expo Web ignores it. Every screen must also explicitly declare `direction: 'rtl'` on its root `View`.

---

## The Rule: Explicit `direction: 'rtl'` on Every Screen Root

```tsx
// Every screen — add this to the outermost View
<View style={{ flex: 1, backgroundColor: colors.background, direction: 'rtl' as any }}>
  {/* screen content */}
</View>
```

The `as any` cast is required because TypeScript's `ViewStyle` type sometimes flags `direction` as unknown. This is safe — React Native supports it at runtime.

**Do NOT rely only on `I18nManager.forceRTL(true)`.** That call is in `_layout.tsx` for native, but Expo Web ignores it completely — screens will render LTR on web without the explicit `direction`.

---

## Flex Row Child Ordering

With `direction: 'rtl'`, flex-row children are laid out right-to-left. The **first child** appears on the **physical right** (RTL leading side).

| Desired Layout | Child Order |
|---|---|
| Name on RIGHT + Time on LEFT | `<Name /> <Time />` |
| Icon on RIGHT + Text on LEFT | `<Icon /> <Text />` |
| Avatar on RIGHT + Content on LEFT | `<Avatar /> <Content />` |

This is the **opposite** of what you'd write for LTR layouts. Do not add `flexDirection: 'row-reverse'` — with `direction: 'rtl'` already set, a normal `row` flows correctly.

---

## Component-Level `direction: 'rtl'`

For components used inside screens (like `RequestCard`, conversation rows, notification rows), apply `direction: 'rtl'` to the **flex-row container**, not the outermost wrapper:

```tsx
// Conversation row example
<View style={styles.rowContainer}>                     {/* outermost — no direction needed */}
  <View style={{ flexDirection: 'row', direction: 'rtl' as any }}>
    <Text style={styles.name}>{otherUser.name}</Text>   {/* RIGHT */}
    <Text style={styles.time}>{formattedTime}</Text>    {/* LEFT */}
  </View>
</View>
```

---

## RTL-Correct Patterns in Existing Screens

### Conversations List (`app/messages/index.tsx`)
```
topRow:    name (RIGHT/first)  |  time (LEFT/last)
bottomRow: preview (RIGHT/first)  |  unread badge (LEFT/last)
```

### Notifications (`app/notifications.tsx`)
```
row: icon (RIGHT/first)  |  content stack (LEFT)
```
Root `View` has `direction: 'rtl'` explicitly.

### Request Cards (`components/RequestCard.tsx`)
RTL is applied on the internal flex-row. `cardBg` is set to `outerBg` (opaque) — do not use a transparent tint (causes Android white rectangle — see `11_UI_DESIGN_RULES.md`).

---

## I18nManager Setup (`app/_layout.tsx`)

```ts
import { I18nManager } from 'react-native';

// At module level — runs once on native startup
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
```

This is already in `_layout.tsx`. **Do not remove or move it.** It sets the native RTL flag that affects text alignment, icon mirroring, and scroll indicators on iOS/Android. On Expo Web it is a no-op.

---

## Text Alignment

With `direction: 'rtl'` on the container, `textAlign` defaults to right-aligned for Arabic text. You usually don't need to set `textAlign: 'right'` explicitly — the `direction` handles it.

Exception: if a `Text` element sits outside a `direction: 'rtl'` container (e.g., in a modal or overlay that has its own independent style), you may need to add `textAlign: 'right'` manually.

---

## Adding a New Screen — Checklist

1. Wrap the screen in:
   ```tsx
   <View style={{ flex: 1, backgroundColor: colors.background, direction: 'rtl' as any }}>
   ```
2. Order flex-row children: **right-side content first**, left-side content last.
3. Do NOT add `flexDirection: 'row-reverse'` — it double-flips with `direction: 'rtl'`.
4. Test on **both native and Expo Web** — I18nManager effects are invisible on web.
5. Use `TAB_BAR_HEIGHT` / `TECH_TAB_BAR_HEIGHT` for bottom padding (see `11_UI_DESIGN_RULES.md`).

---

## `RequestInfoCard` — `showPhone` Prop

`RequestInfoCard` is a sub-component within `app/requests/[id].tsx`. It does **not** close over the parent's render-time locals — it is a separate function declaration. The phone-privacy boolean must be passed as a prop:

```tsx
// In RequestDetailScreen:
const showPhone = isCustomer || isSelectedTech;

// In JSX:
<RequestInfoCard request={request} colors={colors} showPhone={showPhone} />

// In component definition:
function RequestInfoCard({
  request,
  colors,
  showPhone,
}: {
  request: ServiceRequest;
  colors: Colors;
  showPhone: boolean;
}) { ... }
```

Non-selected technicians see `'••••••••'` for phone and `'—'` for name.

---

## Tab Navigation Deep-Link with Initial Scroll

Technician requests tabs use `FlatList` with `initialScrollIndex`:

```tsx
// Navigate to "done" tab (index 2)
router.push({ pathname: '/(technician)/requests', params: { initialTab: '2' } });

// In the screen:
const { initialTab } = useLocalSearchParams<{ initialTab?: string }>();
const initTabIdx = initialTab ? parseInt(initialTab, 10) : 0;
const [activeTab, setActiveTab] = useState(initTabIdx);

// FlatList:
<FlatList
  initialScrollIndex={initTabIdx}
  getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
  ...
/>
```

The `initialScrollIndex` approach avoids the `setTimeout` race condition from the previous `scrollToIndex` pattern.

---

*Last updated: July 2026*
