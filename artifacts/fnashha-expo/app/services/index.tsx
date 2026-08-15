import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { apiFetch } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ServiceCard } from '@/components/ServiceCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import type { Service } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';

export default function ServicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const t = translations[locale];
  const [search, setSearch] = useState('');

  const { data: services = [], isLoading, refetch, isRefetching } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => apiFetch('/api/services?active=true'),
  });

  useRefetchOnFocus([refetch]);

  const filtered = services.filter(s =>
    !search.trim() ||
    (s.nameAr || s.name).includes(search.trim()),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t.servicesScreen.title} />

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={t.servicesScreen.searchPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        <Feather name="search" size={18} color={colors.mutedForeground} />
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}>
          <SkeletonList count={6} height={110} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => String(s.id)}
          numColumns={2}
          contentContainerStyle={{ padding: 12, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32 }}
          columnWrapperStyle={{ gap: 0 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="search" title={t.servicesScreen.noResults} subtitle={t.servicesScreen.tryDifferentSearch} />}
          renderItem={({ item }) => (
            <View style={{ width: '50%', paddingHorizontal: 4 }}>
              <ServiceCard
                service={item}
                onPress={() => router.push(`/services/${item.id}` as any)}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Cairo_400Regular', textAlign: 'auto' },
});
