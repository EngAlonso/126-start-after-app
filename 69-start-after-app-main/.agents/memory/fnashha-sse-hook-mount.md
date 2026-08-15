---
name: Fnashha SSE hook mount requirement
description: useUserEvents must be explicitly called in customer and technician layouts, not just imported — admin layout is the reference pattern.
---

# SSE Hook Mount Requirement

## Rule
`useUserEvents()` must be **called** (not just imported) inside the customer and technician layout components. Same pattern as `useAdminEvents()` in admin/layout.tsx line 108.

**Why:** The hook opens the EventSource connection. If it is only imported but never invoked, no SSE connection is established and zero real-time events reach the frontend — all pages require manual refresh.

**How to apply:** Every time a new customer or technician layout file is created or reorganized, confirm `useUserEvents()` appears as a bare call inside the component body, near the top with other hooks.

## Reference pattern (admin/layout.tsx)
```ts
import { useAdminEvents } from "@/hooks/use-admin-events";
// ...
export default function AdminLayout(...) {
  useAdminEvents(); // ← always called
  // ...
}
```

## Fixed files
- `artifacts/fnashha/src/pages/customer/layout.tsx` — `useUserEvents()` added
- `artifacts/fnashha/src/pages/technician/layout.tsx` — `useUserEvents()` added

## Additional Phase 13 gaps fixed in the same session
1. `useUserEvents` offer_selected handler now also invalidates `REQUESTS_LIST_KEY` → tech list updates when their offer is accepted
2. Server cancellation now broadcasts `request_cancelled` to all offer-submitting technicians, not just selectedTechnicianId
3. Admin request-detail offers converted from manual useState+fetch to `useListOffers` React Query → SSE new_offer events now refresh admin offer list live
4. Admin `new_message` SSE handler now invalidates `getListMessagesQueryKey(requestId)` → admin conversation page refreshes on new messages
5. `triggerReferralReward` return type changed from `boolean` to `ReferralRewardResult | false` → referrer now gets SSE + push alongside referee
