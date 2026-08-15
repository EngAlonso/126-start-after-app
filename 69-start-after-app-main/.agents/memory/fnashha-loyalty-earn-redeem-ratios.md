---
name: Fnashha loyalty earn vs redeem ratios
description: Two separate loyalty ratios — coinEarnRatio for earning and coinConversionRatio for redemption; platform-credit route uses actual DB record to detect coin discounts.
---

## Rules

**coinConversionRatio** — redemption ratio: how many EGP discount 1 coin provides (e.g. 0.1 = 1 coin = 0.10 EGP off).
**coinEarnRatio** — earn ratio: how many coins are earned per 1 EGP spent (e.g. 1 = 1 coin/EGP, 0.1 = 1 coin per 10 EGP).

Both live in CMS settings table and are exposed via GET /loyalty/config.

**Why:** Before Phase 12, earnCoins() used coinConversionRatio for earning, which conflated earning rate with discount value. They are logically independent and admin-controlled.

**How to apply:**
- earnCoins() → uses config.coinEarnRatio
- calculateCoins(), redeemCoins() → use config.coinConversionRatio
- Admin CMS loyalty tab includes both fields with clear labels

## Platform Credit route

`GET /api/requests/:id/platform-credit` returns coin discount settlement info for technicians.

**Critical rule:** `hasCoinDiscount` is derived from the existence of a `platform_credits` row, NOT from `request.hasDiscount`. The `hasDiscount` flag can be true for coupon discounts too. Only a `platform_credits` record confirms a coin redemption occurred.

Also enforces `request.status === "completed"` before querying.
