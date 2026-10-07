"use client";

import { useRef, useState, type CSSProperties, type PointerEvent, type TouchEvent } from "react";

// Drag-to-resize behaviour for mobile bottom sheets, like native iOS/Android
// sheets: the sheet opens at a "peek" height; dragging the handle up snaps
// it to "full", dragging down collapses it and, from peek, closes it. The
// list inside also expands the sheet when swiped up while peeking.

export type SheetSnap = "peek" | "full";

/** Snap heights as % of the dynamic viewport height (dvh). */
const SNAP_DVH: Record<SheetSnap, number> = { peek: 62, full: 92 };
/** Movement before a press counts as a drag (keeps taps/clicks working). */
const DRAG_SLOP_PX = 6;
/** A drag this far, or a flick this fast, changes the snap point. */
const SNAP_DISTANCE_PX = 60;
const FLICK_VELOCITY = 0.5; // px per ms
const EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

interface DragState {
  pointerId: number;
  startY: number;
  startTime: number;
  dragging: boolean;
}

export function useSheetSnap({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [snap, setSnap] = useState<SheetSnap>("peek");
  /** Live finger offset in px while dragging (positive = down), else null. */
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const drag = useRef<DragState | null>(null);
  const listTouch = useRef<{ startY: number } | null>(null);

  // Every opening starts at peek. Adjusting state during render (not in an
  // effect) avoids painting one frame at the previous size.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSnap("peek");
      setDragOffset(null);
    }
  }

  /** Upward travel is free up to the full height, then rubber-bands. */
  const constrain = (dy: number) => {
    if (dy >= 0) return dy;
    const room = snap === "full" ? 0 : ((SNAP_DVH.full - SNAP_DVH.peek) / 100) * window.innerHeight;
    return dy < -room ? -room + (dy + room) * 0.2 : dy;
  };

  const settle = (dy: number, velocity: number) => {
    const up = dy < -SNAP_DISTANCE_PX || velocity < -FLICK_VELOCITY;
    const down = dy > SNAP_DISTANCE_PX || velocity > FLICK_VELOCITY;
    if (up) setSnap("full");
    else if (down) {
      // A long pull from full height goes straight to closed.
      if (snap === "peek" || dy > window.innerHeight * 0.45) onClose();
      else setSnap("peek");
    }
  };

  const finishDrag = (e: PointerEvent<HTMLElement>, cancelled = false) => {
    const state = drag.current;
    drag.current = null;
    if (!state?.dragging) return;
    const dy = e.clientY - state.startY;
    const velocity = dy / Math.max(1, e.timeStamp - state.startTime);
    setDragOffset(null);
    if (!cancelled) settle(dy, velocity);
  };

  /** Spread onto the handle/header area that should drag the sheet. */
  const handleProps = {
    style: { touchAction: "none" } as CSSProperties,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag.current = { pointerId: e.pointerId, startY: e.clientY, startTime: e.timeStamp, dragging: false };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const state = drag.current;
      if (!state || state.pointerId !== e.pointerId) return;
      const dy = e.clientY - state.startY;
      if (!state.dragging) {
        if (Math.abs(dy) < DRAG_SLOP_PX) return;
        // Capture only once it's really a drag, so taps on buttons still click.
        state.dragging = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      setDragOffset(constrain(dy));
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => finishDrag(e),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => finishDrag(e, true),
  };

  /**
   * Spread onto the scrollable list: swiping up while peeking expands the
   * sheet; pulling down at the very top of the list while full collapses it.
   * Normal scrolling is untouched otherwise.
   */
  const listProps = {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      listTouch.current = { startY: e.touches[0].clientY };
    },
    onTouchMove: (e: TouchEvent<HTMLElement>) => {
      const start = listTouch.current;
      if (!start) return;
      const dy = e.touches[0].clientY - start.startY;
      if (snap === "peek" && dy < -12) {
        setSnap("full");
        listTouch.current = null;
      } else if (snap === "full" && dy > 40 && e.currentTarget.scrollTop <= 0) {
        setSnap("peek");
        listTouch.current = null;
      }
    },
    onTouchEnd: () => {
      listTouch.current = null;
    },
  };

  /** Inline style for the sheet itself (inline height beats the Sheet's h-auto). */
  const sheetStyle: CSSProperties = {
    height: `max(0px, calc(${SNAP_DVH[snap]}dvh - ${dragOffset ?? 0}px))`,
    // Keep the Sheet's own open/close slide + fade (translate/opacity) working.
    transition: [dragOffset === null ? `height 320ms ${EASING}` : null, "opacity 200ms ease-in-out", "translate 200ms ease-in-out", "transform 200ms ease-in-out"]
      .filter(Boolean)
      .join(", "),
  };

  const toggle = () => setSnap((s) => (s === "peek" ? "full" : "peek"));

  return { snap, sheetStyle, handleProps, listProps, toggle, isDragging: dragOffset !== null };
}
