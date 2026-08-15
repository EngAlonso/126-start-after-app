# Fnashha Mobile — Phase 1 Architecture

Flutter app for Fnashha (فنشها), targeting Android + iOS from one codebase.
This phase builds the **foundation only** — networking, auth, theming, and
routing skeleton — not the full feature screens. It talks to the existing
`artifacts/api-server` backend unmodified.

> Not a Replit "artifact": Replit's mobile tooling (preview pane, emulator,
> Expo Go, App Store submission flow) only supports Expo/React Native.
> There is no Flutter preview integration, so this project lives as a plain
> `mobile/` directory at the repo root, outside `artifacts/` and outside the
> pnpm workspace. Building/running it requires a local Flutter setup or CI
> (`flutter run`, `flutter build apk`, `flutter build ipa`) — there is no
> in-browser preview here.

## Folder structure

```
mobile/lib/
  core/                     # Cross-cutting infrastructure, no UI
    config/env.dart         # API base URL (build-time --dart-define)
    constants/              # Endpoint paths, storage keys, timeouts
    network/
      dio_client.dart        # Two Dio instances: main + bare refresh client
      api_exception.dart     # Normalized error type for the UI layer
      interceptors/
        auth_interceptor.dart    # Bearer header + single-flight 401 refresh
        logging_interceptor.dart # Debug-only request/response logs
    storage/secure_storage_service.dart  # Keychain/EncryptedSharedPrefs
    sse/                     # Custom SSE client (see "Realtime" below)

  models/                   # Freezed + json_serializable data classes
  repositories/              # Orchestrates services + storage; app-facing API
  services/                  # Thin HTTP wrappers, one per backend resource

  features/
    auth/
      providers/              # Riverpod providers + AuthController
      screens/                 # splash_screen.dart, login_screen.dart
    home/
      screens/                 # Placeholder per-role landing screen

  routing/
    app_router.dart           # go_router config + auth redirect guard
    route_paths.dart           # Path constants

  theme/
    app_colors.dart            # Hex values lifted from the web app's tokens
    app_theme.dart              # Light/dark ThemeData (Material 3 + Cairo)

  widgets/common/              # AppButton, AppTextField, LoadingIndicator
  app.dart                    # MaterialApp.router root widget
  main.dart                   # Entrypoint (ProviderScope)
```

`features/<name>/{providers,screens}` is the pattern to extend: each new
feature (requests, offers, wallet, chat, CMS…) gets its own directory here.
`core`, `models`, `repositories`, `services` stay feature-agnostic.

## Packages used

| Package | Why |
|---|---|
| `flutter_riverpod` | State management (see rationale below). |
| `go_router` | Official Flutter-team router; declarative routes + redirect guards for auth. |
| `dio` | HTTP client with interceptor support (auth header injection, 401 refresh-retry). |
| `http` | Only used for the raw streamed SSE connection — Dio doesn't stream a GET the way `SseClient` needs. |
| `flutter_secure_storage` | Token storage in Keychain (iOS) / EncryptedSharedPreferences (Android), never plain prefs. |
| `google_fonts` | Loads Cairo to match the web app's Arabic typography. |
| `flutter_localizations` + `intl` | RTL support and Arabic locale plumbing. |
| `freezed` / `freezed_annotation` + `json_serializable` / `json_annotation` (+ `build_runner`, dev-only) | Immutable, null-safe models generated from the backend's exact JSON shapes. |

`riverpod_generator`/`riverpod_lint` were deliberately **not** added: their
current versions have a dependency conflict with `freezed_annotation ^3.x`
(riverpod_lint pins an older freezed_annotation range). Riverpod is used
without codegen (`Provider`, `AsyncNotifierProvider`, `NotifierProvider`
declared directly) — this is a fully supported, still-idiomatic Riverpod
style, just more verbose than `@riverpod` annotations. Revisit if a future
Riverpod/freezed release resolves the conflict.

## State management: Riverpod (no codegen)

Chosen over Provider, Bloc, and GetX because:
- **Compile-safe DI** — providers are typed top-level objects, not
  `context.read<T>()` string/type lookups that can fail at runtime.
