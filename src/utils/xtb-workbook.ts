import * as XLSX from '@e965/xlsx';

import type { ImportedReport, StatementPeriod, StatementPosition, StatementStatistic } from './imported-files';
import { parsePeriodDate, parseStatisticNumber } from './statement-stats';

type Cell = string | number | boolean | Date | null | undefined;
type Row = Cell[];
type Table = { headers: string[]; rows: Row[] };
type Trade = { profit: number; purchaseValue: number | null };

const DAY_MS = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const ACCOUNT_CURRENCIES = new Set([
  'USD',
  'EUR',
  'GBP',
  'RUB',
  'PLN',
  'CZK',
  'HUF',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'HKD',
  'USDT',
]);

function normalize(value: Cell) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase();
}

function getTable(rows: Row[], requiredHeaders: string[]): Table | null {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalize);
    return requiredHeaders.every((header) => headers.includes(header.toLowerCase()));
  });
  if (headerIndex < 0) {
    return null;
  }

  return {
    headers: rows[headerIndex].map((cell) => String(cell ?? '').trim()),
    rows: rows.slice(headerIndex + 1),
  };
}

function getColumnIndex(headers: string[], ...names: string[]) {
  const normalizedHeaders = headers.map((header) => normalize(header));
  return normalizedHeaders.findIndex((header) =>
    names.some((name) => header === name.toLowerCase())
  );
}

function getCell(row: Row, headers: string[], ...names: string[]): Cell {
  const index = getColumnIndex(headers, ...names);
  return index < 0 ? undefined : row[index];
}

function toNumber(value: Cell) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    return parseStatisticNumber(value);
  }
  return null;
}

function toDate(value: Cell) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(EXCEL_EPOCH + Math.floor(value) * DAY_MS).toISOString().slice(0, 10);
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return parsePeriodDate(value) ?? null;
  }
  return null;
}

function findPeriod(sheets: Row[][]): StatementPeriod | null {
  let start: string | null = null;
  let end: string | null = null;

  for (const rows of sheets) {
    for (const row of rows.slice(0, 6)) {
      for (let index = 0; index < row.length - 1; index += 1) {
        const label = normalize(row[index]);
        if (label === 'date from (utc)') {
          start = toDate(row[index + 1]);
        } else if (label === 'date to (utc)') {
          end = toDate(row[index + 1]);
        }
      }
    }
    if (start && end) {
      break;
    }
  }

  return start && end && start <= end
    ? { kind: 'range', start, end, source: 'xlsx' }
    : null;
}

function formatAmount(value: number) {
  return value.toFixed(2).replace('.', ',');
}

function formatMoney(value: number, currency?: string, signed = false) {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    RUB: '₽',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft',
    CHF: 'CHF',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$',
    HKD: 'HK$',
    USDT: '₮',
  };
  const symbol = currency ? symbols[currency.toUpperCase()] ?? currency : '';
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  return `${sign}${symbol}${Math.abs(value).toFixed(2).replace('.', ',')}`;
}

function addStatistic(statistics: StatementStatistic[], label: string, value: string) {
  const existing = statistics.find((item) => item.label === label);
  if (existing) {
    existing.value = value;
  } else {
    statistics.push({ label, value });
  }
}

function sumColumn(rows: Row[], headers: string[], ...names: string[]) {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const value = toNumber(getCell(row, headers, ...names));
    if (value !== null) {
      total += value;
      count += 1;
    }
  }
  return count ? total : null;
}

function getClosedTrades(table: Table | null): Trade[] {
  if (!table) {
    return [];
  }

  return table.rows.flatMap((row) => {
    const ticker = getCell(row, table.headers, 'Ticker');
    const profit = toNumber(getCell(row, table.headers, 'Profit/Loss'));
    if (!ticker || profit === null) {
      return [];
    }
    return [{
      profit,
      purchaseValue: toNumber(getCell(row, table.headers, 'Purchase Value')),
    }];
  });
}

