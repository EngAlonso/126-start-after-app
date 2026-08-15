/**
 * MessageTick — WhatsApp-style read receipts for sent messages.
 *
 * Three states:
 *  "sending"   — single tick, semi-transparent (optimistic, not yet on server)
 *  "delivered" — double tick, white/faded  (saved on server, not yet read)
 *  "read"      — double tick, vivid blue   (recipient opened the conversation)
 *
 * Designed for use inside sender bubbles that have a colored background
 * (bg-primary / bg-accent). White works better than gray on a colored bg.
 */
export function MessageTick({
  state,
  size = "sm",
}: {
  state: "sending" | "delivered" | "read";
  /** "sm" = 10×7 (customer chat), "md" = 12×9 (technician chat) */
  size?: "sm" | "md";
}) {
  const w = size === "md" ? 18 : 15;
  const h = size === "md" ? 10 : 8;

  // WhatsApp blue — vivid, unmistakable even on a primary-colored bubble
  const blue = "#53bdeb";
  const delivered = "rgba(255,255,255,0.65)";
  const sending   = "rgba(255,255,255,0.4)";

  if (state === "sending") {
    // Single small tick
    return (
      <svg
        width={w * 0.7}
        height={h}
        viewBox="0 0 10 8"
        fill="none"
        className="inline-block flex-shrink-0"
        aria-label="جاري الإرسال"
      >
        <path
          d="M1 4L3.5 6.5L9 1"
          stroke={sending}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const stroke = state === "read" ? blue : delivered;

  // Double tick: two overlapping checkmarks offset to the right — WhatsApp style
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 18 10"
      fill="none"
      className="inline-block flex-shrink-0 transition-colors duration-200"
      aria-label={state === "read" ? "تمت القراءة" : "تم التسليم"}
    >
      {/* First (left) tick */}
      <path
        d="M1 5L4 8L10 1"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Second (right) tick — shifted 6px right, overlaps with first */}
      <path
        d="M7 5L10 8L16 1"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
