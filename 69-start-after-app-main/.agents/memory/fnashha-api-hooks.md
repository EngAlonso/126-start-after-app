---
name: Fnashha Generated API Hook Signatures
description: Generated hooks use positional args not object params — critical to avoid [object Object] URL bugs.
---

## Rule
Generated hooks in `lib/api-client-react/src/generated/api.ts` take **positional arguments**, not an object.

## Examples
- `useListMessages(requestId: number, options?)` — NOT `useListMessages({ requestId } as any)`
- `getListMessagesQueryKey(requestId: number)` — NOT `getListMessagesQueryKey({ requestId } as any)`
- `useSendMessage()` mutate takes `{ requestId, data }` — this one IS an object (mutation props)

**Why:** Calling with an object instead of a number makes the URL `/api/requests/[object Object]/messages` → silent 404, no messages appear. This is the root cause of the chat-not-working bug that was hard to find.

**How to apply:** Before using a generated hook, read its signature from the generated file at lines ~3059–3210 for messages. Always check positional vs object params.
