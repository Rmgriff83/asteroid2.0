// Reads the device safe-area insets (notches, home bars) exposed as CSS vars
// in style.css, so Phaser UI can avoid them.
export function getSafeArea() {
  const cs = getComputedStyle(document.documentElement)
  const v = (name) => parseFloat(cs.getPropertyValue(name)) || 0
  return {
    top: v('--sat'),
    right: v('--sar'),
    bottom: v('--sab'),
    left: v('--sal'),
  }
}
