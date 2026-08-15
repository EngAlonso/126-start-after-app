/**
 * Singleton QueryClient shared across the entire app.
 *
 * Exported from a dedicated module so AuthContext can call queryClient.clear()
 * inside logout() without creating a circular dependency with _layout.tsx.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});
