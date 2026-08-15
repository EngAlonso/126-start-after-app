import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_providers.dart';

/// Placeholder landing screen per role. Phase 1 only wires up the
/// destination + logout action; the real customer/technician/admin
/// screens (requests, offers, wallet, CMS, etc.) are out of scope here.
class HomeShellScreen extends ConsumerWidget {
  const HomeShellScreen({super.key, required this.role});

  final String role;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final currentState = authState.asData?.value;
    final user = currentState is Authenticated ? currentState.user : null;

    return Scaffold(
      appBar: AppBar(
        title: Text('مرحباً ${user?.fullName ?? ""}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: Center(
        child: Text('لوحة $role — قيد الإنشاء'),
      ),
    );
  }
}
