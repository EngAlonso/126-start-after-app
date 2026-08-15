import { useCallback, useRef } from "react";
import type { TouchEvent } from "react";

const EDGE_START_DISTANCE = 48;
const SWIPE_DISTANCE = 64;
const CLEAR_SWIPE_DISTANCE = 100;
const HORIZONTAL_DOMINANCE_RATIO = 1.35;

type GestureState = {
  startX: number;
  startY: number;
  tracking: boolean;
};

function isMobileTouchViewport() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  return hasTouch && window.matchMedia("(max-width: 767px)").matches;
}

function isIgnoredSurface(target: EventTarget | null) {
  if (!(target instanceof Element)) return true;

  if (
    target.closest(
      "button, a, input, textarea, select, option, [role='button'], [role='dialog'], " +
      "[contenteditable='true'], [data-swipe-ignore='true']",
    )
  ) {
    return true;
  }

  let current: Element | null = target;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current instanceof HTMLElement) {
      const hasHorizontalOverflow = current.scrollWidth > current.clientWidth + 1;
      const overflowX = window.getComputedStyle(current).overflowX;
      const isHorizontallyScrollable =
        overflowX === "auto" ||
        overflowX === "scroll" ||
        overflowX === "overlay";
      if (isHorizontallyScrollable && hasHorizontalOverflow) {
        return true;
      }
    }
    current = current.parentElement;
  }

  return false;
}

export function useAdminMobileSwipe({
  isOpen,
  onOpen,
  onClose,
}: {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const gesture = useRef<GestureState | null>(null);

  const onTouchStart = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      gesture.current = null;
      if (!isMobileTouchViewport() || event.touches.length !== 1) return;
      if (isIgnoredSurface(event.target)) return;

      const touch = event.touches[0];
      gesture.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        tracking: true,
      };
    },
    [],
  );

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    const currentGesture = gesture.current;
    if (!currentGesture?.tracking || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - currentGesture.startX;
    const deltaY = touch.clientY - currentGesture.startY;

    if (
      Math.abs(deltaY) > 12 &&
      Math.abs(deltaY) > Math.abs(deltaX) / HORIZONTAL_DOMINANCE_RATIO
    ) {
      currentGesture.tracking = false;
    }
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const currentGesture = gesture.current;
      gesture.current = null;
      if (!currentGesture?.tracking) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - currentGesture.startX;
      const deltaY = touch.clientY - currentGesture.startY;
      const horizontalDistance = Math.abs(deltaX);
      const isClearlyHorizontal =
        horizontalDistance > Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO;

      if (!isOpen) {
        const startedNearRightEdge =
          currentGesture.startX >= window.innerWidth - EDGE_START_DISTANCE;
        const wasClearlyIntentionalSwipe =
          horizontalDistance >= CLEAR_SWIPE_DISTANCE;

        if (
          deltaX <= -SWIPE_DISTANCE &&
          isClearlyHorizontal &&
          (startedNearRightEdge || wasClearlyIntentionalSwipe)
        ) {
          onOpen();
        }
        return;
      }

      if (deltaX >= SWIPE_DISTANCE && isClearlyHorizontal) {
        onClose();
      }
    },
    [isOpen, onClose, onOpen],
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}