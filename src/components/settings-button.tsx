import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { useLocalization } from '@/i18n/provider';
import { ThemedText } from './themed-text';

export function SettingsButton() {
  const { messages } = useLocalization();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={messages.common.settings}
      hitSlop={8}
      onPress={() => router.push('/settings')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <ThemedText style={styles.icon}>⚙</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
    lineHeight: 28,
  },
  pressed: {
    opacity: 0.65,
  },
});
