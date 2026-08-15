import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLocale } from '@/contexts/LocaleContext';

export interface Service {
  id: number;
  name: string;
  nameAr?: string | null;
  image?: string | null;
  icon?: string | null;
  isActive?: boolean;
  displayOrder?: number;
}

interface Props {
  service: Service;
  onPress: (service: Service) => void;
}

// A distinct accent per service (cycled by id)
const ACCENTS = [
  '#E9B73A', '#F97316', '#6366F1', '#22C55E',
  '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899',
  '#0EA5E9', '#14B8A6',
];

export function ServiceCard({ service, onPress }: Props) {
  const colors = useColors();
  const { locale } = useLocale();
  const accent = ACCENTS[service.id % ACCENTS.length];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => onPress(service)}
      activeOpacity={0.72}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '1A' }]}>
        {service.image ? (
          <Image
            source={{ uri: service.image }}
            style={styles.img}
            resizeMode="contain"
          />
        ) : (
          <Feather name="tool" size={28} color={accent} />
        )}
      </View>

      <Text
        style={[styles.label, { color: colors.foreground }]}
        numberOfLines={3}
        textBreakStrategy="simple"
      >
        {locale === 'en' ? (service.name || service.nameAr || '') : (service.nameAr ?? service.name)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 120,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
    lineHeight: 20,
  },
});
