import type { StatementPosition, StatementStatistic } from './imported-files';

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
    pattern: /\b(realized|unrealized)?\s*(profit|loss|result|p\s*\/?\s*l|pnl)\b|прибыл[ьи]|убыток|результат/i,
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
  statistics: StatementStatistic[];
  accountCurrency?: string;
  positions: StatementPosition[];
  hasOtherAssets?: boolean;
};

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
        found.set(statistic.label, { label: statistic.label, value: normalizeWhitespace(value) });
      }
    }
  }

  return Array.from(found.values());
}

export function parseStatement(text: string): ParsedStatement {
  const normalizedText = normalizeText(text);
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
    statistics: Array.from(statistics.values()),
    accountCurrency: summary.accountCurrency,
    positions: parsePositions(normalizedText, summary.accountCurrency),
    hasOtherAssets: /Brak innych aktywów/i.test(normalizedText) ? false : undefined,
  };
}
