# 05 — API Endpoints

---

## Base URL

Resolved by `hooks/api-base.ts` → `apiUrl('/api/...')`.

In dev: reads from `app.config.js` `extra.origin` (set from `process.env.API_BASE_URL`).
In production: `EXPO_PUBLIC_API_BASE_URL` environment variable.

---

## Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | ✗ | Login → `{ accessToken, refreshToken, user }` |
| `POST` | `/api/auth/refresh` | ✗ | Rotate refresh token → new pair |
| `POST` | `/api/auth/register` | ✗ | Customer registration → auto-login |
| `POST` | `/api/auth/register/technician` | ✗ | Technician registration (pending approval) |
| `GET` | `/api/auth/me` | ✓ | Current user profile (flat object) |
| `POST` | `/api/auth/logout` | ✓ | Revoke refresh token |

---

## Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users/:id` | ✓ | User profile |
| `PATCH` | `/api/users/:id` | ✓ | Update profile (`fullName`, `profileImage`, etc.) |

---

## Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/requests?role=<role>&status=<csv>&limit=<n>` | ✓ | Request list |
| `GET` | `/api/requests/:id` | ✓ | Request detail — phone stripped for non-selected techs |
| `POST` | `/api/requests` | ✓ (customer) | Submit new service request |
| `PATCH` | `/api/requests/:id` | ✓ (customer) | Edit pending request (address, description) |
| `POST` | `/api/requests/:id/cancel` | ✓ (customer) | Cancel request |
| `POST` | `/api/requests/:id/complete` | ✓ (customer) | Approve completion (waiting_approval → completed) |

### Request List Query Params
- `role` — `customer` or `technician`
- `status` — comma-separated list of status strings (e.g., `pending,offers_received`)
- `limit` — number of results (default 20, cap 100)
- `page` — page number (default 1)

### Status Values
```
pending → offers_received → technician_selected → in_progress
→ waiting_approval → completed
     ↘ price_change_requested → (respond) → back to previous
     ↘ cancelled_by_customer | cancelled_by_technician | cancelled_by_admin
```

---

## Offers

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/requests/:id/offers` | ✓ | All offers on a request (customer only) |
| `GET` | `/api/requests/:id/offers/my` | ✓ (tech) | Technician's own offer on a request |
| `POST` | `/api/requests/:id/offers` | ✓ (tech) | Submit offer (`price`, `spareParts`, `notes`) |
| `PATCH` | `/api/requests/:id/offers/:offerId` | ✓ (tech) | Edit own offer |
| `POST` | `/api/requests/:id/offers/:offerId/select` | ✓ (customer) | Select an offer → technician_selected |

---

## Price Adjustments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/requests/:id/price-adjustment` | ✓ (tech) | Request price change |
| `POST` | `/api/requests/:id/price-adjustment/respond` | ✓ (customer) | Approve or reject price change |
| `POST` | `/api/request-completion` | ✓ (tech) | Mark job as done → waiting_approval |

---

## Conversations & Messages

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/conversations` | ✓ | Conversation list — **raw snake_case SQL join** |
| `GET` | `/api/messages/:requestId` | ✓ | Messages for a conversation |
| `POST` | `/api/messages/:requestId` | ✓ | Send a message (`text`, `image`, `audio`) |
| `POST` | `/api/messages/:requestId/deliver` | ✓ | Mark all messages as delivered |

### ⚠️ Conversations Response Shape
`GET /api/conversations` uses `db.execute(sql`...`)` and returns **snake_case** keys:
```ts
interface RawConversation {
  request_id: number;
  status: string;
  service_name: string;
  customer_id: number;
  customer_name: string;
  technician_id: number | null;
  technician_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_type: string | null;
  message_count: number;
  unread_count: number;
}
```
The `toConversation(raw, myId)` function in `messages/index.tsx` maps this to the camelCase `Conversation` type.

---

## Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications?limit=<n>` | ✓ | Notification list |
| `POST` | `/api/notifications/:id/read` | ✓ | Mark one read |
| `POST` | `/api/notifications/read-all` | ✓ | Mark all read |

---

## Points (Technician)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/points/balance` | ✓ (tech) | `{ balance, reservedPoints, available }` |
| `GET` | `/api/points/transactions?limit=<n>` | ✓ (tech) | Transaction history |

### Transaction Types
| Type | Meaning | Direction |
|---|---|---|
| `credit` | Points added (job completion, admin) | + green |
| `debit` | Points spent (offer submission) | − red |
| `commission` | Platform fee deducted | − amber |
| `release` | Reserved points returned (offer not selected) | + blue |

---

## Ratings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/ratings/technician/:id` | ✓ | Technician's ratings (own or public) |
| `POST` | `/api/ratings` | ✓ (customer) | Submit rating for completed request |

---

## Upload

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/upload/user?category=<cat>` | ✓ | Upload file → `{ url }` |

### Category Values
| Category | Usage |
|---|---|
| `profiles` | Profile images |
| `requests` | Images attached to service requests |
| `chat` | Images/audio sent in chat |

### ⚠️ Upload MIME Type Requirement
The server expects `image/jpeg` or `image/png` (or `audio/webm`, etc. for audio). Always use the **Blob fetch approach** — do NOT use the `{ uri, type, name }` shorthand:
```ts
const fileResponse = await fetch(asset.uri);
const blob = await fileResponse.blob();
const jpegBlob = blob.slice(0, blob.size, 'image/jpeg');
formData.append('file', jpegBlob, 'photo.jpg');
```

---

## Loyalty / Wallet (Customer)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/loyalty/wallet` | ✓ (customer) | Loyalty wallet: coins, pending, reserved |
| `GET` | `/api/loyalty/referral` | ✓ (customer) | Referral code + stats |
| `POST` | `/api/loyalty/redeem` | ✓ (customer) | Redeem coins for discount |

---

## Services / CMS

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/services` | ✗ | Service categories list |
| `GET` | `/api/services/:id` | ✗ | Single service detail |
| `GET` | `/api/banners` | ✗ | Banner slides (CMS) |
| `GET` | `/api/cms/settings` | ✗ | CMS key-value config |

---

## Support Tickets

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/support` | ✓ | List own tickets |
| `POST` | `/api/support` | ✓ | Create ticket |
| `GET` | `/api/support/:id` | ✓ | Ticket detail + replies |
| `POST` | `/api/support/:id/reply` | ✓ | Add reply |

---

## Technician Profile (Public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/technicians/:id/public-profile` | ✓ | Public profile including `completedJobs` |

> **Note:** `completedJobs` is available via this endpoint. Fields `verified`, `online`, `duration` do **not** exist on the profile.

---

## SSE (Real-Time)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/sse?token=<accessToken>` | ✓ via query param | Server-Sent Events stream |

See `09_CHAT_AND_NOTIFICATIONS.md` for SSE event types and handling.

---

*Last updated: July 2026*
