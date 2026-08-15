# 06 — Request Lifecycle

---

## Status Machine

```
[Customer creates request]
         ↓
      pending
         ↓ (technicians submit offers)
  offers_received
         ↓ (customer selects an offer)
 technician_selected
         ↓ (technician starts / system)
    in_progress
         ↓ (technician marks complete)
  waiting_approval
         ↓ (customer approves)
      completed

  price_change_requested  ← branch from technician_selected or in_progress
         ↓ (customer responds)
    → approved  → back to in_progress
    → rejected  → back to in_progress

  Cancellation (any early stage):
  pending | offers_received | technician_selected | in_progress
         ↓
  cancelled_by_customer | cancelled_by_technician | cancelled_by_admin
```

---

## Status Labels (Arabic)

| Status Key | Arabic Label | Icon | Colors |
|---|---|---|---|
| `pending` | تم النشر | `send` | blue bg/text |
| `offers_received` | بانتظار العروض | `tag` | purple |
| `technician_selected` | تم قبول العرض | `user-check` | orange |
| `in_progress` | جارٍ التنفيذ | `tool` | indigo |
| `waiting_approval` | بانتظار تأكيد العميل | `alert-circle` | amber |
| `price_change_requested` | طلب تعديل سعر | `refresh-cw` | cyan |
| `completed` | مكتمل | `check-circle` | green |
| `cancelled_by_customer` | ألغاه العميل | `x-circle` | red |
| `cancelled_by_technician` | ألغاه الفني | `x-circle` | red |
| `cancelled_by_admin` | ألغاه الإدارة | `x-circle` | red |
| `rejected` | مرفوض | `slash` | red |

---

## Who Can Do What

### Customer Actions

| Status | Action | Endpoint |
|---|---|---|
| `pending`, `offers_received` | Edit request (address, description) | `PATCH /api/requests/:id` |
| `pending`, `offers_received` | Cancel request | `POST /api/requests/:id/cancel` |
| `offers_received` | Select an offer | `POST /api/requests/:id/offers/:offerId/select` |
| `waiting_approval` | Approve completion | `POST /api/requests/:id/complete` |
| `price_change_requested` | Approve / reject price change | `POST /api/requests/:id/price-adjustment/respond` |
| `completed` | Rate technician | `POST /api/ratings` |

### Technician Actions

| Status | Action | Endpoint |
|---|---|---|
| `pending`, `offers_received` | Submit offer | `POST /api/requests/:id/offers` |
| `pending`, `offers_received` | Edit own offer | `PATCH /api/requests/:id/offers/:offerId` |
| `technician_selected`, `in_progress` | Mark job complete | `POST /api/request-completion` |
| `technician_selected`, `in_progress` | Request price change | `POST /api/requests/:id/price-adjustment` |
| Any (if selected) | Cancel | `POST /api/requests/:id/cancel` |

---

## Request Detail Screen (`app/requests/[id].tsx`)

This is the largest file in the project (~2300 lines). It serves both customer and technician views with conditional rendering.

### Key Computed Booleans
```ts
const isCustomer      = user?.role === 'customer';
const isTech          = user?.role === 'technician';
const isSelectedTech  = isTech && request.selectedTechnicianId === user?.id;
const showPhone       = isCustomer || isSelectedTech;  // phone privacy gate
const canCancel       = isCustomer && ['pending', 'offers_received'].includes(request.status);
const canAcceptOffer  = isCustomer && request.status === 'offers_received';
const canEditRequest  = isCustomer && ['pending', 'offers_received'].includes(request.status);
const canSubmitOffer  = isTech && ['pending', 'offers_received'].includes(request.status);
const canChat         = ['technician_selected', 'in_progress', 'waiting_approval',
                         'price_change_requested'].includes(request.status)
                        && (isCustomer || isSelectedTech);
const canTechComplete = isSelectedTech && ['technician_selected', 'in_progress'].includes(request.status);
const canTechPriceChange = isSelectedTech && ['technician_selected', 'in_progress'].includes(request.status);
const isPriceChangePending = request.status === 'price_change_requested';
const canRespondPriceChange = isCustomer && isPriceChangePending;
const canComplete     = isCustomer && request.status === 'waiting_approval';
```

### Sub-Components in requests/[id].tsx
| Component | Purpose |
|---|---|
| `RequestInfoCard` | Address, phone, name, area, description, audio |
| `OffersSection` | List of offers (customer view) |
| `MyOfferCard` | Technician's own submitted offer |
| `PriceChangeSection` | Price adjustment form + response |
| `RatingModal` | Customer rating submission |
| `ImagesSection` | Request-attached images |

### `RequestInfoCard` Prop: `showPhone`
`showPhone` is computed in `RequestDetailScreen` and passed as a prop to `RequestInfoCard`. Non-selected technicians see `'••••••••'` for phone and `'—'` for name.

### `InfoGridItem` Component
Defined at the bottom of `requests/[id].tsx`. Accepts optional `onPress` for tappable cells (phone → opens `tel:` dialer).
```ts
function InfoGridItem({ icon, iconColor, iconBg, label, value, colors, onPress }: any)
```

---

## Service Request Form (`app/services/[id].tsx`)

Submitted by customers. Contains:
- Service selection (pre-filled from route param `id`)
- Area + governorate dropdowns (SearchableSelect)
- Address text input
- Description (optional)
- Audio recording (optional — `expo-av`)
- Image attachments (optional — `expo-image-picker`)
- Scheduling (date/time)
- Coupon/loyalty coins application

---

## Cancellation Notes

- There is **no bare `cancelled` status** in the DB. The three variants are: `cancelled_by_customer`, `cancelled_by_technician`, `cancelled_by_admin`.
- In the customer requests filter tab, "ملغاة" checks all three variants:
  ```ts
  ['cancelled_by_customer', 'cancelled_by_technician', 'cancelled_by_admin'].includes(r.status)
  ```

---

## Points and Offers

When a technician submits an offer:
- Points are **reserved** (`reservedPoints` increases, `available` decreases).
- If the technician is NOT selected: points are **released** back (`release` transaction).
- If the technician IS selected: points are **deducted** permanently at job completion (`debit` + `commission` transactions).

See `08_WALLET_AND_POINTS.md` for the full points flow.

---

*Last updated: July 2026*
