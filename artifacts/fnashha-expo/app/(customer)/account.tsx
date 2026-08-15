import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Linking, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { apiFetch, apiUrl, resolveMediaUrl } from '@/hooks/useApi';
import { AppHeader } from '@/components/AppHeader';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { useConfirm } from '@/hooks/useConfirm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { navigateToGuestHomeAfterLogout } from '@/utils/logout-navigation';
import { deregisterPushTokens } from '@/hooks/usePushNotifications';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import { LanguagePickerModal } from '@/components/LanguagePickerModal';

export default function CustomerAccountScreen() {
  const colors = useColors();
  const { isDark, setDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, accessToken, logout } = useAuth();
  const { get } = useCmsSettings();
  const { confirm, showAlert, dialogState } = useConfirm();
  const { locale, setLocale, isRTL } = useLocale();
  const t = translations[locale];
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  const handleLanguageSelect = () => {
    console.log('Language row pressed');
    setLangPickerOpen(true);
  };

  const phone     = get(CMS_KEYS.PHONE, '');
  const whatsapp  = get(CMS_KEYS.WHATSAPP, phone);
  const email     = get(CMS_KEYS.EMAIL, '');
  const avatarUri  = resolveMediaUrl(user?.profileImage);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    const ok = await confirm({
      title: t.customerAccount.logoutTitle,
      message: t.customerAccount.logoutMessage,
      confirmText: t.customerAccount.logoutConfirm,
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
    }).catch(() => { /* best-effort */ });
  };

  // ── Delete Account ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    const step1 = await confirm({
      title: t.customerAccount.deleteTitle,
      message: t.customerAccount.deleteMessage,
      confirmText: t.customerAccount.deleteConfirm,
    });
    if (!step1) return;

    const step2 = await confirm({
      title: t.customerAccount.deleteTitle2,
      message: t.customerAccount.deleteMessage2,
      confirmText: t.customerAccount.deleteConfirm2,
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
      showAlert(t.common.error, e.message || t.customerAccount.deleteError);
    }
  };

  const chevron = isRTL ? 'chevron-left' : 'chevron-right';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader role="customer" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Premium profile header ────────────────────────────────── */}
        <View style={styles.profileOuter}>
          <LinearGradient
            colors={['#FFFBEB', '#FEF3C7', '#FDE68A44']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.profileGradient, { borderColor: '#FDE68A' }]}
          >
            {/* Decorative circles */}
            <View style={[styles.decorCircle, { width: 130, height: 130, borderRadius: 65, bottom: -40, left: -40 }]} />
            <View style={[styles.decorCircle, { width: 60,  height: 60,  borderRadius: 30, top: -16, right: 88, opacity: 0.4 }]} />

            {/* Arabic profile order is physical: avatar left, info/edit right. */}
            <View style={[styles.profileRow, locale === 'ar' && styles.profileRowArabic]}>
              {/* Avatar with golden frame */}
              <View style={styles.avatarFrame}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarInitial}>{user?.fullName?.[0] ?? '؟'}</Text>
                  </View>
                )}
              </View>

              {/* Name + phone */}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>{user?.fullName}</Text>
                <Text style={styles.profileMobile}>{user?.mobile}</Text>
              </View>

              {/* Edit button */}
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#FDE68A' }]}
                onPress={() => router.push('/edit-profile')}
                activeOpacity={0.75}
              >
                <Feather name="edit-2" size={15} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── Account ──────────────────────────────────────────────── */}
        <MenuSection title={t.customerAccount.sections.account} colors={colors}>
          <MenuItem
            icon="user" iconBg="#FEF3C7" iconColor="#D97706"
            label={t.customerAccount.editProfile}
            colors={colors}
            isRTL={isRTL}
            chevron={chevron}
            isLast
            onPress={() => router.push('/edit-profile')}
          />
        </MenuSection>

        {/* ── Appearance ───────────────────────────────────────────── */}
        <MenuSection title={t.customerAccount.sections.appearance} colors={colors}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border + '70' }}>
            <MenuItemSwitch
              icon="moon" iconBg="#EDE9FE" iconColor="#7C3AED"
              label={t.customerAccount.darkMode}
              value={isDark}
              onToggle={setDark}
              colors={colors}
              isRTL={isRTL}
            />
          </View>
          <MenuItemLanguage
            currentLabel={locale === 'ar' ? t.common.languageArabic : t.common.languageEnglish}
            label={t.common.language}
            colors={colors}
            isRTL={isRTL}
            onPress={handleLanguageSelect}
          />
        </MenuSection>

        {/* ── Contact ──────────────────────────────────────────────── */}
        <MenuSection title={t.customerAccount.sections.contact} colors={colors}>
          {phone ? (
            <MenuItem
              icon="phone" iconBg="#DCFCE7" iconColor="#16A34A"
              label={`${t.customerAccount.callPrefix}: ${phone}`}
              colors={colors}
              isRTL={isRTL}
              chevron={chevron}
              isLast={!whatsapp && !email}
              onPress={() => Linking.openURL(`tel:${phone}`)}
            />
          ) : null}
          {whatsapp ? (
            <MenuItem
              icon="message-square" iconBg="#DCFCE7" iconColor="#16A34A"
              label={`${t.customerAccount.whatsappPrefix}: ${whatsapp}`}
              colors={colors}
              isRTL={isRTL}
              chevron={chevron}
              isLast={!email}
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
          ) : null}
          {email ? (
            <MenuItem
              icon="mail" iconBg="#DBEAFE" iconColor="#2563EB"
              label={email}
              colors={colors}
              isRTL={isRTL}
              chevron={chevron}
              isLast
              onPress={() => Linking.openURL(`mailto:${email}`)}
            />
          ) : null}
        </MenuSection>

        {/* ── Support ──────────────────────────────────────────────── */}
        <MenuSection title={t.customerAccount.sections.support} colors={colors}>
          <MenuItem
            icon="help-circle" iconBg="#FEF3C7" iconColor="#D97706"
            label={t.customerAccount.supportTickets}
            colors={colors}
            isRTL={isRTL}
            chevron={chevron}
            isLast
            onPress={() => router.push('/support')}
          />
        </MenuSection>

        {/* ── Danger zone ──────────────────────────────────────────── */}
        <View style={styles.dangerZone}>
          <TouchableOpacity
            style={[styles.dangerCard, {
              backgroundColor: colors.destructive + '09',
              borderColor:     colors.destructive + '35',
              flexDirection: isRTL ? 'row' : 'row-reverse',
            }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={[styles.dangerLabel, { color: colors.destructive }]}>{t.customerAccount.logout}</Text>
            <View style={[styles.dangerIconWrap, { backgroundColor: colors.destructive + '16' }]}>
              <Feather name="log-out" size={18} color={colors.destructive} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerCard, {
              backgroundColor: colors.destructive + '06',
              borderColor:     colors.destructive + '20',
              flexDirection: isRTL ? 'row' : 'row-reverse',
            }]}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
          >
            <Text style={[styles.dangerLabel, { color: colors.destructive }]}>{t.customerAccount.deleteAccount}</Text>
            <View style={[styles.dangerIconWrap, { backgroundColor: colors.destructive + '12' }]}>
              <Feather name="trash-2" size={18} color={colors.destructive} />
            </View>
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

