---
name: Fnashha Expo — Technician requests screen & price change flow
description: Alternating card colors on technician requests, account screen redesign, and full price-change lifecycle in request detail.
---

## Alternating card colors (RequestCard)
- `accentIndex?: number` prop added to `RequestCard`.
- Two `CARD_ACCENTS`: amber `#E9B73A` (brand) and blue `#2563EB`.
- Even/odd cards alternate via `accentIndex % 2`; adds a 4px left strip + subtle bg tint.
- Technician `requests.tsx` passes `index` from `renderItem`.
- Customer screens that don't pass `accentIndex` still render the original plain card.

## Technician account screen redesign
- Hero section: full-width amber top band + rounded avatar + online dot (colored by approval status).
- Stats row inside hero card: available points, reserved points, years of experience.
- Status badge reads `user.status` (not `technicianProfile.status`) — pre-existing rule.
- Menu items now have individual `iconBg` / `iconColor` per item for better visual hierarchy.
- `setDark` must be destructured from `useTheme()` at component root — don't use require().

## Request detail — price change flow (requests/[id].tsx)
New statuses added: `price_change_requested`, `cancelled_by_admin`.

### Technician actions (when status = technician_selected | in_progress)
- **"تم التنفيذ"** → `POST /api/requests/:id/request-completion` → sets status to `waiting_approval`.
- **"تغيير السعر"** → opens inline form → `POST /api/requests/:id/price-adjustment` with `{ newPrice, newSpareParts, newDescription }` → sets status to `price_change_requested`.

### Technician when status = price_change_requested
- Shows cyan notice card: "في انتظار موافقة العميل" + proposed price.
- `canTechComplete` is false (cannot complete while price change pending — backend also blocks it).

### Customer when status = price_change_requested
- Fetches `GET /api/requests/:id/price-adjustment` → `pendingAdjustment` query (enabled only when status = price_change_requested).
- Shows price summary card with new price, spare parts, reason.
- **"موافق"** → `POST /api/requests/:id/price-adjustment/respond` with `{ decision: 'approved' }` → backend updates agreedPrice, recalculates commission, sets status to `in_progress`.
- **"رفض"** → same endpoint with `{ decision: 'rejected' }` → keeps original price, sets status to `in_progress`.

### Scroll padding
- Uses `TECH_TAB_BAR_HEIGHT` for technicians, `TAB_BAR_HEIGHT` for customers (conditional on `isTech`).

### PriceAdjustment type
Expanded in types/index.ts to include: `oldPrice`, `oldSpareParts`, `newSpareParts`, `newDescription`, `supportingImage`, `decisionDate`, `technicianId`.

**Why:** The backend `price_adjustments` table has all these fields but the type only had `newPrice` and `reason`.