function addTradeMetrics(
  statistics: StatementStatistic[],
  trades: Trade[],
  currency?: string
) {
  addStatistic(statistics, 'Закрытых сделок', String(trades.length));
  if (trades.length === 0) {
    const noTrades = '— (нет закрытых сделок за период)';
    addStatistic(statistics, 'Win Rate', noTrades);
    addStatistic(statistics, 'Profit Factor', noTrades);
    addStatistic(statistics, 'Payoff Ratio', noTrades);
    addStatistic(statistics, 'Expectancy', noTrades);
    return;
  }

  const winners = trades.filter((trade) => trade.profit > 0);
  const losers = trades.filter((trade) => trade.profit < 0);
  const winningTotal = winners.reduce((sum, trade) => sum + trade.profit, 0);
  const losingTotal = losers.reduce((sum, trade) => sum + Math.abs(trade.profit), 0);
  const winRate = (winners.length / trades.length) * 100;
  const profitFactor =
    losingTotal > 0
      ? formatAmount(winningTotal / losingTotal)
      : winners.length > 0
        ? '∞ (нет убыточных сделок)'
        : '— (нет прибыльных сделок)';
  const payoffRatio =
    winners.length > 0 && losers.length > 0
      ? formatAmount((winningTotal / winners.length) / (losingTotal / losers.length))
      : '— (нужны прибыльные и убыточные сделки)';
  const expectancy = trades.reduce((sum, trade) => sum + trade.profit, 0) / trades.length;

  addStatistic(statistics, 'Win Rate', `${formatAmount(winRate)}%`);
  addStatistic(statistics, 'Profit Factor', profitFactor);
  addStatistic(statistics, 'Payoff Ratio', payoffRatio);
  addStatistic(statistics, 'Expectancy', formatMoney(expectancy, currency, true));

  const purchaseValue = trades.reduce(
    (sum, trade) => sum + (trade.purchaseValue ?? 0),
    0
  );
  const allPurchaseValuesAvailable = trades.every((trade) => trade.purchaseValue !== null);
  if (allPurchaseValuesAvailable && purchaseValue > 0) {
    addStatistic(
      statistics,
      'Realized PnL (%)',
      `${formatAmount((trades.reduce((sum, trade) => sum + trade.profit, 0) / purchaseValue) * 100)}%`
    );
  }
}

function getXtbSheetRows(workbook: XLSX.WorkBook) {
  const rowsByName = new Map<string, Row[]>();
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (sheet) {
      rowsByName.set(
        name.trim().toLowerCase(),
        XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, raw: true, defval: '' })
      );
    }
  }
  return rowsByName;
}

