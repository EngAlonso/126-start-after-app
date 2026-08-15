---
name: Fnashha Flutter Phase 6 — Offers module
description: What the backend actually supports for offers, and design decisions for the mobile Offers screens.
---

- `POST /requests/:id/offers/:offerId/select` returns only `{success: true}` — no updated
  request body. Any client calling it must re-fetch `GET /requests/:id` afterward to see the
  new `technician_selected` status / `selectedTechnician`; the select response itself is not
  enough.
- The offers-list endpoint (`GET /requests/:id/offers`) does **not** include `completedJobs`,
  a verification badge, or an online/offline indicator — those fields don't exist anywhere in
  `usersTable`/`technicianProfilesTable`/`offersTable`. `completedJobs` is only available via
  `GET /technicians/:userId/public-profile`, called per-technician on the offer detail screen.
- There is no estimated-duration/ETA field on offers anywhere in the schema — a "fastest
  completion" highlight has no real data to base itself on, so only "best price" (lowest
  `totalPrice`) and "top rated" (highest `technician.averageRating`, only when ≥2 offers have a
  nonzero rating) are computed as comparison highlights.
- `technician.mobile` on an offer can be null (backend phone-visibility gate) — same pattern as
  `RequestPersonInfo.mobile` in Phase 5; never treat a missing mobile as a bug.
