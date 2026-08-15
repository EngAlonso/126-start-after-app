import React from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthedFetch, apiFetch } from '@/hooks/useApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { getRouteFromDbNotification } from '@/lib/notificationRouter';
import { useLocale } from '@/contexts/LocaleContext';
import { translations } from '@/lib/i18n';
import type { Notification } from '@/types';

const ANOTHER_TECHNICIAN_SELECTED_ICON = require('../assets/images/another-technician-selected.png');
const PRICE_ADJUSTMENT_REQUESTED_ICON = require('../assets/images/price-adjustment-requested.png');

// ── Notification icon map ─────────────────────────────────────────────────────
// These are the notification types persisted by the API. `status_change` is
// intentionally resolved from its existing title because the API uses that
// one DB type for completion, confirmation, ratings, and price changes.
type NotificationGlyphName =
  | 'toolbox'
  | 'cash-plus'
  | 'check'
  | 'cancel'
  | 'order-completed'
  | 'service-completion-confirmation'
  | 'new-price-offer'
  | 'offer-withdrawn'
  | 'order-cancelled'
  | 'fnashha-coins-added'
  | 'admin-points-added'
  | 'person-check'
  | 'technician-selected'
  | 'service-request'
  | 'another-technician-selected'
  | 'price-adjustment-requested'
  | 'payment-due'
  | 'payment-transferred'
  | 'admin-announcement'
  | 'message'
  | 'bell'
  | 'cash-edit'
  | 'cash-minus'
  | 'confirm'
  | 'star'
  | 'support'
  | 'wallet'
  | 'cash'
  | 'coins'
  | 'gift'
  | 'referral-reward'
  | 'campaign-reward'
  | 'support-ticket-replied'
  | 'status';

type IconEntry = {
  name: NotificationGlyphName;
  tone: 'success' | 'danger' | 'gold' | 'info' | 'warning' | 'support' | 'muted';
};

const TYPE_ICON: Record<string, IconEntry> = {
  new_request:            { name: 'service-request', tone: 'info' },
  new_offer:              { name: 'new-price-offer', tone: 'gold' },
  offer_accepted:         { name: 'person-check', tone: 'success' },
  request_completed:      { name: 'order-completed', tone: 'success' },
  request_cancelled:      { name: 'order-cancelled', tone: 'danger' },
  technician_selected:    { name: 'technician-selected', tone: 'success' },
  new_message:            { name: 'message',      tone: 'info' },
  announcement:           { name: 'admin-announcement', tone: 'support' },
  price_adjustment:       { name: 'cash-edit',    tone: 'warning' },
  price_change_requested: { name: 'price-adjustment-requested', tone: 'warning' },
  price_approved:         { name: 'cash-plus',    tone: 'success' },
  price_rejected:         { name: 'cash-minus',   tone: 'danger' },
  waiting_approval:       { name: 'service-completion-confirmation', tone: 'warning' },
  new_rating:             { name: 'star',         tone: 'gold' },
  support_reply:          { name: 'support-ticket-replied', tone: 'support' },
  platform_credit_added:  { name: 'payment-due',  tone: 'gold' },
  platform_credit_paid:   { name: 'payment-transferred', tone: 'success' },
  coins_earned:           { name: 'fnashha-coins-added', tone: 'gold' },
  referral_reward:        { name: 'referral-reward', tone: 'gold' },
  campaign_reward:        { name: 'campaign-reward', tone: 'gold' },
  status_change:          { name: 'status',       tone: 'muted' },
};

type NotificationGlyphProps = {
  name: NotificationGlyphName;
  color: string;
  size?: number;
  fill?: string;
  theme?: SelectedTechnicianGlyphTheme;
};

type SelectedTechnicianGlyphTheme = {
  foreground: string;
  info: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  notificationPurple: string;
  notificationGold: string;
  notificationGreen: string;
  notificationRed: string;
};

const MATERIAL_GLYPH: Record<
  Exclude<
    NotificationGlyphName,
    'technician-selected' | 'service-request' | 'another-technician-selected' | 'price-adjustment-requested' | 'payment-due' | 'payment-transferred' | 'admin-announcement' | 'service-completion-confirmation' | 'new-price-offer' | 'offer-withdrawn' | 'order-cancelled' | 'fnashha-coins-added' | 'admin-points-added' | 'referral-reward' | 'campaign-reward' | 'support-ticket-replied'
  >,
  keyof typeof MaterialIcons.glyphMap
> = {
  toolbox: 'handyman',
  'cash-plus': 'local-offer',
  check: 'check-circle',
  cancel: 'cancel',
  'order-completed': 'check-circle',
  'person-check': 'handyman',
  message: 'chat-bubble',
  bell: 'campaign',
  'cash-edit': 'price-change',
  'cash-minus': 'trending-down',
  confirm: 'help',
  star: 'star',
  support: 'support-agent',
  wallet: 'account-balance-wallet',
  cash: 'payment',
  coins: 'monetization-on',
  gift: 'card-giftcard',
  status: 'swap-horiz',
};

function NewMessageGlyph({ size, fill }: { size: number; fill: string }) {
  const outline = '#2D2B2D';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Rear bubble: dots */}
      <Path
        d="M3 4.5h10.2a3 3 0 0 1 3 3v3.2a3 3 0 0 1-3 3H9.2l-2.5 3.2-.9-3.2H6a3 3 0 0 1-3-3V7.5a3 3 0 0 1 0-3Z"
        fill={fill}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Circle cx="6.8" cy="9.3" r="0.85" fill={outline} />
      <Circle cx="9.7" cy="9.3" r="0.85" fill={outline} />
      <Circle cx="12.6" cy="9.3" r="0.85" fill={outline} />

      {/* Front bubble: message lines */}
      <Path
        d="M8.4 8h9.6a3 3 0 0 1 3 3v5.1a3 3 0 0 1-3 3h-4.1l-1.8 3.1-1.25-3.1H8.4a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z"
        fill={fill}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Line x1="9.6" y1="12.2" x2="18.1" y2="12.2" stroke={outline} strokeWidth={1.35} strokeLinecap="round" />
      <Line x1="9.6" y1="14.5" x2="18.1" y2="14.5" stroke={outline} strokeWidth={1.35} strokeLinecap="round" />
      <Line x1="9.6" y1="16.8" x2="15.8" y2="16.8" stroke={outline} strokeWidth={1.35} strokeLinecap="round" />
    </Svg>
  );
}

function OrderCompletedNotificationGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 150 150">
      <Defs>
        <LinearGradient id="orderCompletedOuter" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#00D83D" />
          <Stop offset="52%" stopColor="#00C52F" />
          <Stop offset="100%" stopColor="#009E25" />
        </LinearGradient>
        <LinearGradient id="orderCompletedInner" x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <Stop offset="0%" stopColor="#04B92E" />
          <Stop offset="100%" stopColor="#00A725" />
        </LinearGradient>
      </Defs>
      <Circle cx="75" cy="75" r="72" fill="url(#orderCompletedOuter)" />
      <Circle cx="75" cy="75" r="64" fill="url(#orderCompletedInner)" />
      <Circle cx="75" cy="75" r="64" fill="none" stroke="#00D238" strokeWidth="2" opacity={0.7} />
      <Path
        d="M43 76 L64 98 L111 49"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "Was the Service Completed?"
 * notification. The question mark and checked service card preserve the
 * reference's bold, outlined blue/yellow composition without reusing the
 * reference asset or adding a background container.
 */
function ServiceCompletionConfirmationNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const question = theme.info;
  const questionShadow = theme.primaryDark;
  const card = theme.primary;
  const cardShadow = theme.primaryDark;
  const check = theme.notificationGreen;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Service card behind the question mark */}
      <Path
        d="M27.6 6.1h10.2c1.8 0 3.2 1.4 3.2 3.2v24.1c0 1.8-1.4 3.2-3.2 3.2H27.6c-1.8 0-3.2-1.4-3.2-3.2V9.3c0-1.8 1.4-3.2 3.2-3.2Z"
        fill={cardShadow}
        stroke={outline}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M25.8 8.2c0-1.5 1.2-2.7 2.7-2.7h8.9c1.5 0 2.7 1.2 2.7 2.7v23.7c0 1.5-1.2 2.7-2.7 2.7h-8.9c-1.5 0-2.7-1.2-2.7-2.7V8.2Z"
        fill={card}
        stroke={outline}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M29.6 9.7h6.9"
        fill="none"
        stroke={theme.accent}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path
        d="m28.9 25.1 3.2 3.2 6.1-7"
        fill="none"
        stroke={check}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Question mark in front — intentionally oversized for small-list legibility */}
      <Path
        d="M6.8 16.1c0-4.4 3.3-7.4 8.1-7.4 4.8 0 7.9 2.8 7.9 6.9 0 3.1-1.6 4.8-4.9 6.8-2 1.2-2.7 2.1-2.7 4.1v1.2h-5.4v-1.5c0-3.7 1.4-5.7 4.6-7.6 2-1.2 2.7-2.2 2.7-3.5 0-1.5-.9-2.6-2.5-2.6-1.7 0-2.8 1.4-2.8 3.6v.6H6.8v-.6Z"
        fill={questionShadow}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 14.8c0-4.4 3.3-7.4 8.1-7.4 4.8 0 7.9 2.8 7.9 6.9 0 3.1-1.6 4.8-4.9 6.8-2 1.2-2.7 2.1-2.7 4.1v1.2H8.5v-1.5c0-3.7 1.4-5.7 4.6-7.6 2-1.2 2.7-2.2 2.7-3.5 0-1.5-.9-2.6-2.5-2.6-1.7 0-2.8 1.4-2.8 3.6v.6H5.5v-.6Z"
        fill={question}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Circle cx="10.8" cy="34.7" r="2.5" fill={questionShadow} stroke={outline} strokeWidth={1.4} />
      <Circle cx="9.5" cy="33.4" r="2.5" fill={question} stroke={outline} strokeWidth={1.4} />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "New Price Offer" notification.
 * A hanging price tag with stacked banknotes communicates a fresh bid while
 * staying transparent and legible in the notification artwork slot.
 */
function NewPriceOfferNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const tag = theme.accent;
  const tagShadow = theme.primaryDark;
  const money = theme.notificationGreen;
  const moneyShadow = theme.primaryDark;
  const moneyHighlight = theme.notificationGold;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Offset silhouette adds depth without creating a background container */}
      <Path
        d="M8.8 7.7h13.9l16.7 16.7c1.4 1.4 1.4 3.6 0 5l-7.8 7.8c-1.4 1.4-3.6 1.4-5 0L8.8 19.6V7.7Z"
        fill={tagShadow}
        stroke={outline}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M6.6 6.3h15.2l17.4 17.4c1.2 1.2 1.2 3.1 0 4.3l-8.2 8.2c-1.2 1.2-3.1 1.2-4.3 0L6.6 18.1V6.3Z"
        fill={tag}
        stroke={outline}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M10.2 9.4h10.7l15.6 15.7"
        fill="none"
        stroke={theme.primary}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.75}
      />

      {/* Tag hole and metal eyelet */}
      <Circle cx="14.9" cy="12.1" r="3.1" fill={tagShadow} stroke={outline} strokeWidth={1.4} />
      <Circle cx="14.9" cy="12.1" r="1.45" fill={tag} stroke={outline} strokeWidth={0.9} />

      {/* Three compact banknote bundles */}
      <Path
        d="m12.8 25.8 17.9-5.1 3.9 9.5-17.9 5.1-3.9-9.5Z"
        fill={moneyShadow}
        stroke={outline}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <Path
        d="m11.4 22.9 17.9-5.1 3.9 9.5-17.9 5.1-3.9-9.5Z"
        fill={money}
        stroke={outline}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <Path
        d="m13.2 22.9 15.2-4.3 2.8 6.7-15.2 4.3-2.8-6.7Z"
        fill="none"
        stroke={moneyHighlight}
        strokeWidth={0.8}
        opacity={0.85}
      />
      <Path
        d="m10.2 26.9 17.9-5.1 3.9 9.5-17.9 5.1-3.9-9.5Z"
        fill={moneyShadow}
        stroke={outline}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <Path
        d="m8.8 24 17.9-5.1 3.9 9.5-17.9 5.1L8.8 24Z"
        fill={money}
        stroke={outline}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <Path
        d="m10.6 24 15.2-4.3 2.8 6.7-15.2 4.3-2.8-6.7Z"
        fill="none"
        stroke={moneyHighlight}
        strokeWidth={0.8}
        opacity={0.85}
      />
      <Path
        d="m12.4 29.7 17.9-5.1 3.9 9.5-17.9 5.1-3.9-9.5Z"
        fill={moneyShadow}
        stroke={outline}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <Path
        d="m11 26.8 17.9-5.1 3.9 9.5-17.9 5.1-3.9-9.5Z"
        fill={money}
        stroke={outline}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <Path
        d="m12.8 26.8 15.2-4.3 2.8 6.7-15.2 4.3-2.8-6.7Z"
        fill="none"
        stroke={moneyHighlight}
        strokeWidth={0.8}
        opacity={0.85}
      />

      {/* Paper bands keep the money stacks recognizable at 48px */}
      <Path
        d="m20.3 20.4 3.3-.9 3.9 9.5-3.3.9-3.9-9.5Z"
        fill={tag}
        stroke={outline}
        strokeWidth={0.85}
        strokeLinejoin="round"
      />
      <Path
        d="m19.2 25.1 3.3-.9 3.9 9.5-3.3.9-3.9-9.5Z"
        fill={tag}
        stroke={outline}
        strokeWidth={0.85}
        strokeLinejoin="round"
      />
      <Path
        d="m18.2 29.8 3.3-.9 3.9 9.5-3.3.9-3.9-9.5Z"
        fill={tag}
        stroke={outline}
        strokeWidth={0.85}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "Offer Withdrawn" notification.
 * The open door and departing technician preserve the reference's visual
 * character, while the red offer card with a minus mark makes the withdrawn
 * price offer explicit at notification-list size.
 */
function OfferWithdrawnNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const door = theme.info;
  const doorShadow = theme.primaryDark;
  const doorway = theme.primaryLight;
  const worker = theme.info;
  const workerShadow = theme.primaryDark;
  const toolbox = theme.notificationRed;
  const toolboxHighlight = theme.accent;
  const offer = theme.notificationRed;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Open doorway: the submitted offer is leaving the request. */}
      <Path
        d="M5.6 38.8V10.1c0-1.7 1.3-3 3-3h12.2c1.7 0 3 1.3 3 3v28.7H5.6Z"
        fill={doorShadow}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M3.6 35.8V7.2c0-1.7 1.3-3 3-3h12.2c1.7 0 3 1.3 3 3v28.6H3.6Z"
        fill={door}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M8.2 9.2h9.2v20.4H8.2V9.2Z"
        fill={theme.primary}
        stroke={doorShadow}
        strokeWidth={1}
        opacity={0.9}
      />
      <Path
        d="M26.2 9.1h10.4c1.4 0 2.5 1.1 2.5 2.5v25.5H26.2V9.1Z"
        fill={doorway}
        stroke={outline}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="M28.4 12.2h7.8v20.6h-7.8V12.2Z"
        fill={theme.accent}
        opacity={0.45}
      />

      {/* Departing technician, kept intentionally compact for 48px clarity. */}
      <Circle cx="28.7" cy="12.9" r="4.2" fill={theme.accent} stroke={outline} strokeWidth={1.3} />
      <Path
        d="M24.5 12.4c.2-3.1 2.1-5.2 4.9-5.2 2.2 0 3.8 1.1 4.5 2.9l-1.9 1.1-7.5 1.2Z"
        fill={worker}
        stroke={outline}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      <Path
        d="M22.6 25.8c.8-4.6 3-7 6.2-7s5.4 2.4 6.2 7l2.1 12.5H20.5l2.1-12.5Z"
        fill={worker}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M26.2 21.2c1.5 1 3.7 1 5.2 0M25.1 28.4l-2.8 7.4M32.7 28.4l3.1 6.8"
        fill="none"
        stroke={workerShadow}
        strokeWidth={1.1}
        strokeLinecap="round"
      />

      {/* Toolbox echoes the reference while staying subordinate to the offer. */}
      <Path
        d="M17.2 34.1h13.1c1.1 0 2 .9 2 2v4.1H15.2v-4.1c0-1.1.9-2 2-2Z"
        fill={toolbox}
        stroke={outline}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="M19.4 34.1v-1.2c0-.9.7-1.6 1.6-1.6h5.5c.9 0 1.6.7 1.6 1.6v1.2"
        fill="none"
        stroke={toolbox}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M17.4 36.4h12.7M21.5 34.1v4.9"
        fill="none"
        stroke={toolboxHighlight}
        strokeWidth={0.9}
        strokeLinecap="round"
      />

      {/* Withdrawn offer card: a small red price slip with a clear minus. */}
      <Path
        d="M35.2 26.2h8.4c1 0 1.8.8 1.8 1.8v8.4c0 1-.8 1.8-1.8 1.8h-8.4c-1 0-1.8-.8-1.8-1.8V28c0-1 .8-1.8 1.8-1.8Z"
        fill={offer}
        stroke={outline}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <Path
        d="M37.1 30.1h4.6M37.1 34.2h4.6"
        fill="none"
        stroke={toolboxHighlight}
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={0.9}
      />
      <Path
        d="M37.1 36.2h4.6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "Order Cancelled" notification.
 * The rounded red cancel tile is the artwork itself, not a notification
 * container, and keeps the reference's unmistakable white X at small sizes.
 */
function OrderCancelledNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const red = theme.notificationRed;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Offset edge gives the tile a little depth without adding a badge */}
      <Rect
        x="4.7"
        y="5.6"
        width="38.2"
        height="38.2"
        rx="9.2"
        fill={outline}
        opacity={0.28}
      />
      <Rect
        x="3.2"
        y="3.2"
        width="38.2"
        height="38.2"
        rx="9.2"
        fill={red}
        stroke={outline}
        strokeWidth={1.7}
      />
      <Path
        d="M10.1 8.2c3.5-2.1 7.6-3.1 12-3.1"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.25}
        strokeLinecap="round"
        opacity={0.36}
      />
      <Path
        d="M12.5 13.4 34.8 35.7M34.8 13.4 12.5 35.7"
        fill="none"
        stroke={outline}
        strokeWidth={6.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5}
      />
      <Path
        d="M12.5 12.1 34.8 34.4M34.8 12.1 12.5 34.4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "Fnashha Coins Added" notification.
 * The layered gold coin keeps the reference's simple money-token silhouette
 * while adding a small highlight and depth for clarity at list size.
 */
function FnashhaCoinsAddedNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const coinEdge = theme.primaryDark;
  const coinFace = theme.notificationGold;
  const coinHighlight = theme.primary;
  const symbol = theme.primaryDark;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="fnashhaCoinsOuter" x1="0.1" y1="0.1" x2="0.9" y2="0.9">
          <Stop offset="0%" stopColor={coinHighlight} />
          <Stop offset="58%" stopColor={coinFace} />
          <Stop offset="100%" stopColor={coinEdge} />
        </LinearGradient>
        <LinearGradient id="fnashhaCoinsInner" x1="0.15" y1="0.05" x2="0.8" y2="0.95">
          <Stop offset="0%" stopColor={theme.primary} />
          <Stop offset="100%" stopColor={coinEdge} />
        </LinearGradient>
      </Defs>

      {/* Offset coin edge gives the standalone token a little depth */}
      <Circle cx="25.1" cy="25.5" r="18.2" fill={outline} opacity={0.25} />
      <Circle
        cx="23.4"
        cy="22.9"
        r="18.1"
        fill="url(#fnashhaCoinsOuter)"
        stroke={outline}
        strokeWidth={1.7}
      />
      <Circle
        cx="23.4"
        cy="22.9"
        r="14.5"
        fill="url(#fnashhaCoinsInner)"
        stroke={coinHighlight}
        strokeWidth={1.1}
        opacity={0.98}
      />
      <Circle cx="17.3" cy="15.8" r="3.7" fill="#FFFFFF" opacity={0.22} />
      <Path
        d="M13.5 31.3c5.6 3.2 12.8 3.5 18.6.2"
        fill="none"
        stroke={coinEdge}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.65}
      />

      {/* New-money symbol, drawn as a path instead of text for stable rendering */}
      <Path
        d="M25.4 10.8v23.7"
        fill="none"
        stroke={symbol}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M30.2 14.3c-1.5-1.7-3.4-2.5-5.8-2.5-3 0-5.3 1.5-5.3 3.8 0 2.5 2.3 3.3 5.4 4.1 3.4.9 6 2 6 4.7 0 2.7-2.5 4.5-5.8 4.5-2.7 0-5.1-.9-6.6-2.7"
        fill="none"
        stroke={symbol}
        strokeWidth={2.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "Points Added by Administration"
 * notification. Layered green point bundles and a clean addition mark make
 * this an administrative balance increase, distinct from the gold Fnashha
 * Coins token, referral reward, and campaign reward artwork.
 */
function AdminPointsAddedNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const paper = theme.notificationGreen;
  const paperShadow = theme.primaryDark;
  const paperHighlight = theme.primaryLight;
  const band = theme.accent;
  const plus = theme.primaryDark;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Offset stack edge gives the notes depth without adding a container. */}
      <Path
        d="m5.8 18.6 25.9-7.1c1.8-.5 3.7.6 4.2 2.4l4.2 15.4c.5 1.8-.6 3.7-2.4 4.2l-25.9 7.1c-1.8.5-3.7-.6-4.2-2.4L3.4 22.8c-.5-1.8.6-3.7 2.4-4.2Z"
        fill={paperShadow}
        stroke={outline}
        strokeWidth={1.45}
        strokeLinejoin="round"
      />
      <Path
        d="m5.2 15.5 25.9-7.1c1.8-.5 3.7.6 4.2 2.4l4.2 15.4c.5 1.8-.6 3.7-2.4 4.2l-25.9 7.1c-1.8.5-3.7-.6-4.2-2.4L2.8 19.7c-.5-1.8.6-3.7 2.4-4.2Z"
        fill={paper}
        stroke={outline}
        strokeWidth={1.45}
        strokeLinejoin="round"
      />
      <Path
        d="m8 17.7 22.7-6.2c.9-.2 1.8.3 2.1 1.2l3.4 12.6c.2.9-.3 1.8-1.2 2.1L12.3 33.6c-.9.2-1.8-.3-2.1-1.2L6.8 19.8c-.2-.9.3-1.8 1.2-2.1Z"
        fill="none"
        stroke={paperHighlight}
        strokeWidth={0.95}
        opacity={0.9}
      />
      <Circle
        cx="21.7"
        cy="21.5"
        r="5.4"
        fill={theme.primary}
        stroke={paperShadow}
        strokeWidth={1}
        opacity={0.9}
      />
      <Path
        d="M21.7 17.7v7.6M23.8 19.1c-.6-.7-1.3-1-2.2-1-1.2 0-2.1.6-2.1 1.6s.9 1.3 2.2 1.7c1.4.4 2.4.8 2.4 1.9s-1 1.8-2.3 1.8c-1.1 0-2-.4-2.6-1.1"
        fill="none"
        stroke={paperShadow}
        strokeWidth={0.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m18.8 13.2 3.2-.9 4.2 15.4-3.2.9-4.2-15.4Z"
        fill={band}
        stroke={outline}
        strokeWidth={0.9}
        strokeLinejoin="round"
        opacity={0.95}
      />

      {/* Front point bundle: the plus is deliberately oversized for list size. */}
      <Path
        d="m13.2 25.2 18.1-5c1.6-.4 3.2.5 3.6 2.1l3.5 12.8c.4 1.6-.5 3.2-2.1 3.6l-18.1 5c-1.6.4-3.2-.5-3.6-2.1l-3.5-12.8c-.4-1.6.5-3.2 2.1-3.6Z"
        fill={paperShadow}
        stroke={outline}
        strokeWidth={1.45}
        strokeLinejoin="round"
      />
      <Path
        d="m12 22.5 18.1-5c1.6-.4 3.2.5 3.6 2.1l3.5 12.8c.4 1.6-.5 3.2-2.1 3.6l-18.1 5c-1.6.4-3.2-.5-3.6-2.1L9.9 26.1c-.4-1.6.5-3.2 2.1-3.6Z"
        fill={paper}
        stroke={outline}
        strokeWidth={1.45}
        strokeLinejoin="round"
      />
      <Path
        d="m14.5 24.8 15.8-4.4c.7-.2 1.4.2 1.6.9l2.8 10.4c.2.7-.2 1.4-.9 1.6L18 37.7c-.7.2-1.4-.2-1.6-.9l-2.8-10.4c-.2-.7.2-1.4.9-1.6Z"
        fill="none"
        stroke={paperHighlight}
        strokeWidth={0.9}
        opacity={0.85}
      />
      <Path
        d="m20.5 21.9 3.2-.9 3.5 12.8-3.2.9-3.5-12.8Z"
        fill={band}
        stroke={outline}
        strokeWidth={0.9}
        strokeLinejoin="round"
        opacity={0.95}
      />

      {/* Administrative addition marker, not a circular badge. */}
      <Path
        d="M33.5 7.2h8.1c1.4 0 2.5 1.1 2.5 2.5v8.1c0 1.4-1.1 2.5-2.5 2.5h-8.1c-1.4 0-2.5-1.1-2.5-2.5V9.7c0-1.4 1.1-2.5 2.5-2.5Z"
        fill={theme.primaryLight}
        stroke={outline}
        strokeWidth={1.45}
        strokeLinejoin="round"
      />
      <Path
        d="M37.6 10.1v7.3M34 13.8h7.3"
        fill="none"
        stroke={plus}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "Referral Reward" notification.
 * Two people, a reward note, and stacked coins communicate a reward received
 * through a referral without adding a circular notification container.
 */
function ReferralRewardNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const note = theme.notificationGreen;
  const noteShadow = theme.primaryDark;
  const person = theme.notificationPurple;
  const personShadow = theme.primaryDark;
  const coin = theme.notificationGold;
  const coinHighlight = theme.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Reward note behind the people */}
      <Rect
        x="5.5"
        y="5.5"
        width="21.5"
        height="36.5"
        rx="2.4"
        fill={note}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M9.1 14.2c3.3-.4 5.2-2.1 5.5-5.3h4.1c.3 3.2 2.2 4.9 5.5 5.3v11.2c-3.3.4-5.2 2.1-5.5 5.3h-4.1c-.3-3.2-2.2-4.9-5.5-5.3V14.2Z"
        fill={theme.primary}
        opacity={0.55}
      />
      <Path
        d="M9 9.3h14.5M9 35.9h14.5"
        fill="none"
        stroke={noteShadow}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.8}
      />
      <Circle cx="16.2" cy="20.1" r="4.1" fill={theme.primaryLight} stroke={noteShadow} strokeWidth={1.1} />
      <Path
        d="M16.2 17.8v4.8M14.4 19.1c.6-.8 2.2-.8 2.9-.1.7.8-.1 1.6-1 1.9-.9.3-1.6.7-1.2 1.4.4.7 1.6.8 2.4.1"
        fill="none"
        stroke={noteShadow}
        strokeWidth={0.9}
        strokeLinecap="round"
      />

      {/* Rear participant */}
      <Circle cx="34.1" cy="14.2" r="6.6" fill={theme.accent} stroke={outline} strokeWidth={1.6} />
      <Path
        d="M25.3 41.4c.6-7.5 3.4-11.1 8.8-11.1s8.2 3.6 8.8 11.1H25.3Z"
        fill={personShadow}
        stroke={outline}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />

      {/* Front participant */}
      <Path
        d="M15.6 41.4c.6-8.8 4-13.8 10.6-13.8s10 5 10.6 13.8H15.6Z"
        fill={person}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M19.4 34.3c3.9-2.4 8.7-2.4 12.6 0"
        fill="none"
        stroke={theme.info}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Circle cx="25.8" cy="18.1" r="7.1" fill={theme.primaryLight} stroke={outline} strokeWidth={1.7} />
      <Path
        d="M22.8 18.1h6M25.8 15.1v6"
        fill="none"
        stroke={theme.primaryDark}
        strokeWidth={1.1}
        strokeLinecap="round"
      />

      {/* Coins in the foreground show the reward being received */}
      <Rect x="9.2" y="34.2" width="18.5" height="4.5" rx="1.8" fill={noteShadow} stroke={outline} strokeWidth={1.2} />
      <Rect x="10.5" y="31.1" width="18.5" height="4.5" rx="1.8" fill={coin} stroke={outline} strokeWidth={1.2} />
      <Rect x="11.8" y="28" width="18.5" height="4.5" rx="1.8" fill={coinHighlight} stroke={outline} strokeWidth={1.2} />
      <Path
        d="M15 30.2h12M13.7 33.3h12M12.4 36.4h12"
        fill="none"
        stroke={theme.primaryDark}
        strokeWidth={0.9}
        strokeLinecap="round"
      />

      {/* Small plus mark reinforces the referral/addition meaning */}
      <Circle cx="39.2" cy="30.1" r="5.1" fill={theme.primaryLight} stroke={outline} strokeWidth={1.4} />
      <Path
        d="M39.2 27.2v5.8M36.3 30.1h5.8"
        fill="none"
        stroke={theme.primaryDark}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "Campaign Reward" notification.
 * A wrapped gift with a bright ribbon and celebratory confetti communicates a
 * promotional reward without adding a circular notification container.
 */
function CampaignRewardNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const box = theme.notificationGold;
  const boxShadow = theme.primaryDark;
  const ribbon = theme.notificationRed;
  const ribbonHighlight = theme.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Box body */}
      <Rect
        x="9.2"
        y="20.1"
        width="29.6"
        height="21.8"
        fill={box}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Rect
        x="10.8"
        y="28"
        width="26.4"
        height="13.9"
        fill={ribbonHighlight}
        opacity={0.28}
      />

      {/* Vertical ribbon and lid */}
      <Rect
        x="22"
        y="19.6"
        width="4"
        height="22.3"
        fill={ribbon}
        stroke={outline}
        strokeWidth={1.1}
      />
      <Rect
        x="7.1"
        y="17"
        width="33.8"
        height="7.5"
        rx="1.2"
        fill={box}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Rect
        x="21.8"
        y="17"
        width="4.4"
        height="7.5"
        fill={ribbon}
        stroke={outline}
        strokeWidth={1.1}
      />
      <Path
        d="M10.2 19.2h13.2M27.8 19.2h10.1"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.35}
      />

      {/* Bow */}
      <Path
        d="M23.8 17.1c-5.1.1-9.1-1.6-8.4-5.2.6-3.3 5.1-2.5 8.4 2.4"
        fill={ribbon}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M24.2 17.1c5.1.1 9.1-1.6 8.4-5.2-.6-3.3-5.1-2.5-8.4 2.4"
        fill={ribbon}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Circle cx="24" cy="17" r="2.5" fill={ribbon} stroke={outline} strokeWidth={1.3} />
      <Path
        d="M23 15.8c.5-.5 1.4-.5 2 0"
        fill="none"
        stroke={theme.primaryLight}
        strokeWidth={0.8}
        strokeLinecap="round"
      />

      {/* Small confetti marks keep the campaign theme legible at list size */}
      <Path
        d="m7.2 8.2 1.7 2.3M8.9 8.2 7.2 10.5"
        stroke={ribbon}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="m39.6 7.3 1.8 2.5M41.4 7.3l-1.8 2.5"
        stroke={theme.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx="5.6" cy="15.5" r="1.2" fill={theme.primary} />
      <Circle cx="42.2" cy="16.4" r="1.2" fill={ribbon} />
      <Path
        d="M5.2 29.5h2.8M6.6 28.1v2.8"
        stroke={theme.primary}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Path
        d="M40.4 31.4h2.8M41.8 30v2.8"
        stroke={ribbon}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Path
        d="M12.2 6.2h2.6M13.5 4.9v2.6"
        stroke={theme.notificationGold}
        strokeWidth={1.1}
        strokeLinecap="round"
      />

      {/* Subtle lower edge gives the present a little depth */}
      <Path
        d="M10.4 40.2h27.2"
        fill="none"
        stroke={boxShadow}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.7}
      />
    </Svg>
  );
}

/**
 * Original vector artwork for an in-app support-ticket reply.
 * A flagged mailbox and layered envelopes communicate a new response from
 * support without using the supplied image or a notification badge.
 */
function SupportTicketRepliedNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const mailbox = theme.info;
  const mailboxShadow = theme.primaryDark;
  const envelope = theme.notificationGreen;
  const envelopeBack = theme.primary;
  const flag = theme.notificationRed;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Mailbox body */}
      <Path
        d="M12.3 39.7V16.5c0-5.4 4.4-9.8 9.8-9.8h5.8c5.4 0 9.8 4.4 9.8 9.8v23.2H12.3Z"
        fill={mailbox}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M15.3 17.2c0-3.9 3.2-7.1 7.1-7.1h5.2c3.9 0 7.1 3.2 7.1 7.1v20.6H15.3V17.2Z"
        fill={mailboxShadow}
        opacity={0.28}
      />
      <Path
        d="M14.4 17.4c0-4.5 3.6-8.1 8.1-8.1h5c4.5 0 8.1 3.6 8.1 8.1"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.15}
        strokeLinecap="round"
        opacity={0.4}
      />

      {/* Mailbox opening */}
      <Path
        d="M16.1 19.1c0-3.3 2.7-6 6-6h5.9c3.3 0 6 2.7 6 6v10.2H16.1V19.1Z"
        fill={outline}
        opacity={0.72}
      />
      <Path
        d="M18.3 20.2c0-2.1 1.7-3.8 3.8-3.8h5.9c2.1 0 3.8 1.7 3.8 3.8v8.1H18.3v-8.1Z"
        fill={theme.primaryLight}
        opacity={0.9}
      />

      {/* Reply envelopes */}
      <Path
        d="M5.7 24.4h20.9c1 0 1.8.8 1.8 1.8v11.6c0 1-.8 1.8-1.8 1.8H5.7c-1 0-1.8-.8-1.8-1.8V26.2c0-1 .8-1.8 1.8-1.8Z"
        fill={envelopeBack}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="m4.3 26.1 11.9 8.8 11.9-8.8"
        fill="none"
        stroke={outline}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      <Path
        d="M10.5 30.7 4.9 37.4M21.9 30.7l5.6 6.7"
        fill="none"
        stroke={outline}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.7}
      />

      <Path
        d="M17.7 27.2h20.9c1 0 1.8.8 1.8 1.8v11.6c0 1-.8 1.8-1.8 1.8H17.7c-1 0-1.8-.8-1.8-1.8V29c0-1 .8-1.8 1.8-1.8Z"
        fill={envelope}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="m16.3 28.9 11.9 8.8 11.9-8.8"
        fill="none"
        stroke={outline}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      <Path
        d="M22.5 33.5 16.9 40.2M33.9 33.5l5.6 6.7"
        fill="none"
        stroke={outline}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.7}
      />

      {/* Raised mailbox flag */}
      <Path
        d="M35.2 17.2V4.8"
        fill="none"
        stroke={flag}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Path
        d="M35.4 5.1h7.1v5.9h-7.1"
        fill={flag}
        stroke={outline}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Circle cx="35.2" cy="4.8" r="1.6" fill={flag} stroke={outline} strokeWidth={0.9} />
      <Path
        d="M9 42.2h28.6"
        fill="none"
        stroke={outline}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.65}
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "You Were Selected" notification.
 * It is intentionally drawn without a background container so it can sit in
 * the same artwork slot as the existing message/rating/completed icons.
 */
function SelectedTechnicianNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const uniform = theme.info;
  const uniformShadow = theme.primaryDark;
  const cap = theme.primary;
  const capShadow = theme.primaryDark;
  const skin = theme.accent;
  const selection = theme.notificationGold;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Shoulders and work jacket */}
      <Path
        d="M7.1 45.2c.7-7.2 2.8-11.8 8.2-14.1l7.2-3.2h3.1l7.2 3.2c5.4 2.3 7.5 6.9 8.2 14.1H7.1Z"
        fill={uniform}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M19.4 31.5 24 37.1l4.6-5.6 2.8 1.3-2.4 12.4H19.1l-2.4-12.4 2.7-1.3Z"
        fill={uniformShadow}
        opacity={0.55}
      />
      <Path
        d="M24 37.1v8.1M11.5 39.3c1.7-2.1 3.8-3.7 6.4-4.7M36.5 39.3c-1.7-2.1-3.8-3.7-6.4-4.7"
        fill="none"
        stroke={outline}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.65}
      />

      {/* Neck and face */}
      <Path d="M20.3 26.7v5.1c1.8 2.1 5.6 2.1 7.4 0v-5.1Z" fill={skin} stroke={outline} strokeWidth={1.2} />
      <Ellipse cx="24" cy="19.5" rx="9.2" ry="10.3" fill={skin} stroke={outline} strokeWidth={1.5} />
      <Path
        d="M15.7 19.8c.1-5.2 1.4-9.6 8.4-10.3 5.3-.5 8.6 3.1 8.2 8.3-2.5-1.4-4.4-3-5.9-5.3-2.5 3.5-6.1 5.1-10.7 5.4Z"
        fill={outline}
      />
      <Path d="M16.2 21.2c-.5 1.6.2 3.7 1.7 4.3" fill="none" stroke={outline} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx="20.7" cy="20" r="0.85" fill={outline} />
      <Circle cx="27.5" cy="20" r="0.85" fill={outline} />
      <Path d="M21.5 24.1c1.6 1.1 3.5 1.1 5 0" fill="none" stroke={outline} strokeWidth={1.2} strokeLinecap="round" />

      {/* Cap — a new, simplified silhouette inspired by the reference */}
      <Path
        d="M15.3 13.5c.6-5.4 3.6-8.2 8.7-8.2 4.9 0 8.1 2.8 8.7 7.4l-2.1 2.5c-4.8-1-9.9-1-15.3.1v-1.8Z"
        fill={cap}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M14.6 13.9c5.5-2.3 12.1-2.2 19.1.2 1.7.6 1.9 2 .3 2.7-5.7 2.5-12.8 2.6-20 .3-1.8-.6-1.3-2.5.6-3.2Z"
        fill={capShadow}
        stroke={outline}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path d="M24 6.2v3.1" stroke={outline} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
      <Circle cx="24" cy="5.6" r="1.2" fill={selection} stroke={outline} strokeWidth={0.8} />

      {/* Small selection mark on the jacket, not a background badge */}
      <Rect x="27.4" y="34.9" width="6.1" height="4.2" rx="0.8" fill={selection} stroke={outline} strokeWidth={0.9} />
      <Path d="m28.8 36.9 1.2 1.1 2.2-2.2" fill="none" stroke={outline} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "New Service Request" notification.
 * The backpack silhouette keeps the reference's service-kit concept while
 * remaining legible at the small notification-list size.
 */
function NewServiceRequestNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const bag = theme.info;
  const bagShadow = theme.primaryDark;
  const canvas = theme.primary;
  const canvasShadow = theme.primaryDark;
  const highlight = theme.accent;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Carry handle */}
      <Path
        d="M18.2 9.8V7.3c0-2.1 1.9-3.8 4.2-3.8h3.2c2.3 0 4.2 1.7 4.2 3.8v2.5"
        fill="none"
        stroke={outline}
        strokeWidth={2.1}
        strokeLinecap="round"
      />
      <Path
        d="M20.4 9.8V7.4c0-.9.8-1.6 1.8-1.6h3.6c1 0 1.8.7 1.8 1.6v2.4"
        fill="none"
        stroke={bagShadow}
        strokeWidth={1.2}
        strokeLinecap="round"
      />

      {/* Main backpack body */}
      <Path
        d="M10.2 15.6c0-2.2 1.8-4 4-4h15.6c4.4 0 8 3.6 8 8v17.7c0 3.1-2.5 5.6-5.6 5.6H15.8c-3.1 0-5.6-2.5-5.6-5.6V15.6Z"
        fill={bag}
        stroke={outline}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M13.5 26.3h20.9v10.8c0 2-1.6 3.6-3.6 3.6H17.1c-2 0-3.6-1.6-3.6-3.6V26.3Z"
        fill={bagShadow}
        opacity={0.42}
      />
      <Path
        d="M13.7 17.9h20.6v17.5c0 2.4-1.9 4.3-4.3 4.3H18c-2.4 0-4.3-1.9-4.3-4.3V17.9Z"
        fill="none"
        stroke={highlight}
        strokeWidth={0.9}
        opacity={0.6}
      />

      {/* Front flap */}
      <Path
        d="M9.2 14.9c5.7-2 14.2-2.4 23.4-1.7 3.6.3 5.5 1.9 5.5 4.6v8.1c-7.9 2.3-19.8 2.3-28.9-.1V14.9Z"
        fill={canvas}
        stroke={outline}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M11.5 21.6c7.8 1.8 16.9 1.8 24.2.1v4.1c-7.5 1.7-16.9 1.7-24.2-.1v-4.1Z"
        fill={canvasShadow}
        opacity={0.65}
      />
      <Path
        d="M12.4 16c6.8-1.6 15-1.6 23.1-.2"
        fill="none"
        stroke={highlight}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.75}
      />

      {/* Front pocket and side pocket */}
      <Path
        d="M13.5 29.2c5.8 1.5 12.9 1.6 19.1.1v6.3c0 1.6-1.3 2.9-2.9 2.9H16.4c-1.6 0-2.9-1.3-2.9-2.9v-6.4Z"
        fill={canvas}
        stroke={outline}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <Path
        d="M33.2 27.1h3.5c1.6 0 2.8 1.3 2.8 2.8v5.1c0 1.3-1 2.3-2.3 2.3h-4V27.1Z"
        fill={canvasShadow}
        stroke={outline}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />

      {/* Buckles */}
      <Rect x="15.3" y="20.5" width="3.1" height="4.6" rx="0.7" fill={highlight} stroke={outline} strokeWidth={0.8} />
      <Rect x="30" y="20.5" width="3.1" height="4.6" rx="0.7" fill={highlight} stroke={outline} strokeWidth={0.8} />
      <Path d="M16.9 21.8v2M31.6 21.8v2" stroke={bagShadow} strokeWidth={0.8} strokeLinecap="round" />

      {/* Shoulder straps */}
      <Path
        d="M11.8 18.7c-1.7 3.7-1.9 8.5-.8 13M36.2 18.7c1.7 3.7 1.9 8.5.8 13"
        fill="none"
        stroke={bagShadow}
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={0.9}
      />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "New Payment Due" notification.
 * The wallet and visible banknote communicate a newly available settlement
 * without relying on a circular badge or the source image.
 */
function PaymentDueNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const wallet = theme.primary;
  const walletShadow = theme.primaryDark;
  const paper = theme.notificationGreen;
  const paperHighlight = theme.accent;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* New banknote rising from the wallet */}
      <Path
        d="M12.1 17.5 13.7 8l22.1 3.8-1.7 9.6-22-3.9Z"
        fill={paper}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M15.3 10.8 34.4 14M17 14.3l3 .5M29.2 16.4l3 .5"
        fill="none"
        stroke={paperHighlight}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.8}
      />
      <Circle cx="25" cy="14.4" r="3.1" fill="none" stroke={outline} strokeWidth={1} opacity={0.8} />
      <Path d="M23.7 14.1c.9-.7 2.1-.3 2.4.6.3.9-.4 1.8-1.4 1.7" fill="none" stroke={outline} strokeWidth={0.8} strokeLinecap="round" />

      {/* Wallet body */}
      <Path
        d="M7.8 18.4c0-1.8 1.5-3.3 3.3-3.3h24.8c2.1 0 3.8 1.7 3.8 3.8v18.8c0 2.2-1.8 4-4 4H11.6c-2.1 0-3.8-1.7-3.8-3.8V18.4Z"
        fill={wallet}
        stroke={outline}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M9.6 29.9h24.6c2.7 0 4.9 1.6 4.9 3.7v3.8c0 2.1-1.7 3.8-3.8 3.8H11.6c-2.1 0-3.8-1.7-3.8-3.8V33c0-1.7.7-2.5 1.8-3.1Z"
        fill={walletShadow}
        opacity={0.5}
      />
      <Path
        d="M10.8 18.7h23.8c1.8 0 3.2 1.4 3.2 3.2v4.3H13.2c-1.3 0-2.4-1.1-2.4-2.4v-5.1Z"
        fill={wallet}
        stroke={outline}
        strokeWidth={1.1}
      />
      <Path
        d="M10.3 36.4c3.8 1.3 8.8 1.7 14.6 1.2"
        fill="none"
        stroke={paperHighlight}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.85}
      />

      {/* Payment clasp */}
      <Path
        d="M30.8 27.4h8.7c1.3 0 2.4 1.1 2.4 2.4v5.8c0 1.3-1.1 2.4-2.4 2.4h-8.7c-1.4 0-2.5-1.1-2.5-2.4v-5.8c0-1.3 1.1-2.4 2.5-2.4Z"
        fill={walletShadow}
        stroke={outline}
        strokeWidth={1.5}
      />
      <Circle cx="34.8" cy="32.7" r="1.7" fill={paperHighlight} stroke={outline} strokeWidth={0.9} />
      <Path d="M34.8 31.9v1.6M34 32.7h1.6" stroke={outline} strokeWidth={0.7} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Original vector artwork for the in-app "Payment Transferred" notification.
 * A banknote being handed over distinguishes settled payment from the
 * separate wallet icon used for a newly pending payment.
 */
function PaymentTransferredNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const money = theme.notificationGreen;
  const moneyHighlight = theme.accent;
  const skin = theme.accent;
  const skinShadow = theme.primaryDark;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Banknote */}
      <Path
        d="M8.6 13.8c0-1.5 1.2-2.7 2.7-2.7h23.1c1.5 0 2.7 1.2 2.7 2.7v11.7c0 1.5-1.2 2.7-2.7 2.7H11.3c-1.5 0-2.7-1.2-2.7-2.7V13.8Z"
        fill={money}
        stroke={outline}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M12.3 16.7c1.8 0 3.1-1.3 3.1-3.1h14.9c0 1.8 1.3 3.1 3.1 3.1v5.9c-1.8 0-3.1 1.3-3.1 3.1H15.4c0-1.8-1.3-3.1-3.1-3.1v-5.9Z"
        fill="none"
        stroke={moneyHighlight}
        strokeWidth={0.9}
        opacity={0.85}
      />
      <Circle cx="23" cy="19.7" r="3.1" fill="none" stroke={outline} strokeWidth={1} opacity={0.85} />
      <Path
        d="M24.5 17.6c-.6-.4-1.5-.4-2 .2-.7.8.1 1.5 1 1.8.9.3 1.7.8 1 1.7-.5.6-1.5.6-2.1.1M23 17v5.5"
        fill="none"
        stroke={outline}
        strokeWidth={0.8}
        strokeLinecap="round"
      />

      {/* Open hand receiving the transferred payment */}
      <Path
        d="M10.2 37.6c2.3-1.6 4.8-3.2 6.5-5l4.6-4.8c.8-.9 2.1-.9 2.9-.1.7.7.8 1.8.2 2.6l-2.1 2.8 6.5-2.5 3.8-1.5c1.1-.4 2.3.2 2.7 1.3.3 1-.1 2.1-1 2.6l-5.6 3c-1.8 1-3.6 2.1-4.9 3.4l-1.4 1.3H12.1c-1.9 0-2.9-2.1-1.9-3.1Z"
        fill={skin}
        stroke={outline}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="m22.3 33.1 3.1-2.7c.8-.7 1.9-.6 2.6.2.6.7.5 1.7-.1 2.4l-2.4 2.5M29 31.5l3.6-1.4"
        fill="none"
        stroke={skinShadow}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.65}
      />
      <Path
        d="M12.4 38.8h10.1M15.1 35.7c1.4-1 2.6-2 3.8-3.2"
        fill="none"
        stroke={moneyHighlight}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.75}
      />
    </Svg>
  );
}

/**
 * Original vector artwork for notifications sent by the Fnashha
 * administration. The bell and sound waves make it distinct from ordinary
 * system announcements while remaining a transparent standalone glyph.
 */
