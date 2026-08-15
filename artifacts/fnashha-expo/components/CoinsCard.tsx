import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fmtNumber } from '@/lib/fmt';

interface Props {
  balance: number;
  pendingCoins?: number;
  approximateValue?: number | null;
  loading?: boolean;
}

export function CoinsCard({ balance, pendingCoins = 0, approximateValue, loading }: Props) {
  return (
    <LinearGradient
      colors={['#E9B73A', '#C89820']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Header row (RTL: icon on right) */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="wallet-outline" size={20} color="#fff" />
        </View>
        <Text style={styles.title}>عملاتي الذهبية</Text>
      </View>

      {/* Balance */}
      <View style={styles.balanceRow}>
        <Text style={styles.balanceNum}>
          {loading ? '—' : fmtNumber(balance)}
        </Text>
        <Ionicons
          name="ellipse"
          size={12}
          color="rgba(255,255,255,0.7)"
          style={{ marginBottom: 8 }}
        />
      </View>

      {/* Equiv */}
      {approximateValue != null && !loading && (
        <Text style={styles.equiv}>
          ≈ {approximateValue.toFixed(1)} جنيه خصم
        </Text>
      )}

      {/* Pending */}
      {pendingCoins > 0 && !loading && (
        <Text style={styles.pending}>
          {fmtNumber(pendingCoins)} عملة قيد الاعتماد
        </Text>
      )}

      {loading && (
        <Text style={styles.pending}>جارٍ التحميل…</Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 22,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Cairo_600SemiBold',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  balanceNum: {
    color: '#fff',
    fontSize: 44,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 52,
  },
  equiv: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
  },
  pending: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'auto',
    marginTop: 4,
  },
});
