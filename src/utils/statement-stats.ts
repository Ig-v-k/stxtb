import type { StatementPeriod, StatementPosition, StatementStatistic } from './imported-files';
import { normalizeMetricId } from '../i18n/metric-localization';

const ACCOUNT_CURRENCIES = 'USD|EUR|GBP|RUB|PLN|CZK|HUF|CHF|JPY|CAD|AUD|HKD|USDT';
const NUMBER_SOURCE = String.raw`[-+]?(?:\d{1,3}(?:[ \u00a0\u202f,.'’]\d{3})+|\d+)(?:[.,]\d+)?`;
const MONEY_PATTERN = new RegExp(
  String.raw`(?:\b(?:${ACCOUNT_CURRENCIES})\s*${NUMBER_SOURCE}|${NUMBER_SOURCE}\s*\b(?:${ACCOUNT_CURRENCIES})\b|[$€£₽]\s*${NUMBER_SOURCE}|${NUMBER_SOURCE}\s*[$€£₽])`,
  'i'
);
const ISIN_PATTERN = /\b[A-Z]{2}[A-Z0-9]{10}\b/gi;

const LEGACY_STATISTIC_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Стоимость счета',
    pattern: /\b(net (?:asset|account|liquidation) value|equity|account value)\b|стоимость счета|чистая стоимость/i,
  },
  {
    label: 'Баланс',
    pattern: /\b(cash balance|closing balance|ending balance|account balance|balance)\b|баланс|остаток/i,
  },
  {
    label: 'Прибыль / убыток',
    pattern: /\b(realized|unrealized)?\s*(profit|loss|result|p\s*\/?\s*l|pnl)\b|\bzysk\b|\bstrata\b|\bwynik\b|прибыл[ьи]|убыток|результат/i,
  },
  {
    label: 'Пополнения',
    pattern: /\b(deposits?|top[\s-]?ups?|transfers?\s+in)\b|пополнени[яе]|внесени[ея]/i,
  },
  {
    label: 'Выводы',
    pattern: /\b(withdrawals?|transfers?\s+out)\b|вывод[ыа]|сняти[ея]/i,
  },
  {
    label: 'Комиссии',
    pattern: /\b(commissions?|fees?)\b|комисси[яи]|сбор[ыа]/i,
  },
  {
    label: 'Дивиденды',
    pattern: /\bdividends?\b|дивиденд[ыа]/i,
  },
  {
    label: 'Свопы',
    pattern: /\bswaps?\b|своп[ыа]/i,
  },
];

export type ParsedStatement = {
  period: StatementPeriod | null;
  periodConflict: boolean;
  statistics: StatementStatistic[];
  accountCurrency?: string;
  positions: StatementPosition[];
  hasOtherAssets?: boolean;
};

export function parsePeriodDate(value: string) {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const localMatch = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(trimmed);
  const year = Number(isoMatch?.[1] ?? localMatch?.[3]);
  const month = Number(isoMatch?.[2] ?? localMatch?.[2]);
  const day = Number(isoMatch?.[3] ?? localMatch?.[1]);
  if (!isoMatch && !localMatch) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}

export function createStatementPeriod(start: string, end: string): StatementPeriod | null {
  const parsedStart = parsePeriodDate(start);
  const parsedEnd = parsePeriodDate(end);
  if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
    return null;
  }

  return { kind: 'range', start: parsedStart, end: parsedEnd, source: 'manual' };
}

function parseDateRange(first: string, second: string): StatementPeriod | null {
  const start = parsePeriodDate(first);
  const end = parsePeriodDate(second);
  if (!start || !end || start > end) {
    return null;
  }
  return { kind: 'range', start, end, source: 'pdf' };
}

function findFilenamePeriod(fileName: string): StatementPeriod | null {
  const yearFirst = /(20\d{2})[-_ ]?Q([1-4])/i.exec(fileName);
  const quarterFirst = /Q([1-4])[-_ ]?(20\d{2})/i.exec(fileName);
  const year = Number(yearFirst?.[1] ?? quarterFirst?.[2]);
  const quarter = Number(yearFirst?.[2] ?? quarterFirst?.[1]);
  if (!year || !quarter) {
    return null;
  }

  const month = (quarter - 1) * 3 + 1;
  const start = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month + 2, 0));
  const end = `${year}-${(month + 2).toString().padStart(2, '0')}-${endDate
    .getUTCDate()
    .toString()
    .padStart(2, '0')}`;
  return { kind: 'range', start, end, source: 'filename' };
}

function periodsMatch(first: StatementPeriod, second: StatementPeriod) {
  if (first.kind !== second.kind) {
    return false;
  }
  if (first.kind === 'all-time' || second.kind === 'all-time') {
    return first.kind === 'all-time' && second.kind === 'all-time';
  }
  return first.start === second.start && first.end === second.end;
}