function AdminAnnouncementNotificationGlyph({
  size,
  theme,
}: {
  size: number;
  theme: SelectedTechnicianGlyphTheme;
}) {
  const outline = theme.foreground;
  const bell = theme.primary;
  const bellShadow = theme.primaryDark;
  const wave = theme.notificationGold;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Handle */}
      <Path
        d="M19.5 10.9V8.8c0-2.2 1.8-3.9 4-3.9s4 1.7 4 3.9v2.1"
        fill="none"
        stroke={outline}
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Bell body */}
      <Path
        d="M12.2 30.3c2.4-2.3 3.3-5.4 3.3-9v-1.7c0-5 3.4-8.8 8-8.8s8 3.8 8 8.8v1.7c0 3.6.9 6.7 3.3 9H12.2Z"
        fill={bell}
        stroke={outline}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M15.3 25.9c5.1 1.1 10.4 1.1 16.4 0 .5 1.7 1.3 3.2 2.8 4.4H12.8c1.3-1.2 2.1-2.7 2.5-4.4Z"
        fill={bellShadow}
        opacity={0.55}
      />
      <Path
        d="M12.2 30.3h24.6c.8 0 1.3.6 1.1 1.3-.2.7-.8 1.1-1.5 1.1H12.6c-.7 0-1.3-.4-1.5-1.1-.2-.7.3-1.3 1.1-1.3Z"
        fill={bell}
        stroke={outline}
        strokeWidth={1.5}
      />

      {/* Clapper */}
      <Path
        d="M20.9 33c.4 2.5 1.5 4 3.1 4s2.7-1.5 3.1-4"
        fill={bell}
        stroke={outline}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx="24" cy="37.8" r="1.5" fill={bellShadow} stroke={outline} strokeWidth={1.1} />

      {/* Sound waves */}
      <Path
        d="M9.4 15.8c-2.4 1.6-3.8 4.2-3.8 7.2s1.4 5.6 3.8 7.2M5.5 12.3C2.1 14.9.4 18.7.4 23s1.7 8.1 5.1 10.7"
        fill="none"
        stroke={wave}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M38.6 15.8c2.4 1.6 3.8 4.2 3.8 7.2s-1.4 5.6-3.8 7.2M42.5 12.3c3.4 2.6 5.1 6.4 5.1 10.7s-1.7 8.1-5.1 10.7"
        fill="none"
        stroke={wave}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function RatingNotificationGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 150 149.8">
      {/* Matches previews/rating-notification-icon-preview.svg. */}
      <Path
        d="m53.9 17.8c-0.2 0-0.5 0.2-0.5 0.4-0.5 3.4-1.9 4.6-5.7 5.2-0.3 0.1-0.4 0.6 0 0.7 3.2 0.6 5.1 1.7 5.5 5.4 0 0.4 0.6 0.4 0.7 0 0.4-3.5 2.4-5 5.1-5.4 0.5 0 0.5-0.6 0-0.7-2-0.3-4.3-1.2-5-4.9l-0.1-0.7z"
        fill="#CDB147"
      />
      <Path
        d="m111.6 34.4c-5.7-0.9-9.1-3.4-10-9.5-0.1-0.5-1-0.6-1.1-0.1-0.7 6.2-4 8.8-9.6 9.6-0.7 0-0.7 0.9-0.1 1 6.3 0.7 8.9 3.6 9.6 9.1l0.1 0.2h0.9l0.1-0.2c0.5-5.5 3.5-8.3 10-9v-0.1c0.8 0 0.8-0.9 0.1-1z"
        fill="#BBA13A"
      />
      <Path
        d="m32 99.2c-5.4-0.8-8.9-3.2-9.5-9.6 0-0.4-0.9-0.6-0.9-0.1-0.8 6.4-4 8.8-9.8 9.7-0.7 0.2-0.8 0.9-0.1 1 6 0.7 8.5 3.2 9.8 9.5 0 0.8 0.8 1.5 1 0.7 0.6-6.1 3.9-9 9.6-10.1l0.3-0.9-0.4-0.2z"
        fill="#CEAF44"
      />
      <Path
        d="m78.1 125.8c-2.2-0.3-4.4-1.7-4.9-5.1 0-0.5-0.7-0.6-0.7-0.1-0.3 3.3-2 4.8-5.1 5.4-0.5 0-0.5 0.6-0.1 0.6 3.3 0.3 4.8 1.7 5.2 5.4 0.1 0.4 0.7 0.4 0.7 0 0.4-3.3 2.2-5.1 5-5.4l0.2-0.1 0.1-0.5-0.4-0.2z"
        fill="#CBAD43"
      />
      <Path
        d="m125.8 46.3c-2.8-0.4-4.7-1.7-5.3-4.9-0.1-0.4-0.8-0.5-0.8 0-0.2 3-2 4.3-5 4.8-0.5 0.1-0.6 0.6 0 0.7 3.2 0.5 4.5 2.1 5 5.6 0.1 0.5 0.7 0.7 0.8 0.2 0.3-3.3 2.1-5.3 5.2-5.7l0.4-0.3-0.3-0.4z"
        fill="#CFAB3D"
      />
      <Path
        d="m60.5 36.7h-14l-6.7-10.5c-2-5.5-8.9-3.9-9.6 1.2l-3.6 11.4-13.1 3.5c-4 1.2-5 6.6-1.6 9.1l11.2 7.6v2.4c-3.2 2.7-3.5 7.6-0.6 10.3v1.2c0.4 3.4 3.3 5.2 6.3 4.4l13.3 11.9c0.6 0.7 0.5 1.5 0.5 1.5l-4.9 26.5c-0.2 4.6 3.5 8.1 7.8 8 1.3 0 2.5-0.3 3.8-1l21.3-10.9c2-1 2-1 3.4-0.2l21.1 11.1c1.2 0.6 2.5 1 3.7 1 4.9 0 8.1-3.9 7.5-8.9l7-3.8 10.7 5.5c3.9 2.1 8.7-1 7.8-5.5l-2.2-12.3 9.1-8.3c2.8-2.7 1.8-8.1-2.9-8.5l-13.1-1.9-3.8-7.5 2-1.7c3.9-3.6 3.4-10.5-3.4-13.1l-27.4-3.8-11.4-23.6c-2.9-5.7-10.4-6.8-13.2 0l-2.5 5.6c-0.6-0.4-1.5-0.8-2.5-0.7z"
        fill="#363739"
      />
      <Path
        d="m60.2 39.6h-14.4c-0.8 0-1.6-0.5-2-1.3l-6.9-11c-1-1.6-3.1-1.2-3.4 0.4l-4.1 12.4c-0.4 1.4-1.5 1.6-2.5 1.9l-12.7 3.2c-1.2 0.4-1.7 2.3-0.5 3.1l11.3 8.1c1.6 0.9 1.4 3.1 1.2 3.2l26.5-3.9c-0.7-1.9 0.6-3.1 1.1-3.7l5-6.1 2.6-5.5-1.2-0.8z"
        fill="#CDB147"
      />
      <Path
        d="m135.5 86.5-13.9-1.9c-1.7-0.2-1.7-1.2-5-8.3l-14.4 12.9c-0.5 0.6-0.5 0.7-0.5 1.2l3.8 22.5 6.6-3.7c0.7-0.4 1.7-0.8 2.5-0.2l10.9 6.4c1.5 0.9 3.5-0.4 3.1-1.9l-2.5-13.1c-0.2-0.8 0-1.7 0.9-2.5l9.3-8.4c1.1-0.9 0.4-2.9-0.8-3z"
        fill="#BBA13A"
      />
      <Path
        d="m76.2 33c-2-3.4-6.5-3.7-8.7-0.5l-10.5 22.9c-0.7 1.3-1.1 2.1-2.3 2.2l-27.7 3.9c-4.1 0.8-6.1 6.3-2.4 9.4l19.2 16.8c0.9 0.8 1.3 2.2 0.9 3.4l-5.3 26.1c-0.2 3.5 2.9 7 7.2 6.2l23.5-12.3c1.2-0.6 2.5-1.1 4.2-0.1l21.6 11.6c4 2.3 9.6-0.2 8.7-5.8l-4.6-25.9c-0.3-1.3 0-2.3 1-3.3l18.9-17.7c3-2.2 2.1-8.2-2.8-9l-27.2-3.2c-1-0.1-1.7-0.7-2.1-1.7l-11.6-23z"
        fill="#F9C627"
        stroke="#363739"
        strokeWidth={3.3608}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function NotificationGlyph({ name, color, size = 25, fill, theme }: NotificationGlyphProps) {
  if (name === 'message') {
    return <NewMessageGlyph size={size} fill={fill ?? color} />;
  }
  if (name === 'technician-selected') {
    return <SelectedTechnicianNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'service-request') {
    return <NewServiceRequestNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'another-technician-selected') {
    return (
      <Image
        source={ANOTHER_TECHNICIAN_SELECTED_ICON}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }
  if (name === 'price-adjustment-requested') {
    return (
      <Image
        source={PRICE_ADJUSTMENT_REQUESTED_ICON}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }
  if (name === 'payment-due') {
    return <PaymentDueNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'payment-transferred') {
    return <PaymentTransferredNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'admin-announcement') {
    return <AdminAnnouncementNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'star') {
    return <RatingNotificationGlyph size={size} />;
  }
  if (name === 'order-completed') {
    return <OrderCompletedNotificationGlyph size={size} />;
  }
  if (name === 'service-completion-confirmation') {
    return <ServiceCompletionConfirmationNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'new-price-offer') {
    return <NewPriceOfferNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'offer-withdrawn') {
    return <OfferWithdrawnNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'order-cancelled') {
    return <OrderCancelledNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'fnashha-coins-added') {
    return <FnashhaCoinsAddedNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'admin-points-added') {
    return <AdminPointsAddedNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'referral-reward') {
    return <ReferralRewardNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'campaign-reward') {
    return <CampaignRewardNotificationGlyph size={size} theme={theme!} />;
  }
  if (name === 'support-ticket-replied') {
    return <SupportTicketRepliedNotificationGlyph size={size} theme={theme!} />;
  }

  return <MaterialIcons name={MATERIAL_GLYPH[name]} size={size} color={color} />;
}

function getStatusChangeIcon(title: string, body: string): IconEntry {
  const context = `${title} ${body}`.toLocaleLowerCase();

  // These notifications are persisted as status_change, so use their
  // existing Arabic copy to recover the intended semantic icon.
  if (
    context.includes('تم اختيار فني آخر') ||
    context.includes('اختار العميل فني')
  ) {
    return { name: 'another-technician-selected', tone: 'danger' };
  }
  if (context.includes('طلب تعديل السعر')) {
    return { name: 'price-adjustment-requested', tone: 'warning' };
  }
  if (
    context.includes('تم سحب عرض') ||
    context.includes('offer withdrawn')
  ) {
    return { name: 'offer-withdrawn', tone: 'danger' };
  }
  if (
    context.includes('استرداد') ||
    context.includes('سحب') ||
    context.includes('withdraw')
  ) {
    return { name: 'cash-minus', tone: 'danger' };
  }
  if (context.includes('هل تم تنفيذ') || context.includes('تأكيد') || context.includes('confirm')) {
    return { name: 'service-completion-confirmation', tone: 'warning' };
  }
  if (context.includes('فنشها كوينز') && context.includes('رصيد محفظتك')) {
    return { name: 'fnashha-coins-added', tone: 'gold' };
  }
  if (
    context.includes('مكافأة الإحالة') ||
    context.includes('referral reward')
  ) {
    return { name: 'referral-reward', tone: 'gold' };
  }
  if (
    context.includes('مكافأة حملة') ||
    context.includes('campaign reward')
  ) {
    return { name: 'campaign-reward', tone: 'gold' };
  }
  if (
    context.includes('تم إضافة نقاط من الإدارة') ||
    context.includes('تم اضافة نقاط من الادارة') ||
    context.includes('points added by administration')
  ) {
    return { name: 'admin-points-added', tone: 'success' };
  }
  if (
    context.includes('كوينز') ||
    context.includes('مكافأة') ||
    context.includes('نقاط') ||
    context.includes('رصيدك بواسطة الإدارة') ||
    context.includes('coins') ||
    context.includes('reward') ||
    context.includes('points')
  ) {
    return { name: 'coins', tone: 'gold' };
  }
  if (context.includes('تقييم جديد') || context.includes('rating')) {
    return { name: 'star', tone: 'gold' };
  }
  if (
    context.includes('إلغاء') ||
    context.includes('ملغ') ||
    context.includes('cancel')
  ) {
    return { name: 'cancel', tone: 'danger' };
  }
  if (
    context.includes('قبول تعديل السعر') ||
    context.includes('price approved') ||
    context.includes('price accepted')
  ) {
    return { name: 'cash-plus', tone: 'success' };
  }
  if (
    context.includes('رفض تعديل السعر') ||
    context.includes('price rejected')
  ) {
    return { name: 'cash-minus', tone: 'danger' };
  }
  if (
    context.includes('السعر') ||
    context.includes('تعديل السعر') ||
    context.includes('price') ||
    context.includes('عرض')
  ) {
    return { name: 'cash-edit', tone: 'warning' };
  }
  if (
    context.includes('إنهاء') ||
    context.includes('إكمال') ||
    context.includes('إتمام') ||
    context.includes('مكتمل') ||
    context.includes('اكتمل') ||
    context.includes('completed')
  ) {
    if (
      context.includes('تم إكمال الطلب') ||
      context.includes('تم إنهاء الطلب') ||
      context.includes('order completed') ||
      context.includes('request completed')
    ) {
      return { name: 'order-completed', tone: 'success' };
    }
    return { name: 'check', tone: 'success' };
  }
  return TYPE_ICON.status_change;
}

function getNotificationIcon(type: string, title: string, body: string): IconEntry {
  return type === 'status_change'
    ? getStatusChangeIcon(title, body)
    // Unknown DB types still receive an intentional system/admin bell rather
    // than a logo or an unrelated generic notification graphic.
    : TYPE_ICON[type] ?? TYPE_ICON.announcement;
}

function getToneColors(
  tone: IconEntry['tone'],
  colors: ReturnType<typeof useColors>,
): {
  foreground: string;
  background: string;
} {
  const solidByTone: Record<IconEntry['tone'], string> = {
    success: colors.notificationGreen,
    danger: colors.notificationRed,
    gold: colors.notificationGold,
    info: colors.notificationBlue,
    warning: colors.notificationAmber,
    support: colors.notificationCyan,
    muted: colors.notificationPurple,
  };
  const foreground = solidByTone[tone];
  return {
    foreground,
    background: `${foreground}1F`,
  };
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const authedFetch = useAuthedFetch();
  const qc = useQueryClient();
  const { locale } = useLocale();
  const t = translations[locale];

  const role = user?.role ?? '';

  function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.notifications.now;
    if (mins < 60) return t.notifications.minutesAgo(mins);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t.notifications.hoursAgo(hrs);
    return t.notifications.daysAgo(Math.floor(hrs / 24));
  }

  // Use limit=100 in the query key so it's distinct from the header's
  // limit=50 cache, but both are invalidated by prefix ['notifications'].
  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery<Notification[]>({
    queryKey: ['notifications', 100],
    queryFn: () => authedFetch('/api/notifications?limit=100'),
    enabled: !!user,
    staleTime: 0, // always fresh when screen opens
  });

  useRefetchOnFocus([refetch]);

  const markAllRead = useMutation({
    mutationFn: () => apiFetch('/api/notifications/read-all', { method: 'POST', token: accessToken }),
    // Invalidate ALL notification queries (badge + screen list)
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneRead = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/notifications/${id}/read`, { method: 'POST', token: accessToken }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handlePress = (item: Notification) => {
    if (!item.isRead) {
      markOneRead.mutate(item.id);
    }
    // Use the centralized router — single source of truth for all navigation.
    const path = getRouteFromDbNotification(item.type, item.relatedId ?? null, role, item.title);
    if (path) router.push(path as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t.notifications.title}
        rightElement={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={() => markAllRead.mutate()}>
              <Text style={[styles.markAll, { color: colors.primary }]}>{t.notifications.markAllRead}</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isLoading ? (
        <View style={{ padding: 16 }}>
          <SkeletonList count={5} height={72} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => String(n.id)}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="bell" title={t.notifications.empty} />}
          renderItem={({ item }) => {
            const iconEntry = getNotificationIcon(item.type, item.title, item.body);
            const iconColors = getToneColors(iconEntry.tone, colors);
            const path = getRouteFromDbNotification(item.type, item.relatedId ?? null, role, item.title);
            const isArtworkIcon =
              iconEntry.name === 'message' ||
              iconEntry.name === 'star' ||
              iconEntry.name === 'order-completed' ||
              iconEntry.name === 'service-completion-confirmation' ||
              iconEntry.name === 'new-price-offer' ||
              iconEntry.name === 'offer-withdrawn' ||
              iconEntry.name === 'order-cancelled' ||
              iconEntry.name === 'fnashha-coins-added' ||
              iconEntry.name === 'admin-points-added' ||
              iconEntry.name === 'referral-reward' ||
              iconEntry.name === 'campaign-reward' ||
              iconEntry.name === 'support-ticket-replied' ||
              iconEntry.name === 'technician-selected' ||
              iconEntry.name === 'service-request' ||
              iconEntry.name === 'another-technician-selected' ||
              iconEntry.name === 'price-adjustment-requested' ||
              iconEntry.name === 'payment-due' ||
              iconEntry.name === 'payment-transferred' ||
              iconEntry.name === 'admin-announcement';
            return (
              <TouchableOpacity
                style={[
                  styles.item,
                  { backgroundColor: item.isRead ? colors.card : colors.primary + '08', borderBottomColor: colors.border },
                ]}
                onPress={() => handlePress(item)}
                activeOpacity={path ? 0.8 : 1}
              >
                <View
                  style={
                    isArtworkIcon
                      ? styles.messageIconSlot
                      : [styles.iconBadge, { backgroundColor: iconColors.background }]
                  }
                >
                  <NotificationGlyph
                    name={iconEntry.name}
                    size={isArtworkIcon ? 48 : 22}
                    color={iconColors.foreground}
                    fill={iconEntry.name === 'message' ? colors.primary : undefined}
                    theme={colors}
                  />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemTopRow}>
                    <Text style={[styles.itemTime, { color: colors.mutedForeground }]}>
                      {timeAgo(item.createdAt)}
                    </Text>
                    {!item.isRead && (
                      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                  <Text style={[styles.itemTitle, { color: colors.foreground }, !item.isRead && styles.itemTitleUnread]}>
                    {item.title}
                  </Text>
                  {!!(item as any).body && (
                    <Text style={[styles.itemBody, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {(item as any).body}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  markAll: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  messageIconSlot: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemContent: { flex: 1, gap: 3 },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  itemTitle: { fontSize: 13, fontFamily: 'Cairo_500Medium', textAlign: 'auto', lineHeight: 20 },
  itemTitleUnread: { fontFamily: 'Cairo_700Bold' },
  itemBody: { fontSize: 12, fontFamily: 'Cairo_400Regular', textAlign: 'auto' },
  itemTime: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  dot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
});
