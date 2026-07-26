import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from './common/Text';
import { SESSION_ROLE_BADGES, type SessionRole } from '../utils/sessionRoles';

interface SessionRoleBadgeProps {
  role: SessionRole;
}

/**
 * The D13 role badge — the one taxonomy signpost on a session row.
 *
 * ## Why an eyebrow and not a chip
 *
 * This badge takes over the slot the numeric index used to hold. That index was
 * a SEQUENCE marker; a role is a KIND. Sequence belonged inline beside the name
 * because it was a waypoint you counted through; kind belongs above the name
 * because it classifies what follows. "Main Lift" also simply does not fit the
 * 18px index column without shoving the exercise name off its line.
 *
 * ## Why all six share one tone
 *
 * The screen has exactly one accent (lime) and spends it on structure — the
 * superset rail, the weight control, the Finish CTA. Colour-coding six badges
 * would either flatten that accent across the whole list or invent a five-hue
 * key the athlete has to learn. So every badge takes the same muted grey the
 * index label used, at eyebrow scale: present when looked for, never competing
 * with the exercise name. The badge does exactly one job — it names the kind.
 */
export function SessionRoleBadge({ role }: SessionRoleBadgeProps) {
  return (
    <Text style={styles.badge} testID={`session-role-badge-${role}`}>
      {SESSION_ROLE_BADGES[role]}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    color: '#5A5A5A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
});
