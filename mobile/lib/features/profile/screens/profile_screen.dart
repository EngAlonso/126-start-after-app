import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../features/auth/providers/auth_providers.dart';
import '../../../features/auth/providers/catalog_providers.dart';
import '../../../features/requests/providers/offers_provider.dart';
import '../../../features/technician/providers/tech_providers.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../providers/profile_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);

    return Scaffold(
      body: profileAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.gold),
        ),
        error: (e, _) => _ErrorBody(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(profileProvider),
        ),
        data: (user) => _ProfileBody(user: user),
      ),
    );
  }
}

// ─── Main scrollable body ─────────────────────────────────────────────────────

class _ProfileBody extends ConsumerWidget {
  const _ProfileBody({required this.user});
  final dynamic user; // UserModel

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // ── Hero header ──────────────────────────────────────────────────
        SliverAppBar(
          expandedHeight: 260,
          pinned: true,
          backgroundColor:
              isDark ? AppColors.darkBackground : AppColors.lightBackground,
          flexibleSpace: FlexibleSpaceBar(
            background: _ProfileHeader(user: user),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded),
            onPressed: () => context.pop(),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.edit_rounded),
              tooltip: 'تعديل الملف الشخصي',
              onPressed: () => context.push(RoutePaths.editProfile),
            ),
          ],
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Account info ─────────────────────────────────────────
                _SectionLabel('معلومات الحساب'),
                const SizedBox(height: 12),
                _InfoCard(user: user),

                const SizedBox(height: 24),

                // ── Technician-only: services, coverage & performance ─────
                if (user.role == 'technician') ...[
                  _SectionLabel('بيانات الفني'),
                  const SizedBox(height: 12),
                  _TechnicianDetailsCard(userId: user.id as int),
                  const SizedBox(height: 24),
                ],

                // ── Settings ─────────────────────────────────────────────
                _SectionLabel('الإعدادات'),
                const SizedBox(height: 12),
                _SettingsCard(user: user),

                const SizedBox(height: 24),

                // ── Logout ───────────────────────────────────────────────
                _LogoutButton(),

                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Profile header ───────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.user});
  final dynamic user;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isDark
              ? [const Color(0xFF1F1700), AppColors.darkBackground]
              : [const Color(0xFFFEF3D5), AppColors.lightBackground],
        ),
      ),
      child: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            // Avatar
            Hero(
              tag: 'profile-avatar',
              child: _Avatar(imageUrl: user.profileImage as String?),
            ),
            const SizedBox(height: 14),

            // Full name
            Text(
              user.fullName as String,
              style: textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),

            // Role + status badges
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _RoleBadge(role: user.role as String),
                const SizedBox(width: 8),
                _StatusBadge(status: user.status as String),
              ],
            ),

            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  const _Avatar({this.imageUrl});
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    const size = 88.0;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.gold, width: 3),
        color: AppColors.gold.withValues(alpha: 0.12),
      ),
      child: ClipOval(
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _Placeholder(),
              )
            : _Placeholder(),
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Icon(Icons.person_rounded, color: AppColors.gold, size: 44);
  }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

class _RoleBadge extends StatelessWidget {
  const _RoleBadge({required this.role});
  final String role;

  String get _label => switch (role) {
        'customer' => 'عميل',
        'technician' => 'فني',
        'admin' => 'مدير',
        'super_admin' => 'مدير عام',
        _ => role,
      };