// ── Sub-components ────────────────────────────────────────────────────────────

function MenuSection({ title, children, colors }: any) {
  return (
    <View style={styles.menuSection}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function MenuItem({ icon, iconBg, iconColor, label, colors, onPress, isLast, isRTL, chevron }: any) {
  return (
    <TouchableOpacity
      style={[
        styles.menuRow,
        { direction: isRTL ? 'rtl' : 'ltr' },
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border + '70' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isRTL ? (
        <>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <View style={[styles.menuIconBadge, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={17} color={iconColor} />
          </View>
          <Feather name={chevron ?? 'chevron-left'} size={15} color={colors.mutedForeground} style={{ opacity: 0.45 }} />
        </>
      ) : (
        <>
          <View style={[styles.menuIconBadge, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={17} color={iconColor} />
          </View>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <Feather name={chevron ?? 'chevron-right'} size={15} color={colors.mutedForeground} style={{ opacity: 0.45 }} />
        </>
      )}
    </TouchableOpacity>
  );
}

function MenuItemSwitch({ icon, iconBg, iconColor, label, value, onToggle, colors, isRTL }: any) {
  return (
    <View style={[styles.menuRow, { direction: isRTL ? 'rtl' : 'ltr' }]}>
      {isRTL ? (
        <>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <View style={[styles.menuIconBadge, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={17} color={iconColor} />
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
          <View style={[styles.menuIconBadge, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={17} color={iconColor} />
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

function MenuItemLanguage({ label, currentLabel, colors, onPress, isRTL }: any) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, { direction: isRTL ? 'rtl' : 'ltr' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isRTL ? (
        <>
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
          <View style={[styles.menuIconBadge, { backgroundColor: '#DBEAFE' }]}>
            <Feather name="globe" size={17} color="#2563EB" />
          </View>
          <Text style={[styles.langValue, { color: colors.primary, borderColor: colors.primary + '40', backgroundColor: colors.primary + '10' }]}>
            {currentLabel}
          </Text>
        </>
      ) : (
        <>
          <View style={[styles.menuIconBadge, { backgroundColor: '#DBEAFE' }]}>
            <Feather name="globe" size={17} color="#2563EB" />
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Profile header ────────────────────────────────────────────────────────
  profileOuter: {
    margin: 16,
    marginBottom: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  profileGradient: {
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(253,230,138,0.55)',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileRowArabic: {
    direction: 'ltr',
  },
  avatarFrame: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 71, height: 71, borderRadius: 35 },
  avatarPlaceholder: {
    width: 71, height: 71, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 26, fontFamily: 'Cairo_700Bold' },
  profileInfo: { flex: 1, alignItems: 'flex-end', gap: 3 },
  profileName: {
    fontSize: 19,
    fontFamily: 'Cairo_700Bold',
    color: '#78350F',
    textAlign: 'auto',
  },
  profileMobile: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    color: '#92400E',
    textAlign: 'auto',
  },
  editBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Menu sections ─────────────────────────────────────────────────────────
  menuSection: { marginHorizontal: 16, marginBottom: 14 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    marginBottom: 8,
    textAlign: 'auto',
    marginRight: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  menuIconBadge: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo_600SemiBold',
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

  // ── Danger zone ───────────────────────────────────────────────────────────
  dangerZone: { marginHorizontal: 16, gap: 10, marginTop: 4 },
  dangerCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dangerIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerLabel: { fontSize: 16, fontFamily: 'Cairo_600SemiBold' },
});
