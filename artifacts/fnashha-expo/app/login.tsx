/**
 * Login screen — /login
 * Issue #1: Bigger logo, bigger brand text, centered form header, better bottom spacing
 * Issue #2: Explicit RTL (row-reverse) for all flex containers
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, ActivityIndicator, Platform,
  ScrollView,
  type TextInput as TextInputType,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/hooks/useApi';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { AuthResponse } from '@/types';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { get } = useCmsSettings();
  const topPad = Platform.OS === 'web' ? 40 : insets.top;

  const { locale } = useLocale();
  const t = translations[locale];

  const appName = get(CMS_KEYS.APP_NAME, BRAND.NAME);
  const logoUrl  = get(CMS_KEYS.LOGO_URL);

  const passwordRef = useRef<TextInputType>(null);

  const [mobile,       setMobile]       = useState('');
  const [password,     setPassword]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [focusedField, setFocusedField] = useState<'mobile' | 'password' | null>(null);

  // ── Login logic — unchanged ───────────────────────────────────────────────
  const handleLogin = async () => {
    setError('');
    if (!mobile.trim() || !password.trim()) {
      setError(t.auth.fillMobilePassword);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ mobile, password }),
      });
      await login(res.user, res.accessToken, res.refreshToken);
    } catch (e: any) {
      setError(e.message || t.auth.invalidCredentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 8, paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
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
            {t.auth.taglineLogin}
          </Text>
        </View>

        {/* ── Login card ────────────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

          <View style={styles.cardHeader}>
            <Text style={[styles.formTitle,    { color: colors.foreground }]}>{t.auth.loginTitle}</Text>
            <Text style={[styles.formSubtitle, { color: colors.mutedForeground }]}>
              {t.auth.loginSubtitle}
            </Text>
          </View>

          {/* Error banner */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Text style={styles.errorText}>{error}</Text>
              <Feather name="alert-circle" size={14} color="#DC2626" />
            </View>
          ) : null}

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t.auth.mobileLabel}</Text>
            <View style={[
              styles.inputRow,
              { backgroundColor: focusedField === 'mobile' ? colors.card : colors.background, borderColor: colors.border },
              focusedField === 'mobile' && { borderColor: colors.primary },
            ]}>
              <TextInput
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
              <View style={[styles.iconWrap, { backgroundColor: focusedField === 'mobile' ? colors.primary + '15' : colors.muted }]}>
                <Feather name="phone" size={16} color={focusedField === 'mobile' ? colors.primary : colors.mutedForeground} />
              </View>
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t.auth.passwordLabel}</Text>
            <View style={[
              styles.inputRow,
              { backgroundColor: focusedField === 'password' ? colors.card : colors.background, borderColor: colors.border },
              focusedField === 'password' && { borderColor: colors.primary },
            ]}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                textContentType="password"
                autoComplete="password"
                textAlign="right"
                returnKeyType="go"
                onFocus={() => setFocusedField('password')}
                onBlur={()  => setFocusedField(null)}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPass(p => !p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.iconWrap, { backgroundColor: focusedField === 'password' ? colors.primary + '15' : colors.muted }]}
              >
                <Feather
                  name={showPass ? 'eye-off' : 'eye'}
                  size={16}
                  color={focusedField === 'password' ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#1A1A1A" size="small" />
            ) : (
              <View style={styles.btnInner}>
                <Feather name="arrow-left" size={17} color="#1A1A1A" />
                <Text style={styles.loginBtnText}>{t.auth.loginBtn}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Spacer ─────────────────────────────────────────────────────── */}
        <View style={{ flex: 1, minHeight: 24 }} />

        {/* ── Register CTA ──────────────────────────────────────────────────── */}
        <View style={styles.registerArea}>
          <Text style={[styles.registerHint, { color: colors.mutedForeground }]}>
            {t.auth.noAccount}
          </Text>
          <TouchableOpacity
            style={[styles.registerBtn, { borderColor: colors.primary + '60', backgroundColor: colors.primaryLight }]}
            onPress={() => router.push('/register-select' as any)}
            activeOpacity={0.82}
          >
            <Text style={[styles.registerBtnText, { color: colors.primaryDark }]}>{t.auth.createAccountBtn}</Text>
            <Feather name="user-plus" size={15} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Root container — scrollable, fills screen
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },

  // Back button
  backBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  backBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Logo / brand — Issue #1: larger sizes
  logoArea: {
    alignItems: 'center',
    marginBottom: 22,
    marginTop: 8,
    gap: 8,
  },
  logoGlow: {
    width: 132,
    height: 132,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#E9B73A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: { width: 106, height: 106, borderRadius: 26 },
  appName: { fontSize: 36, fontFamily: 'Cairo_700Bold' },
  brandTitle: { fontSize: 34, fontFamily: 'Cairo_700Bold', letterSpacing: 0.3 },
  tagline: { fontSize: 17, fontFamily: 'Cairo_400Regular', textAlign: 'center' },

  // Card
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardHeader: { gap: 5, alignItems: 'center' },
  formTitle:    { fontSize: 22, fontFamily: 'Cairo_700Bold',    textAlign: 'center' },
  formSubtitle: { fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'center' },

  // Error — RTL: icon on the right
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

  // Fields — RTL: icon on the right, input fills left
  fieldGroup: { gap: 7 },
  label: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', textAlign: 'auto' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 10,
    gap: 8,
    height: 50,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
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

  // Login button
  loginBtn: {
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#E9B73A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },
  btnDisabled: { opacity: 0.6, elevation: 0, shadowOpacity: 0 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginBtnText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    letterSpacing: 0.3,
  },

  // Register area — better use of bottom space
  registerArea: { alignItems: 'center', marginTop: 16, gap: 12 },
  registerHint: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    width: '100%',
    justifyContent: 'center',
  },
  registerBtnText: { fontSize: 15, fontFamily: 'Cairo_700Bold' },
});
