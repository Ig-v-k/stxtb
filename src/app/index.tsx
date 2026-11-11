import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSessionReports } from '@/hooks/use-session-reports';
import type { ImportedReport, StatementPosition } from '@/utils/imported-files';
import { parseStatisticNumber } from '@/utils/statement-stats';

type Metric = { label: string; value: string };

const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₽': 'RUB',
};

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

function getPositionAnalysis(positions: StatementPosition[], accountCurrency?: string) {
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
      const hhi = weights.reduce((sum, weight) => sum + weight ** 2, 0);
      concentrationMetrics.push(
        {
          label: 'HHI',
          value: `${formatNumber(hhi * 10_000)} / 10 000`,
        },
        {
          label: 'Эфф. позиций',
          value: formatNumber(1 / hhi),
        },
        {
          label: 'Топ-3',
          value: formatShare(
            weights.slice(0, 3).reduce((sum, weight) => sum + weight, 0) * 100
          ),
        }
      );
    }
  }

  return {
    valuedCount: valuedPositions.length,
    unvaluedCount: positions.length - valuedPositions.length,
    assetClassCount: assetClasses.size,
    total,
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
    const positionAnalysis = getPositionAnalysis(positions, latestReport.accountCurrency);
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
      if (positionAnalysis.largest && positionAnalysis.total) {
        positionMetrics.push({
          label: `Крупнейшая (${positionAnalysis.largest.position.symbol})`,
          value: `${formatMoney(
            positionAnalysis.largest.amount,
            positionAnalysis.currency
          )} · ${formatShare(
            (positionAnalysis.largest.amount / positionAnalysis.total) * 100
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

    metricGroups.push(
      accountMetrics,
      resultMetrics,
      positionMetrics,
      positionAnalysis.classMetrics,
      positionAnalysis.concentrationMetrics,
      additionalMetrics
    );
  }
  const metricLine = metricGroups
    .flatMap((metrics) => metrics)
    .map((metric) => `${metric.label} - ${metric.value}`)
    .join(', ');

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
                <ThemedText type="small">{metricLine}</ThemedText>
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
});
