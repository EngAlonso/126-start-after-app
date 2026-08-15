# 09 — Chat and Notifications

---

## Real-Time Architecture: SSE

The app uses **Server-Sent Events (SSE)** for all real-time updates. There is no WebSocket.

### Hook: `hooks/useSse.ts`

- On **web** (`Platform.OS === 'web'`): uses the native `EventSource` API.
- On **native** (iOS / Android): uses `XMLHttpRequest` with `onprogress` for true streaming SSE — `EventSource` is not available in React Native's JS engine.
- On reconnect: calls `queryClient.invalidateQueries()` with **no arguments** — this triggers a full cache refresh, not a targeted invalidation.

### Where `useUserEvents()` is Called

The hook **must be called** (not just imported) inside the customer and technician layout components:
- `app/(customer)/_layout.tsx`
- `app/(technician)/_layout.tsx`

Omitting the call silences all real-time events for that role.

### SSE Events Handled

| Event Name | Action |
|---|---|
| `new_message` | Invalidates conversations + messages cache |
| `messages_read` | Invalidates messages cache |
| `messages_delivered` | Invalidates messages cache |
| `notification` | Invalidates notifications cache |
| `request_update` | Invalidates requests cache |
| reconnect | Full `invalidateQueries()` (no key) |

---

## Chat Module

### Conversations List (`app/messages/index.tsx`)

- Fetches `GET /api/conversations`
- Raw response is **snake_case** (direct SQL join result) — mapped to camelCase `Conversation` type via `toConversation()`:

```ts
interface RawConversation {
  request_id:       number;
  status:           string;
  service_name:     string;
  customer_id:      number;
  customer_name:    string;
  technician_id:    number | null;
  technician_name:  string | null;
  last_message:     string | null;
  last_message_at:  string | null;
  last_message_type: string | null;
  message_count:    number;
  unread_count:     number;
}
```

- `otherUser` is the **other party** — resolved by comparing `customer_id` with the current user's `id`.
- RTL child order in `topRow`: name (RIGHT/leading), time (LEFT/trailing).
- RTL child order in `bottomRow`: preview (RIGHT/leading), unread badge (LEFT/trailing).

### Chat Screen (`app/messages/[requestId].tsx`)

- Route param: `requestId` (number as string)
- Sends messages via `POST /api/messages` with optimistic updates.
- Uses `useMutation` with optimistic state — the message appears immediately in the list before the server confirms.

> **Critical:** React Query v5 live-updates mutation options on re-render. Never capture mutable state (like tokens) in `mutationFn` via closure — always pass them as `variables`. See `18_AGENT_NOTES.md`.

- Marks messages delivered on screen mount.
- Marks messages read on screen focus.

### Message Types

```ts
type MessageType = 'text' | 'image' | 'audio';
```

There is **no `voice` type** in the DB enum. Audio messages use `type: 'audio'`.

### Audio Playback

- Audio playback is implemented in both the chat screen and request detail.
- Recordings are stored server-side; the file extension on live recordings was `.bin` (now fixed to play correctly — see `15_COMPLETED_FIXES.md`).

---

## Notifications

### Notification Screen (`app/notifications.tsx`)

- Fetches `GET /api/notifications`
- RTL layout: icon on RIGHT (leading), content on LEFT.
- `direction: 'rtl'` explicitly set on the root View.

### Push Notifications

Managed by `hooks/usePushNotifications.ts`, called from `app/_layout.tsx`.

#### Registration Flow
1. Request permission via `expo-notifications`.
2. Get device push token via `Notifications.getDevicePushTokenAsync()` (FCM on Android, APNs on iOS).
3. Register token with backend: `POST /api/push-tokens`.
4. Listen for token rotation and re-register on change.

#### Android Channel
```ts
Notifications.setNotificationChannelAsync('fnashha_default', {
  name: 'Fnashha Notifications',
  importance: Notifications.AndroidImportance.MAX,
});
```

#### Cold-Start Handling
`Notifications.getLastNotificationResponseAsync()` is called in `_layout.tsx` to handle notifications that launched the app from a terminated state.

#### Deduplication Guards
- `inFlightRef` — prevents overlapping registration calls.
- `lastHandledIdRef` — prevents double-handling of the same notification tap.
- Token registration is skipped if the token in AsyncStorage matches the current device token.

#### Notification Routing (`lib/notificationRouter.ts`)
Maps notification type/data to the correct screen. Called from notification tap handlers in `_layout.tsx`.

| Notification Type | Destination |
|---|---|
| `new_message` | `/messages/[requestId]` |
| `request_update` | `/requests/[id]` |
| `status_change` (title = "تقييم جديد") | `/tech-ratings` |
| others | `/notifications` |

#### ⚠️ iOS Safari / Cross-Origin Guard
```ts
// NEVER call this raw in render — it throws SecurityError in cross-origin iframes
const isWebPushSupported = useMemo(() => {
  try { return 'PushManager' in window && 'Notification' in window; }
  catch { return false; }
}, []);
```

#### Backend Push Types
6 push event types registered: `new_message`, `request_update`, `offer_received`, `offer_selected`, `job_complete`, `price_change`.

---

## Unread Badge

- `unreadCount` is included in each `Conversation` object from the API.
- The conversations list and tab bar badge both use this value.
- Badge is updated in real-time via SSE → `new_message` event → cache invalidation.

---

*Last updated: July 2026*