- **No BuildContext coupling** — `go_router`'s `redirect` callback needs to
  read auth state *outside* the widget tree (see `app_router.dart`); Bloc
  and Provider both require a `BuildContext` or a wiring hack to do this
  cleanly, Riverpod's `ref.read`/`ref.watch` doesn't.
- **Built-in async state** — `AsyncNotifierProvider<AuthController, AuthState>`
  gives loading/data/error states for free, which is exactly the shape
  auto-login needs (loading while restoring a session, data once resolved).
- **Testability** — providers can be overridden per-test without a widget
  tree, which matters once feature tests are added.

## Routing: go_router

`routing/app_router.dart` defines only the routes needed to prove the auth
flow end-to-end: `/` (splash), `/login`, and one placeholder home per role
(`/customer`, `/technician`, `/admin`). A single `redirect` callback reads
`authControllerProvider`:

- **Loading** → stay on splash.
- **Unauthenticated** → force `/login`.
- **Authenticated** → bounce off `/` or `/login` into the role's home;
  otherwise leave navigation alone (so once real feature routes are added
  under e.g. `/customer/requests`, the guard doesn't fight them).

`GoRouterRefreshListenable` bridges Riverpod state changes into
`go_router`'s `refreshListenable`, so a login/logout immediately
re-evaluates the redirect instead of waiting for the next manual
navigation call.

## Auth flow

- **Login** (`LoginScreen` → `AuthController.login` → `AuthRepository.login`
  → `AuthService.login` → `POST /auth/login`): on success, stores
  `accessToken`/`refreshToken` in secure storage and a JSON snapshot of the
  user (for instant splash restore), then flips router state to
  `Authenticated`.
- **Auto-login** (`AuthController.build`, runs once at app start): calls
  `AuthRepository.restoreSession()`, which reads the cached user from
  secure storage without waiting on the network. If no session exists,
  starts `Unauthenticated`. The `AuthInterceptor` transparently refreshes
  an expired access token on the very next authenticated request either
  way — auto-login doesn't need to pre-emptively validate the token.
- **Refresh**: `AuthInterceptor.onError` catches any `401`, and coalesces
  concurrent refresh attempts into one in-flight `Future` (single-flight)
  to avoid multiple simultaneous calls to `POST /auth/refresh` racing the
  backend's rotation-with-reuse-detection (a reused/stale refresh token
  revokes the whole session server-side). On success, the original request
  is retried once with the new access token; on failure, local session data
  is cleared and `onSessionExpired` fires so the router redirects to
  `/login` even for a call no screen is actively awaiting.
- **Logout** (`AuthController.logout` → `AuthRepository.logout` →
  `POST /auth/logout` with the stored refresh token to revoke it
  server-side) → clears secure storage regardless of whether the network
  call succeeded, then flips router state to `Unauthenticated`.
- A device ID (generated once, cached in secure storage) is sent on both
  login and refresh so the backend can key sessions per device, matching
  its existing refresh-token schema.

## Theme

`theme/app_colors.dart` hardcodes the hex values read directly from the web
app's Tailwind v4 `@theme` tokens (`artifacts/fnashha/src/index.css`), for
both `:root` (light) and `.dark`. `theme/app_theme.dart` builds a Material 3
`ThemeData` per mode from those colors, with the `Cairo` font (via
`google_fonts`) applied through the whole `TextTheme` so type matches the
web app. `app.dart` wires `theme`/`darkTheme`/`themeMode: ThemeMode.system`
into `MaterialApp.router`, and pins locale to Arabic + `Directionality.rtl`
in the app-level `builder` (the product is Arabic-only today; an
English/LTR variant is a separate product decision, not just an `intl`
fallback).

## Realtime (SSE)

The backend added `?token=` query-param auth to `/api/events` and
`/api/admin/events` specifically because native EventSource/HTTP clients on
Android/iOS cannot attach a custom header to a long-lived streamed GET.
`core/sse/sse_client.dart` implements a minimal SSE client on top of
`package:http`'s streamed request (rather than pulling in a third-party SSE
package) so it can match the backend's exact frame format (`event:`/`data:`
lines, `:ping`/`:connected` comment frames) and implement:
- Reconnect with backoff (1s, 2s, 5s, 10s, 20s) on disconnect.
- A watchdog timer that treats >50s of silence as a dead connection (the
  backend pings every 25s, so a healthy stream is never silent that long).

