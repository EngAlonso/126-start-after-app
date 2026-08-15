---
name: Fnashha project overview
description: Key facts about the Fnashha Arabic home services platform architecture and conventions
---

# Fnashha Project

## Stack
- Frontend: React + Vite at `artifacts/fnashha`
- API: Express + Drizzle ORM at `artifacts/api-server`
- DB: PostgreSQL via `lib/db`
- API client: generated hooks at `lib/api-client-react` (wildcard export from `./generated/api`)

## Key conventions
- DB push: `pnpm --filter @workspace/db run push` (drizzle-kit push --force for conflicts)
- API restart: use `restart_workflow` for "artifacts/api-server: API Server" after any source edit
- Images: stored as base64 data URLs in DB (no object storage)

## Hook patterns
- `useListOffers(requestId: number, options?)` — first arg is NUMBER, NOT object
- `getListOffersQueryKey(requestId)`, `getGetRequestQueryKey(id)` — use for invalidation
- `useUpdateOffer` mutate: `{requestId, offerId, data}` — all three at top level

## Route structure
- Admin routes: all wrapped in `<ProtectedAdmin><AdminLayout>...</AdminLayout></ProtectedAdmin>`
- Customer routes: wrapped in `<ProtectedCustomer><CustomerLayout>...</CustomerLayout></ProtectedCustomer>`
