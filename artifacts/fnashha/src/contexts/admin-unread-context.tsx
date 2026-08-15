import { useQueryClient } from "@tanstack/react-query";
import { getGetAnalyticsOverviewQueryKey } from "@workspace/api-client-react";

export type UnreadType = "requests" | "technicians" | "support";

// ── Module-level sets — survive React re-renders and route changes ─────────────
const sessionSeen: Record<UnreadType, Set<number>> = {
  requests: new Set(),
  technicians: new Set(),
  support: new Set(),
};

// Populated by list pages so detail pages know whether an item was unread
const knownUnread: Record<UnreadType, Set<number>> = {
  requests: new Set(),
  technicians: new Set(),
  support: new Set(),
};

const analyticsKey: Record<UnreadType, string> = {
  requests: "newRequests",
  technicians: "unreadTechnicians",
  support: "unreadSupportTickets",
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAdminUnread() {
  const qc = useQueryClient();

  /**
   * Call when the admin opens a detail view.
   * wasUnread = true  → badge decrements immediately via setQueryData
   */
  const markSeen = (type: UnreadType, id: number, wasUnread: boolean) => {
    if (sessionSeen[type].has(id)) return;
    sessionSeen[type].add(id);
    knownUnread[type].delete(id);

    if (wasUnread) {
      const field = analyticsKey[type];
      qc.setQueryData(getGetAnalyticsOverviewQueryKey(), (old: any) => {
        if (!old) return old;
        return { ...old, [field]: Math.max(0, (old[field] ?? 0) - 1) };
      });
    }
  };

  /** True if this admin already opened the item in the current session */
  const isSeenLocally = (type: UnreadType, id: number) =>
    sessionSeen[type].has(id);

  /**
   * Called by list pages for each unread item so the detail page can read it.
   * Idempotent — safe to call on every render.
   */
  const trackUnread = (type: UnreadType, id: number) => {
    if (!sessionSeen[type].has(id)) knownUnread[type].add(id);
  };

  /** Returns true if the list page registered this item as unread */
  const wasKnownUnread = (type: UnreadType, id: number) =>
    knownUnread[type].has(id);

  return { markSeen, isSeenLocally, trackUnread, wasKnownUnread };
}
