---
name: Fnashha Flutter Riverpod 3.3 API gotchas
description: Compile errors seen when writing new Riverpod notifiers/provider scopes against riverpod 3.3.2 in the mobile app.
---

`AutoDisposeNotifier<T>` / `AutoDisposeAsyncNotifier<T>` do not exist in riverpod 3.3.2 — they were removed. Always extend plain `Notifier<T>` / `AsyncNotifier<T>` and get autoDispose behavior from the provider constructor instead: `NotifierProvider.autoDispose<MyNotifier, MyState>(MyNotifier.new)`. Same `Notifier`/`AsyncNotifier` class works for both autoDispose and non-autoDispose providers.

`ProviderScope` no longer accepts a `parent` constructor argument (no more `ProviderScope(parent: ProviderScope.containerOf(context), child: ...)` pattern). Route/bottom-sheet builders (`showModalBottomSheet`, dialogs, etc.) don't need a manually-scoped `ProviderScope` — they already inherit the ancestor `ProviderScope` since the overlay is part of the same widget tree. Just return the widget directly from the builder.

**Why:** these are recurring copy-paste patterns from Riverpod 2-era code/tutorials; riverpod 3.3.2 (pinned in this project's pubspec) removed both APIs, causing `extends_non_class` / `undefined_named_parameter` analyzer errors that look unrelated to the actual bug.

**How to apply:** when adding a new Notifier or a modal/bottom-sheet in the Flutter app, check `flutter analyze` immediately — these two mistakes are the most common self-inflicted compile errors in new technician/customer feature code.
