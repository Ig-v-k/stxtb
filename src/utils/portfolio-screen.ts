import type { BenchmarkData } from './benchmark-data';
import {
  isMetricValueAvailable,
  type ImportedReport,
  type StatementPosition,
} from './imported-files';
import {
  getBenchmarkMetrics,
  getDynamicMetrics,
  type Metric,
} from './portfolio-metrics';
import { parseStatisticNumber } from './statement-stats';

export const SHORT_METRIC_LABELS: Record<string, string> = {
  'Стоимость счета': 'Счёт',
  'Стоимость счёта': 'Счёт',
  'Account Value': 'Счёт',
  'Net Asset Value': 'Счёт',
  Equity: 'Счёт',
  'Unrealized PnL': 'Откр. результат',
  'Unrealized PnL (%)': 'Откр. результат %',
  'Realized PnL': 'Closed P&L',
  'Realized PnL (%)': 'Closed P&L %',
  'Стоимость открытых позиций': 'Откр. позиции',
  'Закрытых сделок': 'Сделки',
  'Свободные средства': 'Св. средства',
  Обеспечение: 'Обеспечение',
  'Прибыль / убыток': 'P&L',
  Дивиденды: 'Дивиденды',
  'Проценты на свободные средства': 'Проц. св. ср-в',
  'Общий доход': 'Доход',
  'Объем сделок': 'Оборот',
  Пополнения: 'Пополнения',
  Комиссии: 'Комиссии',
  'Изменение счёта': 'Δ счёта',
  'Стоимость бумаг': 'Бумаги',
  'Доля бумаг в счёте': 'Бумаги / счёт',
  Оценено: 'Оценено',
  'Эфф. позиций': 'Эфф. поз.',
  'Топ-3 (доля счёта)': 'Топ-3 счёта, %',
  'Топ-3 (доля бумаг)': 'Топ-3 бумаг, %',
  'Топ-1 (доля счёта)': 'Топ-1 счёта, %',
  'Топ-1 (доля бумаг)': 'Топ-1 бумаг, %',
  'Топ-5 (доля счёта)': 'Топ-5 счёта, %',
  'Топ-5 (доля бумаг)': 'Топ-5 бумаг, %',
  'Без оценки': 'Без цены',
  'Периодов с денежными потоками': 'Периоды',
  'Cumulative Return (TWR)': 'Доходность TWR',
  'Annualized Return': 'Год. доходность',
  'Стандартное отклонение (год.)': 'σ (год.)',
  'Downside Deviation (год.)': 'Downside σ год.',
  'Max Drawdown': 'Макс. просадка',
  'Drawdown Duration': 'DD (дни)',
  'Sharpe (безрисковая ставка 0%)': 'Sharpe (Rf 0%)',
  'Sortino (целевая доходность 0%)': 'Sortino (0%)',
  'Omega (порог 0%)': 'Omega (0%)',
  'Снимков портфеля': 'Снимки стоимости',
  'Tracking Error': 'TE',
  'Information Ratio': 'IR',
  'Upside/Downside Capture': 'Capture ↑/↓',
  'Jensen’s Alpha': 'Jensen α',
  'Alpha Fama–French': 'F-F α',
  'Brinson Allocation': 'Brinson Alloc.',
  'Brinson Selection': 'Brinson Sel.',
  'Бенчмарк (FRED)': 'Бенчмарк',
  'Contribution to Return': 'Вклад в доход',
  'Yield on Cost': 'YoC',
  'Текущая дивидендная доходность': 'Див. доходн.',
  'Секторная экспозиция': 'Сектор',
  'Страновая экспозиция': 'Страна',
  'Валютная экспозиция': 'Валюта',
  'Win Rate': 'Win %',
  'Profit Factor': 'Фактор прибыли',
  'Payoff Ratio': 'Payoff',
  Expectancy: 'Среднее на сделку',
  'Turnover Rate': 'Оборот',
  'Fee / Tax Drag': 'Комис./налог',
  'Средневзвешенный P/E': 'Взвеш. P/E',
  'Средневзвешенный P/S': 'Взвеш. P/S',
  'Средневзвешенный P/B': 'Взвеш. P/B',
  'Средневзвешенный EV/EBITDA': 'Взвеш. EV/EBITDA',
  'Средневзвешенный ROE': 'Взвеш. ROE',
  'Средневзвешенный Debt/Equity': 'Взвеш. D/E',
  'MWR / XIRR': 'MWR (XIRR)',
  'VaR 95% (период)': 'VaR 95%',
  'CVaR 95% (период)': 'CVaR 95%',
};

