---
name: Fnashha Expo SSE on native
description: React Native has no built-in EventSource; the useSse hook must use XHR+onprogress for real-time streaming on iOS/Android.
---

## Root cause

`Platform.OS !== 'web'` immediately takes a polling branch — 30-second `setInterval`. The EventSource code (lines 71–148) is never reached. React Native has no global `EventSource`.

## Fix

Use `XMLHttpRequest` with `onprogress`. RN's XHR fires `onprogress` for every received chunk, giving true real-time delivery without any new packages.

Key pattern:
```ts
let processedLen = 0;
let buffer = '';

xhr.onprogress = () => {
  const newText = xhr.responseText.slice(processedLen);
  processedLen = xhr.responseText.length;
  buffer += newText;

  const events = buffer.split('\n\n');
  buffer = events.pop() ?? '';

  for (const block of events) {
    let eventType = 'message';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventType = line.slice(6).trim();
    }
    handleSseEvent(eventType);
  }
};
```

**Why XHR over fetch+ReadableStream:** XHR.onprogress is battle-tested in RN since 0.62. fetch streaming (response.body.getReader()) is available in Expo SDK 54 / RN 0.76 but has less predictable buffering behavior in the metro bundler environment.

**Why not a package:** react-native-sse is a thin wrapper around XHR. Doing it directly avoids a dependency and is easier to debug.
