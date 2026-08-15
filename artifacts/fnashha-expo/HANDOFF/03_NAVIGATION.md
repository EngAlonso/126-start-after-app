# 03 — Navigation

---

## Router: Expo Router (File-Based)

All screens are defined by their file path in `app/`. Expo Router v4 uses React Navigation under the hood with a file-system API.

---

## Root Layout (`app/_layout.tsx`)

The root layout wraps everything in the provider stack and implements the **AuthGate**.

### Provider Order (outermost → innermost)
```
QueryClientProvider
  SafeAreaProvider
    ThemeProvider
      KeyboardProvider
        AuthProvider
          AuthGate  ← decides which root to show
            PersistentTabBar
            <Slot />
```

### AuthGate Logic
```
if (!fontsLoaded)           → show SplashScreen
if (!user)                  → guest stack (index, login, register, etc.)
if (user.role === 'customer') → (customer)/ tab group
if (user.role === 'technician') → (technician)/ tab group
```

### I18nManager (RTL — native only)
```ts
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
```
Set at module level in `_layout.tsx`. Only affects native builds. For Expo Web, use `direction: 'rtl'` explicitly in each screen. See `12_RTL_GUIDE.md`.

---

## Route Groups

Expo Router route groups use `(name)/` folders — they don't appear in the URL path.

| Group | File | Active For |
|---|---|---|
| `(customer)/` | `_layout.tsx` | Logged-in customers only |
| `(technician)/` | `_layout.tsx` | Logged-in technicians only |

Both group layouts suppress the default Expo tab bar (`tabBar={() => null}`) in favor of the custom `PersistentTabBar` rendered in the root layout.

---

## Customer Tab Structure

Rendered by `CustomerTabBar`. 4 tabs using IndexedStack pattern:

| Index | Route | Icon | Label |
|---|---|---|---|
| 0 | `(customer)/index` | home | الرئيسية |
| 1 | `(customer)/my-page` | layers | صفحتي |
| 2 | `(customer)/requests` | clipboard | طلباتي |
| 3 | `(customer)/account` | user | حسابي |

---

## Technician Tab Structure

Rendered by `TechnicianTabBar`. 4 tabs + center logo button:

| Index | Route | Icon | Label |
|---|---|---|---|
| 0 | `(technician)/index` | home | الرئيسية |
| 1 | `(technician)/my-page` | layers | صفحتي |
| 2 | `(technician)/requests` | clipboard | الطلبات |
| 3 | `(technician)/wallet` | pocket | محفظتي |
| 4 | `(technician)/account` | user | حسابي |

Logo button in the center is decorative (scrolls to top or opens home).

---

## Stack (Deep-Link) Screens

These screens are pushed on top of the tab structure via `router.push(...)`:

| Route | Screen |
|---|---|
| `/services/[id]` | Request submission form for a service |
| `/requests/[id]` | Full request detail (customer + technician) |
| `/messages/[requestId]` | Chat screen |
| `/messages` | Conversations list |
| `/notifications` | Notification list |
| `/tech-ratings` | Technician ratings (own ratings) |
| `/technician-profile/[techId]` | Public technician profile |
| `/edit-profile` | Edit profile (both roles) |
| `/customer-wallet` | Customer loyalty wallet |
| `/referral` | Referral program |
| `/support` | Support tickets list |
| `/support/new` | Create ticket |
| `/support/[id]` | Ticket detail |

---

## Navigation Patterns

### Push a screen
```ts
import { router } from 'expo-router';
router.push('/requests/42');
router.push({ pathname: '/requests/[id]', params: { id: 42 } });
```

### Navigate to a specific technician tab
```ts
// Navigate to Completed tab (index 2) in technician requests list
router.push({ pathname: '/(technician)/requests', params: { initialTab: '2' } });
```
The screen reads `initialTab` from `useLocalSearchParams()` and uses `useState(initTabIdx)` + `initialScrollIndex` on the pager FlatList. No flash, no setTimeout needed.

### Tab indices (technician requests)
| Index | Key | Label |
|---|---|---|
| 0 | `pending` | تحتاج عرض |
| 1 | `active` | النشطة |
| 2 | `done` | المنتهية |

### Customer requests filter tabs
| Key | Actual statuses included |
|---|---|
| `all` | all statuses |
| `pending` | `pending`, `offers_received` |
| `in_progress` | `technician_selected`, `in_progress`, `offers_received`, `waiting_approval` |
| `completed` | `completed` |
| `cancelled` | `cancelled_by_customer`, `cancelled_by_technician`, `cancelled_by_admin` |

### Go back
```ts
router.back();
```

### Replace (no back)
```ts
router.replace('/login');
```

---

## Guest Routes (no auth required)

- `/` (index.tsx) — services browse
- `/login`
- `/register` (customer)
- `/register-select`
- `/register-tech` (technician)
- `/intro`

---

## Notification Deep-Link Routing

`lib/notificationRouter.ts` → `getRouteFromDbNotification(type, relatedId, role, title)` maps notification types to screen paths. Used in `notifications.tsx` and `_layout.tsx` for push notification taps.

| Notification Type | Route |
|---|---|
| `new_request` | `/(technician)/requests` |
| `new_offer` | `/requests/[relatedId]` |
| `technician_selected` | `/requests/[relatedId]` |
| `new_message` | `/messages/[relatedId]` |
| `review_received` | `/tech-ratings` |
| `announcement` | (no navigation) |
| `status_change` "تقييم جديد" | `/tech-ratings` |
| `price_adjustment` | `/requests/[relatedId]` |
| `support_reply` | `/support/[relatedId]` |
| `points_added` / `points_deducted` | `/(technician)/wallet` |
| `platform_credit_added` | `/customer-wallet` |

---

## Tab Bar Heights (Important for Padding)

Always use these constants for `paddingBottom` in screens that sit inside a tab:

```ts
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';

// Correct paddingBottom for content inside tabs:
contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
```

---

*Last updated: July 2026*
