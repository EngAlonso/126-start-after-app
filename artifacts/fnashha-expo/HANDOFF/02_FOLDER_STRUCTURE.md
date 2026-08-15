# 02 — Folder Structure

---

## Root of `artifacts/fnashha-expo/`

```
artifacts/fnashha-expo/
├── app/                      ← Expo Router file-based routes (screens)
├── components/               ← Shared UI components
├── contexts/                 ← React Context providers
├── hooks/                    ← Custom hooks (API, auth, theme, SSE)
├── lib/                      ← Utility functions
├── constants/                ← Static constants (colors, brand)
├── types/                    ← TypeScript interfaces
├── assets/                   ← Images, fonts, icons
├── android/                  ← Android native project (auto-generated)
├── utils/                    ← Additional utility helpers
├── scripts/                  ← Build/deploy helper scripts
├── server/                   ← (if present) local dev server
├── HANDOFF/                  ← ← ← This knowledge base
├── FNASHHA_EXPO_HANDOFF.md   ← Original handoff doc (do not delete)
├── app.config.js             ← Expo dynamic config
├── app.json                  ← Expo static config
├── eas.json                  ← EAS Build config
├── babel.config.js           ← Babel (with reanimated plugin)
├── metro.config.js           ← Metro bundler config
├── tsconfig.json             ← TypeScript config
├── package.json              ← Dependencies
├── google-services.json      ← FCM Android config
└── GoogleService-Info.plist  ← APNs iOS config
```

---

## `app/` — Screen Routes

```
app/
├── _layout.tsx               ← ROOT: AuthProvider, ThemeProvider, I18nManager, fonts
├── index.tsx                 ← Guest home (service browsing + banners)
├── login.tsx                 ← Login form (both roles)
├── register.tsx              ← Customer registration
├── register-tech.tsx         ← Technician registration
├── register-select.tsx       ← Role selection before register
├── intro.tsx                 ← Intro slideshow (CMS-driven, skippable)
├── +not-found.tsx            ← 404 screen
│
├── services/
│   ├── index.tsx             ← Services browse/search list
│   └── [id].tsx              ← Request form (submit a new request for a service)
│
├── requests/
│   └── [id].tsx              ← Request detail (≈2300 lines; customer + technician views)
│
├── messages/
│   ├── index.tsx             ← Conversations list
│   └── [requestId].tsx       ← Chat screen (single conversation)
│
├── notifications.tsx         ← Notification list (all types)
├── tech-ratings.tsx          ← Technician ratings page (for logged-in tech)
├── technician-profile/
│   └── [techId].tsx          ← Public technician profile (viewable by customers)
├── edit-profile.tsx          ← Edit profile (customer + technician, same screen)
├── customer-wallet.tsx       ← Customer loyalty coins wallet
├── referral.tsx              ← Referral program screen
├── support/
│   ├── index.tsx             ← Support tickets list
│   ├── new.tsx               ← Create support ticket
│   └── [id].tsx              ← Support ticket detail
│
├── (customer)/               ← Customer-only tab group
│   ├── _layout.tsx           ← Customer tabs layout (suppresses default tab bar)
│   ├── index.tsx             ← Customer home dashboard
│   ├── my-page.tsx           ← Active requests + loyalty summary
│   ├── requests.tsx          ← Customer requests list (tabbed: all/pending/active/done)
│   └── account.tsx           ← Customer account settings + theme toggle
│
└── (technician)/             ← Technician-only tab group
    ├── _layout.tsx           ← Technician tabs layout (suppresses default tab bar)
    ├── index.tsx             ← Technician home dashboard
    ├── my-page.tsx           ← Stats + completed requests (≈590 lines)
    ├── requests.tsx          ← Technician requests (3 tabs: pending/active/done)
    ├── wallet.tsx            ← Technician points wallet
    └── account.tsx           ← Technician profile + hero card + menu
```

---

## `components/` — Shared Components

