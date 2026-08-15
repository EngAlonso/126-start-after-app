import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import { fmtNumber, fmtDate } from '@/lib/fmt';
import type { ServiceRequest } from '@/types';

type StatusConfig = {
  label: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
};

// Covers all known statuses including extended backend variants.
const STATUS_MAP: Record<string, StatusConfig> = {
  pending:                 { label: 'تم النشر',              color: '#2563EB', icon: 'send' },
  offers_received:         { label: 'بانتظار العروض',        color: '#7C3AED', icon: 'tag' },
  technician_selected:     { label: 'تم قبول العرض',         color: '#EA580C', icon: 'user-check' },
  in_progress:             { label: 'جارٍ التنفيذ',          color: '#4F46E5', icon: 'tool' },
  waiting_approval:        { label: 'بانتظار تأكيدك',        color: '#D97706', icon: 'alert-circle' },
  price_change_requested:  { label: 'طلب تعديل سعر',         color: '#0891B2', icon: 'refresh-cw' },
  completed:               { label: 'مكتمل',                  color: '#16A34A', icon: 'check-circle' },
  cancelled:               { label: 'ملغى',                   color: '#DC2626', icon: 'x-circle' },
  cancelled_by_customer:   { label: 'ألغاه العميل',           color: '#DC2626', icon: 'x-circle' },
  cancelled_by_technician: { label: 'ألغاه الفني',            color: '#DC2626', icon: 'x-circle' },
  cancelled_by_admin:      { label: 'ألغاه الإدارة',          color: '#DC2626', icon: 'x-circle' },
  rejected:                { label: 'مرفوض',                  color: '#DC2626', icon: 'slash' },
};

// Two alternating accent palettes — amber brand + deep blue complement
const CARD_ACCENTS = [
  { bg: '#E9B73A', border: '#E9B73A' },  // brand amber
  { bg: '#2563EB', border: '#2563EB' },  // deep blue
] as const;

interface RequestCardProps {
  request: ServiceRequest;
  showService?: boolean;
  onPress?: () => void;
  /** Pass the list index to get alternating card accent colors (0-based). */
  accentIndex?: number;
}

