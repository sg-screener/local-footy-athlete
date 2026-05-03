/**
 * V2 design-system primitives.
 *
 * This folder is distinct from `components/common/` on purpose:
 *   - `common/` contains the legacy ("Classic") component library used
 *     throughout the app today.
 *   - `ui/` is the V2 library — softer radii, accent glow, spring press,
 *     opinionated for the redesigned Home screen and beyond.
 *
 * Keep them separate until V2 fully supersedes Classic; then collapse.
 */

export { Button } from './Button';
export type { V2ButtonVariant, V2ButtonSize, V2ButtonProps } from './Button';

export { Card } from './Card';
export type { V2CardTone, V2CardProps } from './Card';

export { Sheet } from './Sheet';
export type { V2SheetProps } from './Sheet';

export { Badge } from './Badge';
export type { V2BadgeTone, V2BadgeSize, V2BadgeProps } from './Badge';

export { IconButton } from './IconButton';
export type { V2IconButtonTone, V2IconButtonSize, V2IconButtonProps } from './IconButton';

export { SectionLabel } from './SectionLabel';
export type { V2SectionLabelProps } from './SectionLabel';
