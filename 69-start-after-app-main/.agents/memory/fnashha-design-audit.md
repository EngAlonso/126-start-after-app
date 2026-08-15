---
name: Fnashha Flutter Design Audit
description: Results of the full UX/design consistency audit across the Flutter app, including what was fixed and what remains compliant.
---

## Audit Scope
Full-app design consistency audit across all customer + technician screens.

## Compliant (No Changes Needed)
- `CustomerAppBar` and `TechnicianAppBar` — identical structure, tokens, sizes
- `CustomerBottomNavBar` and `TechBottomNavBar` — same shadow, colors, animation, height (60px)
- `AppButton` / `AppSecondaryButton` — consistently used across auth screens
- `EmptyStateWidget` — well-defined shared widget (animated icon, title, subtitle, optional action)
- Skeleton system — `SkeletonBox`, `SkeletonCard`, `SkeletonList`, `SkeletonBanner`, `SkeletonServiceGrid` all in skeleton_widget.dart
- `AppDesign` token system — comprehensive (radius, space, shadow, duration)
- Wallet screens, profile screens, intro screens — compliant

## Fixed in Audit Pass

### Loading States (CircularProgressIndicator → SkeletonList)
- `requests_tab.dart` initial load
- `my_requests_screen.dart` initial load
- `conversations_screen.dart` initial load
- `tech_my_jobs_screen.dart` initial load
- `notifications_screen.dart` custom shimmer (_ShimmerCard class) → SkeletonList

### Empty States (custom _EmptyState → EmptyStateWidget)
- `requests_tab.dart` _EmptyRequests class removed
- `my_requests_screen.dart` _EmptyState class removed (dynamic icon/title for search vs filter)
- `conversations_screen.dart` _EmptyState class removed
- `tech_my_jobs_screen.dart` _EmptyState class removed (tab-based icon/title via switch)
- `notifications_screen.dart` _EmptyState class removed

### Error States (TextButton/FilledButton.icon → AppButton)
- `requests_tab.dart` _RequestsError retry button
- `my_requests_screen.dart` _ErrorState retry button
- `conversations_screen.dart` _ErrorState retry button
- `tech_my_jobs_screen.dart` _ErrorState retry button (was FilledButton.icon with custom gold style)
- `notifications_screen.dart` _ErrorState retry button

### Card Radius (hardcoded → AppDesign constants)
- `tech_my_page_tab.dart` _StatusChip: 10 → AppDesign.radiusSM (12)
- `tech_my_page_tab.dart` _LowPointsWarning: 14 → AppDesign.radiusMD (16)
- `tech_my_page_tab.dart` _SummaryCard: 18 → AppDesign.radiusLG (20)
- `tech_my_page_tab.dart` _EmptyCard: 18 → AppDesign.radiusMD (16)
- `my_requests_screen.dart` search field: 16 → AppDesign.radiusMD
- `my_requests_screen.dart` ChoiceChip: 20 → AppDesign.radiusLG

### Nav Bar Font Size Standardization
- `home_bottom_nav_bar.dart` CustomerBottomNavBar label: 10 → 9.5 (matches TechBottomNavBar)

## Pre-existing Warnings (not introduced by audit pass)
8 warnings in: customer_home_screen.dart, my_page_tab.dart, onboarding_screen.dart,
tech_my_page_tab.dart (points_balance_card unused import), referral_screen.dart (×2)

**Why:** These pre-date the audit and are harmless unused-import/null-aware-operator warnings.
