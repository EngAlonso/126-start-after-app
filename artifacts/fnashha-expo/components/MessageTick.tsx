/**
 * MessageTick — WhatsApp-style message status indicators for sent messages.
 *
 * Four states:
 *  "sending"   — single faded tick  (optimistic, not yet confirmed by server)
 *  "sent"      — single solid tick  (server stored it; recipient not yet received)
 *  "delivered" — double faded tick  (recipient device fetched the message list)
 *  "read"      — double vivid blue  (recipient opened the chat; is_read = true)
 *
 * Uses react-native-svg to render the same SVG paths as the web component.
 * Designed to sit inside sender bubbles with a colored (primary) background.
 *
 * Semantic mapping to backend fields:
 *   sending   → _isOptimistic flag present (before POST response)
 *   sent      → POST confirmed; isDelivered = false, isRead = false
 *   delivered → isDelivered = true (set by PATCH deliver-all on recipient open)
 *   read      → isRead = true (set by PATCH read-all on recipient open)
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export type TickState = 'sending' | 'sent' | 'delivered' | 'read';

interface MessageTickProps {
  state: TickState;
  /** "sm" = 15×8 px, "md" = 18×10 px */
  size?: 'sm' | 'md';
}

// Colors — identical to the web component values.
const BLUE      = '#53bdeb';                   // read
const DELIVERED = 'rgba(255,255,255,0.65)';    // delivered (double, faded)
const SENT      = 'rgba(255,255,255,0.90)';    // sent (single, solid)
const SENDING   = 'rgba(255,255,255,0.40)';    // sending (single, very faded)

export function MessageTick({ state, size = 'sm' }: MessageTickProps) {
  const w = size === 'md' ? 18 : 15;
  const h = size === 'md' ? 10 : 8;

  // ── Single tick: "sending" or "sent" ─────────────────────────────────────
  if (state === 'sending' || state === 'sent') {
    const stroke = state === 'sent' ? SENT : SENDING;
    return (
      <Svg
        width={Math.round(w * 0.7)}
        height={h}
        viewBox="0 0 10 8"
        fill="none"
        accessibilityLabel={state === 'sent' ? 'تم الإرسال' : 'جاري الإرسال'}
      >
        <Path
          d="M1 4L3.5 6.5L9 1"
          stroke={stroke}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // ── Double tick: "delivered" or "read" ───────────────────────────────────
  const stroke = state === 'read' ? BLUE : DELIVERED;
  return (
    <Svg
      width={w}
      height={h}
      viewBox="0 0 18 10"
      fill="none"
      accessibilityLabel={state === 'read' ? 'تمت القراءة' : 'تم التسليم'}
    >
      {/* Left tick */}
      <Path
        d="M1 5L4 8L10 1"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right tick — shifted 6 px, overlaps with left */}
      <Path
        d="M7 5L10 8L16 1"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
