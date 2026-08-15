---
name: Fnashha SSE event coverage
description: How real-time SSE reconnect/sync and new event wiring is done in Fnashha; read before adding new realtime events.
---

## Generic reconnect strategy
On `EventSource.onopen` (after the first connect), call `queryClient.invalidateQueries()` with **no arguments**. This invalidates the entire React Query cache rather than a hardcoded list of query keys, so any page — including ones added later — automatically re-syncs after a dropped/reconnected SSE connection.

**Why:** the original implementation only refreshed 3 hardcoded keys, which silently missed new entity types as the app grew (offers, tickets, users, technicians, etc.). A full-cache invalidate is the only approach that doesn't need to be touched every time a new query is added.

**How to apply:** Both `use-admin-events.ts` and `use-user-events.ts` follow this pattern. Any new SSE-consuming hook should do the same on `onopen`.

## Adding new realtime endpoints without orval codegen
New backend endpoints (e.g. `PATCH /requests/:id/edit`, `POST /requests/:requestId/offers/:offerId/withdraw`) do not need to be added to `openapi.yaml` + regenerated through orval. The frontend already has a local `apiCall(path, method, body, token)` raw-fetch helper duplicated in pages like `technician/request-detail.tsx` and `customer/request-detail.tsx` — reuse that pattern for one-off/non-generated calls instead of touching the generated client.

## Broadcast event naming convention
SSE event names added: `request_updated`, `offer_withdrawn`, `account_status_changed`, `technician_status_changed`, `support_ticket_updated`, `new_notification`. Each broadcasts to the relevant userIds (customer/technician/admin) via the existing `sse-broadcast.ts` helpers (`broadcastToUser`, `broadcastToUsers`, admin broadcast). Frontend listeners then invalidate the matching React Query key (e.g. `getListUsersQueryKey()` is a prefix key — invalidating it without params also invalidates parametrized variants like `{role: "technician"}`).
