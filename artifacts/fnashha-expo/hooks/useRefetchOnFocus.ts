/**
 * useRefetchOnFocus
 *
 * Calls the supplied refetch functions every time the screen gains focus,
 * skipping the very first focus (initial mount) so we never double-fetch.
 *
 * Usage:
 *   const { data, refetch } = useQuery({ ... });
 *   useRefetchOnFocus([refetch]);
 *
 *   // Multiple queries:
 *   useRefetchOnFocus([refetchA, refetchB, refetchC]);
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

export function useRefetchOnFocus(refetches: Array<() => unknown>): void {
  // Keep a ref so the callback always sees the latest refetch functions
  // without needing them in the useCallback deps array.
  const refetchesRef = useRef(refetches);
  refetchesRef.current = refetches;

  // Track whether this is the initial focus (mount) so we skip it.
  const hasMountedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      refetchesRef.current.forEach(fn => fn());
    }, []), // empty deps — intentional; latest fns are accessed via ref
  );
}
