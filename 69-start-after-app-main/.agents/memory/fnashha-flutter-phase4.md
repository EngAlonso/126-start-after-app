---
name: Fnashha Flutter Phase 4 — Services + Create Request
description: Architecture decisions for the Services module and Create Request wizard in the Flutter mobile app.
---

## Riverpod 3 gotchas (flutter_riverpod: ^3.3.2)

- **No `StateNotifier`/`StateNotifierProvider`** — use `Notifier<T>` + `NotifierProvider<T>`.
- **No `StateProvider`** — use `Notifier<T>` with a public `update()` method.
- **`.state` is protected** on `Notifier` — setting it from outside (e.g. the screen) generates `invalid_use_of_protected_member`. Always expose a named method like `update(String v)` or `clear()` on the notifier and call that from the screen.
- `ref` is a built-in property on `Notifier` subclasses — no constructor injection needed.

**Why:** Riverpod 3 removed these legacy APIs; the project uses flutter_riverpod ^3.3.2.

## HomeNavDestination enum

Has exactly these values: `home`, `requests`, `wallet`, `notifications`, `profile`.
There is no `services` or `offers` value. Phase 4 adds the services route via navigation inside the home/services tap handlers, NOT via a new nav-bar tab.

## create_request_screen.dart — key patterns

- Pre-fills fullName/mobile in `addPostFrameCallback` by reading `authControllerProvider.asData?.value` and casting to `Authenticated`.
- Service picker reuses `servicesProvider` from `catalog_providers.dart` — no extra network call.
- Governorate/area cascade: `areasProvider` returns all areas; filter locally by `governorateId`. Reset `_areaId = null` when governorate changes.
- Audio recording: `AudioRecorder.hasPermission()` in `record` v5 both checks AND requests permission on mobile. Call it before `start()`.
- Images: `ImagePicker.pickMultiImage()`, upload immediately via `UploadService(UploadCategory.requestPhoto)`, store `(localPath, remoteUrl)` pairs.
- Audio upload uses `UploadCategory.voiceNote`.

## AppSecondaryButton location

Defined in `mobile/lib/widgets/common/app_button.dart` (same file as `AppButton`, NOT a separate file). Import `app_button.dart` to get both.

## Plain Dart models for new entities

`RequestModel` was written as a plain Dart class (no Freezed) to avoid needing `build_runner`. Existing Freezed models stay as-is. This is the right approach for new models added without regenerating code.

## serviceByIdProvider pattern

```dart
final serviceByIdProvider = Provider.family<ServiceModel?, int>((ref, id) {
  return ref.watch(servicesProvider).asData?.value
      .where((s) => s.id == id).firstOrNull;
});
```
Returns `null` while async, no async/await needed.
