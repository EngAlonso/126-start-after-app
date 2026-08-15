---
name: Fnashha permissions mapping
description: Which requirePermission() key to use for each API route in the system.
---

# Fnashha Permissions Mapping

## Users routes (users.ts)
| Route | Permission Key |
|---|---|
| GET /api/users | `users.view` |
| PATCH /api/users/:id/admin-edit | `users.edit` |
| POST /api/users/:id/ban | `users.ban` |
| POST /api/users/:id/unban | `users.ban` |
| POST /api/users/:id/suspend | `users.ban` |
| POST /api/users/:id/activate | `users.edit` |
| DELETE /api/users/:id | `delete_users` (legacy key, kept for compatibility) |

## Technician routes (users.ts)
| Route | Permission Key |
|---|---|
| GET /api/technicians/pending | `technicians.view` |
| GET /api/technicians/approved | `technicians.view` |
| GET /api/technicians/rejected | `technicians.view` |
| POST /api/technicians/:id/approve | `technicians.approve` |
| POST /api/technicians/:id/restore | `technicians.approve` |
| POST /api/technicians/:id/reject | `technicians.reject` |
| PATCH /api/technicians/:id/admin-experience | `technicians.edit_experience` |
| PATCH /api/technicians/:id/admin-services | `technicians.edit_services` |
| PATCH /api/technicians/:id/admin-areas | `technicians.edit_areas` |
| DELETE /api/technicians/:id/permanent-delete | `technicians.delete` |

## Content routes
| Route | Permission Key |
|---|---|
| POST/PATCH/DELETE /api/services/* | `services.add` / `services.edit` / `services.delete` |
| POST/PATCH/DELETE /api/governorates/* | `locations.add` / `locations.edit` / `locations.delete` |
| POST/PATCH/DELETE /api/areas/* | `locations.add` / `locations.edit` / `locations.delete` |
| POST/PATCH/DELETE /api/banners/* | `cms.banners` |
| PATCH /api/requests/:id/offers/:id/admin | `offers.manage` |

## Note
`requirePermission` auto-passes for `super_admin`. Regular `admin` must have the specific key in their DB permissions record.
