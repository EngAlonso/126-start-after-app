---
name: Fnashha Flutter Phase 11C — Technician Chat
description: How technician chat was implemented by reusing the existing customer chat module instead of duplicating it.
---

The chat module (`ConversationsScreen`, `ChatScreen`, `chatServiceProvider`, `messagesProvider`, `chatSseProvider`) was already role-agnostic: `/api/conversations` filters by `customer_id = me OR selected_technician_id = me` server-side, so no separate technician conversations screen/provider was needed — only new navigation entry points into the same screens.

Backend `message_type` enum is `('text','image')` only — no voice/audio message type exists in the DB or `messages.ts` routes. `ChatComposer` already has a comment noting voice is intentionally omitted for this reason; do not add a fake voice-record UI without a backend change (out of scope for a "don't invent APIs" task).

`ConversationsScreen`'s tap handler previously passed only `serviceName`/`status` as router `extra`, never `otherName`/`otherImage`, so `ChatScreen`'s AppBar fell back to placeholder text for the header — added `ConversationModel.otherPartyName/otherPartyImage(currentUserId)` helpers (shared by `ConversationTile` and the screen) to fix this using data already in the payload, no extra fetch.

List-derived `RequestModel`s (from `techMyJobsProvider`, `techLatestRequestsProvider`) do NOT have `.customer` populated (only the detail endpoint joins it) — quick "open chat" actions added from list rows (My Jobs cards, active-jobs banner) intentionally push `RoutePaths.chat(id)` with no/partial `extra`, matching the existing precedent in `notifications_screen.dart` (`new_message` deep link also omits extras) rather than doing an extra fetch just for cosmetic AppBar text.

**Why:** avoids duplicating chat screens/providers per role and avoids inventing backend capability; keeps the "reuse, don't fork" instruction intact across roles.

**How to apply:** any new role that needs chat should reuse `RoutePaths.chat`/`RoutePaths.conversations` + the same providers; only add a navigation entry point (icon/button) for that role, not new chat infra.
