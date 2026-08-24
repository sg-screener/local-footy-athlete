/** Convert horizontal scroll distance to the nearest legal picker index. */
export function numberPickerIndexFromOffset(
  offsetX: number,
  itemWidth: number,
  itemCount: number,
): number {
  if (itemWidth <= 0 || itemCount <= 0) return 0;
  return Math.min(
    itemCount - 1,
    Math.max(0, Math.round(offsetX / itemWidth)),
  );
}
