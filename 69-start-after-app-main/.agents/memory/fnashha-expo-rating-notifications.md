---
name: Fnashha Expo rating notifications
description: Notification type and navigation rule for new technician ratings.
---

New technician-rating notifications are currently stored with the generic `status_change` type, the Arabic title `تقييم جديد`, and the related service-request ID. Expo must use that title plus technician role to route the tap to `/tech-ratings`; other `status_change` notifications remain request-linked.

**Why:** The backend notification enum does not have a dedicated rating type, so routing by `status_change` alone would incorrectly redirect normal request-status notifications.

**How to apply:** Keep the existing notification creation and read-marking behavior unchanged. Update only the Expo notification path mapping when the rating destination changes; if the backend later adds a dedicated rating type, support it without removing the generic fallback.