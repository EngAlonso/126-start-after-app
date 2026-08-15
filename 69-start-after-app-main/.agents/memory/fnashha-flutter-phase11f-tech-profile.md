---
name: Fnashha Flutter Phase 11F — Technician Profile & Settings
description: Reused customer profile module for technician profile; found technicianProfile.status latent bug and how account status actually works.
---

- `usersTable.status` (active/pending/suspended/banned/rejected) IS the technician's account/approval status — registration sets it to "pending", admin approval flips it to "active". No need to read `technicianProfilesTable.approvalStatus` for the account-status badge; the existing generic `_StatusBadge` (reads `user.status`) already covers technicians correctly.
- Latent bug (not fixed, out of scope for 11F): `TechnicianProfileModel.status` in `mobile/lib/models/technician_profile_model.dart` reads JSON key `status`, but the backend's `technicianProfile` object (from `formatUser` in `auth.ts`) only ever has `approvalStatus`, never `status` — so that field is always null and the one call site (`technician_home_screen.dart`) silently falls back to a hardcoded default. Fix by reading `approvalStatus` if ever touched.
- Backend routes `GET /technicians/:id/profile` (services+areas+approvalStatus+yearsOfExperience+rating, no auth) and `GET /technicians/:id/public-profile` (rating+completedJobs, no auth) are complementary — neither alone has every field a technician's own profile screen needs; both are fetched and merged client-side.
- `PATCH /api/users/:id` already accepted `serviceIds`/`areaIds`/`yearsOfExperience` server-side before any mobile technician-profile-editing existed; only the Flutter `ProfileService.updateProfile` needed extending to pass them through — always check what an existing shared endpoint already supports before assuming a new one is needed.
