---
name: Fnashha auth localStorage quota
description: Technician login crashes silently due to localStorage quota exceeded — base64 images in technicianProfile bloat the stored user object past ~5MB.
---

## Rule
`formatUser` in `auth.ts` must strip `personalPhoto`, `nationalIdFront`, and `nationalIdBack` from the `technicianProfile` before returning the login/me response.

## Why
Technician profiles store national-ID photos and a personal photo as base64 data URLs in the DB. Each can be 150–300 KB. When included in the login response, `auth-context.tsx login()` calls `localStorage.setItem("fnashha_user", JSON.stringify(user))` which throws `QuotaExceededError`, silently aborting session storage. The technician sees the login button spin and then nothing — the page doesn't redirect and no toast appears.

## How to apply
Keep the destructuring-strip in `formatUser`:
```ts
const technicianProfile = profile
  ? (({ personalPhoto: _p, nationalIdFront: _f, nationalIdBack: _b, ...rest }) => rest)(profile)
  : null;
```
Components that need the actual images (admin technician-detail page) call `GET /api/technicians/:id/profile` directly.
