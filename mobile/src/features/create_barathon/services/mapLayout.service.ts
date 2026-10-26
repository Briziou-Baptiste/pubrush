// Gesture capture is restricted to the sheet header; horizontal drags remain untouched.
export function isSheetDrag(dx: number, dy: number): boolean {
  return Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.5;
}

export function sheetCollapsedAfterDrag(collapsed: boolean, dy: number): boolean {
  if (dy > 40) return true;
  if (dy < -40) return false;
  return collapsed;
}

// Use measured overlays, including their actual text wrapping and safe-area offsets.
export function getMapControlsLayout(bottomTop: number, headerBottom: number) {
  const gap = 16; // includes the 4px touch extension on each button
  const height = bottomTop - headerBottom - gap * 2;
  // Stack vertically where possible; on short screens keep both 48px targets side by side.
  return { top: Math.max(headerBottom + gap, bottomTop - gap - (height >= 108 ? 108 : 48)),
    horizontal: height < 108, fits: height >= 48 };
}
