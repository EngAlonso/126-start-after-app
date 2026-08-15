import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Linking, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { apiFetch, apiUrl, resolveMediaUrl, useAuthedFetch } from '@/hooks/useApi';
import { AppHeader } from '@/components/AppHeader';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
import { useConfirm } from '@/hooks/useConfirm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { navigateToGuestHomeAfterLogout } from '@/utils/logout-navigation';
import { deregisterPushTokens } from '@/hooks/usePushNotifications';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import { LanguagePickerModal } from '@/components/LanguagePickerModal';

// ── Status config (icons + colors only — labels come from translations) ────────
const STATUS_ICON_COLOR: Record<string, { color: string; bg: string; icon: keyof typeof Feather.glyphMap }> = {
  pending:  { color: '#D97706', bg: '#FEF3C7', icon: 'clock' },
  approved: { color: '#059669', bg: '#D1FAE5', icon: 'check-circle' },
  rejected: { color: '#DC2626', bg: '#FEE2E2', icon: 'x-circle' },
};

export default function TechnicianAccountScreen() {
  const colors = useColors();
  const { isDark, setDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, accessToken, logout } = useAuth();
  const { get } = useCmsSettings();
  const { confirm, showAlert, dialogState } = useConfirm();
  const authedFetch = useAuthedFetch();
  const { locale, setLocale, isRTL } = useLocale();
  const t = translations[locale];
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  const handleLanguageSelect = () => {
    console.log('Language row pressed');
    setLangPickerOpen(true);
  };

  const phone    = get(CMS_KEYS.PHONE, '');
  const whatsapp = get(CMS_KEYS.WHATSAPP, phone);
  const email    = get(CMS_KEYS.EMAIL, '');

  const approvalStatus = (user?.technicianProfile?.approvalStatus as string | undefined) ?? 'pending';
  const statusConf = STATUS_ICON_COLOR[approvalStatus] ?? STATUS_ICON_COLOR.pending;
  const statusLabel =
    approvalStatus === 'approved' ? t.techAccount.statusApproved :
    approvalStatus === 'rejected' ? t.techAccount.statusRejected :
    t.techAccount.statusPending;

  const techProfile = user?.technicianProfile;
  const points      = techProfile?.pointsBalance ?? 0;
  const reserved    = techProfile?.reservedPoints ?? 0;
  const available   = Math.max(0, points - reserved);
  const yearsExp    = techProfile?.yearsOfExperience;

  const { data: ratingsData } = useQuery<{ averageRating: number | string; reviewCount: number | string }>({
    queryKey: ['tech-ratings', user?.id],
    queryFn: () => authedFetch(`/api/ratings/technician/${user!.id}`),
    enabled: !!user?.id,
  });
  const avgRating: number    = isFinite(Number(ratingsData?.averageRating)) ? Number(ratingsData?.averageRating) : 0;
  const totalRatings: number = Math.max(0, Math.round(Number(ratingsData?.reviewCount ?? 0)));

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    const ok = await confirm({
      title: t.techAccount.logoutTitle,
      message: t.techAccount.logoutMessage,
      confirmText: t.techAccount.logoutConfirm,
    });
    if (!ok) return;

    const refreshToken = await AsyncStorage.getItem('refreshToken');
    await deregisterPushTokens(accessToken || '').catch(() => null);
    await logout();
    navigateToGuestHomeAfterLogout();

    void fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken: refreshToken ?? '' }),
    }).catch(() => {});
  };

  // ── Delete Account ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    const step1 = await confirm({
      title: t.techAccount.deleteTitle,
      message: t.techAccount.deleteMessage,
      confirmText: t.techAccount.deleteConfirm,
    });
    if (!step1) return;

    const step2 = await confirm({
      title: t.techAccount.deleteTitle2,
      message: t.techAccount.deleteMessage2,
      confirmText: t.techAccount.deleteConfirm2,
    });
    if (!step2) return;

    try {
      await apiFetch('/api/auth/me', {
        method: 'DELETE',
        token: accessToken,
        body: JSON.stringify({ reason: '' }),
      });
      await deregisterPushTokens(accessToken || '').catch(() => null);
      await logout();
      navigateToGuestHomeAfterLogout();
    } catch (e: any) {
      showAlert(t.common.error, e.message || t.techAccount.deleteError);
    }
  };

  const avatarUri = resolveMediaUrl(user?.profileImage);
  const chevron = isRTL ? 'chevron-left' : 'chevron-right';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader role="technician" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: TECH_TAB_BAR_HEIGHT + insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <View style={[styles.hero, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : colors.primary }]}>

          {/* Amber top band */}
          <View style={[styles.heroBand, { backgroundColor: colors.primary }]}>
            <View style={[styles.heroBandCurve, { backgroundColor: colors.card }]} />
          </View>

          {/* Edit button */}
          <TouchableOpacity
            style={[styles.heroEditBtn, { backgroundColor: colors.card }]}
            onPress={() => router.push('/edit-profile')}
          >
            <Feather name="edit-2" size={15} color={colors.primary} />
          </TouchableOpacity>

          {/* Avatar ring */}
          <View style={[styles.heroAvatarRing, { borderColor: colors.primary + '40', backgroundColor: colors.card }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.heroAvatar} resizeMode="cover" />
            ) : (
              <View style={[styles.heroAvatarFallback, { backgroundColor: colors.primary }]}>
                <Text style={styles.heroAvatarInitial}>{user?.fullName?.[0] ?? '؟'}</Text>
              </View>
            )}
            <View style={[styles.onlineDot, { backgroundColor: statusConf.color, borderColor: colors.card }]} />
          </View>

          {/* Name */}
          <Text style={[styles.heroName, { color: colors.foreground }]}>{user?.fullName ?? '—'}</Text>

          {/* Mobile */}
          <View style={styles.heroMobileRow}>
            <Feather name="phone" size={12} color={colors.mutedForeground} />
            <Text style={[styles.heroMobile, { color: colors.mutedForeground }]}>{user?.mobile}</Text>
          </View>

          {/* Status badge */}
          <View style={[styles.heroStatusBadge, { backgroundColor: statusConf.bg }]}>
            <Feather name={statusConf.icon} size={13} color={statusConf.color} />
            <Text style={[styles.heroStatusText, { color: statusConf.color }]}>{statusLabel}</Text>
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            {/* Available Points */}
            <StatItem
              value={available.toLocaleString('en-US')}
              label={t.techAccount.availablePoints}
              color={colors.primary}
              colors={colors}
              onPress={() => router.push('/(technician)/wallet')}
            />
            <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />

            {/* Ratings */}
            <StatItem
              value={avgRating.toFixed(1)}
              label={totalRatings > 0 ? t.techAccount.ratingCount(totalRatings) : t.techAccount.ratings}
              color="#7C3AED"
              colors={colors}
              onPress={() => router.push('/tech-ratings')}
            />
            <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />

            {/* Years of experience */}
            <StatItem
              value={yearsExp != null ? yearsExp.toLocaleString('en-US') : '0'}
              label={t.techAccount.yearsExp}
              color="#2563EB"
              colors={colors}
            />
          </View>
        </View>

        {/* ── Account section ───────────────────────────────────────────── */}
        <MenuSection title={t.techAccount.sections.settings} colors={colors}>
          <MenuItem
            icon="user"
            iconBg="#FEF3C7"
            iconColor={colors.primary}
            label={t.techAccount.editProfile}
            colors={colors}
            isRTL={isRTL}
            chevron={chevron}
            onPress={() => router.push('/edit-profile')}
          />
          <MenuItem
            icon="zap"
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            label={t.techAccount.myPoints}
            colors={colors}
            isRTL={isRTL}
            chevron={chevron}
            onPress={() => router.push('/(technician)/wallet')}
          />
          <MenuItem
            icon="star"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            label={t.techAccount.myRatings}
            colors={colors}
            isRTL={isRTL}
            chevron={chevron}
            onPress={() => router.push('/tech-ratings')}
          />
          <MenuItem
            icon="bell"
            iconBg="#FFF7ED"
            iconColor="#EA580C"
            label={t.techAccount.notifications}
            colors={colors}
            isRTL={isRTL}
            chevron={chevron}
            onPress={() => router.push('/notifications')}
          />
          <MenuItem
            icon="message-circle"
            iconBg="#F0FDFA"
            iconColor="#0D9488"
            label={t.techAccount.conversations}
            colors={colors}
            isRTL={isRTL}
            chevron={chevron}
            onPress={() => router.push('/messages')}
            isLast
          />
        </MenuSection>

        {/* ── Appearance ────────────────────────────────────────────────── */}
        <MenuSection title={t.techAccount.sections.appearance} colors={colors}>
          <MenuItemLanguage
            currentLabel={locale === 'ar' ? t.common.languageArabic : t.common.languageEnglish}
            label={t.common.language}
            colors={colors}
            isRTL={isRTL}
            onPress={handleLanguageSelect}
            isLast={false}
          />
          <MenuItemSwitch
            icon="moon"
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
            label={t.techAccount.darkMode}
            value={isDark}
            onToggle={setDark}
            colors={colors}
            isRTL={isRTL}
          />
        </MenuSection>

        {/* ── Contact ───────────────────────────────────────────────────── */}
        {(phone || whatsapp || email) && (
          <MenuSection title={t.techAccount.sections.contact} colors={colors}>
            {!!phone && (
              <MenuItem
                icon="phone"
                iconBg="#D1FAE5"
                iconColor="#059669"
                label={`${t.techAccount.callPrefix}: ${phone}`}
                colors={colors}
                isRTL={isRTL}
                chevron={chevron}
                onPress={() => Linking.openURL(`tel:${phone}`)}
              />
            )}
            {!!whatsapp && (
              <MenuItem
                icon="message-square"
                iconBg="#D1FAE5"
                iconColor="#059669"
                label={`${t.techAccount.whatsappPrefix}: ${whatsapp}`}
                colors={colors}
                isRTL={isRTL}
                chevron={chevron}
                onPress={async () => {
                  const digits = whatsapp.replace(/\D/g, '');
                  const intl = digits.startsWith('20') && digits.length >= 12
                    ? digits
                    : digits.startsWith('0') && digits.length === 11
                      ? `20${digits.slice(1)}`
                      : digits.length === 10
                        ? `20${digits}`
                        : `20${digits}`;
                  const waUrl = `https://wa.me/${intl}`;
                  const deepLink = `whatsapp://send?phone=${intl}`;
                  const canDeep = await Linking.canOpenURL(deepLink).catch(() => false);
                  Linking.openURL(canDeep ? deepLink : waUrl).catch(() => Linking.openURL(waUrl));
                }}
              />
            )}
            {!!email && (
              <MenuItem
                icon="mail"
                iconBg="#EFF6FF"
                iconColor="#2563EB"
                label={email}
                colors={colors}
                isRTL={isRTL}
                chevron={chevron}
                onPress={() => Linking.openURL(`mailto:${email}`)}
                isLast
              />
            )}
          </MenuSection>
        )}

        {/* ── Support ───────────────────────────────────────────────────── */}
        <MenuSection title={t.techAccount.sections.support} colors={colors}>
          <MenuItem
            icon="help-circle"
            iconBg="#D1FAE5"
            iconColor="#059669"
            label={t.techAccount.supportTickets}
            colors={colors}
            isRTL={isRTL}
            chevron={chevron}
            onPress={() => router.push('/support')}
            isLast
          />
        </MenuSection>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <View style={{ marginHorizontal: 16, gap: 10, marginBottom: 8 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.destructive + '40', borderWidth: 1 }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>{t.techAccount.logout}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.destructive + '08', borderColor: colors.destructive + '20', borderWidth: 1 }]}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={18} color={colors.destructive} />
            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>{t.techAccount.deleteAccount}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmDialog state={dialogState} />
      <LanguagePickerModal
        visible={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
      />
    </View>
  );
}


