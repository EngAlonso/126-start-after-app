import { Link } from "wouter";
import { Coins } from "lucide-react";
import { useLoyaltyWallet, useLoyaltyConfig } from "@/hooks/use-loyalty";
import { useAuth } from "@/contexts/auth-context";

interface CoinsBadgeProps {
  compact?: boolean;
}

export function CoinsBadge({ compact = false }: CoinsBadgeProps) {
  const { isAuthenticated, isCustomer } = useAuth();
  const { data: config } = useLoyaltyConfig();
  const { data: wallet } = useLoyaltyWallet();

  if (!isAuthenticated || !isCustomer) return null;
  if (!config?.loyaltyEnabled) return null;

  const coins = (wallet as any)?.availableCoins ?? 0;
  const coinName = config?.coinName ?? "عملات فنشها";

  if (compact) {
    return (
      <Link href="/customer/wallet" style={{ textDecoration: "none" }}>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer select-none">
          <Coins className="w-3.5 h-3.5 text-yellow-600" />
          <span className="text-xs font-bold text-yellow-700">{coins.toLocaleString()}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link href="/customer/wallet" style={{ textDecoration: "none" }}>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer select-none">
        <Coins className="w-4 h-4 text-yellow-600" />
        <span className="text-sm font-bold text-yellow-700">{coins.toLocaleString()}</span>
        <span className="text-xs text-yellow-600 hidden sm:inline">{coinName}</span>
      </div>
    </Link>
  );
}