const PRIMARY_METRIC_PATTERNS = [
  /^(?:Снимков портфеля|Периодов с денежными потоками)$/i,
  /^(?:Стоимость сч[её]та|Account Value|Net Asset Value|Equity)$/i,
  /^(?:Cumulative Return \(TWR\)|Annualized Return|CAGR)$/i,
  /^Max Drawdown$/i,
  /^Топ-3 \(доля (?:счёта|бумаг)\)$/i,
  /^Unrealized PnL \(%\)$/i,
  /^Unrealized PnL$/i,
  /^Profit Factor$/i,
  /^Закрытых сделок$/i,
  /^Expectancy$/i,
];

const METRIC_DESCRIPTIONS: Record<string, string> = {
  'Стоимость счета': 'Текущая стоимость счета с учетом денежных средств и открытых позиций.',
  'Стоимость счёта': 'Текущая стоимость счета с учетом денежных средств и открытых позиций.',
  'Account Value': 'Текущая стоимость счета с учетом денежных средств и открытых позиций.',
  'Net Asset Value': 'Стоимость активов за вычетом обязательств по счету.',
  Equity: 'Текущая стоимость средств на счете с учетом открытых позиций.',
  Баланс: 'Денежный баланс счета без учета текущего результата открытых позиций.',
  'Свободные средства': 'Средства, доступные для новых операций после учета обеспечения.',
  Обеспечение: 'Средства, зарезервированные брокером для поддержания открытых позиций.',
  'Изменение счёта': 'Изменение стоимости счета относительно предыдущего отчета.',
  'Прибыль / убыток': 'Прибыль или убыток за отчетный период.',
  Дивиденды: 'Сумма полученных дивидендов за отчетный период.',
  Пополнения: 'Сумма денежных средств, внесенных на счет за отчетный период.',
  Выводы: 'Сумма денежных средств, выведенных со счета за отчетный период.',
  Комиссии: 'Комиссии, удержанные за отчетный период.',
  Свопы: 'Начисления или списания за перенос открытых позиций.',
  'Unrealized PnL': 'Текущая прибыль или убыток по еще не закрытым позициям.',
  'Unrealized PnL (%)': 'Нереализованный результат по открытым позициям в процентах.',
  'Realized PnL': 'Прибыль или убыток по закрытым позициям.',
  'Realized PnL (%)': 'Результат по закрытым позициям в процентах.',
  'Общий доход': 'Сумма доходов, указанная в отчете за период.',
  'Объем сделок': 'Общая стоимость операций покупки и продажи за период.',
  'Стоимость бумаг': 'Суммарная рыночная стоимость ценных бумаг в портфеле.',
  'Доля бумаг в счёте': 'Какая часть стоимости счета приходится на ценные бумаги.',
  'Топ-3 (доля счёта)': 'Доля трех крупнейших позиций в общей стоимости счета.',
  'Топ-3 (доля бумаг)': 'Доля трех крупнейших позиций в общей стоимости ценных бумаг.',
  'Снимков портфеля': 'Количество отчетов со стоимостью счета, использованных для расчета динамики.',
  'Периодов с денежными потоками': 'Количество периодов, по которым учтены изменения стоимости и денежные потоки.',
  'Cumulative Return (TWR)': 'Совокупная доходность портфеля с поправкой на пополнения и выводы.',
  'Annualized Return': 'Доходность портфеля, пересчитанная на год.',
  'MWR / XIRR': 'Доходность с учетом суммы и времени пополнений и выводов.',
  'Max Drawdown': 'Наибольшее падение стоимости портфеля от предыдущего пика.',
  'Drawdown Duration': 'Продолжительность самого длинного периода восстановления после пика.',
  'Win Rate': 'Доля прибыльных закрытых сделок среди всех закрытых сделок.',
  'Profit Factor': 'Прибыль от выигрышных сделок относительно убытков от проигрышных.',
  'Payoff Ratio': 'Средняя прибыльная сделка относительно средней убыточной.',
  Expectancy: 'Средний ожидаемый результат одной сделки.',
};

