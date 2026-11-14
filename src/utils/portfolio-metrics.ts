import type { ImportedReport } from './imported-files';
import { parseStatisticNumber } from './statement-stats';

export type Metric = { label: string; value: string };

type Snapshot = {
  start: string;
  end: string;
  value: number;
  netFlow: number | null;
};

type ReturnPeriod = {
  start: string;
  end: string;
  days: number;
  value: number;
  netFlow: number;
};

const DAY_MS = 86_400_000;
const INSUFFICIENT_HISTORY = 'Н/Д';

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${formatNumber(value * 100)}%`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(first: string, second: string) {
  return Math.round((parseDate(second) - parseDate(first)) / DAY_MS);
}

function getStatistic(report: ImportedReport, pattern: RegExp) {
  return report.statistics?.find((item) => pattern.test(item.label));
}

function getSnapshot(report: ImportedReport): Snapshot | null {
  if (!report.period || report.period.kind !== 'range' || report.periodConflict) {
    return null;
  }

  const accountValue = getStatistic(
    report,
    /^(?:стоимость счета|net asset value|equity|account value)$/i
  ) ?? getStatistic(report, /^баланс$|^balance$/i);
  const value = accountValue ? parseStatisticNumber(accountValue.value) : null;
  if (value === null || value <= 0) {
    return null;
  }

  const deposits = getStatistic(report, /пополнени|внесени|^deposits?$|^top[\s-]?ups?$/i);
  const withdrawals = getStatistic(report, /вывод|сняти|^withdrawals?$/i);
  const hasCashFlowData = Boolean(deposits || withdrawals);
  const depositValue = deposits ? parseStatisticNumber(deposits.value) : 0;
  const withdrawalValue = withdrawals ? parseStatisticNumber(withdrawals.value) : 0;

  return {
    start: report.period.start,
    end: report.period.end,
    value,
    netFlow:
      hasCashFlowData && depositValue !== null && withdrawalValue !== null
        ? Math.abs(depositValue) - Math.abs(withdrawalValue)
        : null,
  };
}

function getSnapshots(reports: ImportedReport[], currency?: string) {
  const snapshots = reports
    .filter((report) => report.accountCurrency === currency)
    .map(getSnapshot)
    .filter((snapshot): snapshot is Snapshot => snapshot !== null)
    .sort((first, second) => first.end.localeCompare(second.end));
  const uniqueSnapshots = new Map<string, Snapshot>();
  for (const snapshot of snapshots) {
    if (!uniqueSnapshots.has(snapshot.end)) {
      uniqueSnapshots.set(snapshot.end, snapshot);
    }
  }
  return Array.from(uniqueSnapshots.values());
}

function getReturnPeriods(snapshots: Snapshot[]): ReturnPeriod[] | null {
  const periods: ReturnPeriod[] = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    const days = daysBetween(previous.end, current.end);
    if (
      days <= 0 ||
      current.netFlow === null ||
      daysBetween(previous.end, current.start) < 0 ||
      daysBetween(previous.end, current.start) > 1
    ) {
      return null;
    }

    const denominator = previous.value + current.netFlow * 0.5;
    if (denominator <= 0) {
      return null;
    }
    const periodReturn =
      (current.value - previous.value - current.netFlow) / denominator;
    if (!Number.isFinite(periodReturn) || periodReturn <= -1) {
      return null;
    }

    periods.push({
      start: previous.end,
      end: current.end,
      days,
      netFlow: current.netFlow,
      value: periodReturn,
    });
  }
  return periods;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return null;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(values: number[], probability: number) {
  const sorted = values.slice().sort((first, second) => first - second);
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  return (
    sorted[lowerIndex] +
    (sorted[upperIndex] - sorted[lowerIndex]) * (position - lowerIndex)
  );
}

function xirr(cashFlows: Array<{ date: string; amount: number }>) {
  const start = parseDate(cashFlows[0].date);
  const npv = (rate: number) =>
    cashFlows.reduce((sum, flow) => {
      const years = (parseDate(flow.date) - start) / (365 * DAY_MS);
      return sum + flow.amount / (1 + rate) ** years;
    }, 0);

  const bounds = [-0.9999, -0.99, -0.9, -0.5, 0, 0.1, 0.5, 1, 10, 100, 1_000, 1_000_000];
  for (let index = 1; index < bounds.length; index += 1) {
    let lower = bounds[index - 1];
    let upper = bounds[index];
    let lowerValue = npv(lower);
    const upperValue = npv(upper);
    if (lowerValue === 0) {
      return lower;
    }
    if (upperValue === 0) {
      return upper;
    }
    if (
      !Number.isFinite(lowerValue) ||
      !Number.isFinite(upperValue) ||
      (lowerValue < 0) === (upperValue < 0)
    ) {
      continue;
    }

    for (let iteration = 0; iteration < 100; iteration += 1) {
      const middle = (lower + upper) / 2;
      const middleValue = npv(middle);
      if (!Number.isFinite(middleValue)) {
        break;
      }
      if (Math.abs(middleValue) < 1e-8) {
        return middle;
      }
      if ((lowerValue < 0) !== (middleValue < 0)) {
        upper = middle;
      } else {
        lower = middle;
        lowerValue = middleValue;
      }
    }
    return (lower + upper) / 2;
  }
  return null;
}

function getMaxDrawdown(returns: number[], dates: string[]) {
  let value = 1;
  let peak = 1;
  let peakDate = dates[0];
  let maximum = 0;
  let maximumDuration = 0;
  let underwaterStart: string | null = null;

  for (let index = 0; index < returns.length; index += 1) {
    value *= 1 + returns[index];
    if (value >= peak) {
      peak = value;
      peakDate = dates[index + 1];
      if (underwaterStart) {
        maximumDuration = Math.max(
          maximumDuration,
          daysBetween(underwaterStart, dates[index + 1])
        );
        underwaterStart = null;
      }
    } else {
      underwaterStart ??= peakDate;
      maximum = Math.min(maximum, value / peak - 1);
      maximumDuration = Math.max(
        maximumDuration,
        daysBetween(underwaterStart, dates[index + 1])
      );
    }
  }
  return { maximum, duration: maximumDuration };
}

function buildMetrics(snapshots: Snapshot[], periods: ReturnPeriod[], currency?: string): Metric[] {
  const returns = periods.map((period) => period.value);
  const dates = [snapshots[0].end, ...periods.map((period) => period.end)];
  const totalDays = daysBetween(dates[0], dates[dates.length - 1]);
  const averagePeriodDays = periods.reduce((sum, period) => sum + period.days, 0) / periods.length;
  const periodsPerYear = 365 / averagePeriodDays;
  const cumulativeReturn = returns.reduce((value, result) => value * (1 + result), 1) - 1;
  const annualizedReturn =
    totalDays > 0 && cumulativeReturn > -1
      ? (1 + cumulativeReturn) ** (365 / totalDays) - 1
      : null;
  const volatility = standardDeviation(returns);
  const annualizedVolatility =
    volatility === null ? null : volatility * Math.sqrt(periodsPerYear);
  const downsideDeviation =
    Math.sqrt(
      returns.reduce((sum, value) => sum + Math.min(value, 0) ** 2, 0) / returns.length
    ) * Math.sqrt(periodsPerYear);
  const averageAnnualReturn =
    (returns.reduce((sum, value) => sum + value, 0) / returns.length) * periodsPerYear;
  const drawdown = getMaxDrawdown(returns, dates);
  const xirrFlows: Array<{ date: string; amount: number }> = [
    { date: snapshots[0].end, amount: -snapshots[0].value },
  ];

  for (const period of periods) {
    const midpoint = new Date(
      (parseDate(period.start) + parseDate(period.end)) / 2
    ).toISOString().slice(0, 10);
    if (period.netFlow !== 0) {
      xirrFlows.push({ date: midpoint, amount: -period.netFlow });
    }
  }
  xirrFlows.push({
    date: snapshots[snapshots.length - 1].end,
    amount: snapshots[snapshots.length - 1].value,
  });
  const moneyWeightedReturn = xirr(xirrFlows);
  const sharpe =
    annualizedVolatility && annualizedVolatility > 0
      ? averageAnnualReturn / annualizedVolatility
      : null;
  const sortino =
    downsideDeviation > 0 ? averageAnnualReturn / downsideDeviation : null;
  const calmar =
    drawdown.maximum < 0 && annualizedReturn !== null
      ? annualizedReturn / Math.abs(drawdown.maximum)
      : null;
  const positiveReturns = returns.reduce((sum, value) => sum + Math.max(value, 0), 0);
  const negativeReturns = returns.reduce((sum, value) => sum + Math.abs(Math.min(value, 0)), 0);
  const omega = negativeReturns > 0 ? positiveReturns / negativeReturns : null;
  const varQuantile = returns.length >= 20 ? quantile(returns, 0.05) : null;
  const cvarReturns =
    varQuantile === null ? [] : returns.filter((value) => value <= varQuantile);
  const cvar = cvarReturns.length
    ? cvarReturns.reduce((sum, value) => sum + value, 0) / cvarReturns.length
    : null;
  const formatRatio = (value: number | null) =>
    value === null || !Number.isFinite(value) ? '—' : formatNumber(value);
  const formatAnnualized = (value: number | null) =>
    value === null || !Number.isFinite(value) ? '—' : formatPercent(value);
  const formatVolatility = (value: number | null) =>
    value === null || !Number.isFinite(value) ? '—' : formatPercent(value);
  const varAmount =
    varQuantile === null ? null : Math.max(0, -varQuantile) * snapshots[snapshots.length - 1].value;
  const cvarAmount =
    cvar === null ? null : Math.max(0, -cvar) * snapshots[snapshots.length - 1].value;

  return [
    { label: 'Периодов с денежными потоками', value: formatNumber(periods.length) },
    { label: 'Cumulative Return (TWR)', value: formatPercent(cumulativeReturn) },
    { label: 'TWR', value: `${formatPercent(cumulativeReturn)} · Modified Dietz` },
    { label: 'CAGR', value: formatAnnualized(annualizedReturn) },
    { label: 'Annualized Return', value: formatAnnualized(annualizedReturn) },
    {
      label: 'MWR / XIRR',
      value:
        moneyWeightedReturn === null
          ? '— (XIRR не сошёлся)'
          : `${formatPercent(moneyWeightedReturn)} · потоки по середине периода`,
    },
    { label: 'Стандартное отклонение (год.)', value: formatVolatility(annualizedVolatility) },
    { label: 'Downside Deviation (год.)', value: formatVolatility(downsideDeviation) },
    { label: 'Max Drawdown', value: formatPercent(drawdown.maximum) },
    { label: 'Drawdown Duration', value: `${formatNumber(drawdown.duration)} дн.` },
    {
      label: 'VaR 95% (период)',
      value:
        varQuantile === null || varAmount === null
          ? '— (нужно не менее 20 периодов)'
          : `${formatPercent(Math.max(0, -varQuantile))} · ${formatNumber(varAmount)}${
              currency ? ` ${currency}` : ''
            }`,
    },
    {
      label: 'CVaR 95% (период)',
      value:
        cvar === null || cvarAmount === null
          ? '— (нужно не менее 20 периодов)'
          : `${formatPercent(Math.max(0, -cvar))} · ${formatNumber(cvarAmount)}${
              currency ? ` ${currency}` : ''
            }`,
    },
    { label: 'Sharpe (безрисковая ставка 0%)', value: formatRatio(sharpe) },
    { label: 'Sortino (целевая доходность 0%)', value: formatRatio(sortino) },
    { label: 'Calmar', value: formatRatio(calmar) },
    { label: 'Omega (порог 0%)', value: formatRatio(omega) },
  ];
}

export function getDynamicMetrics(reports: ImportedReport[], currency?: string): Metric[] {
  const snapshots = getSnapshots(reports, currency);
  const notAvailable = (reason: string): Metric[] =>
    [
      'Cumulative Return (TWR)',
      'TWR',
      'CAGR',
      'MWR / XIRR',
      'Annualized Return',
      'Стандартное отклонение (год.)',
      'Downside Deviation (год.)',
      'Max Drawdown',
      'Drawdown Duration',
      'VaR 95% (период)',
      'CVaR 95% (период)',
      'Sharpe (безрисковая ставка 0%)',
      'Sortino (целевая доходность 0%)',
      'Calmar',
      'Omega (порог 0%)',
    ].map((label) => ({ label, value: reason }));

  if (snapshots.length < 2) {
    return [
      { label: 'Снимков портфеля', value: formatNumber(snapshots.length) },
      ...notAvailable(INSUFFICIENT_HISTORY),
    ];
  }

  const periods = getReturnPeriods(snapshots);
  if (!periods || periods.length === 0) {
    return [
      { label: 'Снимков портфеля', value: formatNumber(snapshots.length) },
      ...notAvailable('— (нет непрерывной истории или данных о пополнениях/выводах)'),
    ];
  }

  return buildMetrics(snapshots, periods, currency);
}