// ── Stat item ────────────────────────────────────────────────────────────────
function StatItem({
  value, label, color, colors, onPress,
}: {
  value: string; label: string; color: string; colors: any; onPress?: () => void;
}) {
  const inner = (
    <>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={styles.statItem} onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.statItem}>{inner}</View>;
}

// ── Menu section ─────────────────────────────────────────────────────────────
function MenuSection({ title, children, colors }: any) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

// ── Menu item ─────────────────────────────────────────────────────────────────
function MenuItem({
  icon, iconBg, iconColor, label, colors, onPress, isLast, isRTL, chevron,
}: {
  icon: any; iconBg: string; iconColor: string;
  label: string; colors: any; onPress: () => void; isLast?: boolean; isRTL: boolean; chevron?: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        { direction: isRTL ? 'rtl' : 'ltr' },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isRTL ? (
        <>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={16} color={iconColor} />
          </View>
          <Feather name={(chevron ?? 'chevron-left') as any} size={18} color={colors.mutedForeground} />
        </>
      ) : (
        <>
          <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={16} color={iconColor} />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <Feather name={(chevron ?? 'chevron-right') as any} size={18} color={colors.mutedForeground} />
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Menu item with switch ─────────────────────────────────────────────────────
function MenuItemSwitch({
  icon, iconBg, iconColor, label, value, onToggle, colors,
  isRTL,
}: {
  icon: any; iconBg: string; iconColor: string;
  label: string; value: boolean; onToggle: (v: boolean) => void;
  colors: any; isRTL: boolean;
}) {
  return (
    <View style={[styles.menuItem, { direction: isRTL ? 'rtl' : 'ltr' }]}>
      {isRTL ? (
        <>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={16} color={iconColor} />
          </View>
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: colors.border, true: colors.primary + 'AA' }}
            thumbColor={value ? colors.primary : colors.muted}
            ios_backgroundColor={colors.border}
          />
        </>
      ) : (
        <>
          <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={16} color={iconColor} />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: colors.border, true: colors.primary + 'AA' }}
            thumbColor={value ? colors.primary : colors.muted}
            ios_backgroundColor={colors.border}
          />
        </>
      )}
    </View>
  );
}

