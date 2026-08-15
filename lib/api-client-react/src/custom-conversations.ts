import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface ConversationThread {
  request_id: number;
  status: string;
  service_name: string;
  customer_id: number;
  customer_name: string;
  technician_id: number | null;
  technician_name: string | null;
  last_message: string;
  last_message_at: string;
  last_message_type: "text" | "image";
  message_count: number;
}

// ─── User conversations ───────────────────────────────────────────────────────

export const getListConversationsQueryKey = () => ["/api/conversations"] as const;

export const listConversations = async (options?: RequestInit): Promise<ConversationThread[]> =>
  customFetch<ConversationThread[]>("/api/conversations", { ...options, method: "GET" });

export const useListConversations = (options?: {
  query?: Partial<UseQueryOptions<ConversationThread[], ErrorType<unknown>>>;
}) => {
  const { query: queryOptions } = options ?? {};
  return useQuery<ConversationThread[], ErrorType<unknown>>({
    queryKey: getListConversationsQueryKey(),
    queryFn: ({ signal }) => listConversations({ signal }),
    ...queryOptions,
  });
};

// ─── Admin conversations ──────────────────────────────────────────────────────

export const getListAdminConversationsQueryKey = () => ["/api/admin/conversations"] as const;

export const listAdminConversations = async (options?: RequestInit): Promise<ConversationThread[]> =>
  customFetch<ConversationThread[]>("/api/admin/conversations", { ...options, method: "GET" });

export const useListAdminConversations = (options?: {
  query?: Partial<UseQueryOptions<ConversationThread[], ErrorType<unknown>>>;
}) => {
  const { query: queryOptions } = options ?? {};
  return useQuery<ConversationThread[], ErrorType<unknown>>({
    queryKey: getListAdminConversationsQueryKey(),
    queryFn: ({ signal }) => listAdminConversations({ signal }),
    ...queryOptions,
  });
};
