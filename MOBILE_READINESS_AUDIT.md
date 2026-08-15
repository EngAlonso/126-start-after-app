# Fnashha — Mobile Readiness Audit Report
**Date:** 2026-07-09  
**Scope:** Android + iOS mobile app readiness against the existing backend API  
**Verdict: NOT production-ready for mobile. 5 blockers must be fixed first.**

---

## Table of Contents
1. [Critical Issues — Blockers](#1-critical-issues--blockers)
2. [High Priority Issues](#2-high-priority-issues)
3. [Medium Priority Issues](#3-medium-priority-issues)
4. [Low Priority Improvements](#4-low-priority-improvements)
5. [Recommended Fixes](#5-recommended-fixes)
6. [Risk Estimates](#6-risk-estimates)
7. [Final Answer](#7-final-answer)

---

## 1. Critical Issues — Blockers

These must be resolved before Android/iOS development begins.

---

### C-1 · Hardcoded Super Admin Credentials in Source Code
**File:** `artifacts/api-server/src/routes/auth.ts:223`  
**Severity:** CRITICAL — Security  

The super admin mobile number `01200229946` and password `123456` are hardcoded as a fallback inside the login handler. Anyone who reads the source code (or the compiled bundle if server-side rendering is ever added) has admin access.  

**Impact on mobile:** A mobile attacker who decompiles the APK/IPA and finds the API base URL can immediately gain full admin access.  

**Fix:** Move to environment secrets. Remove the hardcoded fallback entirely.

---

### C-2 · No Rate Limiting on Auth Endpoints
**File:** `artifacts/api-server/src/index.ts` / middleware — absent  
**Severity:** CRITICAL — Security  

There is zero rate limiting on `/auth/login`, `/auth/register/*`, or any other endpoint. No `express-rate-limit` or equivalent package is installed.  

**Impact on mobile:** A mobile attacker can brute-force any customer's account using their phone number. Credential-stuffing attacks are trivially executable. This is a regulatory risk (Egypt ITIDA / PDPL) and an App Store review risk.

**Fix:** Install `express-rate-limit`. Apply 5 attempts/15 min on login; 3 registrations/hour per IP.

---

### C-3 · No Token Refresh Endpoint
**File:** `artifacts/api-server/src/routes/auth.ts` — absent  
**Severity:** CRITICAL — Auth  

JWTs are issued with a hardcoded 30-day expiry. There is no `/auth/refresh` endpoint. When a token expires, mobile users are silently logged out. There is no mechanism for the mobile app to renew a session without re-entering credentials.  

**Impact on mobile:** After 30 days, every user loses their session. A mobile app that stores credentials to auto-login every 30 days is UX-hostile and insecure.  

**Fix:** Issue a short-lived access token (15 min–1 hr) and a long-lived refresh token (90 days). Add `POST /auth/refresh` that accepts the refresh token and returns a new access token.

---

### C-4 · SSE Authentication Cannot Work with Mobile EventSource
**File:** `artifacts/api-server/src/lib/sse-broadcast.ts` / SSE connection endpoint  
**Severity:** CRITICAL — Mobile Architecture  

The SSE endpoint requires a Bearer token in the `Authorization` header. **Native mobile EventSource implementations (React Native, Android, iOS) cannot send custom headers** with `EventSource`. Only query-string token delivery works on mobile.  

**Impact on mobile:** Every real-time feature (offer notifications, status changes, chat updates) silently fails on Android and iOS unless this is addressed. The entire SSE layer is broken for mobile.  

**Fix:** Accept the JWT as a `?token=` query parameter on the SSE endpoint. Validate it the same way as the header. Alternatively, replace SSE with WebSockets (`ws` / `socket.io`) which support headers and have better mobile reconnect support.

---

### C-5 · No Phone Number Verification (OTP) at Registration
**File:** `artifacts/api-server/src/routes/auth.ts`  
**Severity:** CRITICAL — Trust / Fraud  

Registration accepts any mobile number without verifying ownership via SMS OTP. A user can register using someone else's phone number and receive notifications and service requests on their behalf.  

**Impact on mobile:** App Store policy (Google Play + Apple App Store) often requires that mobile-authenticated apps verify phone numbers. Without OTP, fraudulent accounts are trivial.  

**Fix:** Integrate an SMS provider (Vonage / Twilio / local Egyptian provider). Add `POST /auth/otp/send` and `POST /auth/otp/verify` before completing registration.

---

## 2. High Priority Issues

Should be fixed before launching to users even if mobile dev has started.

---

### H-1 · Server-Side Logout Does Nothing
**File:** `artifacts/api-server/src/routes/auth.ts:329`  

`POST /auth/logout` only logs the activity. It does not invalidate the token or deactivate the device's push token. A stolen JWT works indefinitely until it expires (30 days). A logged-out user continues to receive push notifications on their device.  

**Fix:** On logout: (1) add token to a Redis/DB blacklist checked by the authenticate middleware, (2) call `DELETE /push-tokens/mine` internally to deactivate the device push token.

---

### H-2 · N+1 Query Anti-Patterns Across Critical Endpoints
**Files:**  
- `requests.ts:374` — loops over requests to fetch offer count + customer per request  
- `requests.ts:786` — loops over requests to fetch service + area per request  
- `offers.ts:129` — loops over offers to fetch technician profile + request details  
- `offers.ts:173` — same pattern  
- `loyalty.ts:1168` — bulk wallet updates in a Promise.all loop  

Each of these performs O(n) sequential DB queries where one JOIN would suffice. Under mobile load (many users, many concurrent requests), these will cause severe latency spikes.  

**Fix:** Replace with Drizzle joins or sub-selects. Batch lookups by ID using `WHERE id IN (...)`.

---

### H-3 · Missing Database Indexes on Foreign Keys and Hot Columns
**Severity:** High — Performance  

The following frequently-queried columns have no index:  
- `service_requests.governorate_id`  
- `service_requests.created_at` (used for pagination/ordering)  
- `offers.status` (used in almost every offer query)  
- `support_tickets.user_id`  
- `ticket_replies.ticket_id`  
- `coin_transactions.wallet_id`  
- `notifications.user_id`  

Mobile list screens (Recent Orders, Active Bids, Wallet History) will degrade quadratically as data grows.  

**Fix:** Add indexes via Drizzle migration or `ALTER TABLE … ADD INDEX`.

---

### H-4 · Loyalty Scheduler Requires Manual HTTP Trigger (No Cron)
**File:** `artifacts/api-server/src/routes/loyalty.ts` — `POST /loyalty/admin/run-scheduler`  

The coin maturation (`maturePendingCoins`) and coin expiry (`expireAvailableCoins`) jobs must be manually triggered via an HTTP request. There is no background cron. If no admin triggers this, **coins never expire and never mature**, breaking the entire time-based loyalty logic.  

**Fix:** Add a startup cron using `node-cron` or `node-schedule`. Schedule maturation daily and expiry nightly. Do NOT rely on an HTTP endpoint for lifecycle-critical operations.

---

### H-5 · No API Versioning
**File:** `artifacts/api-server/src/index.ts`  

All routes are mounted at `/api/...` with no version prefix. Any breaking change to a response shape (adding a required field, removing a field, changing a type) will break all installed mobile app versions with no migration path.  

**Fix:** Mount all routes at `/api/v1/...`. Add an `X-Api-Version` response header. Plan to keep v1 alive while v2 is introduced. This is a structural change that is very hard to retrofit later.

---

### H-6 · No Response Compression (Gzip)
**File:** `artifacts/api-server/src/index.ts`  

The `compression` package is not installed. All API responses are uncompressed. Mobile users on Egyptian 3G/4G networks will suffer significantly larger data usage and slower load times.  

**Fix:** `pnpm add compression`. Add `app.use(compression())` before routes.

---

### H-7 · All File Uploads Proxy Through the API Server
**File:** `artifacts/api-server/src/routes/upload.ts`  

Images and audio files are uploaded to the API server, which then forwards them to Cloudinary (or stores locally). Mobile users uploading a 5MB job photo will send 5MB to the API server, which then re-sends it to Cloudinary. This doubles bandwidth, increases latency, and puts CPU/memory pressure on the API server.  

**Fix:** Implement server-side presigned URL generation (`POST /upload/sign`). The mobile app uploads directly to Cloudinary using the signed URL. The API server only stores the resulting URL.

---

### H-8 · Missing `updatedAt` on Core Tables
**Tables without `updatedAt`:** `services`, `governorates`, `areas`, `messages`, `ratings`, `price_adjustments`  

Mobile apps need delta-sync: "give me everything changed since timestamp X." Without `updatedAt`, the mobile app must re-download all records on every app launch.  

**Fix:** Add `updated_at TIMESTAMPTZ DEFAULT NOW()` to all tables via migration.

---

## 3. Medium Priority Issues

Should be planned for the first sprint, but not day-one blockers.

---

### M-1 · No Input Validation (Zod / Joi)
**Files:** All route files  

Route handlers destructure `req.body` directly with no schema validation. Invalid or malicious inputs (missing required fields, wrong types, excessively long strings) cause unhandled exceptions or silent DB errors.  

**Fix:** Add Zod schemas for all request bodies. Validate in middleware and return `400` with a structured error.

---

### M-2 · Missing Pagination on Reference Data Endpoints
**Files:** `services.ts`, `locations.ts`, `banners.ts`  

These endpoints return all records with no `page`/`limit`. As the platform grows (100+ services, 50+ areas), mobile app list screens will receive unbounded payloads.  

**Fix:** Add `page` + `limit` query params with a sensible default (20–50).

---

### M-3 · No Read Receipts or Unread Count per Conversation
**File:** `artifacts/api-server/src/routes/messages.ts`  

There is no endpoint to mark messages as read, and no per-conversation unread count. The mobile app cannot show badge counts accurately or mark a conversation as "seen."  

**Fix:** Add a `read_at` column to `messages`. Add `POST /messages/:requestId/read`. Return unread count per conversation.

---

### M-4 · No Dispute/Rejection Path from `waiting_approval`
**File:** `artifacts/api-server/src/routes/requests.ts`  

When a technician marks a request as complete (`waiting_approval`), the customer can only approve (→ `completed`). There is no way to dispute, reject, or request a re-visit. The customer is stuck.  

**Fix:** Add `POST /requests/:id/dispute` transitioning to a `disputed` status. Define admin resolution flow.

---

### M-5 · No Missed-Event Recovery for SSE Disconnects
**File:** `artifacts/api-server/src/lib/sse-broadcast.ts`  

When a mobile SSE connection drops (tunnel switch, background app, network change), there is no `Last-Event-ID` / event replay mechanism. Events fired during the disconnected window are permanently lost.  

**Fix:** Use the `id:` SSE field to assign monotonic event IDs. Store the last 100 events per user in Redis or in-memory with a TTL. On reconnect with `Last-Event-ID`, replay missed events.

---

### M-6 · FCM Notification Data Lacks a `screen` / `path` Field
**File:** `artifacts/api-server/src/lib/notifications.ts`  

Push notification data payloads include `type` and `requestId` but no explicit routing key. The mobile app must maintain a client-side mapping from `type` to screen. This mapping must stay in sync with the backend — a maintenance liability.  

**Fix:** Add a `screen` or `path` field to every notification payload (e.g., `"screen": "request-detail"`, `"path": "/customer/requests/42"`).

---

### M-7 · Price Adjustment After Coin Redemption Is Not Reconciled
**File:** `artifacts/api-server/src/routes/requests.ts` (price_adjustment endpoint)  

If a customer applies a coin discount and then the technician submits a price adjustment (higher price), the system does not re-evaluate the coin redemption. The customer_payable_amount may be incorrect after the adjustment is accepted.  

**Fix:** When a price adjustment is approved, recalculate the coin discount against the new agreedPrice. Emit the delta as a coin transaction if more coins are needed or release if fewer are needed.

---

### M-8 · `service_requests.images` Stored as `TEXT[]` (PostgreSQL Array)
**File:** `lib/db/src/schema/index.ts`  

PostgreSQL `TEXT[]` arrays serialize differently across drivers. Mobile apps must handle this as a JSON array. If the column is ever queried raw (e.g., in admin tools or analytics), type handling diverges.  

**Fix:** Change to `JSONB` or ensure every API response explicitly serializes this field as a JSON array. Verify Drizzle always returns `string[]`, never a raw PG array string.

---

### M-9 · Agreed Price Returned as NUMERIC String, Not Number
**File:** Multiple routes  

Drizzle/PostgreSQL `NUMERIC(10,2)` columns are returned as strings (`"1200.00"`). Mobile clients using float parsing (JavaScript, Kotlin, Swift) must explicitly cast. A client treating it as a string in arithmetic will silently produce wrong totals.  

**Fix:** Cast all price/amount fields to `parseFloat` in every route response. Or configure Drizzle's type-override globally.

---

### M-10 · No `app_versions` Table for Forced Updates
**Severity:** Medium  

There is no mechanism for the backend to tell a mobile app "you are out of date and must update." A breaking API change will silently corrupt the experience for users on old versions.  

**Fix:** Add an `app_versions` table (`min_version`, `current_version`, `platform`). Add `GET /app/config` (public) that returns the version gate plus feature flags (loyaltyEnabled, etc.).

---

## 4. Low Priority Improvements

Nice-to-haves for a polished mobile launch.

---

### L-1 · Multer Limit (100MB) vs Express JSON Limit (20MB) Mismatch
**File:** `upload.ts`, `index.ts`  
Inconsistent limits create confusion. Express will reject JSON payloads over 20MB but multer accepts binary uploads up to 100MB. Align them with your product requirements.

---

### L-2 · No Soft-Delete Pattern
Hard deletes on `requests` or `offers` cause 404s in mobile history screens. Consider a `deleted_at` column on key tables so archived records remain accessible to history views.

---

### L-3 · No Device / Session Management
A user logged in on both a phone and a tablet shares a single token. There is no way to "log out of all devices." Add a `user_sessions` table with device fingerprint.

---

### L-4 · No Analytics Events Table
There is no `analytics_events` table for tracking mobile-specific user funnels (e.g., how many users start but abandon a service request). Add one for future product decisions.

---

### L-5 · Logout Does Not Clean Up Push Tokens
`POST /auth/logout` does not call the push-token deactivation logic. Users continue receiving notifications after logout until the token naturally rotates (device reinstall, FCM refresh).

---

### L-6 · No Multi-Language (i18n) in API Error Messages
All error strings are in Arabic hardcoded. A future English-language mobile version would need all `error:` strings to support localization keys.

---

### L-7 · `upload.ts` Has Duplicated Cloudinary vs. Local Storage Logic
The upload route has copy-pasted branching for Cloudinary vs. local disk. Extract into a `StorageService` abstraction so mobile upload endpoints don't have the same duplication.

---

## 5. Recommended Fixes (Priority Order)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | Remove hardcoded super admin credentials | 30 min | 🔴 Critical security |
| 2 | Add `express-rate-limit` on `/auth/*` | 1 hr | 🔴 Critical security |
| 3 | Add SSE query-param auth (`?token=`) | 2 hr | 🔴 Blocks all real-time on mobile |
| 4 | Add `POST /auth/refresh` + short-lived access tokens | 4 hr | 🔴 Auth UX |
| 5 | Add OTP SMS verification | 1 day | 🔴 Trust / App Store |
| 6 | Add `node-cron` for loyalty scheduler | 2 hr | 🔴 Loyalty correctness |
| 7 | Add `compression` middleware | 30 min | 🟠 Bandwidth |
| 8 | Add DB indexes (FK + hot columns) | 2 hr | 🟠 Performance |
| 9 | Add `updatedAt` to all tables | 2 hr | 🟠 Sync |
| 10 | Add API versioning `/api/v1/` | 4 hr | 🟠 Long-term compat |
| 11 | Implement presigned Cloudinary upload URLs | 4 hr | 🟠 Upload UX |
| 12 | Fix N+1 queries with JOINs | 1 day | 🟠 Performance |
| 13 | Add input validation (Zod) | 2 days | 🟡 Robustness |
| 14 | Add message read receipts | 4 hr | 🟡 Chat UX |
| 15 | Add `screen` field to push payloads | 1 hr | 🟡 Deep linking |
| 16 | Add `GET /app/config` version gate | 2 hr | 🟡 Forced updates |
| 17 | Fix NUMERIC prices to parse as floats | 1 hr | 🟡 Data types |
| 18 | Add SSE missed-event replay | 1 day | 🟡 Reliability |
| 19 | Add pagination to services/locations/banners | 2 hr | 🟡 Scalability |
| 20 | Add dispute flow from `waiting_approval` | 4 hr | 🟡 Business logic |

---

## 6. Risk Estimates

### Android Risk: **HIGH**

| Area | Risk | Reason |
|------|------|--------|
| Authentication | HIGH | 30-day token with no refresh will force logouts; no OTP |
| Real-time (SSE) | CRITICAL | Android EventSource cannot send headers — SSE silently broken |
| Push Notifications | MEDIUM | FCM token registration exists; logout doesn't clean up |
| File Uploads | MEDIUM | All traffic through API server; no presigned URLs |
| Performance | HIGH | N+1 queries + no indexes will degrade on Android's reactive UIs |
| Security | CRITICAL | No rate limiting; hardcoded credentials in source |

### iOS Risk: **HIGH**

| Area | Risk | Reason |
|------|------|--------|
| Authentication | HIGH | Same as Android; no refresh; no OTP |
| Real-time (SSE) | CRITICAL | iOS EventSource identical constraint — cannot send Authorization header |
| Push Notifications | MEDIUM | APNS config is present; `priority: high` is set |
| App Store Approval | HIGH | No OTP verification is a known rejection reason; rate limiting absence may trigger security review |
| Background Behavior | MEDIUM | SSE not usable in iOS background; need push notifications as fallback for all events |
| Security | CRITICAL | Same as Android |

---

## 7. Final Answer

### Is the backend production-ready for Android and iOS development to start today?

**No. There are 5 blockers that must be fixed before a mobile app can function correctly:**

---

**BLOCKER 1 — SSE is broken on mobile**  
The real-time layer (offers, status changes, chat notifications) relies on SSE with an `Authorization` header. Native mobile EventSource cannot send custom headers. Every real-time feature silently fails on Android and iOS. **Fix first: accept the JWT as a `?token=` query param on the SSE endpoint.**

**BLOCKER 2 — Hardcoded admin credentials in source code**  
Anyone with access to the backend repository (CI/CD logs, npm registry, a decompiled server bundle) has full admin access. This is an immediate security breach waiting to happen. **Fix: move to environment secrets and remove the hardcoded fallback.**

**BLOCKER 3 — No rate limiting**  
Without rate limiting on login and registration, the API is immediately vulnerable to brute force and credential stuffing. Any app store security review, penetration test, or motivated attacker will exploit this. **Fix: `express-rate-limit` on auth routes before going live.**

**BLOCKER 4 — No token refresh**  
30-day JWTs with no refresh endpoint means every user is forcibly logged out at the 30-day mark. A mobile app cannot gracefully handle session expiry without a refresh flow. **Fix: short-lived access tokens + refresh tokens.**

**BLOCKER 5 — Loyalty scheduler has no cron job**  
The coin maturation and expiry logic only fires when an admin manually POSTs to an endpoint. Without a background cron, the loyalty system is frozen in time: coins never mature, never expire. If customers earn coins but they never mature, the feature appears broken. **Fix: add `node-cron` at server startup.**

---

**After those 5 blockers are resolved**, the backend provides a solid enough foundation for mobile development to begin in parallel with the high and medium priority fixes. The overall architecture (JWT Bearer tokens, FCM push, Drizzle + PostgreSQL, role-based access) is mobile-compatible. The codebase is clean, Arabic-first, and coherent. The risk items above are all fixable — none require a rewrite.

**Estimated time to clear all 5 blockers: 2–3 focused engineering days.**
