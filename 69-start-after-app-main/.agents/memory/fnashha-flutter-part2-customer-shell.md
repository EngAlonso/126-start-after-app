---
name: Fnashha Flutter Part 2 — Customer App Shell
description: Architecture of the redesigned customer home shell with persistent AppBar, IndexedStack tabs, center FAB bottom nav, My Page dashboard, Referral screen, Requests tab, and My Account tab.
---

## What was rebuilt

The old `CustomerHomeScreen` (single scroll + push navigation) was replaced with a shell architecture.

### CustomerAppBar (`customer_app_bar.dart`)
- `PreferredSizeWidget` — goes in `Scaffold.appBar`, not a scrollable widget
- RTL-aware: `leading` = RIGHT = Fnashha logo; `actions` = LEFT = Messages + Notifications
- Center `title` = `_CoinsChip` (taps → `/wallet`); badge on notifications from `unreadNotificationsCountProvider`
- `onLogoTap` callback lets the parent shell snap back to tab 0

### CustomerBottomNavBar (`home_bottom_nav_bar.dart`)
- Replaced old 5-item `HomeNavDestination` enum with new `CustomerNavTab` enum (4 values: home, myPage, requests, myAccount)
- Old `HomeNavDestination` aliased as `typedef HomeNavDestination = CustomerNavTab` for backward compat
- Centre slot is a `_CenterFab` (gold circle, scale press animation) → navigates to `/create-request`
- Badge support via `Map<CustomerNavTab, int> badgeCounts`

### CustomerHomeScreen shell (`customer_home_screen.dart`)
- `_selectedIndex` int (0–3) drives `IndexedStack` + `CustomerNavTab.values[index]`
- SSE anchored via `ref.watch(notificationsSseProvider)` in `build`
- Index 0: `_HomeContent` — banners + services (6 items via `maxItems`) + HowItWorks
- Index 1: `MyPageTab`, 2: `RequestsTab`, 3: `MyAccountTab`

### MyPageTab (`my_page_tab.dart`)
- Greeting from `authControllerProvider` → `Authenticated.user.fullName` (no extra network call)
- Banner: reuses `HeroBannerCarousel`
- `_WalletCard` + `_ReferralCard` in a Row, each a `_DashCard` with press-scale animation
- Referral reward is dynamic: computed from `referralProvider.statistics` (totalRewardsEarned / completed); coin name from `walletProvider`

### RequestsTab (`requests_tab.dart`)
- 4 `Tab`s: مفتوحة / قيد التنفيذ / مكتملة / مغلقة
- Maps to `RequestFilter.open / inProgress / completed / cancelled`
- Tab change calls `myRequestsProvider.notifier.setFilter(...)` — data is re-fetched, not cached
- Infinite scroll via `_scrollCtrl.addListener` + `loadMore()`
- Service names from `servicesProvider` (in `catalog_providers.dart`)

### MyAccountTab (`my_account_tab.dart`)
- Profile header from `profileProvider` (avatar, name, role badge, status badge)
- Three-dot menu (`_ThreeDotMenu`) via `PopupMenuButton`: dark mode, privacy, terms, contact, language
- Dark mode toggle calls `themeModeProvider.notifier.toggle()`
- Contact section uses `Clipboard.setData` (no url_launcher dependency)
- Delete Account: `dio.delete('/users/$userId')` then `authControllerProvider.notifier.logout()`
- Logout: confirmation dialog then `authControllerProvider.notifier.logout()`

### ReferralScreen (`wallet/screens/referral_screen.dart`)
- Standalone route at `/referral` (added to `route_paths.dart` + `app_router.dart`)
- Code card: copy via `Clipboard.setData`, share via `Share.share(text)` (share_plus v10 API)
- Stats grid: 4 cells from `referralProvider.statistics`
- How-it-works: 3-step visual with connector lines
- History: `referral.rewardHistory.map(item => ReferralTile(item: item))`

### HowItWorksSection (`how_it_works_section.dart`)
- Static 3-step vertical flow with gradient connector lines between steps
- Steps: اختر الخدمة → استلم العروض → اكتمل واستمتع
- Optional `onRequestTap` CTA button

### ThemeModeProvider (`theme/theme_mode_provider.dart`)
- `AsyncNotifier<ThemeMode>` persisting to `SharedPreferences` under key `fnashha_theme_mode_v1`
- `app.dart` now watches this: `themeMode: ref.watch(themeModeProvider).asData?.value ?? ThemeMode.system`

## Key decisions

**Why:** The old `HomeNavDestination` push-navigation model couldn't support persistent tab state (wallet balance in AppBar, coins badge, notifications) across all tabs.

**How to apply:**
- Coins balance is read from `walletProvider` in `CustomerAppBar` — this is always loaded while the shell is mounted
- `IndexedStack` preserves each tab's scroll position and provider state across switches
- The center FAB does NOT correspond to any `CustomerNavTab` value — its tap goes directly to `createRequest` route
- `ServicesSection` now accepts `maxItems` optional int — pass 6 for the home tab

## Pre-existing noise in flutter analyze
~1400 errors are pre-existing (missing dio, image_picker, DioException in service files not touched by this work). All 9 new/modified files have zero errors.
