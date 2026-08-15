---
name: Fnashha Flutter mobile foundation
description: Phase 1 Flutter app architecture decisions and constraints for the Fnashha mobile client.
---

The Fnashha Flutter app lives at `mobile/` (repo root, outside `artifacts/`
and outside the pnpm workspace) because Replit has no Flutter artifact type
and no Flutter preview/emulator integration — user explicitly chose to
proceed with Flutter anyway, accepting no in-workspace preview. Verify with
`cd mobile && flutter analyze` / `flutter test`, not a Screenshot tool call.

**Dependency conflict to remember:** `riverpod_lint`/`riverpod_generator`'s
current versions require `freezed_annotation ^2.2.0`, which conflicts with
`freezed ^3.x`. Riverpod is used without codegen (plain `Provider`,
`NotifierProvider`, `AsyncNotifierProvider`) to avoid this — don't add
`riverpod_generator`/`riverpod_lint` without re-checking this conflict is
resolved upstream.

**Riverpod 3.x API differences from older tutorials:** no `StateProvider`
exported from the main `riverpod.dart` (it's in `providers/legacy/`, use a
`Notifier<T>` class instead); `AsyncValue` has no `valueOrNull` — use
`.asData?.value` instead.

Full architecture (folder layout, package choices, auth flow, theme,
routing, SSE client design, base-URL config via `--dart-define=API_HOST`)
is documented in `mobile/ARCHITECTURE.md` — read that file directly rather
than duplicating it here.