export function getMetricDescription(label: string) {
  const description = METRIC_DESCRIPTIONS[label];
  if (description) return description;
  if (/^Доля /.test(label)) return 'Доля стоимости этой позиции в счете или в общей стоимости позиций.';
  if (/^Макс\./.test(label)) return 'Стоимость крупнейшей позиции и ее доля в счете или в общей стоимости позиций.';
  if (/комисс|налог/i.test(label)) return 'Сумма комиссий или налогов, указанная в отчете за период.';
  if (/дивиденд/i.test(label)) return 'Дивидендный показатель, рассчитанный или указанный в отчете.';
  if (/доходност|return|profit|p.?l|прибыл|убыток/i.test(label)) return 'Показатель доходности или финансового результата, указанный в отчете.';
  return 'Дополнительный показатель из отчета XTB; значение приведено по данным отчета.';
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₽': 'RUB',
};

export function formatReportPeriod(report: ImportedReport) {
  if (!report.period) return 'Период не указан';
  if (report.period.kind === 'all-time') return 'За всё время';
  const formatDate = (value: string) => {
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  };
  return `${formatDate(report.period.start)} – ${formatDate(report.period.end)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number, currency?: string) {
  return `${formatNumber(value)}${currency ? ` (${currency})` : ''}`;
}

function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}%`;
}

function formatShare(value: number) {
  return `${formatNumber(value)}%`;
}

function getStatistic(report: ImportedReport, ...labels: string[]) {
  return report.statistics?.find((item) => labels.includes(item.label));
}

function getStatisticMatching(report: ImportedReport, pattern: RegExp) {
  return report.statistics?.find((item) => pattern.test(item.label));
}

function formatStatisticValue(value: string, currency?: string, label?: string) {
  const hasCurrency = /\b(?:USD|EUR|GBP|RUB|PLN|CZK|HUF|CHF|JPY|CAD|AUD|HKD|USDT)\b|[$€£₽]/i.test(value);
  const hasPercent = /%|percent|процент/i.test(value);
  const numericValue = parseStatisticNumber(value);
  const isPercentage = /%|percent|процент|доходност|return|volatility|deviation|drawdown|capture|alpha/i.test(label ?? '');
  const isMonetary = /p.?n.?l|profit|loss|income|dividend|deposit|withdraw|cash|balance|equity|account value|net asset value|collateral|margin|fee|commission|swap|turnover|volume|cost|expectancy|price|amount|tax|стоимост|баланс|прибыл|убыт|доход|дивиденд|пополн|вывод|средств|обеспеч|комис|своп|оборот|объем|налог/i.test(label ?? '');
  if (isPercentage && numericValue !== null && !hasPercent) return `${formatNumber(numericValue)}%`;
  if (numericValue === null || hasCurrency || hasPercent || isPercentage || !isMonetary || !currency) return value;
  return `${value} (${currency})`;
}

function getSourceMetric(report: ImportedReport, label: string, pattern: RegExp, currency?: string, percentage = false): Metric {
  const statistic = getStatisticMatching(report, pattern);
  if (!statistic) return { label, value: '— (нет данных в отчёте)' };
  if (percentage) {
    const value = parseStatisticNumber(statistic.value);
    return { label, value: value === null ? statistic.value : `${formatNumber(value)}${statistic.value.includes('%') ? '' : '%'}` };
  }
  return { label, value: formatStatisticValue(statistic.value, currency, statistic.label) };
}