function findStatementPeriod(text: string, fileName?: string) {
  const filenamePeriod = fileName ? findFilenamePeriod(fileName) : null;
  let pdfPeriod: StatementPeriod | null = null;
  if (
    /all[\s-]+time|since (?:the )?account opening|за всё время|за все время|с момента открытия|od początku|od otwarcia/i.test(
      text
    )
  ) {
    pdfPeriod = { kind: 'all-time', source: 'pdf' };
  }

  const datePattern = String.raw`(?:\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{1,2}-\d{1,2})`;
  const rangePattern = new RegExp(
    String.raw`(${datePattern})\s*(?:-|–|—|\bto\b|\bdo\b)\s*(${datePattern})`,
    'gi'
  );
  const ranges = Array.from(text.matchAll(rangePattern));
  const anchoredRange = ranges.find((match) => {
    const start = match.index ?? 0;
    const context = text.slice(Math.max(0, start - 120), start + match[0].length + 40);
    return /okres|period|kwartal|quarter|zestawienie|report/i.test(context);
  });
  const range = anchoredRange ?? (ranges.length === 1 ? ranges[0] : undefined);
  if (!pdfPeriod && range) {
    pdfPeriod = parseDateRange(range[1], range[2]);
  }

  if (pdfPeriod) {
    return {
      period: pdfPeriod,
      conflict: filenamePeriod !== null && !periodsMatch(pdfPeriod, filenamePeriod),
    };
  }

  return {
    period: filenamePeriod,
    conflict: false,
  };
}

export function parseStatisticNumber(value: string) {
  const trimmed = value.trim();
  const parenthesizedNegative = /^\(.*\)$/.test(trimmed);
  let numeric = trimmed.replace(/[^\d,.'’+-]/g, '').replace(/[’']/g, '');
  if (!/\d/.test(numeric)) {
    return null;
  }

  const commaIndex = numeric.lastIndexOf(',');
  const dotIndex = numeric.lastIndexOf('.');
  const decimalIndex = Math.max(commaIndex, dotIndex);
  const hasBothSeparators = commaIndex >= 0 && dotIndex >= 0;
  const trailingDigits = decimalIndex < 0 ? 0 : numeric.length - decimalIndex - 1;
  if (hasBothSeparators || (decimalIndex >= 0 && trailingDigits > 0 && trailingDigits <= 2)) {
    const decimalSeparator = numeric[decimalIndex];
    numeric = numeric
      .split('')
      .filter((character, index) => {
        return character === '+' || character === '-' || /\d/.test(character) || index === decimalIndex;
      })
      .join('')
      .replace(decimalSeparator, '.');
  } else {
    numeric = numeric.replace(/[.,]/g, '');
  }

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parenthesizedNegative ? -Math.abs(parsed) : parsed;
}

