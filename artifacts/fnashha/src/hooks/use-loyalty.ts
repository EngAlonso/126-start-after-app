import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function loyaltyFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}/api/loyalty${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

export const LOYALTY_CONFIG_KEY   = ["loyalty", "config"];
export const LOYALTY_WALLET_KEY   = ["loyalty", "wallet"];
export const LOYALTY_TXN_KEY      = (page: number) => ["loyalty", "transactions", page];
export const LOYALTY_REFERRAL_KEY = ["loyalty", "referral"];

export function useLoyaltyConfig() {
  return useQuery({
    queryKey: LOYALTY_CONFIG_KEY,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/loyalty/config`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      return data as {
        loyaltyEnabled: boolean;
        coinName: string;
        coinNameEn: string;
        // Earning formula: every coinEarnX EGP = coinEarnY coins
        coinEarnX: number;
        coinEarnY: number;
        // Redemption formula: every coinRedeemX coins = coinRedeemY EGP discount
        coinRedeemX: number;
        coinRedeemY: number;
        maxCoinsPerRequest: number;
        minRequestValue: number;
        pendingCoinDays: number;
        referralEnabled: boolean;
        referralReferrerCoins: number;
        referralRefereeCoins: number;
      };
    },
    staleTime: 60_000,
  });
}

export function useLoyaltyWallet() {
  const { token } = useAuth();
  return useQuery({
    queryKey: LOYALTY_WALLET_KEY,
    queryFn: () => loyaltyFetch("/wallet", token!),
    enabled: !!token,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useLoyaltyTransactions(page = 1) {
  const { token } = useAuth();
  return useQuery({
    queryKey: LOYALTY_TXN_KEY(page),
    queryFn: () => loyaltyFetch(`/transactions?page=${page}&limit=20`, token!),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useLoyaltyReferral() {
  const { token } = useAuth();
  return useQuery({
    queryKey: LOYALTY_REFERRAL_KEY,
    queryFn: () => loyaltyFetch("/referral-code", token!),
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useCalculateCoins() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (body: { coinsToUse: number; requestId?: number }) =>
      loyaltyFetch("/calculate", token!, { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useRedeemCoins() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { requestId: number; coinsToUse: number }) =>
      loyaltyFetch("/redeem", token!, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOYALTY_WALLET_KEY });
    },
  });
}

export function useReleaseCoins() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) =>
      loyaltyFetch(`/redeem/${requestId}`, token!, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOYALTY_WALLET_KEY });
    },
  });
}
