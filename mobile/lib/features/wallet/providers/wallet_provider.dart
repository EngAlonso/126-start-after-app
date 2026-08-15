import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/sse/user_sse_provider.dart';
import '../../../models/coin_transaction_model.dart';
import '../../../models/referral_model.dart';
import '../../../models/wallet_model.dart';
import '../../../services/wallet_service.dart';
import '../../auth/providers/auth_providers.dart';

// ── Service provider ─────────────────────────────────────────────────────────

final walletServiceProvider = Provider<WalletService>((ref) {
  return WalletService(ref.watch(dioClientProvider).dio);
});

// ── Wallet balance provider ──────────────────────────────────────────────────

class WalletNotifier extends AsyncNotifier<WalletModel> {
  @override
  Future<WalletModel> build() {
    // Refresh whenever a wallet_updated SSE event arrives.
    ref.listen(userSseProvider, (_, next) {
      final event = next.asData?.value;
      if (event?.event == 'wallet_updated') {
        refresh();
      }
    });
    return ref.read(walletServiceProvider).fetchWallet();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(walletServiceProvider).fetchWallet(),
    );
  }
}

final walletProvider =
    AsyncNotifierProvider<WalletNotifier, WalletModel>(WalletNotifier.new);

// ── Transactions provider (with pagination) ──────────────────────────────────

const _txPageSize = 20;

class TransactionsState {
  const TransactionsState({
    this.items = const [],
    this.page = 1,
    this.totalPages = 1,
    this.total = 0,
    this.isLoadingMore = false,
    this.errorMessage,
  });

  final List<CoinTransactionModel> items;
  final int page;
  final int totalPages;
  final int total;
  final bool isLoadingMore;
  final String? errorMessage;

  bool get hasMore => page < totalPages;

  TransactionsState copyWith({
    List<CoinTransactionModel>? items,
    int? page,
    int? totalPages,
    int? total,
    bool? isLoadingMore,
    String? errorMessage,
    bool clearError = false,
  }) =>
      TransactionsState(
        items: items ?? this.items,
        page: page ?? this.page,
        totalPages: totalPages ?? this.totalPages,
        total: total ?? this.total,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

class TransactionsNotifier extends AsyncNotifier<TransactionsState> {
  @override
  Future<TransactionsState> build() => _fetchFirstPage();

  Future<TransactionsState> _fetchFirstPage() async {
    final result = await ref
        .read(walletServiceProvider)
        .fetchTransactions(page: 1, limit: _txPageSize);
    return TransactionsState(
      items: result.data,
      page: 1,
      totalPages: result.totalPages,
      total: result.total,
    );
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(_fetchFirstPage);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    state = AsyncValue.data(current.copyWith(isLoadingMore: true, clearError: true));
    try {
      final nextPage = current.page + 1;
      final result = await ref
          .read(walletServiceProvider)
          .fetchTransactions(page: nextPage, limit: _txPageSize);
      state = AsyncValue.data(current.copyWith(
        items: [...current.items, ...result.data],
        page: nextPage,
        totalPages: result.totalPages,
        total: result.total,
        isLoadingMore: false,
      ));
    } on ApiException catch (e) {
      state = AsyncValue.data(
        current.copyWith(isLoadingMore: false, errorMessage: e.message),
      );
    }
  }
}

final transactionsProvider =
    AsyncNotifierProvider<TransactionsNotifier, TransactionsState>(
  TransactionsNotifier.new,
);

// ── Referral provider ────────────────────────────────────────────────────────

class ReferralNotifier extends AsyncNotifier<ReferralModel> {
  @override
  Future<ReferralModel> build() =>
      ref.read(walletServiceProvider).fetchReferral();

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(walletServiceProvider).fetchReferral(),
    );
  }
}

final referralProvider =
    AsyncNotifierProvider<ReferralNotifier, ReferralModel>(ReferralNotifier.new);
