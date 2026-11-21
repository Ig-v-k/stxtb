import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLocalization } from '@/i18n/provider';

export default function SettingsScreen() {
  const { messages } = useLocalization();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={messages.common.back}
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText style={styles.backIcon}>‹</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            {messages.settings.title}
          </ThemedText>
          <View style={styles.settingRow}>
            <View style={styles.settingDescription}>
              <ThemedText type="smallBold">
                {messages.settings.languageTitle}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {messages.settings.languageDescription}
              </ThemedText>
            </View>
            <LocaleSwitcher />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 36,
    lineHeight: 40,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    marginTop: Spacing.two,
    marginBottom: Spacing.five,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  settingDescription: {
    flex: 1,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.65,
  },
});