function getPositionAnalysis(positions: StatementPosition[], accountCurrency?: string, accountValue?: number | null) {
  const valuedPositions = positions.flatMap((position) => {
    const amount = parseStatisticNumber(position.marketValue);
    if (amount === null) return [];
    const symbol = /[$€£₽]/.exec(position.marketValue)?.[0];
    const code = /\b(?:USD|EUR|GBP|RUB|PLN|CZK|HUF|CHF|JPY|CAD|AUD|HKD|USDT)\b/i.exec(position.marketValue)?.[0];
    const currency = code?.toUpperCase() ?? (symbol ? CURRENCY_SYMBOLS[symbol] : accountCurrency);
    return [{ position, amount, currency: currency ?? '' }];
  });
  const currencies = new Set(valuedPositions.map((item) => item.currency));
  const comparable = valuedPositions.length > 0 && currencies.size === 1;
  const total = comparable ? valuedPositions.reduce((sum, item) => sum + item.amount, 0) : null;
  const largest = comparable ? valuedPositions.reduce((first, second) => second.amount > first.amount ? second : first) : null;
  const currency = comparable ? valuedPositions[0].currency || undefined : undefined;
  const portfolioValueForWeight =
    comparable && typeof accountValue === 'number' && accountValue > 0 && currency === accountCurrency
      ? accountValue
      : null;
  const weightTotal = portfolioValueForWeight ?? total;
  const assetClasses = new Set(positions.map((position) => position.assetClass).filter(Boolean));
  const classMetrics: Metric[] = [];
  const concentrationMetrics: Metric[] = [];

  if (comparable && total !== null) {
    const totalsByClass = new Map<string, { amount: number; count: number }>();
    for (const item of valuedPositions) {
      const label = item.position.assetClass || 'Класс не указан';
      const current = totalsByClass.get(label) ?? { amount: 0, count: 0 };
      current.amount += item.amount;
      current.count += 1;
      totalsByClass.set(label, current);
    }
    for (const [label, value] of totalsByClass) {
      classMetrics.push({
        label: `${label} (${value.count})`,
        value: `${formatMoney(value.amount, currency)} · ${total === 0 ? '—' : formatShare((value.amount / total) * 100)}`,
      });
    }
  }
  if (positions.length > 0) {
    concentrationMetrics.push({
      label: 'Оценено',
      value: `${valuedPositions.length}/${positions.length} · ${formatShare((valuedPositions.length / positions.length) * 100)}`,
    });
  }
  if (comparable && valuedPositions.length === positions.length) {
    const grossValue = valuedPositions.reduce((sum, item) => sum + Math.abs(item.amount), 0);
    if (grossValue > 0) {
      const weights = valuedPositions.map((item) => Math.abs(item.amount) / grossValue).sort((first, second) => second - first);
      const shareDenominator = portfolioValueForWeight ?? grossValue;
      const topWeights = valuedPositions.map((item) => Math.abs(item.amount) / shareDenominator).sort((first, second) => second - first);
      const hhi = weights.reduce((sum, weight) => sum + weight ** 2, 0);
      concentrationMetrics.push(
        { label: 'HHI', value: `${formatNumber(hhi * 10_000)} / 10 000` },
        { label: 'Эфф. позиций', value: formatNumber(1 / hhi) },
        { label: portfolioValueForWeight !== null ? 'Топ-3 (доля счёта)' : 'Топ-3 (доля бумаг)', value: formatShare(topWeights.slice(0, 3).reduce((sum, weight) => sum + weight, 0) * 100) },
        { label: portfolioValueForWeight !== null ? 'Топ-1 (доля счёта)' : 'Топ-1 (доля бумаг)', value: formatShare((topWeights[0] ?? 0) * 100) },
        { label: portfolioValueForWeight !== null ? 'Топ-5 (доля счёта)' : 'Топ-5 (доля бумаг)', value: formatShare(topWeights.slice(0, 5).reduce((sum, weight) => sum + weight, 0) * 100) }
      );
      for (const item of valuedPositions) {
        concentrationMetrics.push({
          label: `Доля ${item.position.symbol} (${portfolioValueForWeight !== null ? 'сч.' : 'поз.'})`,
          value: formatShare((Math.abs(item.amount) / shareDenominator) * 100),
        });
      }
    }
  }
  return {
    valuedCount: valuedPositions.length,
    unvaluedCount: positions.length - valuedPositions.length,
    assetClassCount: assetClasses.size,
    total,
    weightTotal,
    weightBasis: portfolioValueForWeight !== null ? 'сч.' : 'поз.',
    currency,
    largest,
    classMetrics,
    concentrationMetrics,
  };
}

