import type { Locale } from './provider';
import { getMessages } from './translations';

const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  pl: 'pl-PL',
};

export function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string, locale: Locale) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatReportPeriod(
  period: { kind: 'range'; start: string; end: string } | { kind: 'all-time' } | null,
  locale: Locale
) {
  const messages = getMessages(locale);
  if (!period) return messages.imports.periodUnknown;
  if (period.kind === 'all-time') return messages.imports.allTime;
  return `${formatDate(period.start, locale)} – ${formatDate(period.end, locale)}`;
}

export function formatReportCount(count: number, locale: Locale) {
  const messages = getMessages(locale);
  let label: string;
  if (locale === 'en') {
    label = count === 1 ? messages.common.report : messages.common.reports;
  } else {
    const lastTwoDigits = count % 100;
    const lastDigit = count % 10;
    if (lastDigit === 1 && lastTwoDigits !== 11) {
      label = messages.common.report;
    } else if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
      label = messages.common.reportsFew;
    } else {
      label = messages.common.reports;
    }
  }
  return interpolate(messages.imports.reportCount, {
    count: formatNumber(count, locale),
    label,
  });
}

export function interpolate(
  template: string,
  values: Record<string, string | number>
) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  );
}
