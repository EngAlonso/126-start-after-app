---
name: Fnashha message delivered state
description: Backend had no is_delivered concept; full implementation required DB column + route + SSE event for correct WhatsApp-style ✓✓ gray tick.
---

## What was missing

The messages table only had `is_read`. There was NO `is_delivered` column. The frontend showed ✓✓ gray (delivered) immediately after the POST 201 response — semantically wrong.

## What was implemented

**Backend:**
- `is_delivered BOOLEAN NOT NULL DEFAULT FALSE` added to `messages` table (schema + alterDDL)
- `PATCH /api/requests/:requestId/messages/deliver-all` — marks undelivered messages from other party as delivered, broadcasts `messages_delivered` SSE to sender(s)

**Frontend (Expo):**
- `isDelivered: boolean` added to `Message` type
- `MessageTick` gains a `sent` state (single solid tick) — now 4 states: sending/sent/delivered/read
- Chat screen calls `deliver-all` then `read-all` on every message fetch (fire-and-forget)
- `useSse` handles `messages_delivered` event → invalidates `messages` query key
- Tick logic: `_isOptimistic → sending`, `isRead → read`, `isDelivered → delivered`, else → `sent`

## State semantics

| State | Tick | Condition |
|---|---|---|
| sending | ✓ faded | _isOptimistic flag on local cache entry |
| sent | ✓ solid | Server confirmed (no _isOptimistic), isDelivered=false, isRead=false |
| delivered | ✓✓ gray | Recipient device fetched messages (isDelivered=true) |
| read | ✓✓ blue | Recipient opened chat (isRead=true) |

**Why deliver-all is called first:** ensures sender sees delivered → read in order (both happen nearly simultaneously when recipient opens chat, but ordering matters for brief window).
