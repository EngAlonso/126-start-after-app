---
name: Fnashha Expo technician ratings contract
description: The technician ratings screen must use the dedicated ratings endpoint and map its review/customer/service response shape.
---

## Rule

For Expo technician ratings, use `/api/ratings/technician/:technicianId`. The profile endpoint uses a different `reviews` shape and is not sufficient for the ratings screen. Rating text is returned as `review`, and service metadata must be included in the dedicated endpoint response.

**Why:** The Expo screen previously read `profile.ratings` from `/public-profile`, which returned `reviews`, making existing ratings appear empty. The dedicated endpoint is also the same source used by the website.

**How to apply:** Keep the query keyed by the authenticated technician ID, map `review`, `customer.profileImage`, and `service.nameAr`/`service.name`, and derive the summary from `averageRating` and `reviewCount`.