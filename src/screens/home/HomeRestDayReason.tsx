import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { REST_DAY_REASON_COPY_ID, type RestDayReason } from '../../rules/restDayReason';
import { signedCopy } from '../../rules/signedCopy';

/** The single explanation line inside an expanded, empty Program day. */
export function HomeRestDayReason({ reason, style }: {
  reason?: RestDayReason;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={style} testID="home-rest-day-reason">
    {signedCopy(reason ? REST_DAY_REASON_COPY_ID[reason] : 'day.rest.default')}
  </Text>;
}
