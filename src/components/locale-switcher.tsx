import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useLocalization, type Locale } from '@/i18n/provider';
import { ThemedText } from './themed-text';

const OPTIONS: Locale[] = ['en', 'ru', 'pl'];

export function LocaleSwitcher() {
  const { locale, messages, setLocale } = useLocalization();

  return (
    <View
      accessibilityLabel={messages.common.language}
      accessibilityRole="radiogroup"
      style={styles.container}>
      {OPTIONS.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ selected: locale === option }}
          accessibilityLabel={
            messages.common[
              option === 'en' ? 'english' : option === 'ru' ? 'russian' : 'polish'
            ]
          }
          onPress={() => setLocale(option)}
          style={({ pressed }) => [
            styles.option,
            locale === option && styles.selectedOption,
            pressed && styles.pressed,
          ]}>
          <ThemedText
            type="smallBold"
            themeColor={locale === option ? 'text' : 'textSecondary'}>
            {option.toUpperCase()}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: Spacing.one,
  },
  option: {
    minWidth: 36,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  selectedOption: {
    borderBottomWidth: 2,
    borderBottomColor: '#808080',
  },
  pressed: {
    opacity: 0.7,
  },
});