function MenuItemLanguage({ label, currentLabel, colors, onPress, isLast, isRTL }: any) {
  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        { direction: isRTL ? 'rtl' : 'ltr' },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isRTL ? (
        <>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <View style={[styles.menuIcon, { backgroundColor: '#DBEAFE' }]}>
            <Feather name="globe" size={16} color="#2563EB" />
          </View>
          <Text style={[styles.langValue, { color: colors.primary, borderColor: colors.primary + '40', backgroundColor: colors.primary + '10' }]}>
            {currentLabel}
          </Text>
        </>
      ) : (
        <>
          <View style={[styles.menuIcon, { backgroundColor: '#DBEAFE' }]}>
            <Feather name="globe" size={16} color="#2563EB" />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <Text style={[styles.langValue, { color: colors.primary, borderColor: colors.primary + '40', backgroundColor: colors.primary + '10' }]}>
            {currentLabel}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── Hero ──
  hero: {
    margin: 16,
    borderRadius: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 20,
  },
  heroBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  heroBandCurve: {
    position: 'absolute',
    bottom: -1,
    left: -20,
    right: -20,
    height: 36,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  heroEditBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 10,
  },
  heroAvatarRing: {
    marginTop: 48,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
  },
  heroAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  heroAvatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarInitial: {
    color: '#fff',
    fontSize: 32,
    fontFamily: 'Cairo_700Bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
  },
  heroName: {
    marginTop: 14,
    fontSize: 21,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  heroMobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  heroMobile: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
  },
  heroStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  heroStatusText: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
  },
  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 18,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    alignSelf: 'center',
  },
  // ── Section ──
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    marginBottom: 8,
    marginRight: 4,
    textAlign: 'auto',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Cairo_500Medium',
    textAlign: 'auto',
  },
  langValue: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  // ── Action buttons ──
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: 'Cairo_600SemiBold',
  },
});
