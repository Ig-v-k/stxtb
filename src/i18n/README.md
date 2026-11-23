# Localization

The app uses a small, typed localization layer so screens can change languages
without coupling business logic to translation files.

## Adding a translation

1. Add the same keys to `translations.ts` for every supported locale.2. Keep the English catalog as the key and shape reference.3. Use `useLocalization()` in UI components for messages and the active locale.4. Use `formatters.ts` for locale-aware dates, numbers, counts, and interpolation.5. Add display-only metric aliases in `metric-localization.ts`; keep report
   parsing, calculations, and stored values locale-neutral.6. Add the language to `Locale`, the persisted preference validation, and the
   reusable `LocaleSwitcher` if a new language is introduced.

Translation keys belong to the interface, not feature modules. Components should
not import locale dictionaries directly, and parsing/calculation utilities
should not depend on the localization provider.

## Checking translation completeness

Before submitting localization changes, run the locale completeness check.
It compares every locale with the English catalog and reports both missing
and extra translation keys.
