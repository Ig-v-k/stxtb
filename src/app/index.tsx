import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSessionReports } from '@/hooks/use-session-reports';
import type { ImportedReport, StatementPosition } from '@/utils/imported-files';
import { getDynamicMetrics, type Metric } from '@/utils/portfolio-metrics';
import { parseStatisticNumber } from '@/utils/statement-stats';

const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₽': 'RUB',
};

const BENCHMARK_METRICS = [
  'Alpha',
  'Beta',
  'R²',
  'Tracking Error',
  'Information Ratio',
  'Upside/Downside Capture',
  'Active Share',
  'Treynor',
  'Jensen’s Alpha',
  'Alpha Fama–French',
  'Brinson Allocation',
  'Brinson Selection',
];

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

function getSourceMetric(
  report: ImportedReport,
  label: string,
  pattern: RegExp,
  currency?: string,
  percentage = false
): Metric {
  const statistic = getStatisticMatching(report, pattern);
  if (!statistic) {
    return { label, value: '— (нет данных в отчёте)' };
  }

  if (percentage) {
    const value = parseStatisticNumber(statistic.value);
    return {
      label,
      value:
        value === null
          ? statistic.value
          : `${formatNumber(value)}${statistic.value.includes('%') ? '' : '%'}`,
    };
  }
  return { label, value: formatStatisticValue(statistic.value, currency) };
}

