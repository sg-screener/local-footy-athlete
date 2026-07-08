import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type NameScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Name'
>;

export const NameScreen: React.FC<NameScreenProps> = ({ navigation }) => {
  const [name, setName] = useState('');
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Name');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData,
  );

  const handleContinue = () => {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      updateOnboardingData({ firstName: trimmed });
      navigation.navigate('BodyMeasurements');
    }
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={name.trim().length === 0}
    >
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          What should I call you?
        </Text>
        <Text
          variant="body"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          So I can coach you properly.
        </Text>
      </View>

      <View style={[styles.inputCard, shadows.xs]}>
        <Feather name="user" size={19} color={colors.text.tertiary} />
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder="Type your name..."
          placeholderTextColor={colors.text.disabled}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          maxLength={30}
        />
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: 32,
  },
  title: {
    ...headingXL,
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 20,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
  },
  textInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    paddingLeft: 12,
    paddingVertical: 8,
  },
});
