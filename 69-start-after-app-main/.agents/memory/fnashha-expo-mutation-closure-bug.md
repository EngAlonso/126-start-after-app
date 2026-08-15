---
name: Fnashha Expo chat send stale closure bug
description: React Query v5 propagates new observer options to pending mutations on re-render — mutationFn closure with mutable state causes 400 errors when onMutate calls setState.
---

## The Bug

In React Query v5, `MutationObserver.setOptions()` propagates new options to the currently-pending mutation (`currentMutation.setOptions(this.options)`) every time the React component re-renders. The `Mutation.execute()` body reads `this.options.mutationFn` at execution time (not at mutation-creation time).

Sequence that causes silent send failure:
1. `mutate()` called — mutationFn closure captures `text = "hello"`
2. `await onMutate()` runs — calls `setText('')` → queues React re-render
3. `await` yields; React flushes the update — component re-renders with `text = ''`
4. Observer's `setOptions()` propagates NEW mutationFn (closure with `text = ''`) to the running mutation
5. Retryer calls `this.options.mutationFn(variables)` — now uses the new closure → `content: ''`
6. Backend returns 400 `{ error: "الرسالة فارغة" }`
7. No onError handler → optimistic message disappears silently

## Fix

**Always pass mutable state as mutation variables, never rely on closure.**

```ts
// WRONG
mutationFn: () => apiFetch(url, { body: JSON.stringify({ content: text.trim() }) }),
onMutate: () => { setText(''); },
mutate();

// CORRECT
mutationFn: (content: string) => apiFetch(url, { body: JSON.stringify({ content }) }),
onMutate: (content: string) => { /* use content variable */ setText(''); },
mutate(text.trim());  // snapshotted before onMutate re-renders
```

Also always add `onError` handler to remove optimistic entry and show an Alert.

## Source proof

- `query-core@5.100.9/src/mutationObserver.ts` lines 91-92: `this.#currentMutation.setOptions(this.options)`
- `query-core@5.100.9/src/mutation.ts` line 190: `return this.options.mutationFn(variables)` — reads at call time

**Why:** React Query keeps options in a live ref so callbacks always see the latest closures. Side-effect: mutationFn is also "live". Any setState in onMutate that re-renders the component before the retryer invokes mutationFn will silently overwrite captured variables.
