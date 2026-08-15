import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

/// Shared chrome for every auth screen (login, register choice, customer
/// registration, technician wizard, pending screen): brand gold blob
/// backdrop + centered, width-capped scroll body. Centralizing this is
/// what makes the auth flow look like one product instead of five
/// independently-styled screens, and keeps the width cap (for
/// tablet/desktop-sized viewports) in exactly one place.
class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.child,
    this.showBackButton = false,
    this.maxWidth = 480,
    this.padding = const EdgeInsets.fromLTRB(24, 12, 24, 24),
  });

  final Widget child;
  final bool showBackButton;
  final double maxWidth;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      body: Stack(
        children: [
          Positioned(
            top: -120,
            left: -80,
            child: _GlowBlob(color: AppColors.gold.withValues(alpha: isDark ? 0.16 : 0.22)),
          ),
          Positioned(
            bottom: -140,
            right: -100,
            child: _GlowBlob(color: AppColors.gold.withValues(alpha: isDark ? 0.10 : 0.14)),
          ),
          SafeArea(
            child: Column(
              children: [
                if (showBackButton)
                  Align(
                    alignment: Alignment.topRight,
                    child: IconButton(
                      icon: const Icon(Icons.arrow_forward, size: 22),
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                  ),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: padding,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(maxWidth: maxWidth),
                        child: child,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowBlob extends StatelessWidget {
  const _GlowBlob({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: 260,
        height: 260,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}

/// The brand wordmark + tagline shown at the top of every auth screen.
class AuthBrandHeader extends StatelessWidget {
  const AuthBrandHeader({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 68,
          height: 68,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFFFFD700), Color(0xFFE8B800)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(color: AppColors.gold.withValues(alpha: 0.35), blurRadius: 24, spreadRadius: 2),
            ],
          ),
          child: const Icon(Icons.handyman_rounded, color: Colors.white, size: 32),
        ),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 6),
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}
