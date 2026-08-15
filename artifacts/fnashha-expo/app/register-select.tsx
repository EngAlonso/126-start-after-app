/**
 * Account-type selection screen — /register-select
 *
 * Mirrors the web /register page design.
 * Routes only — no registration logic here.
 *   /register       — customer registration
 *   /register-tech  — technician registration
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

export default function RegisterSelectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 40 : insets.top;
  const { locale } = useLocale();
  const t = translations[locale];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/login')}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={[styles.backBtnInner, { backgroundColor: colors.muted }]}>
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </View>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title,    { color: colors.foreground }]}>{t.registerSelect.title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t.registerSelect.subtitle}
        </Text>
      </View>

      {/* ── Account type cards ─────────────────────────────────────────────── */}
      <View style={styles.cards}>

        {/* ── Customer card — amber (matches wallet) ──────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/register')}
          activeOpacity={0.86}
          style={styles.cardTouch}
        >
          <LinearGradient
            colors={['#E9B73A', '#C89820']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* Decorative blob */}
            <View style={[styles.blob, styles.blobTopLeft]} />
            <View style={[styles.blob, styles.blobBottomRight]} />

            {/* Content */}
            <View style={styles.cardRow}>
              {/* Icon */}
              <View style={styles.iconWrap}>
                <Feather name="user" size={34} color="#C89820" />
              </View>

              {/* Text */}
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{t.registerSelect.customerTitle}</Text>
                <Text style={styles.cardDesc}>
                  {t.registerSelect.customerDesc}
                </Text>
              </View>

              {/* Arrow */}
              <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.65)" />
            </View>

            {/* CTA strip */}
            <View style={styles.ctaStrip}>
              <Feather name="arrow-left" size={14} color="#C89820" />
              <Text style={styles.ctaText}>{t.registerSelect.customerCta}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Technician card — deep slate ───────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/register-tech')}
          activeOpacity={0.86}
          style={styles.cardTouch}
        >
          <LinearGradient
            colors={['#334155', '#1E293B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* Decorative blob */}
            <View style={[styles.blob, styles.blobTopLeft, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
            <View style={[styles.blob, styles.blobBottomRight, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

            {/* Content */}
            <View style={styles.cardRow}>
              {/* Icon */}
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <Feather name="tool" size={32} color="#fff" />
              </View>

              {/* Text */}
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle]}>{t.registerSelect.techTitle}</Text>
                <Text style={[styles.cardDesc]}>
                  {t.registerSelect.techDesc}
                </Text>
              </View>

              {/* Arrow */}
              <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.45)" />
            </View>

            {/* CTA strip */}
            <View style={[styles.ctaStrip, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.12)' }]}>
              <Feather name="arrow-left" size={14} color="#fff" />
              <Text style={[styles.ctaText, { color: '#fff' }]}>{t.registerSelect.techCta}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Already have account */}
      <View style={styles.loginRow}>
        <Text style={[styles.loginHint, { color: colors.mutedForeground }]}>
          {t.auth.hasAccount}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/login')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.loginLink, { color: colors.primaryDark }]}>{t.auth.loginLink}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 52,
  },

  // Back button
  backBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  backBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 32,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
  },

  // Cards
  cards: { gap: 16 },

  cardTouch: {
    borderRadius: 24,
    // shadow applied to touch wrapper so it clips correctly
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },

  card: {
    borderRadius: 24,
    padding: 22,
    gap: 16,
    overflow: 'hidden',
  },

  // Decorative blobs (pure visual, like wallet card sheen)
  blob: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  blobTopLeft: { top: -40, left: -30 },
  blobBottomRight: { bottom: -50, right: -20 },

  // Main content row inside card
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  // Icon circle
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardText: { flex: 1, gap: 5, alignItems: 'flex-end' },

  cardTitle: {
    fontSize: 24,
    fontFamily: 'Cairo_700Bold',
    color: '#fff',
    textAlign: 'auto',
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'auto',
    lineHeight: 19,
  },

  // CTA strip at the bottom of each card
  ctaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
    color: '#7A5200',
  },

  // Login link
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 6,
  },
  loginHint: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  loginLink: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
});
