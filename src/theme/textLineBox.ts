/**
 * The minimum line box that can safely contain the iPhone system font.
 *
 * Local presentation styles are allowed to change `fontSize`, but React Native
 * otherwise leaves the shared variant's old `lineHeight` in place. A 22px title
 * inheriting the 17px body line box is how the top of "Session feedback" was
 * physically clipped. Resolve the effective pair at the shared text boundary so
 * every current and future local font-size override gets the same protection.
 */
export function safeTextLineHeight(
  fontSize: number,
  requestedLineHeight?: number,
): number {
  const minimum = Math.ceil(fontSize * 1.18);
  return Math.max(minimum, requestedLineHeight ?? 0);
}