  @override
  Widget build(BuildContext context) {
    return _Chip(label: _label, color: AppColors.gold);
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  (String, Color) get _info => switch (status) {
        'active' => ('نشط', const Color(0xFF22C55E)),
        'pending' => ('قيد المراجعة', const Color(0xFFF59E0B)),
        'suspended' => ('موقوف', const Color(0xFFEF4444)),
        'banned' => ('محظور', const Color(0xFFEF4444)),
        'rejected' => ('مرفوض', const Color(0xFFEF4444)),
        _ => (status, AppColors.gold),
      };

  @override
  Widget build(BuildContext context) {
    final (label, color) = _info;
    return _Chip(label: label, color: color);
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.40)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ─── Account info card ────────────────────────────────────────────────────────

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.user});
  final dynamic user;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    String? memberSince;
    if (user.createdAt != null) {
      try {
        final dt = DateTime.parse(user.createdAt as String);
        memberSince = DateFormat('d MMMM y', 'ar').format(dt);
      } catch (_) {
        memberSince = user.createdAt as String?;
      }
    }

    return _Card(
      isDark: isDark,
      child: Column(
        children: [
          _InfoRow(
            icon: Icons.phone_rounded,
            label: 'رقم الهاتف',
            value: user.mobile as String,
          ),
          if ((user.email as String?)?.isNotEmpty == true) ...[
            const _Divider(),
            _InfoRow(
              icon: Icons.email_rounded,
              label: 'البريد الإلكتروني',
              value: user.email as String,
            ),
          ],
          if ((user.jobTitle as String?)?.isNotEmpty == true) ...[
            const _Divider(),
            _InfoRow(
              icon: Icons.work_rounded,
              label: 'المسمى الوظيفي',
              value: user.jobTitle as String,
            ),
          ],
          if (memberSince != null) ...[
            const _Divider(),
            _InfoRow(
              icon: Icons.calendar_today_rounded,
              label: 'عضو منذ',
              value: memberSince,
            ),
          ],
          if ((user.suspensionReason as String?)?.isNotEmpty == true) ...[
            const _Divider(),
            _InfoRow(
              icon: Icons.warning_rounded,
              label: 'سبب الإيقاف',
              value: user.suspensionReason as String,
              valueColor: const Color(0xFFEF4444),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        children: [
          Icon(icon, color: AppColors.gold, size: 20),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkMutedForeground
                      : AppColors.lightMutedForeground,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: valueColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Technician details card (Phase 11F) ───────────────────────────────────────

/// Rating, completed jobs, years of experience, services offered and
/// coverage areas — the technician-only fields the generic [UserModel] and
/// [_InfoCard] don't carry. Reuses [technicianPublicProfileProvider] (rating
/// / completed jobs, already used on the Offer Details screen) and the new
/// [technicianFullProfileProvider] (services / areas / years of experience).
class _TechnicianDetailsCard extends ConsumerWidget {
  const _TechnicianDetailsCard({required this.userId});
  final int userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final publicProfileAsync = ref.watch(technicianPublicProfileProvider(userId));
    final fullProfileAsync = ref.watch(technicianFullProfileProvider(userId));
    final governoratesAsync = ref.watch(governoratesProvider);

    if (fullProfileAsync.isLoading || publicProfileAsync.isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator(color: AppColors.gold)),
      );
    }
    if (fullProfileAsync.hasError || publicProfileAsync.hasError) {
      return _Card(
        isDark: isDark,
        child: const Padding(
          padding: EdgeInsets.all(20),
          child: Text('تعذر تحميل بيانات الفني', style: TextStyle(color: AppColors.destructive)),
        ),
      );
    }

    final full = fullProfileAsync.value!;
    final rating = publicProfileAsync.value!;
    final governorateNames = {
      for (final g in governoratesAsync.value ?? const []) g.id: g.nameAr,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Card(
          isDark: isDark,
          child: Column(
            children: [
              _InfoRow(
                icon: Icons.star_rounded,
                label: 'التقييم',
                value: rating.reviewCount > 0
                    ? '${rating.averageRating.toStringAsFixed(1)} (${rating.reviewCount} تقييم)'
                    : 'لا يوجد تقييمات بعد',
              ),
              const _Divider(),
              _InfoRow(
                icon: Icons.task_alt_rounded,
                label: 'المهام المكتملة',
                value: '${rating.completedJobs}',
              ),
              if (full.yearsOfExperience != null) ...[
                const _Divider(),
                _InfoRow(
                  icon: Icons.workspace_premium_rounded,
                  label: 'سنوات الخبرة',
                  value: '${full.yearsOfExperience} سنة',
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text('الخدمات المقدمة',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground)),
        const SizedBox(height: 10),
        full.services.isEmpty
            ? const Text('لم يتم اختيار خدمات بعد', style: TextStyle(fontSize: 13))
            : Wrap(
                spacing: 8,
                runSpacing: 8,
                children: full.services
                    .map((s) => _Chip(label: s.nameAr, color: AppColors.gold))
                    .toList(),
              ),
        const SizedBox(height: 20),
        Text('مناطق التغطية',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground)),
        const SizedBox(height: 10),
        full.areas.isEmpty
            ? const Text('لم يتم اختيار مناطق بعد', style: TextStyle(fontSize: 13))
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: () {
                  final byGov = <int, List<String>>{};
                  for (final a in full.areas) {
                    byGov.putIfAbsent(a.governorateId, () => []).add(a.nameAr);
                  }
                  return byGov.entries.map((entry) {
                    final govName = governorateNames[entry.key] ?? '';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (govName.isNotEmpty)
                            Text(govName,
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: entry.value
                                .map((name) => _Chip(label: name, color: AppColors.gold))
                                .toList(),
                          ),
                        ],
                      ),
                    );
                  }).toList();
                }(),
              ),
      ],
    );
  }
}

// ─── Settings card ────────────────────────────────────────────────────────────

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.user});
  final dynamic user;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isFounder = user.isFounder as bool;

    return _Card(
      isDark: isDark,
      child: Column(
        children: [
          _SettingsTile(
            icon: Icons.edit_rounded,
            label: 'تعديل الملف الشخصي',
            onTap: () => context.push(RoutePaths.editProfile),
          ),
          const _Divider(),
          _SettingsTile(
            icon: Icons.lock_rounded,
            label: 'تغيير كلمة المرور',
            onTap: () => context.push(RoutePaths.changePassword),
          ),
          const _Divider(),
          _SettingsTile(
            icon: Icons.notifications_rounded,
            label: 'الإشعارات',
            onTap: () => context.push(RoutePaths.notifications),
          ),
          if (isFounder) ...[
            const _Divider(),
            _SettingsTile(
              icon: Icons.admin_panel_settings_rounded,
              label: 'إعدادات المؤسس',
              trailing: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'مؤسس',
                  style: TextStyle(
                    color: AppColors.gold,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              onTap: () => context.push(RoutePaths.founderSettings),
            ),
          ],
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Row(
          children: [
            Icon(icon, color: AppColors.gold, size: 22),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            if (trailing != null) ...[
              trailing!,
              const SizedBox(width: 8),
            ],
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

class _LogoutButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFFEF4444),
          side: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        icon: const Icon(Icons.logout_rounded),
        label: const Text(
          'تسجيل الخروج',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        onPressed: () => _confirmLogout(context, ref),
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تسجيل الخروج'),
        content: const Text('هل أنت متأكد من رغبتك في تسجيل الخروج؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFFEF4444),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('خروج'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: isDark
            ? AppColors.darkMutedForeground
            : AppColors.lightMutedForeground,
        letterSpacing: 0.4,
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.isDark, required this.child});
  final bool isDark;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? AppColors.darkBorder
              : AppColors.lightBorder,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: child,
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Divider(
      height: 1,
      indent: 54,
      color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
    );
  }
}

// ─── Error body ───────────────────────────────────────────────────────────────

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
            const Icon(Icons.error_outline_rounded,
                color: AppColors.gold, size: 48),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onRetry,
              child: const Text('إعادة المحاولة'),
            ),
          ],
        ),
      ),
    );
  }
}
