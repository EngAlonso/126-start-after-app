/**
 * Customer Registration screen — /register
 * Matches the Login screen design system: premium card, amber branding, no scroll.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, ActivityIndicator, Platform,
  type TextInput as TextInputType,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useReferral } from '@/contexts/ReferralContext';
import { apiFetch } from '@/hooks/useApi';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { AuthResponse } from '@/types';

type FocusedField = 'fullName' | 'mobile' | 'password' | 'confirmPassword' | null;

export default function RegisterScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { login } = useAuth();
  const { referralCode, clearReferralCode } = useReferral();
  const { get }   = useCmsSettings();
  const topPad    = Platform.OS === 'web' ? 32 : insets.top;

  const { locale } = useLocale();
  const t = translations[locale];

  const appName = get(CMS_KEYS.APP_NAME, BRAND.NAME);
  const logoUrl  = get(CMS_KEYS.LOGO_URL);

  // Refs for sequential focus
  const mobileRef          = useRef<TextInputType>(null);
  const passwordRef        = useRef<TextInputType>(null);
  const confirmPasswordRef = useRef<TextInputType>(null);

  const [fullName,         setFullName]         = useState('');
  const [mobile,           setMobile]           = useState('');
  const [password,         setPassword]         = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showPass,         setShowPass]         = useState(false);
  const [showConfirmPass,  setShowConfirmPass]  = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState('');
  const [focusedField,     setFocusedField]     = useState<FocusedField>(null);

  // ── Registration logic — unchanged ────────────────────────────────────────
  const handleRegister = async () => {
    setError('');
    if (!fullName.trim() || !mobile.trim() || !password.trim()) {
      setError(t.auth.fillRequiredFields);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.passwordsNotMatch);
      return;
    }
    if (password.length < 6) {
      setError(t.auth.passwordMinLength);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/register/customer', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          mobile,
          password,
          ...(referralCode ? { referredBy: referralCode } : {}),
        }),
      });
      if (referralCode) await clearReferralCode();
      await login(res.user, res.accessToken, res.refreshToken);
      router.replace('/(customer)/' as any);
    } catch (e: any) {
      setError(e.message || t.auth.genericError);
    } finally {
      setLoading(false);
    }
  };

  const focused = (field: FocusedField) => focusedField === field;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[
          styles.container,
          { paddingTop: topPad + 4, paddingBottom: (insets.bottom || 0) + 12 },
        ]}
      >
        {/* ── Back button ───────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.backBtnInner, { backgroundColor: colors.muted }]}>
            <Feather name="arrow-right" size={20} color={colors.foreground} />
          </View>
        </TouchableOpacity>

        {/* ── Logo / Brand ──────────────────────────────────────────────────── */}
        <View style={styles.logoArea}>
          <View style={[styles.logoGlow, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
            ) : (
              <Text style={[styles.appName, { color: colors.primary }]}>{appName}</Text>
            )}
          </View>
          <Text style={[styles.brandTitle, { color: colors.foreground }]}>{appName}</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            {t.auth.taglineRegister}
          </Text>
        </View>

        {/* ── Registration card ─────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

          <View style={styles.cardHeader}>
            <Text style={[styles.formTitle,    { color: colors.foreground }]}>{t.auth.registerTitle}</Text>
            <Text style={[styles.formSubtitle, { color: colors.mutedForeground }]}>
              {t.auth.registerSubtitle}
            </Text>
          </View>

          {/* Error banner */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t.auth.fullNameLabel}</Text>
            <View style={[
              styles.inputRow,
              { backgroundColor: focused('fullName') ? colors.card : colors.background, borderColor: colors.border },
              focused('fullName') && { borderColor: colors.primary },
            ]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="محمد أحمد"
                placeholderTextColor={colors.mutedForeground}
                value={fullName}
                onChangeText={setFullName}
                textContentType="name"
                autoComplete="name"
                textAlign="right"
                returnKeyType="next"
                blurOnSubmit={false}
                onFocus={() => setFocusedField('fullName')}
                onBlur={()  => setFocusedField(null)}
                onSubmitEditing={() => mobileRef.current?.focus()}
              />
              <View style={[styles.iconWrap, { backgroundColor: focused('fullName') ? colors.primary + '15' : colors.muted }]}>
                <Feather name="user" size={16} color={focused('fullName') ? colors.primary : colors.mutedForeground} />
              </View>
            </View>
          </View>

          {/* Mobile */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t.auth.mobileLabel}</Text>
            <View style={[
              styles.inputRow,
              { backgroundColor: focused('mobile') ? colors.card : colors.background, borderColor: colors.border },
              focused('mobile') && { borderColor: colors.primary },
            ]}>
              <TextInput
                ref={mobileRef}
                style={[styles.input, { color: colors.foreground }]}
                placeholder="01xxxxxxxxx"
                placeholderTextColor={colors.mutedForeground}
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                textAlign="right"
                returnKeyType="next"
                blurOnSubmit={false}
                onFocus={() => setFocusedField('mobile')}
                onBlur={()  => setFocusedField(null)}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <View style={[styles.iconWrap, { backgroundColor: focused('mobile') ? colors.primary + '15' : colors.muted }]}>
                <Feather name="phone" size={16} color={focused('mobile') ? colors.primary : colors.mutedForeground} />
              </View>
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t.auth.passwordLabel}</Text>
            <View style={[
              styles.inputRow,
              { backgroundColor: focused('password') ? colors.card : colors.background, borderColor: colors.border },
              focused('password') && { borderColor: colors.primary },
            ]}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                textContentType="newPassword"
                autoComplete="new-password"
                textAlign="right"
                returnKeyType="next"
                blurOnSubmit={false}
                onFocus={() => setFocusedField('password')}
                onBlur={()  => setFocusedField(null)}
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />
              <TouchableOpacity
                onPress={() => setShowPass(p => !p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.iconWrap, { backgroundColor: focused('password') ? colors.primary + '15' : colors.muted }]}
              >
                <Feather
                  name={showPass ? 'eye-off' : 'eye'}
                  size={16}
                  color={focused('password') ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t.auth.confirmPasswordLabel}</Text>
            <View style={[
              styles.inputRow,
              { backgroundColor: focused('confirmPassword') ? colors.card : colors.background, borderColor: colors.border },
              focused('confirmPassword') && { borderColor: colors.primary },
            ]}>
              <TextInput
                ref={confirmPasswordRef}
                style={[styles.input, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPass}
                textContentType="newPassword"
                autoComplete="new-password"
                textAlign="right"
                returnKeyType="go"
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={()  => setFocusedField(null)}
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPass(p => !p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.iconWrap, { backgroundColor: focused('confirmPassword') ? colors.primary + '15' : colors.muted }]}
              >
                <Feather
                  name={showConfirmPass ? 'eye-off' : 'eye'}
                  size={16}
                  color={focused('confirmPassword') ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Register button */}
          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#1A1A1A" size="small" />
            ) : (
              <View style={styles.btnInner}>
                <Feather name="user-plus" size={17} color="#1A1A1A" />
                <Text style={styles.registerBtnText}>{t.auth.registerBtn}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Footer links ──────────────────────────────────────────────────── */}
        <View style={styles.footerArea}>
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{t.auth.hasAccount} </Text>
            <Link href="/" style={[styles.footerLink, { color: colors.primary }]}>{t.auth.loginLink}</Link>
          </View>
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{t.auth.areTech}</Text>
            <Link href="/register-tech" style={[styles.footerLink, { color: colors.primary }]}>{t.auth.registerAsTech}</Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Root container — no scroll, fills screen
  container: {
    flex: 1,
    paddingHorizontal: 22,
  },

  // Back button
  backBtn: { alignSelf: 'flex-end', marginBottom: 4 },
  backBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Logo / brand
  logoArea: {
    alignItems: 'center',
    marginBottom: 14,
    gap: 4,
  },
  logoGlow: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#E9B73A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: { width: 52, height: 52, borderRadius: 14 },
  appName: { fontSize: 22, fontFamily: 'Cairo_700Bold' },
  brandTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold', letterSpacing: 0.3 },
  tagline: { fontSize: 11, fontFamily: 'Cairo_400Regular', textAlign: 'center' },

  // Card
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardHeader: { gap: 2 },
  formTitle:    { fontSize: 19, fontFamily: 'Cairo_700Bold',    textAlign: 'auto' },
  formSubtitle: { fontSize: 12, fontFamily: 'Cairo_400Regular', textAlign: 'auto' },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontFamily: 'Cairo_500Medium',
    textAlign: 'auto',
    fontSize: 12,
    lineHeight: 18,
  },

  // Fields
  fieldGroup: { gap: 5 },
  label: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', textAlign: 'auto' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 10,
    gap: 8,
    height: 46,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    paddingHorizontal: 4,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Register button — same premium style as Login
  registerBtn: {
    borderRadius: 16,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: '#E9B73A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },
  btnDisabled: { opacity: 0.6, elevation: 0, shadowOpacity: 0 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  registerBtnText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    letterSpacing: 0.3,
  },

  // Footer links
  footerArea: { alignItems: 'center', marginTop: 14, gap: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  footerLink: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
});
