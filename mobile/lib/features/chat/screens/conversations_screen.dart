import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/app_button.dart';
import '../../../widgets/common/empty_state_widget.dart';
import '../../../widgets/common/skeleton_widget.dart';
import '../../auth/providers/auth_providers.dart';
import '../providers/chat_provider.dart';
import '../widgets/conversation_tile.dart';

/// Phase 7 — Conversations list: shows all chat threads for the current user.
class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final asyncConvos = ref.watch(conversationsProvider);
    final authState = ref.watch(authControllerProvider);
    final authData = authState.value;
    final currentUserId =
        authData is Authenticated ? authData.user.id : 0;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'المحادثات',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward),
          onPressed: () => context.pop(),
        ),
      ),
      body: asyncConvos.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: SkeletonList(count: 6),
        ),
        error: (e, _) => _ErrorState(
          onRetry: () => ref.read(conversationsProvider.notifier).refresh(),
        ),
        data: (convos) {
          if (convos.isEmpty) {
            return RefreshIndicator(
              color: AppColors.gold,
              onRefresh: () =>
                  ref.read(conversationsProvider.notifier).refresh(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.of(context).size.height * 0.65,
                    child: const EmptyStateWidget(
                      icon:     Icons.chat_bubble_outline_rounded,
                      title:    'لا توجد محادثات بعد',
                      subtitle: 'ستظهر المحادثات هنا بعد اختيار فني لطلبك',
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: AppColors.gold,
            onRefresh: () =>
                ref.read(conversationsProvider.notifier).refresh(),
            child: ListView.separated(
              physics: const BouncingScrollPhysics(
                  parent: AlwaysScrollableScrollPhysics()),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: convos.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final convo = convos[i];
                return ConversationTile(
                  conversation: convo,
                  currentUserId: currentUserId,
                  onTap: () => context.push(
                    RoutePaths.chat(convo.requestId),
                    extra: {
                      'serviceName': convo.serviceName,
                      'status': convo.status,
                      'otherName': convo.otherPartyName(currentUserId),
                      'otherImage': convo.otherPartyImage(currentUserId),
                    },
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.gold),
            const SizedBox(height: 12),
            const Text('تعذر تحميل المحادثات',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 20),
            SizedBox(
              width: 180,
              child: AppButton(label: 'إعادة المحاولة', onPressed: onRetry),
            ),
          ],
        ),
      ),
    );
  }
}
