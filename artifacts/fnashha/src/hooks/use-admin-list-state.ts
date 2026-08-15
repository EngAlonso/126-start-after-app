import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";

type QueryValue = string | number | null | undefined;

/**
 * Keeps Admin list controls in the URL so browser history and refreshes
 * restore the same filters, tabs, sorting, and pagination.
 */
export function useAdminListState() {
  const [location, navigate] = useLocation();
  const search = useSearch();

  const params = useMemo(() => new URLSearchParams(search), [search]);

  const updateQuery = useCallback(
    (updates: Record<string, QueryValue>, options?: { replace?: boolean }) => {
      const next = new URLSearchParams(search);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });

      const query = next.toString();
      navigate(`${location}${query ? `?${query}` : ""}`, options);
    },
    [location, navigate, search],
  );

  return { params, updateQuery };
}