function splitPrimaryMetrics(metrics: Metric[]) {
  const primaryMetrics: Metric[] = [];
  const selectedMetrics = new Set<Metric>();
  for (const pattern of PRIMARY_METRIC_PATTERNS) {
    const metric = metrics.find((candidate) => !selectedMetrics.has(candidate) && pattern.test(candidate.label));
    if (metric) {
      primaryMetrics.push(metric);
      selectedMetrics.add(metric);
    }
  }
  return { primaryMetrics, otherMetrics: metrics.filter((metric) => !selectedMetrics.has(metric)) };
}

type BenchmarkState = {
  data: BenchmarkData | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
};

export function buildPortfolioScreenData(
  sortedReports: ImportedReport[],
  latestReport: ImportedReport | undefined,
  benchmarkState: BenchmarkState
) {
  const metricGroups: Metric[][] = [];
  const positions = latestReport?.positions ?? [];

  if (latestReport) {
    const accountValue = getStatistic(latestReport, 'Стоимость счета', 'Баланс');
    const freeFunds = getStatistic(latestReport, 'Свободные средства');
    const accountValueNumber = accountValue ? parseStatisticNumber(accountValue.value) : null;
    const freeFundsNumber = freeFunds ? parseStatisticNumber(freeFunds.value) : null;
    const collateral = getStatistic(latestReport, 'Обеспечение');
    const collateralNumber = collateral ? parseStatisticNumber(collateral.value) : null;
    const latestReportEnd = latestReport.period?.kind === 'range' ? latestReport.period.end : undefined;
    const previousReport = latestReportEnd
      ? sortedReports.find((report) =>
          report.id !== latestReport.id &&
          report.period?.kind === 'range' &&
          report.period.end < latestReportEnd &&
          report.accountCurrency === latestReport.accountCurrency)
      : undefined;
    const previousAccountValue = previousReport
      ? getStatistic(previousReport, 'Стоимость счета', 'Баланс')
      : undefined;
    const previousAccountValueNumber = previousAccountValue
      ? parseStatisticNumber(previousAccountValue.value)
      : null;
    const positionAnalysis = getPositionAnalysis(positions, latestReport.accountCurrency, accountValueNumber);
    const accountMetrics: Metric[] = [];
    const resultMetrics: Metric[] = [];
    const positionMetrics: Metric[] = [];

    if (accountValue) accountMetrics.push({ label: accountValue.label, value: formatStatisticValue(accountValue.value, latestReport.accountCurrency, accountValue.label) });
    for (const label of ['Баланс', 'Свободные средства', 'Обеспечение']) {
      const statistic = getStatistic(latestReport, label);
      if (statistic && statistic !== accountValue) accountMetrics.push({ label: statistic.label, value: formatStatisticValue(statistic.value, latestReport.accountCurrency, statistic.label) });
    }
    if (accountValueNumber !== null && freeFundsNumber !== null && accountValueNumber !== 0) accountMetrics.push({ label: 'Свободные средства', value: formatShare((freeFundsNumber / accountValueNumber) * 100) });
    if (collateralNumber !== null && accountValueNumber !== null && accountValueNumber > 0) accountMetrics.push({ label: 'Обеспечение', value: formatShare((collateralNumber / accountValueNumber) * 100) });

    for (const label of ['Прибыль / убыток', 'Дивиденды', 'Пополнения', 'Выводы', 'Комиссии', 'Свопы']) {
      const statistic = getStatistic(latestReport, label);
      if (statistic) resultMetrics.push({ label: statistic.label, value: formatStatisticValue(statistic.value, latestReport.accountCurrency, statistic.label) });
    }
    if (accountValueNumber !== null && previousAccountValueNumber !== null && previousAccountValueNumber !== 0) {
      const change = accountValueNumber - previousAccountValueNumber;
      resultMetrics.push({
        label: 'Изменение счёта',
        value: `${change > 0 ? '+' : ''}${formatMoney(change, latestReport.accountCurrency)} · ${formatPercent((change / previousAccountValueNumber) * 100)}`,
      });
    }

    if (positions.length) {
      positionMetrics.push({ label: 'Позиции', value: formatNumber(positions.length) });
      if (positionAnalysis.assetClassCount) positionMetrics.push({ label: 'Классы', value: formatNumber(positionAnalysis.assetClassCount) });
      if (positionAnalysis.total !== null) {
        positionMetrics.push({ label: 'Стоимость бумаг', value: formatMoney(positionAnalysis.total, positionAnalysis.currency) });
        if (positionAnalysis.total > 0 && accountValueNumber !== null && accountValueNumber > 0 && positionAnalysis.currency === latestReport.accountCurrency) {
          positionMetrics.push({ label: 'Доля бумаг в счёте', value: formatShare((positionAnalysis.total / accountValueNumber) * 100) });
        }
      } else if (positionAnalysis.valuedCount > 0) {
        positionMetrics.push({ label: 'Стоимость бумаг', value: '— (разные валюты)' });
      }
      if (positionAnalysis.largest && positionAnalysis.weightTotal) {
        positionMetrics.push({
          label: `Макс. ${positionAnalysis.largest.position.symbol} (${positionAnalysis.weightBasis})`,
          value: `${formatMoney(positionAnalysis.largest.amount, positionAnalysis.currency)} · ${formatShare((positionAnalysis.largest.amount / positionAnalysis.weightTotal) * 100)}`,
        });
      }
      if (positionAnalysis.unvaluedCount) positionMetrics.push({ label: 'Без оценки', value: formatNumber(positionAnalysis.unvaluedCount) });
    }

    const displayedLabels = new Set([...accountMetrics, ...resultMetrics].map((metric) => metric.label));
    const additionalMetrics = (latestReport.statistics ?? [])
      .filter((statistic) =>
        !displayedLabels.has(statistic.label) &&
        statistic.label !== 'Общий доход' &&
        !/^(?:unrealized|realized)\s+p.?l(?:\s*\(%\))?$|^(?:win rate|profit factor|payoff ratio|expectancy)$/i.test(statistic.label))
      .map((statistic) => ({ label: statistic.label, value: formatStatisticValue(statistic.value, latestReport.accountCurrency, statistic.label) }));

    const fee = getStatisticMatching(latestReport, /комисси|commission|^fees?$/i);
    const tax = getStatisticMatching(latestReport, /налог|^tax(?:es)?$/i);
    const feeAmount = fee ? parseStatisticNumber(fee.value) : null;
    const taxAmount = tax ? parseStatisticNumber(tax.value) : null;
    const totalCosts = feeAmount === null && taxAmount === null ? null : Math.abs(feeAmount ?? 0) + Math.abs(taxAmount ?? 0);
    const feeTaxDrag = totalCosts === null
      ? '— (нет данных о комиссиях и налогах)'
      : `${formatMoney(totalCosts, latestReport.accountCurrency)}${accountValueNumber !== null && accountValueNumber > 0 ? ` · ${formatShare((totalCosts / accountValueNumber) * 100)} от стоимости счёта` : ''}`;
    const tradedValue = getStatistic(latestReport, 'Объем сделок');
    const turnoverRate = tradedValue
      ? `${formatStatisticValue(tradedValue.value, latestReport.accountCurrency, tradedValue.label)} · — (нет средней стоимости счёта)`
      : '— (нет данных об обороте сделок)';
    const dryMetrics: Metric[] = [
      getSourceMetric(latestReport, 'Unrealized PnL', /^(?!.*(?:%|процент)).*(?:unrealized|unrealised|нереализован|открыт.*(?:p.?l|прибыл))/i, latestReport.accountCurrency),
      getSourceMetric(latestReport, 'Unrealized PnL (%)', /(?:(?:unrealized|unrealised|нереализован|открыт.*(?:p.?l|прибыл)).*(?:%|процент)|(?:%|процент).*(?:unrealized|unrealised|нереализован))/i, undefined, true),
      getSourceMetric(latestReport, 'Realized PnL', /^(?!.*(?:%|процент)).*(?:realized|realised|реализован|закрыт.*(?:p.?l|прибыл))/i, latestReport.accountCurrency),
      getSourceMetric(latestReport, 'Realized PnL (%)', /(?:(?:realized|realised|реализован|закрыт.*(?:p.?l|прибыл)).*(?:%|процент)|(?:%|процент).*(?:realized|realised|реализован))/i, undefined, true),
      getSourceMetric(latestReport, 'Общий доход', /общ.*доход|total income/i, latestReport.accountCurrency),
      { label: 'Contribution to Return', value: '— (нужны доходности позиций за период)' },
      getSourceMetric(latestReport, 'Yield on Cost', /yield on cost|доходность.*(?:цен|стоимост).*покуп|дивидендн.*цен.*приобрет/i, undefined, true),
      getSourceMetric(latestReport, 'Текущая дивидендная доходность', /current.*(?:dividend )?yield|текущ.*дивидендн.*доходност/i, undefined, true),
      { label: 'Секторная экспозиция', value: '— (нет классификации по секторам)' },
      { label: 'Страновая экспозиция', value: '— (нет классификации по странам)' },
      { label: 'Валютная экспозиция', value: '— (нет валюты каждой позиции)' },
      getSourceMetric(latestReport, 'Win Rate', /^win rate$/i, undefined, true),
      getSourceMetric(latestReport, 'Profit Factor', /^profit factor$/i),
      getSourceMetric(latestReport, 'Payoff Ratio', /^payoff ratio$/i),
      getSourceMetric(latestReport, 'Expectancy', /^expectancy$/i, latestReport.accountCurrency),
      { label: 'Turnover Rate', value: turnoverRate },
      { label: 'Fee / Tax Drag', value: feeTaxDrag },
      getSourceMetric(latestReport, 'Средневзвешенный P/E', /(?:средневзвеш|weighted).*(?:p\s*\/?\s*e|price.?earnings)/i),
      getSourceMetric(latestReport, 'Средневзвешенный P/S', /(?:средневзвеш|weighted).*(?:p\s*\/?\s*s|price.?sales)/i),
      getSourceMetric(latestReport, 'Средневзвешенный P/B', /(?:средневзвеш|weighted).*(?:p\s*\/?\s*b|price.?book)/i),
      getSourceMetric(latestReport, 'Средневзвешенный EV/EBITDA', /(?:средневзвеш|weighted).*ev\s*\/?\s*ebitda/i),
      getSourceMetric(latestReport, 'Средневзвешенный ROE', /(?:средневзвеш|weighted).*roe/i, undefined, true),
      getSourceMetric(latestReport, 'Средневзвешенный Debt/Equity', /(?:средневзвеш|weighted).*(?:debt\s*\/?\s*equity|долг.*капитал)/i),
    ];

    metricGroups.push(accountMetrics, resultMetrics, positionMetrics, positionAnalysis.classMetrics, positionAnalysis.concentrationMetrics, additionalMetrics, dryMetrics);
  }

  const metrics = [
    ...metricGroups.flatMap((group) => group),
    ...(latestReport ? getDynamicMetrics(sortedReports, latestReport.accountCurrency) : []),
    ...(latestReport
      ? getBenchmarkMetrics(sortedReports, latestReport.accountCurrency, benchmarkState.data, benchmarkState.loading, benchmarkState.error, benchmarkState.stale)
      : []),
  ];
  const availableMetrics = metrics.filter((metric) => isMetricValueAvailable(metric.value));
  const split = splitPrimaryMetrics(availableMetrics);
  return {
    primaryMetrics: split.primaryMetrics,
    otherMetrics: split.otherMetrics,
    availableMetricCount: availableMetrics.length,
  };
}