Not yet wired into any screen — this is the transport layer only, ready for
a feature to `sseClient.connect().listen(...)` once needed.

## File uploads

`services/upload_service.dart` wraps `POST /api/upload/user` (local disk,
multipart field `file`, `category` field) via Dio's `FormData`. The
Cloudinary-backed `POST /api/upload` route is admin/CMS-only and out of
scope for the mobile app.

## Backend base URL configuration

There is no Replit-managed equivalent of Expo's `$REPLIT_DEV_DOMAIN`
auto-wiring for Flutter. The API host is passed at build/run time:

```
flutter run --dart-define=API_HOST=https://<your-repl-domain>.replit.dev
flutter build apk --dart-define=API_HOST=https://fnashha.example.com
```

`core/config/env.dart` defaults to `http://10.0.2.2:80` (the Android
emulator's alias for the host machine's `localhost`) only as a
development convenience — it is not a production fallback, and shipping
without passing `API_HOST` for a real build is a build-config bug, not a
supported default.

## Phase 2 — Authentication UI

Built the complete auth UI on top of the Phase 1 foundation, without any
architecture or backend changes. Extends the existing layering
(`services/` → `repositories/` → Riverpod `providers/` → `screens/`)
rather than introducing a parallel structure.

**New reference-data slice** (`CatalogService`, `service_model.dart`,
`governorate_model.dart`, `area_model.dart`, `catalog_providers.dart`)
wraps the public `GET /services|/governorates|/areas` endpoints for the
technician wizard's service/area pickers. No repository layer was added
for it — unlike `AuthRepository`, there is no local state to coordinate,
only a network read, so providers call the service directly.

**Auth extended, not replaced**: `AuthService`/`AuthRepository`/
`AuthController` gained `registerCustomer` (logs in immediately, same as
`login`) and `registerTechnician` (does **not** log in — the backend
leaves new technician accounts `pending` and issues no tokens, so this
path is called directly from its screen rather than through
`AuthController`, and the app shows an explicit "awaiting approval"
screen instead of navigating into a home shell).

**Screens added**: unified `LoginScreen` (one login form for all three
roles — the backend doesn't take a role parameter), `RegisterChoiceScreen`,
`RegisterCustomerScreen`, `RegisterTechnicianScreen` (4-step wizard:
personal info → services/experience/areas → documents → review, mirroring
the web app's own wizard), `TechnicianPendingScreen`. Routes are
whitelisted as public in the router's redirect guard alongside `/login`.

**Remember Me**: tokens must stay in secure storage while the app runs
(the `AuthInterceptor` reads them per-request), so "don't remember me"
can't mean "never persist" — it's implemented as "wipe the session on app
teardown" via a `WidgetsBindingObserver` in `app.dart` that calls
`AuthRepository.clearSessionIfNotRemembered()` on `AppLifecycleState.detached`.
This is best-effort: Android fires `detached` reliably, iOS may not on a
hard swipe-kill.

**Widgets enhanced in place** (not duplicated): `AppTextField` now wraps
`TextFormField` with validator/prefix-icon/error support (was a bare
`TextField`); `AppButton` gained an optional icon. New shared widgets:
`AppPasswordField` (obscure toggle), `AppSecondaryButton`, `AuthShell` +
`AuthBrandHeader` (shared chrome/backdrop for every auth screen, also
caps content width for tablets), `ImageUploadTile` (pick → upload →
preview, backs the wizard's document step via `image_picker`, a new
dependency).

**Bug fixed**: `AuthService.fetchMe()` was reading `response.data!['user']`
but `GET /auth/me` returns the user fields spread at the top level
(matching `/auth/login` and `/auth/register/*`, which nest under `user`).
Client-side parsing fix only.

## What's deliberately NOT in this phase

- No feature screens beyond auth + one placeholder-per-role home.
- No SSE consumption wired into any screen yet (transport layer only).
- No backend changes of any kind — the API is treated as a fixed contract.
