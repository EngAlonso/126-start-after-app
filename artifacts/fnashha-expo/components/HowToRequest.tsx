import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

export function HowToRequest() {
  const colors = useColors();
  const { isDark } = useTheme();
  const { locale, isRTL } = useLocale();
  const t = translations[locale];
  const ht = t.customerHome.howToRequest;

  const steps = [
    { icon: 'grid',         title: ht.step1Title, desc: ht.step1Desc },
    { icon: 'file-text',    title: ht.step2Title, desc: ht.step2Desc },
    { icon: 'users',        title: ht.step3Title, desc: ht.step3Desc },
    { icon: 'check-circle', title: ht.step4Title, desc: ht.step4Desc },
  ];

  // Light mode: warm cream-amber gradient (unchanged).
  // Dark mode: deep amber-tinted dark surfaces that match the dark palette
  //            (dark.accent #231D08 → dark.secondary #211D0E → dark.primaryLight #2E2508).
  const gradientColors: [string, string, string] = isDark
    ? ['#231D08', '#2A2010', '#2E2508']
    : ['#FFFBEB', '#FEF3C7', '#FDE68A55'];

  // Border: light amber strip in light mode; subtle amber glow in dark mode.
  const cardBorderColor = isDark ? colors.primary + '40' : '#FDE68A';

  // Description text: dark brown readable on cream in light mode;
  // muted foreground (#8B929E) readable on the dark surface in dark mode.
  const descColor = isDark ? colors.mutedForeground : '#713F12';

  return (
    <View
      style={[
        styles.howSectionOuter,
        {
          shadowColor: colors.primary,
          borderColor: cardBorderColor,
          // backgroundColor must match gradient start to avoid Android white elevation bg
          backgroundColor: isDark ? '#231D08' : '#FFFBEB',
        },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.howSection}
      >
        <View style={[styles.howDecorCircle, styles.howDecorBottom]} />
        <View style={[styles.howDecorCircle, styles.howDecorTop]} />

        <View style={[styles.howHeader, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
          <View style={styles.howHeaderIcon}>
            <Feather name="clipboard" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
            {ht.title}
          </Text>
        </View>

        <View style={styles.stepsList}>
          {steps.map((step, i) => (
            <View key={i} style={[styles.stepRow, isRTL && styles.rtlStepRow]}>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{step.title}</Text>
                <Text style={[styles.stepDesc, { color: descColor, textAlign: isRTL ? 'right' : 'left' }]}>{step.desc}</Text>
              </View>
              <View style={[styles.stepNum, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '35' }]}>
                <Feather name={step.icon as any} size={20} color={colors.primary} />
              </View>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  howSectionOuter: {
    margin: 16,
    marginTop: 28,
    borderRadius: 24,
    borderWidth: 1,
    // overflow:'hidden' removed — Android elevation + overflow:hidden = white rectangle.
    // The inner LinearGradient (howSection) clips its own children.
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  howSection: {
    minHeight: 250,
    borderRadius: 23,
    padding: 24,
    overflow: 'hidden',
  },
  howDecorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  howDecorBottom: {
    width: 150,
    height: 150,
    left: -58,
    bottom: -74,
  },
  howDecorTop: {
    width: 76,
    height: 76,
    right: -22,
    top: -28,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  howHeader: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  howHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
  },
  stepsList: { gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rtlStepRow: { direction: 'ltr' },
  stepNum: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepContent: { flex: 1, alignItems: 'flex-end', paddingVertical: 2 },
  stepTitle: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  stepDesc: { fontSize: 12, fontFamily: 'Cairo_400Regular', marginTop: 3 },
  sectionTitle: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
});