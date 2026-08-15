---
name: Fnashha Expo audio playback
description: Root cause and fix for voice recording upload succeeding but producing no audio on native Expo.
---

# Expo audio playback — root cause & fix

## Rule
Any audio attached to a service request must be played via `Audio.Sound` (expo-av). The web uses `<audio controls src={req.audioUrl}>`. Expo must resolve relative URLs via `apiUrl()` and use `Audio.Sound.createAsync` with `setAudioModeAsync` before playback.

**Why:** expo-av on iOS (AVPlayer) and Android (MediaPlayer) require either the file extension or a correct MIME Content-Type to detect the codec. `express.static` serves `.bin` files as `application/octet-stream`, which both platforms silently reject. Web browsers sniff the binary format and play anyway, masking the bug on web.

## Three causes, all fixed in Expo only (backend untouched)

### 1. Missing audio player in request detail (`requests/[id].tsx`)
`RequestInfoCard` had zero code for `request.audioUrl`. Added `Audio.Sound` playback with:
- `useRef<Audio.Sound | null>(null)` + `useState(isPlaying)`
- `useEffect` cleanup → `soundRef.current?.unloadAsync()`
- `handleAudioToggle`: first press → `setAudioModeAsync` + `createAsync({ shouldPlay: true })`; subsequent → `pauseAsync` / `playAsync`
- `onPlaybackStatusUpdate` callback resets `isPlaying` on `didJustFinish`
- URL resolved: `request.audioUrl.startsWith('http') ? url : apiUrl(url)`
- UI: `infoAudioRow` + `infoAudioBtn` styles, play/pause Feather icon

### 2. Missing audio preview in create-request form (`services/[id].tsx`)
After upload, only filename + remove button were shown. Added:
- `previewSoundRef` + `isPreviewPlaying` state
- `handlePreviewToggle` using `resolveMediaUrl(audioUrl)` for URL resolution
- `clearAudio` now unloads preview sound before clearing state
- `useEffect` cleanup extended to also unload `previewSoundRef`
- `audioPlayBtn` style added; play/pause button inserted between filename and trash button

### 3. Live recordings saved as `.bin` instead of `.m4a`
Recording filename was `'تسجيل صوتي مباشر'` (no extension). `saveFile` falls back to `.bin`.
Fixed by changing filename to `'voice_recording.m4a'` in `handleStopRecording` call.
File-picked audio already had correct extensions — only live recordings were affected.

## How to apply
- New audio features that use `Audio.Sound`: always call `setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })` before `createAsync`.
- Always unload sounds in `useEffect` cleanup: `soundRef.current?.unloadAsync().catch(() => {})`.
- Never pass a filename without extension to `uploadFile`/`uploadAudioUri` — use `voice_recording.m4a` or `<name>.ext` form.
- Relative `/uploads/...` paths from the API always need `apiUrl()` prepended on Expo native.
