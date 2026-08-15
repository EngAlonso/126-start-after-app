---
name: Fnashha Expo focus-refetch pattern
description: How all Expo screens refresh server data when regaining focus
---

## Rule
Every screen with `useQuery` imports and calls `useRefetchOnFocus([refetch1, refetch2, ...])` from `@/hooks/useRefetchOnFocus`.

## How it works
- `useFocusEffect` from `expo-router` fires on every screen focus (including initial mount)
- A `hasMountedRef` skips the first focus to avoid double-fetching on mount
- A `refetchesRef` always holds the latest refetch functions (no stale closures, empty useCallback deps)

## Coverage (15 screens)
(customer): index, my-page, requests
(technician): index, my-page, requests, wallet
Shared: notifications, customer-wallet, tech-points, tech-ratings, messages/index, services/index, referral, app/index (guest)

**Why:** React Query's 30s staleTime meant screens didn't refetch when returning from sub-screens.
