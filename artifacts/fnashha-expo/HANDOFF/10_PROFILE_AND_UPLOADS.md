# 10 — Profile and Uploads

---

## Profile Editing (`app/edit-profile.tsx`)

### Who Uses This Screen
Both **customers** and **technicians** share the same screen. Technician-specific sections (area selection, service badges) are conditionally rendered based on `user.role`.

### Form Fields

| Field | Type | Applies To |
|---|---|---|
| `fullName` | text | All |
| `email` | email | All |
| `password` / `confirmPassword` | text | All (optional change) |
| `profileImage` | image | All |
| `selectedAreaIds` | number[] | Technicians only |

### Save Flow
1. Validate inputs (password match, etc.).
2. `PATCH /api/users/:id` with updated fields.
3. Call `updateUser(updatedUser)` on `AuthContext` to update in-memory + AsyncStorage user object.

### Technician Area Updates
Technician service areas are updated separately via a dedicated mutation — not part of the main `PATCH /api/users/:id` call.

---

## Profile Image Upload

### Why the Blob Approach Is Required

React Native's `FormData` with `{uri, type, name}` object shorthand:
- ❌ **iOS:** Sometimes sends the wrong MIME type for HEIC photos.
- ❌ **Expo Web:** Completely rejects the `{uri, type, name}` shorthand.

The **Blob fetch approach** is the only cross-platform reliable method.

### Implementation Pattern

```ts
// 1. Pick image with expo-image-picker
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.8,
});
const asset = result.assets[0];

// 2. Fetch the URI as a Blob
const fileResponse = await fetch(asset.uri);
const blob = await fileResponse.blob();

// 3. Force MIME type to image/jpeg (regardless of source format)
const jpegBlob = blob.slice(0, blob.size, 'image/jpeg');

// 4. Build FormData and upload
const formData = new FormData();
formData.append('file', jpegBlob, 'photo.jpg');

const uploadedUrl = await apiUpload(
  '/api/upload/user?category=profiles',
  formData,
  accessToken
);

// 5. Update the user's profileImage field
await apiFetch(`/api/users/${user.id}`, 'PATCH', { profileImage: uploadedUrl }, token);
```

### Upload Endpoint
```
POST /api/upload/user?category=<category>
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
Field: file
```

**Categories:**
| Category | Usage |
|---|---|
| `profiles` | Profile photos |
| `requests` | Request-attached images |
| `chat` | Chat image messages |

Files are stored on disk (not Cloudinary). Cloudinary is used only for CMS content.

### `apiUpload` Function (`hooks/useApi.ts`)
```ts
async function apiUpload(path: string, formData: FormData, token?: string): Promise<string>
```
- POSTs with `Authorization: Bearer <token>` if token provided.
- Does **not** set `Content-Type` manually — let the browser/runtime set it with the boundary automatically.
- Returns the uploaded file URL as a string.
- Parses error responses and throws on non-OK status.

---

## Request Attachments

Customers can attach images when submitting a service request (`app/services/[id].tsx`):

```
POST /api/upload/user?category=requests
```

Technicians can attach a supporting image when requesting a price change (`app/requests/[id].tsx`):
- Same upload endpoint with `category=requests`.
- URL is included in the `POST /api/requests/:id/price-adjustment` body as `supportingImage`.

---

## Audio Recordings

### Recording
- Uses `expo-av` (`Audio.Recording`).
- Recorded in the service request form for audio descriptions.
- Uploaded as a file, same endpoint as other user uploads.

### Playback
- Also uses `expo-av` (`Audio.Sound`).
- Playback UI exists in both the chat screen and the request detail screen.
- ⚠️ Live recordings from earlier sessions may have a `.bin` extension — this was a known bug that was fixed (see `15_COMPLETED_FIXES.md`).

---

## AuthContext — User Object Updates

After any profile change, the in-memory user must be synced:

```ts
const { updateUser } = useAuth();
// After successful PATCH:
updateUser({ ...user, fullName: newName, profileImage: newUrl });
```

`updateUser` saves to both `AuthContext` state and `AsyncStorage` so the update persists across restarts.

---

## Permissions

Declared in `app.config.js` and required before accessing camera/library:

```js
// iOS
infoPlist: {
  NSCameraUsageDescription: '...',
  NSPhotoLibraryUsageDescription: '...',
}
// Android
permissions: ['CAMERA', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']
```

Request permissions before launching the picker:
```ts
const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (status !== 'granted') { /* show alert */ return; }
```

---

*Last updated: July 2026*