function normalizeText(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function findNumbers(value: string) {
  return Array.from(value.matchAll(new RegExp(NUMBER_SOURCE, 'g')));
}

function findAccountSummary(text: string) {
  const sectionStart = text.search(/imię i nazwisko|waluta rachunku/i);
  if (sectionStart < 0) {
    return {
      statistics: [] as StatementStatistic[],
      accountCurrency: undefined,
    };
  }

  const sectionEndCandidates = [
    text.indexOf('Instrumenty OMI', sectionStart),
    text.indexOf('Kwartalne zestawienie', sectionStart),
  ].filter((index) => index >= 0);
  const sectionEnd = sectionEndCandidates.length
    ? Math.min(...sectionEndCandidates)
    : text.length;
  const section = text.slice(sectionStart, sectionEnd);
  const currencyLabel = /waluta rachunku/i.exec(section);
  if (!currencyLabel) {
    return {
      statistics: [] as StatementStatistic[],
      accountCurrency: undefined,
    };
  }

  const afterCurrencyLabel = section.slice(currencyLabel.index + currencyLabel[0].length);
  const currencyMatch = new RegExp(String.raw`\b(${ACCOUNT_CURRENCIES})\b`, 'i').exec(
    afterCurrencyLabel
  );
  if (!currencyMatch) {
    return {
      statistics: [] as StatementStatistic[],
      accountCurrency: undefined,
    };
  }

  const accountCurrency = currencyMatch[1].toUpperCase();
  const valuesText = afterCurrencyLabel.slice(currencyMatch.index + currencyMatch[0].length);
  const values = findNumbers(valuesText).map((match) => match[0]);
  if (values.length === 0) {
    return {
      statistics: [],
      accountCurrency,
    };
  }

  const labels = [
    ['Баланс', values[0]],
    ['Стоимость счета', values[1]],
    ['Обеспечение', values[2]],
    ['Свободные средства', values[3]],
  ].slice(0, values.length);

  return {
    accountCurrency,
    statistics: labels.map(([label, value]) => ({ label, value })),
  };
}

function parsePositions(text: string, accountCurrency?: string): StatementPosition[] {
  const flatText = normalizeWhitespace(text);
  const matches = Array.from(flatText.matchAll(ISIN_PATTERN));
  const positions: StatementPosition[] = [];
  const seenIsins = new Set<string>();

  for (const [index, isinMatch] of matches.entries()) {
    const isin = isinMatch[0].toUpperCase();
    if (seenIsins.has(isin) || isinMatch.index === undefined) {
      continue;
    }

    const previousMatch = matches[index - 1];
    const prefixStart = previousMatch
      ? previousMatch.index! + previousMatch[0].length
      : 0;
    const prefix = flatText.slice(prefixStart, isinMatch.index);
    const rowStart = /(?:^|\s)(\d{1,3})\s+([A-Z0-9][A-Z0-9._-]{0,19})\s+([\s\S]*)$/.exec(
      prefix
    );
    if (!rowStart) {
      continue;
    }

    const suffixStart = isinMatch.index + isinMatch[0].length;
    const nextMatch = matches[index + 1];
    const suffix = flatText.slice(
      suffixStart,
      nextMatch?.index ?? flatText.length
    );
    const moneyMatch = MONEY_PATTERN.exec(suffix);
    let assetClass = '';
    let marketValue = '';
    let volume = '';

    if (moneyMatch && moneyMatch.index !== undefined) {
      assetClass = suffix.slice(0, moneyMatch.index);
      marketValue = normalizeWhitespace(moneyMatch[0]);
      const afterMarketValue = suffix.slice(moneyMatch.index + moneyMatch[0].length);
      volume = findNumbers(afterMarketValue)[0]?.[0] ?? '';
    } else {
      const values = findNumbers(suffix);
      if (values.length >= 2 && values[0].index !== undefined) {
        assetClass = suffix.slice(0, values[0].index);
        marketValue = `${values[0][0]}${accountCurrency ? ` ${accountCurrency}` : ''}`;
        volume = values[1][0];
      } else {
        assetClass = suffix;
      }
    }

    assetClass = normalizeWhitespace(
      assetClass.replace(/Klasa aktywów|Wartość rynkowa|Wolumen/gi, ' ')
    );
    const instrumentName = normalizeWhitespace(
      rowStart[3].replace(/Nr|Symbol|Nazwa instrumentu|ISIN/gi, ' ')
    );
    if (!instrumentName) {
      continue;
    }

    positions.push({
      number: rowStart[1],
      symbol: rowStart[2],
      instrumentName,
      isin,
      assetClass,
      marketValue,
      volume,
    });
    seenIsins.add(isin);
  }

  return positions;
}

function parseLegacyStatistics(text: string): StatementStatistic[] {
  const lines = text.split(/\r?\n/);
  const found = new Map<string, StatementStatistic>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      continue;
    }

    for (const statistic of LEGACY_STATISTIC_PATTERNS) {
      if (found.has(statistic.label) || !statistic.pattern.test(line)) {
        continue;
      }

      const nextLine = lines[index + 1]?.trim() ?? '';
      const amountOnNextLine =
        /^(?:(?:[$€£₽]|USD|EUR|GBP|RUB|PLN|CZK|HUF|CHF|JPY|CAD|AUD|HKD|USDT)\s*)?[-+]?\d[\d\u00a0\s,.'’]*(?:\s*(?:USD|EUR|GBP|RUB|PLN|CZK|HUF|CHF|JPY|CAD|AUD|HKD|USDT|[$€£₽]))?$/iu.test(
          nextLine
        );
      const value =
        MONEY_PATTERN.exec(line)?.[0] ??
        (amountOnNextLine ? MONEY_PATTERN.exec(nextLine)?.[0] : undefined) ??
        line.match(/[-+]?\d(?:[\d\u00a0\s,.'’]*\d)?(?:[,.]\d{1,2})?/)?.[0] ??
        (amountOnNextLine
          ? nextLine.match(/[-+]?\d(?:[\d\u00a0\s,.'’]*\d)?(?:[,.]\d{1,2})?/)?.[0]
          : undefined);

      if (value) {
        found.set(statistic.label, { id: normalizeMetricId(statistic.label), label: statistic.label, value: normalizeWhitespace(value) });
      }
    }
  }

  return Array.from(found.values());
}

export function parseStatement(text: string, fileName?: string): ParsedStatement {
  const normalizedText = normalizeText(text);
  const detectedPeriod = findStatementPeriod(normalizedText, fileName);
  const summary = findAccountSummary(normalizedText);
  const statistics = new Map<string, StatementStatistic>();

  for (const statistic of summary.statistics) {
    statistics.set(statistic.label, statistic);
  }
  for (const statistic of parseLegacyStatistics(normalizedText)) {
    if (!statistics.has(statistic.label)) {
      statistics.set(statistic.label, statistic);
    }
  }

  return {
    period: detectedPeriod.period,
    periodConflict: detectedPeriod.conflict,
    statistics: Array.from(statistics.values()),
    accountCurrency: summary.accountCurrency,
    positions: parsePositions(normalizedText, summary.accountCurrency),
    hasOtherAssets: /Brak innych aktywów/i.test(normalizedText) ? false : undefined,
  };
}
