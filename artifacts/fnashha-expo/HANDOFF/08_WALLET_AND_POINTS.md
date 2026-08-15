# 08 — Wallet and Points

---

## Two Wallet Systems

| System | Users | Screen | Currency |
|---|---|---|---|
| **Points Wallet** | Technicians | `(technician)/wallet.tsx` | Points (نقاط) |
| **Loyalty Coins Wallet** | Customers | `customer-wallet.tsx` | Coins (عملات) |

---

## Technician Points System

### Balance Model
```ts
interface PointsBalance {
  balance: number;       // total (credit) — never decreases except via debit
  reservedPoints: number; // locked for pending offers
  available: number;     // = balance - reservedPoints (ready to use)
}
```

### Transaction Types
| Type | Sign | Color | Icon | Meaning |
|---|---|---|---|---|
| `credit` | + | Green `#16A34A` | `trending-up` | Points added (job complete, admin bonus) |
| `debit` | − | Red `#DC2626` | `trending-down` | Points spent (offer permanently deducted) |
| `commission` | − | Amber `#D97706` | `lock` | Platform commission |
| `release` | + | Blue `#2563EB` | `rotate-ccw` | Reserved points returned (offer not selected) |

> **Note:** `reserve` does **not** create a transaction row — it only changes `reservedPoints`. Only `release` logs a transaction but does NOT change `pointsBalance`.

### Points Flow per Offer
```
Submit offer    → reservedPoints ↑ (no transaction row)
Not selected    → reservedPoints ↓ + release transaction
Selected → job complete → debit + commission transactions, reservedPoints → 0
```

### Endpoints
```
GET /api/points/balance           → { balance, reservedPoints, available }
GET /api/points/transactions?limit=50
```

---

## Technician Wallet Screen (`(technician)/wallet.tsx`)

### UI Components
1. **Two balance cards** side-by-side:
   - Available points — LinearGradient card (amber tones)
   - Reserved points — amber/orange static card
2. **Total balance line** below cards
3. **Three stat mini-cards:** Added / Deducted / Commission
4. **Info box** — explains the points system
5. **Transaction list** with filter chips (All / Added / Deducted / Commission / Released)

### ⚠️ Dark Mode — Available Points Card
The available-points LinearGradient uses `isDark`-aware color pairs to ensure readable text:

```ts
colors={isDark
  ? (lowPoints ? ['#2D1E00', '#1A1000'] : ['#1A1500', '#201C00'])
  : (lowPoints ? ['#FEF3C7', '#FFFBEB'] : ['#FEF9EC', '#FFFDF5'])}
```

Text colors in the card:
```ts
// balanceNum
color: isDark ? '#E9B73A' : '#92400E'
// balanceSub
color: isDark ? '#D97706' : colors.mutedForeground
// balanceHint
color: isDark ? '#B45309' : colors.mutedForeground
```

Without this fix, white text (`colors.foreground`) on a very-light yellow gradient = invisible in dark mode.

### Low Points Alert
`lowPoints = available < 200` — shows an `alert-triangle` badge on the card and a darker amber gradient.

### Filter Chips
```ts
type Filter = 'all' | 'credit' | 'debit' | 'commission' | 'release';
```
Filter is client-side — all transactions fetched, then filtered via `Array.filter`.

---

## Customer Loyalty Coins Wallet

### What Are Coins?
- Earned by: completing requests, referrals, campaigns.
- Redeemed as: discounts on service requests.

### Wallet States
| State | Meaning |
|---|---|
| `available` | Can be redeemed now |
| `pending` | Earning in progress (e.g., waiting for job completion) |
| `reserved` | Allocated to an active discount |
| `expired` | Past expiry date |

### Coin Ratios
- **`coinEarnRatio`**: coins earned per EGP spent (set in CMS).
- **`coinConversionRatio`**: coin value as EGP discount (e.g., 100 coins = 5 EGP).

### Redemption
Only available when request status = `waiting_approval`. Coins and coupons are **mutually exclusive** (cannot use both on the same request).

### Platform Credits
`hasCoinDiscount` is determined by the presence of a `platform_credits` row for the request — **not** by the `hasDiscount` flag.

### Referral
- Each user has a unique referral code.
- Referring a new customer → both parties earn coins when the referee completes their first request.
- Screen: `referral.tsx`, endpoint: `GET /api/loyalty/referral`.

---

## CMS Keys for Wallet Settings

| Key | Purpose |
|---|---|
| `coinEarnRatio` | Coins per EGP earned |
| `coinConversionRatio` | Coin value in EGP |
| `coinExpiryDays` | Days until coins expire |
| `loyaltyEnabled` | Toggles loyalty wallet tab visibility |

---

*Last updated: July 2026*