export function parseXtbWorkbook(
  bytes: Uint8Array,
  name: string,
  size: number | null
): ImportedReport {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
  } catch {
    throw new Error('Не удалось прочитать XLSX. Проверьте, что это не поврежденный файл.');
  }

  const rowsByName = getXtbSheetRows(workbook);
  const closedRows = rowsByName.get('closed positions') ?? [];
  const cashRows = rowsByName.get('cash operations') ?? [];
  const openRows = rowsByName.get('open positions') ?? [];
  const period = findPeriod([closedRows, cashRows, openRows]);
  const closedTable = getTable(closedRows, ['Ticker', 'Profit/Loss']);
  const cashTable = getTable(cashRows, ['Type', 'Amount']);
  const openPositionTable = getTable(openRows, [
    'Instrument/Position',
    'Ticker',
    'Value',
  ]);
  const openSummaryTable = getTable(openRows, ['Metric', 'Amount', 'Currency']);

  if (!closedTable && !cashTable && !openPositionTable && !openSummaryTable) {
    throw new Error('В XLSX не найдены листы или таблицы формата «История операций» XTB.');
  }

  const statistics: StatementStatistic[] = [];
  const currenciesByProduct = new Map<string, Set<string>>();
  const openValueByCurrency = new Map<string, number>();
  const openProfitByCurrency = new Map<string, number>();

  if (openSummaryTable) {
    for (const row of openSummaryTable.rows) {
      const metric = normalize(getCell(row, openSummaryTable.headers, 'Metric'));
      const amount = toNumber(getCell(row, openSummaryTable.headers, 'Amount'));
      const currency = String(getCell(row, openSummaryTable.headers, 'Currency') ?? '')
        .trim()
        .toUpperCase();
      const product = String(getCell(row, openSummaryTable.headers, 'Product') ?? '').trim();
      if (amount === null || !currency || !product) {
        continue;
      }

      const productCurrencies = currenciesByProduct.get(product) ?? new Set<string>();
      productCurrencies.add(currency);
      currenciesByProduct.set(product, productCurrencies);
      if (metric === 'open position value') {
        openValueByCurrency.set(
          currency,
          (openValueByCurrency.get(currency) ?? 0) + amount
        );
      } else if (metric === 'open position profit') {
        openProfitByCurrency.set(
          currency,
          (openProfitByCurrency.get(currency) ?? 0) + amount
        );
      }
    }
  }

  const currencies = new Set([
    ...openValueByCurrency.keys(),
    ...openProfitByCurrency.keys(),
  ]);
  const fileCurrency = /^([A-Z]{3,4})_/i.exec(name)?.[1]?.toUpperCase();
  const accountCurrency =
    currencies.size === 1
      ? Array.from(currencies)[0]
      : currencies.size === 0 && fileCurrency && ACCOUNT_CURRENCIES.has(fileCurrency)
        ? fileCurrency
        : undefined;
  const positions: StatementPosition[] = [];
  if (openPositionTable) {
    for (const row of openPositionTable.rows) {
      const ticker = String(getCell(row, openPositionTable.headers, 'Ticker') ?? '').trim();
      const type = String(getCell(row, openPositionTable.headers, 'Type') ?? '').trim();
      const value = toNumber(getCell(row, openPositionTable.headers, 'Value'));
      const volume = toNumber(getCell(row, openPositionTable.headers, 'Volume'));
      const product = String(getCell(row, openPositionTable.headers, 'Product') ?? '').trim();
      if (!ticker || type || value === null) {
        continue;
      }

      const productCurrencies = currenciesByProduct.get(product);
      const currency =
        productCurrencies?.size === 1
          ? Array.from(productCurrencies)[0]
          : productCurrencies === undefined && currencies.size === 0
            ? accountCurrency
            : undefined;
      positions.push({
        number: String(positions.length + 1),
        symbol: ticker,
        instrumentName: String(
          getCell(row, openPositionTable.headers, 'Instrument/Position') ?? ticker
        ).trim(),
        isin: '',
        assetClass: String(getCell(row, openPositionTable.headers, 'Category') ?? '').trim(),
        marketValue: formatMoney(value, currency),
        volume: volume === null ? '' : formatAmount(volume),
      });
    }
  }

  if (currencies.size === 1) {
    const currency = Array.from(currencies)[0];
    const openValue = openValueByCurrency.get(currency);
    const openProfit = openProfitByCurrency.get(currency);
    if (openValue !== undefined) {
      addStatistic(
        statistics,
        'Стоимость открытых позиций',
        formatMoney(openValue, currency)
      );
    }
    if (openProfit !== undefined) {
      addStatistic(statistics, 'Unrealized PnL', formatMoney(openProfit, currency, true));
      const costBasis = openValue === undefined ? null : openValue - openProfit;
      addStatistic(
        statistics,
        'Unrealized PnL (%)',
        costBasis !== null && costBasis > 0
          ? `${formatAmount((openProfit / costBasis) * 100)}%`
          : '— (нет стоимости приобретения)'
      );
    }
  }

  const trades = getClosedTrades(closedTable);
  addTradeMetrics(statistics, trades, accountCurrency);
  if (trades.length > 0) {
    const realizedProfit = trades.reduce((sum, trade) => sum + trade.profit, 0);
    addStatistic(
      statistics,
      'Realized PnL',
      formatMoney(realizedProfit, accountCurrency, true)
    );
    addStatistic(statistics, 'Прибыль / убыток', formatMoney(realizedProfit, accountCurrency, true));
  }

  if (cashTable) {
    const operationTotals = new Map<string, number>();
    let totalIncome = 0;
    let tradedValue = 0;
    for (const row of cashTable.rows) {
      const type = String(getCell(row, cashTable.headers, 'Type') ?? '').trim();
      const amount = toNumber(getCell(row, cashTable.headers, 'Amount'));
      if (!type || amount === null) {
        continue;
      }

      const normalizedType = normalize(type);
      const label =
        /dividend|дивиденд/.test(normalizedType)
          ? 'Дивиденды'
          : /withholding tax|interest tax|tax|налог/.test(normalizedType)
            ? 'Налоги'
            : /free funds interest|interest|процент/.test(normalizedType)
              ? 'Проценты на свободные средства'
              : /commission|fee|sec fee|stamp duty|комисси|сбор/.test(normalizedType)
                ? 'Комиссии'
                : /deposit|top.?up|transfer in|пополн|внесени/.test(normalizedType)
                  ? 'Пополнения'
                  : /withdraw|transfer out|вывод|сняти/.test(normalizedType)
                    ? 'Выводы'
                    : /swap|rollover|своп/.test(normalizedType)
                      ? 'Свопы'
                      : null;
      if (label) {
        operationTotals.set(label, (operationTotals.get(label) ?? 0) + amount);
      }
      if (/^(?:dividend|free funds interest|interest)$/.test(normalizedType)) {
        totalIncome += amount;
      }
      if (/^(?:stock purchase|stock sell)$/.test(normalizedType)) {
        tradedValue += Math.abs(amount);
      }
    }

    for (const [label, amount] of operationTotals) {
      addStatistic(statistics, label, formatMoney(amount, accountCurrency));
    }
    addStatistic(statistics, 'Общий доход', formatMoney(totalIncome, accountCurrency));
    addStatistic(statistics, 'Объем сделок', formatMoney(tradedValue, accountCurrency));
  }

  if (closedTable) {
    const commission = sumColumn(closedTable.rows, closedTable.headers, 'Commission');
    const swaps =
      sumColumn(closedTable.rows, closedTable.headers, 'Swap') ?? 0;
    const rollover =
      sumColumn(closedTable.rows, closedTable.headers, 'Rollover') ?? 0;
    if (commission !== null) {
      const previousCommission = toNumber(
        statistics.find((item) => item.label === 'Комиссии')?.value
      );
      addStatistic(
        statistics,
        'Комиссии',
        formatMoney(
          -(Math.abs(previousCommission ?? 0) + Math.abs(commission)),
          accountCurrency
        )
      );
    }
    if (swaps !== 0 || rollover !== 0) {
      const previousSwaps = toNumber(
        statistics.find((item) => item.label === 'Свопы')?.value
      );
      addStatistic(
        statistics,
        'Свопы',
        formatMoney((previousSwaps ?? 0) + swaps + rollover, accountCurrency)
      );
    }
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    size,
    period,
    statistics,
    accountCurrency,
    positions,
    analysisError:
      !period && statistics.length === 0 && positions.length === 0
        ? 'В файле не найден период, денежные операции или открытые позиции.'
        : undefined,
  };
}
