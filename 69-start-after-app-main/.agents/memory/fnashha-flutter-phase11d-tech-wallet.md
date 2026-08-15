---
name: Fnashha Flutter Phase 11D — Technician Wallet
description: Technician wallet screen implementation and how to run Flutter tooling in this environment.
---

Technician Wallet (`TechWalletScreen`) mirrors the customer `WalletScreen` structurally: same
`NestedScrollView` + sticky `TabBar` chrome, extracted into shared widgets in
`lib/features/wallet/widgets/wallet_shared.dart` (`WalletTabBarDelegate`, `WalletEmptyState`,
`WalletErrorCard`) plus the pre-existing generic `MetricCard` / `TransactionTile` /
`BalanceCard` widgets. The technician side has only 2 tabs (overview, transactions) — no
referral tab, since technician points (`/api/points/*`) are a separate backend system from
customer loyalty coins (`/api/loyalty/*`) with no referral concept.

**Why it matters:** when doing this kind of shared-widget extraction refactor, grep every
screen file for any lingering reference to the old *local* private widget name (e.g.
`_EmptyState`) after replacing it with the shared one — a stray reference compiles fine until
`flutter analyze`, which is otherwise easy to skip.

**Flutter tooling in this environment:** `flutter` is not on `$PATH` by default even though
`pkgs.flutter` is in `replit.nix`. Run it via `nix-shell -p flutter --run "flutter analyze"` /
`flutter test` / `flutter pub get` from the `mobile/` directory.
