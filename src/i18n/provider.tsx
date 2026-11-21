import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getMessages } from './translations';

const LOCALE_STORAGE_KEY = '@stxtb/locale';

export type Locale = 'en' | 'ru' | 'pl';

type LocalizationContextValue = {
  locale: Locale;
  messages: ReturnType<typeof getMessages>;
  setLocale: (locale: Locale) => Promise<void>;
};

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (systemLocale.startsWith('ru')) return 'ru';
    if (systemLocale.startsWith('pl')) return 'pl';
    return 'en';
  });

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((storedLocale) => {
        if (active && (storedLocale === 'en' || storedLocale === 'ru' || storedLocale === 'pl')) {
          setLocaleState(storedLocale);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load the saved language preference.', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch (error) {
      console.error('Could not save the language preference.', error);
    }
  }, []);

  const value = useMemo(
    () => ({ locale, messages: getMessages(locale), setLocale }),
    [locale, setLocale]
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within LocalizationProvider.');
  }
  return context;
}
