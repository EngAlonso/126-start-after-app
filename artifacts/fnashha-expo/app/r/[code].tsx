import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useReferral } from '@/contexts/ReferralContext';

export default function ReferralRoute() {
  const colors = useColors();
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { setReferralCode } = useReferral();

  useEffect(() => {
    const routeCode = Array.isArray(code) ? code[0] : code;
    if (routeCode) setReferralCode(routeCode);
  }, [code, setReferralCode]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}