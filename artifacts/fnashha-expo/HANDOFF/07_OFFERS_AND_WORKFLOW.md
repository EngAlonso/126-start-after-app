# 07 — Offers and Workflow

---

## Offer Submission (Technician)

### When Allowed
Only when request status is `pending` or `offers_received`.

```ts
const canSubmitOffer = isTech && ['pending', 'offers_received'].includes(request.status);
```

### Form Fields
| Field | Type | Required | Notes |
|---|---|---|---|
| `price` | number | ✓ | Total job price in EGP |
| `spareParts` | number | ✗ | Spare parts cost in EGP |
| `notes` | string | ✗ | Technician notes to customer |

### Endpoint
```
POST /api/requests/:id/offers
Body: { price, spareParts, notes }
```

### Points Deduction on Offer
- Submitting an offer **reserves** points (deducted from `available`, added to `reservedPoints`).
- The amount is determined by the platform commission ranges.
- Points are held atomically using `SELECT...FOR UPDATE` to prevent race conditions.

### Editing Own Offer
```
PATCH /api/requests/:id/offers/:offerId
Body: { price?, spareParts?, notes? }
```

---

## Offer Selection (Customer)

### When Allowed
Only when status is `offers_received`.

```ts
const canAcceptOffer = isCustomer && request.status === 'offers_received';
```

### Endpoint
```
POST /api/requests/:id/offers/:offerId/select
```
No body required. Returns the updated request object.

> **Note:** The select endpoint returns no body in some API versions. Refetch the request after selection.

### Effect
- Request status → `technician_selected`
- All other technicians' offers: points **released** back to them.
- Selected technician: points remain **reserved** until job completion.

---

## Job Completion Flow

### Technician Marks Complete
When `canTechComplete` (status = `technician_selected` or `in_progress`):

```
POST /api/request-completion
Body: { requestId }
```

Status → `waiting_approval`.

### Customer Approves
When `canComplete` (status = `waiting_approval`):

```
POST /api/requests/:id/complete
```

Status → `completed`.

On completion:
- Selected technician's reserved points are **permanently deducted** (`debit` + `commission`).
- Loyalty coins may be earned (customer) and referral rewards triggered.
- Customer can now rate the technician.

---

## Price Change Flow

### Technician Requests Price Change
When `canTechPriceChange` (status = `technician_selected` or `in_progress`):

```
POST /api/requests/:id/price-adjustment
Body: {
  newPrice: number,
  newSpareParts?: number,
  description: string,
  supportingImage?: string  // uploaded image URL
}
```

Status → `price_change_requested`.

### Customer Responds
```
POST /api/requests/:id/price-adjustment/respond
Body: { action: 'approve' | 'reject' }
```

- **Approve:** Commission is recalculated for the new price (debit/release diff), status → `in_progress`.
- **Reject:** Status → `in_progress` (previous price stands).

### Price Change in `requests/[id].tsx`
Controlled by:
```ts
const isPriceChangePending  = request.status === 'price_change_requested';
const canRespondPriceChange = isCustomer && isPriceChangePending;
```
Supporting image upload uses `expo-image-picker` → Blob fetch approach → `POST /api/upload/user?category=requests`.

---

## Commission System

- Commission is range-based (`commission_ranges` table in the DB).
- Managed by the `resolveCommissionRange` function on the API server (`offers.ts`).
- Commission is recalculated on price adjustments:
  - Price increase → additional `debit` transaction.
  - Price decrease → `release` transaction for the difference.

---

## Rating Flow

After status = `completed`, the customer can rate the technician.

```
POST /api/ratings
Body: { requestId, technicianId, stars: 1-5, review: string }
```

Rating modal in `requests/[id].tsx`:
```ts
const [showRatingModal, setShowRatingModal] = useState(false);
const [ratingStars, setRatingStars]         = useState(5);
const [ratingReview, setRatingReview]       = useState('');
```

---

## Chat Availability

Chat is enabled only between the **selected technician** and the **customer**, during active statuses:

```ts
const canChat = [
  'technician_selected',
  'in_progress',
  'waiting_approval',
  'price_change_requested',
].includes(request.status) && (isCustomer || isSelectedTech);
```

Chat button appears in the header of `requests/[id].tsx` when `canChat` is true.

---

## Technician Requests Tabs

`app/(technician)/requests.tsx` has 3 tabs with separate React Query caches:

| Tab Index | Key | Statuses Fetched |
|---|---|---|
| 0 | `pending` | `pending` |
| 1 | `active` | `technician_selected`, `in_progress`, `waiting_approval`, `price_change_requested`, `offers_received` |
| 2 | `done` | `completed`, `cancelled_by_customer`, `cancelled_by_technician`, `cancelled_by_admin` |

### Deep-Linking to a Tab
```ts
router.push({
  pathname: '/(technician)/requests',
  params: { initialTab: '2' }  // '2' = done tab
});
```

The screen uses `useState(initTabIdx)` + `initialScrollIndex` on the pager FlatList — no setTimeout race condition.

---

*Last updated: July 2026*