| File | Purpose |
|---|---|
| `AppHeader.tsx` | Role-aware top header: back button, logo, notification badge, nav shortcuts |
| `AppLogo.tsx` | Brand logo component |
| `AppTextInput.tsx` | Styled text input with label, icon, error state |
| `BannerSlider.tsx` | Auto-scrolling banner carousel (CMS-driven) |
| `CoinsCard.tsx` | Customer loyalty coin balance display |
| `ConfirmDialog.tsx` | Cross-platform confirm/alert modal (replaces `Alert.alert`) |
| `CustomerTabBar.tsx` | Bottom tab bar for customers; exports `TAB_BAR_HEIGHT` |
| `TechnicianTabBar.tsx` | Bottom tab bar for technicians; exports `TECH_TAB_BAR_HEIGHT` |
| `CustomTabBar.tsx` | *(legacy, may be unused)* |
| `PersistentTabBar.tsx` | Wraps Customer + Technician tab bars; mounted in root layout |
| `EmptyState.tsx` | Consistent empty / error / loading-error screen |
| `ErrorBoundary.tsx` | React error boundary wrapper |
| `ErrorFallback.tsx` | UI shown when ErrorBoundary catches |
| `HowToRequest.tsx` | Tutorial card shown to new customers |
| `KeyboardAwareScrollViewCompat.tsx` | Cross-platform scroll + keyboard avoidance |
| `MessageTick.tsx` | Chat message delivery tick (`✓` / `✓✓`) |
| `ReferralCard.tsx` | Referral program invitation card |
| `RequestCard.tsx` | Request summary card; amber/blue accent strips; two-layer elevation |
| `ScreenHeader.tsx` | Simple header for stack screens (back button + title) |
| `SearchableSelect.tsx` | Searchable dropdown/modal picker |
| `ServiceCard.tsx` | Service category card for browse screens |
| `SkeletonCard.tsx` | Loading skeletons: `SkeletonList`, `RequestCardSkeletonList` |
| `StarRating.tsx` | Read-only star rating display |

---

## `contexts/`

| File | Purpose |
|---|---|
| `AuthContext.tsx` | `AppUser` state, tokens, login/logout, 401 refresh handler |
| `ThemeContext.tsx` | `isDark` / `setDark`, persisted to AsyncStorage |

---

## `hooks/`

| File | Purpose |
|---|---|
| `api-base.ts` | `apiUrl(path)` — resolves full URL from env or app.config |
| `useApi.ts` | `apiFetch`, `apiUpload`, `useAuthedFetch` |
| `useCmsSettings.ts` | Fetches CMS key-value config from backend |
| `useColors.ts` | Returns `colors` object for current theme |
| `useConfirm.ts` | Hook for `ConfirmDialog` imperative API |
| `usePushNotifications.ts` | Push notification permissions + token management |
| `useRefetchOnFocus.ts` | Re-fetches queries when screen gains focus |
| `useSse.ts` | SSE real-time event stream (web: EventSource; native: XHR) |

---

## `lib/`

| File | Purpose |
|---|---|
| `fmt.ts` | `fmtNumber`, `fmtDate` formatters (Arabic locale) |
| `notificationRouter.ts` | Maps notification type + relatedId → Expo Router path |
| `queryClient.ts` | TanStack Query client singleton configuration |

---

## `constants/`

| File | Purpose |
|---|---|
| `brand.ts` | App name, slug, scheme, storage keys |
| `colors.ts` | Full light/dark color palette |
| `intro.ts` | Default intro slideshow slides (overridden by CMS) |

---

## `types/`

The primary type file is `types/index.ts` (or similar). Key interfaces:

| Type | Description |
|---|---|
| `AppUser` | Logged-in user: `id, role, fullName, mobile, profileImage, status, ...` |
| `ServiceRequest` | Full request shape including status, technician info, addresses |
| `RequestStatus` | Union of all status strings |
| `Offer` | A technician's offer on a request |
| `Message` | Chat message: text / image / audio types |
| `Conversation` | Conversation summary for the list screen |
| `SupportTicket` | Support ticket |
| `LoyaltyWallet` | Customer coin wallet |
| `PointsBalance` | Technician points: `balance, reservedPoints, available` |
| `PointTransaction` | Single point ledger entry: `type, amount, createdAt, ...` |
| `Notification` | Push/SSE notification record |

---

*Last updated: July 2026 — migrated from FNASHHA_EXPO_HANDOFF.md + exploration*