export function RequestCard({ request, showService = true, onPress, accentIndex }: RequestCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { locale } = useLocale();
  const t = translations[locale];

  const _statusConfig = STATUS_MAP[request.status] ?? {
    label: request.status,
    color: colors.mutedForeground,
    icon: 'circle' as const,
  };
  const statusInfo: StatusConfig = {
    ..._statusConfig,
    label: (t.requestStatus as any)[request.status] ?? _statusConfig.label,
  };

  const handlePress = () => {
    if (onPress) onPress();
    else router.push(`/requests/${request.id}` as any);
  };

  const price = request.agreedPrice ?? request.customerPayableAmount;

  const location = (() => {
    const areaName = locale === 'en'
      ? (request.area?.name || request.area?.nameAr)
      : request.area?.nameAr;
    const govName = locale === 'en'
      ? (request.governorate?.name || request.governorate?.nameAr)
      : request.governorate?.nameAr;
    if (areaName && govName) return locale === 'en' ? `${areaName}, ${govName}` : `${areaName}، ${govName}`;
    return request.address ?? null;
  })();

  const person = (request as any).technician ?? (request as any).customer ?? null;
  const personRole = (request as any).technician ? t.messages.techFallback : (request as any).customer ? t.messages.customerFallback : null;
  const personLabel = person
    ? (person as any).name || (person as any).mobile || personRole
    : null;

  const statusBadgeBg = statusInfo.color + (isDark ? '28' : '18');
  const shadowColor = isDark ? '#000000' : '#7A8CA0';

  // ── Alternating accent strip ──────────────────────────────────────────────
  const hasAccent = accentIndex !== undefined;
  const accent = hasAccent ? CARD_ACCENTS[accentIndex % CARD_ACCENTS.length] : null;

  // Outer gets elevation with an OPAQUE background (prevents Android white rectangle).
  // Inner gets overflow:'hidden' for border-radius clipping — safe since it has no elevation.
  const outerBg = isDark
    ? colors.card
    : (hasAccent
      ? (accent!.bg === '#E9B73A' ? '#FFFEF5' : '#F5F7FF')
      : colors.card);

  // Use same opaque colour as outer — eliminates Android white-rectangle on elevated view
  const cardBg = outerBg;
  const cardBorder = hasAccent
    ? accent!.border + (isDark ? '55' : '35')
    : colors.border;
  const leftStripColor = accent?.bg ?? colors.primary;

  return (
    <TouchableOpacity
      style={[styles.cardOuter, { backgroundColor: outerBg, shadowColor }]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={[styles.cardInner, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.inner}>
        {/* ── Row 1: Status badge + Request ID badge ── */}
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: statusBadgeBg }]}>
            <Feather name={statusInfo.icon} size={11} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
          <View style={[
            styles.idChip,
            {
              backgroundColor: (accent?.bg ?? colors.primary) + '14',
              borderColor: (accent?.bg ?? colors.primary) + '55',
            },
          ]}>
            <Text style={[styles.requestId, { color: accent?.bg ?? colors.primary }]}>
              {t.requestDetail.title(request.id)}
            </Text>
          </View>
        </View>

        {/* ── Row 2: Service chip ── */}
        {showService && request.service && (
          <View style={styles.serviceRow}>
            <View style={[styles.serviceIconWrap, { backgroundColor: (accent?.bg ?? colors.primary) + '22' }]}>
              {request.service.icon ? (
                <Text style={styles.serviceEmoji}>{request.service.icon}</Text>
              ) : (
                <Feather name="tool" size={13} color={accent?.bg ?? colors.primary} />
              )}
            </View>
            <Text style={[styles.serviceName, { color: colors.foreground }]} numberOfLines={1}>
              {locale === 'en' ? (request.service.name || request.service.nameAr) : (request.service.nameAr || request.service.name)}
            </Text>
          </View>
        )}

        {/* ── Row 3: Location ── */}
        {location ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={accent?.bg ?? colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        {/* ── Row 4: Person info ── */}
        {personLabel ? (
          <View style={styles.metaRow}>
            <Feather name="user" size={12} color={accent?.bg ?? colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {String(personLabel)}
            </Text>
          </View>
        ) : null}

        {/* ── Divider ── */}
        <View style={[styles.divider, { backgroundColor: cardBorder }]} />

        {/* ── Footer: price + date ── */}
        <View style={styles.footer}>
          {price ? (
            <View style={styles.priceWrap}>
              <Text style={[styles.price, { color: accent?.bg ?? colors.primary }]}>
                {fmtNumber(Number(price))} {t.common.currency}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.dateWrap}>
            <Feather name="calendar" size={12} color={accent?.bg ?? colors.primary} />
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {fmtDate(request.createdAt, { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>
      </View>

      {/* Colored strip on the LEFT in RTL — last child in the row */}
      {hasAccent && (
        <View style={[styles.accentStrip, { backgroundColor: leftStripColor }]} />
      )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Outer: carries elevation with opaque background (prevents Android white rectangle)
  cardOuter: {
    borderRadius: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 3,
    // NOTE: DO NOT add overflow:'hidden' here — elevation + overflow:'hidden' = white rect
  },
  // Inner: clips the accent strip corners; safe since it has no elevation
  cardInner: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentStrip: {
    width: 4,
    // Strip is on the LEFT in RTL — outer (left) corners match the card's borderRadius
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  inner: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
  },
  idChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  requestId: {
    fontSize: 11,
    fontFamily: 'Cairo_700Bold',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    flex: 1,
    textAlign: 'auto',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    flex: 1,
    textAlign: 'auto',
  },
  divider: {
    height: 1,
    marginVertical: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 15,
    fontFamily: 'Cairo_700Bold',
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
  },
});
