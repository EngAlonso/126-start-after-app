import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCmsSettings, CMS_KEYS } from '@/hooks/useCmsSettings';
import { BRAND } from '@/constants/brand';
import * as Haptics from 'expo-haptics';

interface Props {
  referralCode?: string | null;
  referralCoins?: number;
  loading?: boolean;
}

export function ReferralCard({ referralCode, referralCoins = 50, loading }: Props) {
  const colors = useColors();
  const { get } = useCmsSettings();
  const appName = get(CMS_KEYS.APP_NAME, BRAND.NAME);

  const handleShare = async () => {
    if (!referralCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `انضم إلى ${appName} واحصل على ${referralCoins} عملة ذهبية! استخدم كودي: ${referralCode}`,
      });
    } catch {
      // share cancelled
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: colors.primaryLight },
          ]}
        >
          <Feather name="gift" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          ادعُ صديقاً واربح
        </Text>
      </View>

      {/* Reward text */}
      <Text style={[styles.rewardText, { color: colors.mutedForeground }]}>
        احصل على{' '}
        <Text style={{ color: colors.primary, fontFamily: 'Cairo_700Bold' }}>
          {referralCoins} عملة ذهبية
        </Text>{' '}
        لكل صديق يسجّل باستخدام كودك
      </Text>

      {/* Code row */}
      {loading ? (
        <View style={[styles.codeBox, { backgroundColor: colors.muted, marginTop: 14 }]}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            جارٍ التحميل…
          </Text>
        </View>
      ) : referralCode ? (
        <View style={styles.codeRow}>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.primary }]}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Feather name="share-2" size={16} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.codeBox, { backgroundColor: colors.muted }]}>
            <Text style={[styles.codeText, { color: colors.foreground }]}>
              {referralCode}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 22,
    marginHorizontal: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Cairo_600SemiBold',
  },
  rewardText: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    lineHeight: 22,
    marginBottom: 16,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeBox: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  codeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    textAlign: 'center',
    letterSpacing: 3,
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    fontSize: 13,
  },
});