function getPositionAnalysis(
  positions: StatementPosition[],
  accountCurrency?: string,
  accountValue?: number | null
) {
  const valuedPositions = positions.flatMap((position) => {
    const amount = parseStatisticNumber(position.marketValue);
    if (amount === null) {
      return [];
    }

    const symbol = /[$€£₽]/.exec(position.marketValue)?.[0];
    const code = /\b(?:USD|EUR|GBP|RUB|PLN|CZK|HUF|CHF|JPY|CAD|AUD|HKD|USDT)\b/i.exec(
      position.marketValue
    )?.[0];
    const currency = code?.toUpperCase() ?? (symbol ? CURRENCY_SYMBOLS[symbol] : accountCurrency);
    return [{ position, amount, currency: currency ?? '' }];
  });
  const currencies = new Set(valuedPositions.map((item) => item.currency));
  const comparable = valuedPositions.length > 0 && currencies.size === 1;
  const total = comparable
    ? valuedPositions.reduce((sum, item) => sum + item.amount, 0)
    : null;
  const largest = comparable
    ? valuedPositions.reduce((first, second) =>
        second.amount > first.amount ? second : first
      )
    : null;
  const currency = comparable ? valuedPositions[0].currency || undefined : undefined;
  const portfolioValueForWeight =
    comparable &&
    typeof accountValue === 'number' &&
    accountValue > 0 &&
    currency === accountCurrency
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
        value: `${formatMoney(value.amount, currency)} · ${
          total === 0 ? '—' : formatShare((value.amount / total) * 100)
        }`,
      });
    }
  }

  if (positions.length > 0) {
    concentrationMetrics.push({
      label: 'Оценено',
      value: `${valuedPositions.length}/${positions.length} · ${formatShare(
        (valuedPositions.length / positions.length) * 100
      )}`,
    });
  }

  if (comparable && valuedPositions.length === positions.length) {
    const grossValue = valuedPositions.reduce((sum, item) => sum + Math.abs(item.amount), 0);
    if (grossValue > 0) {
      const weights = valuedPositions
        .map((item) => Math.abs(item.amount) / grossValue)
        .sort((first, second) => second - first);
      const shareDenominator = portfolioValueForWeight ?? grossValue;
      const topWeights = valuedPositions
        .map((item) => Math.abs(item.amount) / shareDenominator)
        .sort((first, second) => second - first);
      const hhi = weights.reduce((sum, weight) => sum + weight ** 2, 0);
      concentrationMetrics.push(
        {
          label: 'HHI (по бумагам)',
          value: `${formatNumber(hhi * 10_000)} / 10 000`,
        },
        {
          label: 'Эфф. позиций',
          value: formatNumber(1 / hhi),
        },
        {
          label:
            portfolioValueForWeight !== null
              ? 'Топ-3 (доля счёта)'
              : 'Топ-3 (доля бумаг)',
          value: formatShare(
            topWeights.slice(0, 3).reduce((sum, weight) => sum + weight, 0) * 100
          ),
        },
        {
          label:
            portfolioValueForWeight !== null
              ? 'Топ-1 (доля счёта)'
              : 'Топ-1 (доля бумаг)',
          value: formatShare((topWeights[0] ?? 0) * 100),
        },
        {
          label:
            portfolioValueForWeight !== null
              ? 'Топ-5 (доля счёта)'
              : 'Топ-5 (доля бумаг)',
          value: formatShare(
            topWeights.slice(0, 5).reduce((sum, weight) => sum + weight, 0) * 100
          ),
        }
      );
      for (const item of valuedPositions) {
        concentrationMetrics.push({
          label: `Вес ${item.position.symbol} (${
            portfolioValueForWeight !== null ? 'счёта' : 'бумаг'
          })`,
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
    weightBasis: portfolioValueForWeight !== null ? 'доля счёта' : 'доля бумаг',
    currency,
    largest,
    classMetrics,
    concentrationMetrics,
    comparable,
  };
}

function formatStatisticValue(value: string, currency?: string) {
  const hasCurrency =
    /\b(?:USD|EUR|GBP|RUB|PLN|CZK|HUF|CHF|JPY|CAD|AUD|HKD|USDT)\b|[$€£₽]/i.test(value);
  if (!currency || hasCurrency) {
    return value;
  }
  return `${value} (${currency})`;
}

function formatPeriod(report: ImportedReport) {
  if (!report.period) {
    return 'Период не указан';
  }
  if (report.period.kind === 'all-time') {
    return 'За всё время';
  }

  const formatDate = (value: string) => {
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  };
  return `${formatDate(report.period.start)} – ${formatDate(report.period.end)}`;
}

export default function HomeScreen() {
  const { reports } = useSessionReports();
  const sortedReports = reports
    .slice()
    .sort((first, second) => {
      const firstEnd = first.period?.kind === 'range' ? first.period.end : '';
      const secondEnd = second.period?.kind === 'range' ? second.period.end : '';
      return secondEnd.localeCompare(firstEnd);
    });
  const latestReport = sortedReports[0];
  const positions = latestReport?.positions ?? [];
  const metricGroups: Metric[][] = [];

  if (latestReport) {
    const accountValue = getStatistic(latestReport, 'Стоимость счета', 'Баланс');
    const freeFunds = getStatistic(latestReport, 'Свободные средства');
    const accountValueNumber = accountValue ? parseStatisticNumber(accountValue.value) : null;
    const freeFundsNumber = freeFunds ? parseStatisticNumber(freeFunds.value) : null;
    const collateral = getStatistic(latestReport, 'Обеспечение');
    const collateralNumber = collateral ? parseStatisticNumber(collateral.value) : null;
    const latestReportEnd =
      latestReport.period?.kind === 'range' ? latestReport.period.end : undefined;
    const previousReport =
      latestReportEnd
        ? sortedReports.find(
            (report) =>
              report.id !== latestReport.id &&
              report.period?.kind === 'range' &&
              report.period.end < latestReportEnd &&
              report.accountCurrency === latestReport.accountCurrency
          )
        : undefined;
    const previousAccountValue = previousReport
      ? getStatistic(previousReport, 'Стоимость счета', 'Баланс')
      : undefined;
    const previousAccountValueNumber = previousAccountValue
      ? parseStatisticNumber(previousAccountValue.value)
      : null;
    const positionAnalysis = getPositionAnalysis(
      positions,
      latestReport.accountCurrency,
      accountValueNumber
    );
    const accountMetrics: Metric[] = [];
    const resultMetrics: Metric[] = [];
    const positionMetrics: Metric[] = [];

    if (accountValue) {
      accountMetrics.push({
        label: accountValue.label,
        value: formatStatisticValue(accountValue.value, latestReport.accountCurrency),
      });
    }
    for (const label of ['Баланс', 'Свободные средства', 'Обеспечение']) {
      const statistic = getStatistic(latestReport, label);
      if (statistic && statistic !== accountValue) {
        accountMetrics.push({
          label: statistic.label,
          value: formatStatisticValue(statistic.value, latestReport.accountCurrency),
        });
      }
    }
    if (
      accountValueNumber !== null &&
      freeFundsNumber !== null &&
      accountValueNumber !== 0
    ) {
      accountMetrics.push({
        label: 'Свободные средства, %',
        value: formatShare((freeFundsNumber / accountValueNumber) * 100),
      });
    }
    if (
      collateralNumber !== null &&
      accountValueNumber !== null &&
      accountValueNumber > 0
    ) {
      accountMetrics.push({
        label: 'Обеспечение, % счёта',
        value: formatShare((collateralNumber / accountValueNumber) * 100),
      });
    }

    for (const label of [
      'Прибыль / убыток',
      'Дивиденды',
      'Пополнения',
      'Выводы',
      'Комиссии',
      'Свопы',
    ]) {
      const statistic = getStatistic(latestReport, label);
      if (statistic) {
        resultMetrics.push({
          label: statistic.label,
          value: formatStatisticValue(statistic.value, latestReport.accountCurrency),
        });
      }
    }
    if (
      accountValueNumber !== null &&
      previousAccountValueNumber !== null &&
      previousAccountValueNumber !== 0
    ) {
      const change = accountValueNumber - previousAccountValueNumber;
      resultMetrics.push({
        label: 'Изменение счёта',
        value: `${change > 0 ? '+' : ''}${formatMoney(change, latestReport.accountCurrency)} · ${formatPercent(
          (change / previousAccountValueNumber) * 100
        )}`,
      });
    }

    if (positions.length) {
      positionMetrics.push({
        label: 'Позиции',
        value: formatNumber(positions.length),
      });
      if (positionAnalysis.assetClassCount) {
        positionMetrics.push({
          label: 'Классы',
          value: formatNumber(positionAnalysis.assetClassCount),
        });
      }
      if (positionAnalysis.total !== null) {
        positionMetrics.push({
          label: 'Стоимость бумаг',
          value: formatMoney(positionAnalysis.total, positionAnalysis.currency),
        });
      } else if (positionAnalysis.valuedCount > 0) {
        positionMetrics.push({
          label: 'Стоимость бумаг',
          value: '— (разные валюты)',
        });
      }
      if (positionAnalysis.largest && positionAnalysis.weightTotal) {
        positionMetrics.push({
          label: `Крупнейшая (${positionAnalysis.largest.position.symbol}, ${positionAnalysis.weightBasis})`,
          value: `${formatMoney(
            positionAnalysis.largest.amount,
            positionAnalysis.currency
          )} · ${formatShare(
            (positionAnalysis.largest.amount / positionAnalysis.weightTotal) * 100
          )}`,
        });
      }
      if (positionAnalysis.unvaluedCount) {
        positionMetrics.push({
          label: 'Без оценки',
          value: formatNumber(positionAnalysis.unvaluedCount),
        });
      }
    }

    const displayedStatisticLabels = new Set(
      [...accountMetrics, ...resultMetrics].map((metric) => metric.label)
    );
    const additionalMetrics = (latestReport.statistics ?? [])
      .filter((statistic) => !displayedStatisticLabels.has(statistic.label))
      .map((statistic) => ({
        label: statistic.label,
        value: formatStatisticValue(statistic.value, latestReport.accountCurrency),
      }));

    const fee = getStatisticMatching(latestReport, /комисси|commission|^fees?$/i);
    const tax = getStatisticMatching(latestReport, /налог|^tax(?:es)?$/i);
    const feeAmount = fee ? parseStatisticNumber(fee.value) : null;
    const taxAmount = tax ? parseStatisticNumber(tax.value) : null;
    const totalCosts =
      feeAmount === null && taxAmount === null
        ? null
        : Math.abs(feeAmount ?? 0) + Math.abs(taxAmount ?? 0);
    const feeTaxDrag =
      totalCosts !== null
        ? `${formatMoney(totalCosts, latestReport.accountCurrency)}${
            accountValueNumber !== null && accountValueNumber > 0
              ? ` · ${formatShare((totalCosts / accountValueNumber) * 100)} от стоимости счёта`
              : ''
          }`
        : '— (нет данных о комиссиях/налогах)';
    const dryMetrics: Metric[] = [
      getSourceMetric(
        latestReport,
        'Unrealized PnL (абсолютный)',
        /^(?!.*(?:%|процент)).*(?:unrealized|unrealised|нереализован|открыт.*(?:p.?l|прибыл))/i,
        latestReport.accountCurrency
      ),
      getSourceMetric(
        latestReport,
        'Unrealized PnL (%)',
        /(?:(?:unrealized|unrealised|нереализован|открыт.*(?:p.?l|прибыл)).*(?:%|процент)|(?:%|процент).*(?:unrealized|unrealised|нереализован))/i,
        undefined,
        true
      ),
      getSourceMetric(
        latestReport,
        'Realized PnL (абсолютный)',
        /^(?!.*(?:%|процент)).*(?:realized|realised|реализован|закрыт.*(?:p.?l|прибыл))/i,
        latestReport.accountCurrency
      ),
      getSourceMetric(
        latestReport,
        'Realized PnL (%)',
        /(?:(?:realized|realised|реализован|закрыт.*(?:p.?l|прибыл)).*(?:%|процент)|(?:%|процент).*(?:realized|realised|реализован))/i,
        undefined,
        true
      ),
      getSourceMetric(
        latestReport,
        'Общий доход',
        /общ.*доход|total income/i,
        latestReport.accountCurrency
      ),
      {
        label: 'Contribution to Return',
        value: '— (нет истории доходности по отдельным позициям)',
      },
      getSourceMetric(
        latestReport,
        'Yield on Cost',
        /yield on cost|доходность.*(?:цен|стоимост).*покуп|дивидендн.*цен.*приобрет/i,
        undefined,
        true
      ),
      getSourceMetric(
        latestReport,
        'Текущая дивидендная доходность',
        /current.*(?:dividend )?yield|текущ.*дивидендн.*доходност/i,
        undefined,
        true
      ),
      {
        label: 'Секторная экспозиция',
        value: '— (сектор отсутствует в данных позиций)',
      },
      {
        label: 'Страновая экспозиция',
        value: '— (страна эмитента отсутствует в данных)',
      },
      {
        label: 'Валютная экспозиция',
        value: '— (валюта инструмента/курс не указаны)',
      },
      {
        label: 'Win Rate',
        value: '— (нет журнала закрытых сделок)',
      },
      {
        label: 'Profit Factor',
        value: '— (нет журнала закрытых сделок)',
      },
      {
        label: 'Payoff Ratio',
        value: '— (нет результатов отдельных сделок)',
      },
      {
        label: 'Expectancy',
        value: '— (нет результатов отдельных сделок)',
      },
      {
        label: 'Turnover Rate',
        value: '— (нет оборота покупок/продаж)',
      },
      { label: 'Fee / Tax Drag', value: feeTaxDrag },
      getSourceMetric(
        latestReport,
        'Средневзвешенный P/E',
        /(?:средневзвеш|weighted).*(?:p\s*\/?\s*e|price.?earnings)/i
      ),
      getSourceMetric(
        latestReport,
        'Средневзвешенный P/S',
        /(?:средневзвеш|weighted).*(?:p\s*\/?\s*s|price.?sales)/i
      ),
      getSourceMetric(
        latestReport,
        'Средневзвешенный P/B',
        /(?:средневзвеш|weighted).*(?:p\s*\/?\s*b|price.?book)/i
      ),
      getSourceMetric(
        latestReport,
        'Средневзвешенный EV/EBITDA',
        /(?:средневзвеш|weighted).*ev\s*\/?\s*ebitda/i
      ),
      getSourceMetric(
        latestReport,
        'Средневзвешенный ROE',
        /(?:средневзвеш|weighted).*roe/i,
        undefined,
        true
      ),
      getSourceMetric(
        latestReport,
        'Средневзвешенный Debt/Equity',
        /(?:средневзвеш|weighted).*(?:debt\s*\/?\s*equity|долг.*капитал)/i
      ),
    ];

    metricGroups.push(
      accountMetrics,
      resultMetrics,
      positionMetrics,
      positionAnalysis.classMetrics,
      positionAnalysis.concentrationMetrics,
      additionalMetrics,
      dryMetrics
    );
  }
  const metrics = [
    ...metricGroups.flatMap((group) => group),
    ...(latestReport
      ? getDynamicMetrics(sortedReports, latestReport.accountCurrency)
      : []),
    ...BENCHMARK_METRICS.map((label) => ({
      label,
      value: '— (нет данных бенчмарка)',
    })),
  ];

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              XTB · ПОРТФЕЛЬ
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Аналитика
            </ThemedText>
            {latestReport && (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {formatPeriod(latestReport)} · {latestReport.name}
              </ThemedText>
            )}
          </View>

          {!latestReport ? (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                Пока пусто
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Импортируйте PDF-отчет на вкладке «Файлы», чтобы увидеть показатели портфеля.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.dashboard}>
              <View style={styles.section}>
                <ThemedText
                  type="smallBold"
                  themeColor="textSecondary"
                  style={styles.sectionTitle}>
                  ПОКАЗАТЕЛИ
                </ThemedText>
                <View style={styles.metricList}>
                  {metrics.map((metric, index) => (
                    <View key={`${metric.label}-${index}`} style={styles.metricRow}>
                      <ThemedText type="small" style={styles.metricLabel}>
                        {metric.label}
                      </ThemedText>
                      <ThemedText type="small" style={styles.metricValue}>
                        {metric.value}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
  },
  emptyState: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  emptyTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  dashboard: {
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  metricList: {
    gap: Spacing.one,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  metricLabel: {
    flex: 1,
  },
  metricValue: {
    flex: 1,
    textAlign: 'right',
  },
});
