# 04 — Authentication

---

## Overview

Authentication uses **JWT access tokens (15 min)** + **refresh tokens (30 days)**. Both are stored in `AsyncStorage`. The backend uses hash-only DB storage + rotation-with-reuse-detection to prevent token theft.

---

## AuthContext (`contexts/AuthContext.tsx`)

### State Exposed
```ts
interface AuthContextValue {
  user: AppUser | null;
  accessToken: string | null;
  login(user: AppUser, accessToken: string, refreshToken: string): void;
  logout(): void;
  updateUser(partial: Partial<AppUser>): void;
}
```

### AppUser Shape
```ts
interface AppUser {
  id: number;
  role: 'customer' | 'technician';
  fullName: string;
  mobile: string;
  profileImage?: string;
  status: 'active' | 'pending' | 'suspended';
  // ... additional fields
}
```

### AsyncStorage Keys
Stored in `AsyncStorage` (from `constants/brand.ts`):
- `fnashha_expo_user` — serialized `AppUser`
- `fnashha_expo_access_token` — JWT access token string
- `fnashha_expo_refresh_token` — refresh token string
- `fnashha_theme_mode` — `'dark'` or `'light'`

---

## Token Refresh (401 Auto-Retry)

When any `apiFetch` call returns **401**, the global refresh handler fires automatically:

1. Calls `POST /api/auth/refresh` with the stored refresh token.
2. If successful: stores new `accessToken` + `refreshToken`, retries the original request.
3. If refresh fails: calls `logout()` → user is sent to login screen.

The handler is registered via `setRefreshHandler()` in `AuthContext`. It is set up once when the provider mounts.

**Do not manually handle 401 in screen code.** `useAuthedFetch` and `apiFetch` handle this transparently.

---

## API Hooks

### `useAuthedFetch` (preferred for authenticated calls)
```ts
const authedFetch = useAuthedFetch();
const data = await authedFetch<ResponseType>('/api/requests?role=customer');
```
Automatically injects `Authorization: Bearer <token>` and handles 401 refresh.

### `apiFetch` (for non-hook contexts or mutations)
```ts
import { apiFetch } from '@/hooks/useApi';
const result = await apiFetch('/api/notifications/read-all', {
  method: 'POST',
  token: accessToken,
});
```

### `apiUpload` (for file uploads)
```ts
import { apiUpload } from '@/hooks/useApi';
const { url } = await apiUpload<{ url: string }>(
  '/api/upload/user?category=profiles',
  formData,
  accessToken,
);
```

---

## Login Flow

1. User submits phone + password on `/login`.
2. `POST /api/auth/login` → `{ accessToken, refreshToken, user }`.
3. `login(user, accessToken, refreshToken)` is called on `AuthContext`.
4. Tokens + user saved to AsyncStorage.
5. `AuthGate` re-renders → navigates to appropriate tab group.

---

## Logout Flow

1. `logout()` called (from account screen or after refresh failure).
2. AsyncStorage cleared (user, tokens).
3. AuthGate navigates to guest stack (`/`).

---

## Registration

- **Customer:** `POST /api/auth/register` → auto-login → customer tabs.
- **Technician:** `POST /api/auth/register/technician` → account stays `pending` until admin approves → no auto-login; technician sees "pending approval" screen.

---

## Role-Based Rendering

In screens that serve both roles (e.g., `requests/[id].tsx`):

```ts
const { user } = useAuth();
const isCustomer   = user?.role === 'customer';
const isTech       = user?.role === 'technician';
const isSelectedTech = isTech && request.selectedTechnicianId === user?.id;
const showPhone    = isCustomer || isSelectedTech;
```

---

## Phone Number Privacy

- **Backend:** strips `customer.mobile` from `GET /api/requests/:id` response for non-selected technicians.
- **Frontend guard:** `showPhone = isCustomer || isSelectedTech` in `requests/[id].tsx` → passed as prop to `RequestInfoCard`.
- Non-selected technicians see `'••••••••'` for phone and `'—'` for name.

---

## Rate Limiting

- Login: 5 attempts per 15 minutes per IP.
- Register: 5 attempts per hour per IP.
- Applied via shared factory in `middlewares/rate-limit.ts` (API server).

---

## SSE Authentication

SSE connections support `?token=<accessToken>` query param fallback (in addition to the standard `Authorization` header) because EventSource doesn't support custom headers. See `09_CHAT_AND_NOTIFICATIONS.md`.

---

*Last updated: July 2026*
