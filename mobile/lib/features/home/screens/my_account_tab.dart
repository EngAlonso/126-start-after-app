import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:share_plus/share_plus.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../features/auth/providers/auth_providers.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../../theme/theme_mode_provider.dart';
import '../../profile/providers/profile_provider.dart';

/// My Account tab — replaces the old push-only Profile screen.
///
/// Sections:
///   • Profile header (avatar, name, role badge)
///   • Account settings (edit profile, change password)
///   • Contact Us (phone / WhatsApp / email from backend contact config)
///   • Help & Support (ticket / conversation flow)
///   • ⋯ Three-dot menu: Dark mode, Privacy, Terms, Language, Contact
///   • Delete Account  (with permanent-deletion dialog)
///   • Logout
class MyAccountTab extends ConsumerWidget {
  const MyAccountTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    final isDark       = Theme.of(context).brightness == Brightness.dark;

    return profileAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      ),
      error: (e, _) => _ErrorBody(
        message: e.toString().replaceFirst('Exception: ', ''),
        onRetry: () => ref.invalidate(profileProvider),
      ),
      data: (user) => CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // ── Header ──────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: _AccountHeader(user: user, isDark: isDark),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Account settings ────────────────────────────────
                  _SectionLabel('إعدادات الحساب'),
                  const SizedBox(height: 12),
                  _MenuCard(
                    isDark: isDark,
                    items: [
                      _MenuItem(
                        icon:  Icons.edit_rounded,
                        label: 'تعديل الملف الشخصي',
                        onTap: () => context.push(RoutePaths.editProfile),
                      ),
                      _MenuItem(
                        icon:  Icons.lock_rounded,
                        label: 'تغيير كلمة المرور',
                        onTap: () => context.push(RoutePaths.changePassword),
                      ),
                      _MenuItem(
                        icon:  Icons.notifications_rounded,
                        label: 'الإشعارات',
                        onTap: () => context.push(RoutePaths.notifications),
                      ),
                      if (user.isFounder)
                        _MenuItem(
                          icon:    Icons.admin_panel_settings_rounded,
                          label:   'إعدادات المؤسس',
                          trailing: _GoldBadge('مؤسس'),
                          onTap:   () => context.push(RoutePaths.founderSettings),
                        ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // ── Contact Us ──────────────────────────────────────
                  _SectionLabel('تواصل معنا'),
                  const SizedBox(height: 12),
                  _ContactSection(isDark: isDark),

                  const SizedBox(height: 24),

                  // ── Help & Support ──────────────────────────────────
                  _SectionLabel('المساعدة والدعم'),
                  const SizedBox(height: 12),
                  _MenuCard(
                    isDark: isDark,
                    items: [
                      _MenuItem(
                        icon:  Icons.confirmation_number_rounded,
                        label: 'فتح تذكرة دعم',
                        subtitle: 'أرسل مشكلتك لفريق الدعم',
                        onTap: () => context.push(RoutePaths.supportTicket),
                      ),
                      _MenuItem(
                        icon:  Icons.chat_rounded,
                        label: 'محادثاتي',
                        onTap: () => context.push(RoutePaths.conversations),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // ── App preferences (three-dot menu items inline) ──
                  _SectionLabel('تفضيلات التطبيق'),
                  const SizedBox(height: 12),
                  _PreferencesCard(isDark: isDark),

                  const SizedBox(height: 32),

                  // ── Delete Account ──────────────────────────────────
                  _DeleteAccountButton(userId: user.id),

                  const SizedBox(height: 14),

                  // ── Logout ──────────────────────────────────────────
                  _LogoutButton(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Account header ─────────────────────────────────────────────────────────────

class _AccountHeader extends StatelessWidget {
  const _AccountHeader({required this.user, required this.isDark});
  final dynamic user;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin:  Alignment.topCenter,
          end:    Alignment.bottomCenter,
          colors: isDark
              ? [const Color(0xFF1F1700), AppColors.darkBackground]
              : [const Color(0xFFFEF3D5), AppColors.lightBackground],
        ),
      ),
      child: Row(
        children: [
          // Avatar
          Stack(
            children: [
              Container(
                width:  72,
                height: 72,
                decoration: BoxDecoration(
                  shape:  BoxShape.circle,
                  border: Border.all(color: AppColors.gold, width: 2.5),
                  color:  AppColors.gold.withValues(alpha: 0.10),
                ),
                child: ClipOval(
                  child: (user.profileImage as String?)?.isNotEmpty == true
                      ? Image.network(
                          user.profileImage as String,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const Icon(Icons.person_rounded, color: AppColors.gold, size: 36),
                        )
                      : const Icon(Icons.person_rounded, color: AppColors.gold, size: 36),
                ),
              ),
            ],
          ),

          const SizedBox(width: 14),

          // Name + role + status
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.fullName as String,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    _Badge(
                      label: _roleLabel(user.role as String),
                      color: AppColors.gold,
                    ),
                    const SizedBox(width: 6),
                    _Badge(
                      label: _statusLabel(user.status as String),
                      color: _statusColor(user.status as String),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  user.mobile as String,
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),

          // Three-dot menu
          _ThreeDotMenu(),
        ],
      ),
    );
  }

  String _roleLabel(String role) => switch (role) {
        'customer'    => 'عميل',
        'technician'  => 'فني',
        'admin'       => 'مدير',
        'super_admin' => 'مدير عام',
        _             => role,
      };

  String _statusLabel(String status) => switch (status) {
        'active'    => 'نشط',
        'pending'   => 'قيد المراجعة',
        'suspended' => 'موقوف',
        'banned'    => 'محظور',
        _           => status,
      };

  Color _statusColor(String status) => switch (status) {
        'active' => const Color(0xFF22C55E),
        'pending' => const Color(0xFFF59E0B),
        _         => const Color(0xFFEF4444),
      };
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color:        color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppDesign.radiusFull),
        border:       Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

// ── Contact section ────────────────────────────────────────────────────────────

/// Reads live contact values from CMS (contactPhone, contactEmail,
/// whatsappNumber).  Falls back to generic labels when the CMS values are
/// not yet configured in the admin dashboard.
class _ContactSection extends ConsumerWidget {
  const _ContactSection({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cms = ref.watch(cmsBrandingProvider).asData?.value
        ?? CmsSettings.defaults;

    final phone     = cms.contactPhone;
    final email     = cms.contactEmail;
    final whatsapp  = cms.whatsappNumber;

    final items = <_MenuItem>[
      if (phone != null)
        _MenuItem(
          icon:     Icons.phone_rounded,
          label:    'اتصل بنا',
          subtitle: phone,
          onTap:    () => _copy(context, phone, 'رقم الهاتف'),
        ),
      if (whatsapp != null)
        _MenuItem(
          icon:     Icons.chat_bubble_rounded,
          label:    'واتساب',
          subtitle: 'تواصل عبر واتساب',
          onTap:    () => Share.share('https://wa.me/$whatsapp'),
        ),
      if (email != null)
        _MenuItem(
          icon:     Icons.email_rounded,
          label:    'البريد الإلكتروني',
          subtitle: email,
          onTap:    () => _copy(context, email, 'البريد الإلكتروني'),
        ),
      // Always show a generic entry if no CMS values are configured yet
      if (phone == null && email == null && whatsapp == null)
        _MenuItem(
          icon:  Icons.support_agent_rounded,
          label: 'تواصل مع الدعم',
          onTap: () => context.push(RoutePaths.conversations),
        ),
    ];

    return _MenuCard(isDark: isDark, items: items);
  }

  Future<void> _copy(BuildContext context, String text, String label) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content:         Text('تم نسخ $label'),
      behavior:        SnackBarBehavior.floating,
      backgroundColor: AppColors.gold,
      duration:        const Duration(seconds: 2),
    ));
  }
}

// ── Preferences card ───────────────────────────────────────────────────────────

class _PreferencesCard extends ConsumerWidget {
  const _PreferencesCard({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeModeAsync = ref.watch(themeModeProvider);
    final isDarkMode     = themeModeAsync.asData?.value == ThemeMode.dark;

    return Container(
      decoration: BoxDecoration(
        color:        isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        border:       Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
        ),
      ),
      child: Column(
        children: [
          // Dark mode toggle
          InkWell(
            borderRadius: BorderRadius.circular(AppDesign.radiusMD),
            onTap: () => ref.read(themeModeProvider.notifier).toggle(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              child: Row(
                children: [
                  Icon(
                    isDarkMode ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                    color: AppColors.gold,
                    size:  22,
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Text(
                      'الوضع الداكن',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Switch(
                    value:         isDarkMode,
                    onChanged:     (_) =>
                        ref.read(themeModeProvider.notifier).toggle(),
                    activeColor:   AppColors.gold,
                    trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
                  ),
                ],
              ),
            ),
          ),
          Divider(height: 1, indent: 54, color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
          _MenuItem(
            icon:  Icons.privacy_tip_rounded,
            label: 'سياسة الخصوصية',
            onTap: () => _showPolicy(context, 'سياسة الخصوصية'),
          ),
          Divider(height: 1, indent: 54, color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
          _MenuItem(
            icon:  Icons.gavel_rounded,
            label: 'الشروط والأحكام',
            onTap: () => _showPolicy(context, 'الشروط والأحكام'),
          ),
          Divider(height: 1, indent: 54, color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
          _MenuItem(
            icon:  Icons.language_rounded,
            label: 'اللغة',
            trailing: const _GoldBadge('العربية'),
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content:     Text('التطبيق متاح باللغة العربية فقط حالياً'),
                behavior:    SnackBarBehavior.floating,
                backgroundColor: AppColors.gold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showPolicy(BuildContext context, String title) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PolicySheet(title: title),
    );
  }
}

// ── Policy bottom sheet ────────────────────────────────────────────────────────

class _PolicySheet extends StatelessWidget {
  const _PolicySheet({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return DraggableScrollableSheet(
      initialChildSize: 0.8,
      maxChildSize:     0.95,
      minChildSize:     0.4,
      builder: (_, ctrl) => Container(
        decoration: BoxDecoration(
          color:        isDark ? AppColors.darkCard : AppColors.lightCard,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppDesign.radiusXXL),
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color:        Colors.black12,
                borderRadius: BorderRadius.circular(AppDesign.radiusFull),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Text(
                title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
            ),
            Expanded(
              child: ListView(
                controller: ctrl,
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                children: const [
                  Text(
                    'يرجى التواصل مع إدارة التطبيق للاطلاع على النص الكامل لهذه الوثيقة.',
                    style: TextStyle(fontSize: 14, height: 1.7),
                    textAlign: TextAlign.justify,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Three-dot menu ─────────────────────────────────────────────────────────────

class _ThreeDotMenu extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDarkMode =
        ref.watch(themeModeProvider).asData?.value == ThemeMode.dark;

    return PopupMenuButton<String>(
      icon:       const Icon(Icons.more_vert_rounded),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
      ),
      onSelected: (value) async {
        switch (value) {
          case 'dark':
            ref.read(themeModeProvider.notifier).toggle();
          case 'privacy':
            _showPolicy(context, 'سياسة الخصوصية');
          case 'terms':
            _showPolicy(context, 'الشروط والأحكام');
          case 'contact':
            context.push(RoutePaths.conversations);
          case 'language':
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content:         Text('التطبيق متاح باللغة العربية فقط حالياً'),
              behavior:        SnackBarBehavior.floating,
              backgroundColor: AppColors.gold,
            ));
        }
      },
      itemBuilder: (_) => [
        PopupMenuItem(
          value: 'dark',
          child: Row(children: [
            Icon(isDarkMode ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                size: 18, color: AppColors.gold),
            const SizedBox(width: 12),
            Text(isDarkMode ? 'الوضع الفاتح' : 'الوضع الداكن'),
          ]),
        ),
        const PopupMenuItem(
          value: 'privacy',
          child: Row(children: [
            Icon(Icons.privacy_tip_rounded, size: 18, color: AppColors.gold),
            SizedBox(width: 12),
            Text('سياسة الخصوصية'),
          ]),
        ),
        const PopupMenuItem(
          value: 'terms',
          child: Row(children: [
            Icon(Icons.gavel_rounded, size: 18, color: AppColors.gold),
            SizedBox(width: 12),
            Text('الشروط والأحكام'),
          ]),
        ),
        const PopupMenuItem(
          value: 'contact',
          child: Row(children: [
            Icon(Icons.support_agent_rounded, size: 18, color: AppColors.gold),
            SizedBox(width: 12),
            Text('تواصل معنا'),
          ]),
        ),
        const PopupMenuItem(
          value: 'language',
          child: Row(children: [
            Icon(Icons.language_rounded, size: 18, color: AppColors.gold),
            SizedBox(width: 12),
            Text('اللغة'),
          ]),
        ),
      ],
    );
  }

  void _showPolicy(BuildContext context, String title) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PolicySheet(title: title),
    );
  }
}

// ── Delete account button ──────────────────────────────────────────────────────

class _DeleteAccountButton extends ConsumerWidget {
  const _DeleteAccountButton({required this.userId});
  final dynamic userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.destructive,
          side: const BorderSide(color: AppColors.destructive, width: 1.5),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          ),
        ),
        icon:  const Icon(Icons.delete_forever_rounded),
        label: const Text(
          'حذف الحساب',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
        onPressed: () => _confirm(context, ref),
      ),
    );
  }

  Future<void> _confirm(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title:   const Text('حذف الحساب نهائياً'),
        content: const Text(
          'هذا الإجراء دائم وغير قابل للتراجع.\n\n'
          'سيتم حذف جميع بياناتك وطلباتك ومعاملاتك بشكل نهائي.\n\n'
          'هل أنت متأكد تماماً من رغبتك في حذف حسابك؟',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child:     const Text('إلغاء'),
          ),
          TextButton(
            style:     TextButton.styleFrom(foregroundColor: AppColors.destructive),
            onPressed: () => Navigator.of(ctx).pop(true),
            child:     const Text('حذف نهائياً', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      final dio = ref.read(dioClientProvider).dio;
      await dio.delete('/users/$userId');
    } catch (_) {
      // Proceed with logout even if the DELETE fails
    }
    await ref.read(authControllerProvider.notifier).logout();
  }
}

// ── Logout button ──────────────────────────────────────────────────────────────

class _LogoutButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFEF4444),
          foregroundColor: Colors.white,
          padding:         const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          ),
          elevation: 0,
        ),
        icon:  const Icon(Icons.logout_rounded),
        label: const Text(
          'تسجيل الخروج',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
        onPressed: () => _confirmLogout(context, ref),
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title:   const Text('تسجيل الخروج'),
        content: const Text('هل أنت متأكد من رغبتك في تسجيل الخروج؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child:     const Text('إلغاء'),
          ),
          TextButton(
            style:     TextButton.styleFrom(foregroundColor: AppColors.destructive),
            onPressed: () => Navigator.of(ctx).pop(true),
            child:     const Text('خروج'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }
}

// ── Shared UI helpers ──────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text,
      style: TextStyle(
        fontSize:   12,
        fontWeight: FontWeight.w700,
        color: isDark ? AppColors.darkMutedForeground : AppColors.lightMutedForeground,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _MenuCard extends StatelessWidget {
  const _MenuCard({required this.isDark, required this.items});
  final bool isDark;
  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color:        isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        border:       Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
        ),
      ),
      child: Column(
        children: List.generate(items.length, (i) {
          final item = items[i];
          return Column(
            children: [
              if (i > 0)
                Divider(
                  height: 1,
                  indent: 54,
                  color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                ),
              item,
            ],
          );
        }),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap:        onTap,
      borderRadius: BorderRadius.circular(AppDesign.radiusMD),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: AppColors.gold, size: 22),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[trailing!, const SizedBox(width: 8)],
            Icon(
              Icons.arrow_forward_ios_rounded,
              size:  13,
              color: isDark ? AppColors.darkMutedForeground : AppColors.lightMutedForeground,
            ),
          ],
        ),
      ),
    );
  }
}

class _GoldBadge extends StatelessWidget {
  const _GoldBadge(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color:        AppColors.gold.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppDesign.radiusFull),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.gold, fontSize: 11, fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.gold, size: 48),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}
