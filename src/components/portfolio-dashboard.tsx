import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { SettingsButton } from '@/components/settings-button';
import { formatNumber, interpolate } from '@/i18n/formatters';
import { useLocalization, type Locale } from '@/i18n/provider';
import type { LocalizationMessages } from '@/i18n/translations';
import {
  getLocalizedMetricDescription,
  localizeMetricLabel,
  normalizeMetricId,
} from '@/i18n/metric-localization';
import type { ImportedReport } from '@/utils/imported-files';
import type { Metric } from '@/utils/portfolio-metrics';
import { parseStatisticNumber } from '@/utils/statement-stats';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type Props = {
  latestReport: ImportedReport | undefined;
  periodLabel: string;
  primaryMetrics: Metric[];
  otherMetrics: Metric[];
  availableMetricCount: number;
  selectedMetric: Metric | null;
  onSelectMetric: (metric: Metric) => void;
  onCloseMetric: () => void;
};

export function PortfolioDashboard({
  latestReport,
  periodLabel,
  primaryMetrics,
  otherMetrics,
  availableMetricCount,
  selectedMetric,
  onSelectMetric,
  onCloseMetric,
}: Props) {
  const metrics = [...primaryMetrics, ...otherMetrics];
  const { locale, messages } = useLocalization();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.brandLine}>
              <View style={styles.brandGroup}>
                <Image
                  source={require('@/assets/images/icon.png')}
                  style={styles.logo}
                  accessibilityLabel={messages.common.logo}
                />
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {messages.portfolio.brand}
                </ThemedText>
              </View>
              <SettingsButton />
            </View>
            <ThemedText type="title" style={styles.title}>{messages.portfolio.title}</ThemedText>
            {latestReport && (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {periodLabel} · {latestReport.name}
              </ThemedText>
            )}
          </View>

          {!latestReport ? (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                {messages.portfolio.emptyTitle}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {messages.portfolio.emptyDescription}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.dashboard}>
              {primaryMetrics.length > 0 && (
                <MetricSection
                  title={messages.portfolio.mainSection}
                  metrics={primaryMetrics}
                  locale={locale}
                  onSelect={onSelectMetric}
                />
              )}
              {otherMetrics.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                    {messages.portfolio.detailsSection}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {interpolate(messages.portfolio.availableMetrics, {
                      count: formatNumber(availableMetricCount, locale),
                    })}
                  </ThemedText>
                  <MetricList metrics={otherMetrics} locale={locale} onSelect={onSelectMetric} />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <MetricDialog
        metric={selectedMetric}
        metrics={metrics}
        onClose={onCloseMetric}
      />
    </ThemedView>
  );
}

function MetricSection({
  title,
  metrics,
  locale,
  onSelect,
}: {
  title: string;
  metrics: Metric[];
  locale: Locale;
  onSelect: (metric: Metric) => void;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>{title}</ThemedText>
      <MetricList metrics={metrics} locale={locale} onSelect={onSelect} />
    </View>
  );
}

function MetricList({
  metrics,
  locale,
  onSelect,
}: {
  metrics: Metric[];
  locale: Locale;
  onSelect: (metric: Metric) => void;
}) {
  const { messages } = useLocalization();

  return (
    <View style={styles.metricList}>
      {metrics.map((metric, index) => (
        <Pressable
          key={`${metric.label}-${index}`}
          accessibilityRole="button"
          accessibilityLabel={`${localizeMetricLabel(metric.id ?? normalizeMetricId(metric.label), locale, metric.label)}, ${metric.value}`}
          accessibilityHint={messages.portfolio.openMetricHint}
          onPress={() => onSelect(metric)}
          style={({ pressed }) => [styles.metricRow, pressed && styles.metricPressed]}>
          <ThemedText type="small" style={styles.metricLabel}>
            {localizeMetricLabel(metric.id ?? normalizeMetricId(metric.label), locale, metric.label)}
          </ThemedText>
          <ThemedText type="small" style={styles.metricValue}>{metric.value}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function MetricDialog({
  metric,
  metrics,
  onClose,
}: {
  metric: Metric | null;
  metrics: Metric[];
  onClose: () => void;
}) {
  const { locale, messages } = useLocalization();
  const tradeDetails = metric
    ? getTradeDetails(metric.label, metrics, locale, messages)
    : null;

  return (
    <Modal animationType="fade" transparent visible={metric !== null} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView type="backgroundElement" style={styles.metricDialog}>
          <ThemedText type="subtitle" style={styles.metricDialogTitle}>
            {metric ? localizeMetricLabel(metric.id ?? normalizeMetricId(metric.label), locale, metric.label) : ''}
          </ThemedText>
          <ThemedText type="smallBold">{metric?.value}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {metric ? getLocalizedMetricDescription(metric.id ?? normalizeMetricId(metric.label), locale) : ''}
          </ThemedText>
          {tradeDetails && (
            <View style={styles.assessment}>
              <ThemedText
                type="smallBold"
                style={{ color: ASSESSMENT_COLORS[tradeDetails.tone] }}>
                {tradeDetails.label}
              </ThemedText>
              {tradeDetails.rows.map((row) => (
                <ThemedText key={row} type="small">{row}</ThemedText>
              ))}
            </View>
          )}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <ThemedText type="smallBold">{messages.common.close}</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

function getTradeDetails(
  label: string,
  metrics: Metric[],
  locale: Locale,
  messages: LocalizationMessages
) {
  const tradeMetricIds = ['winRate', 'profitFactor', 'payoffRatio', 'expectancy'] as const;
  const labelId = normalizeMetricId(label);
  if (!tradeMetricIds.includes(labelId as typeof tradeMetricIds[number])) {
    return null;
  }

  const getMetric = (name: string) =>
    metrics.find((metric) => (metric.id ?? normalizeMetricId(metric.label)) === normalizeMetricId(name));
  const winRateMetric = getMetric('winRate');
  const payoffMetric = getMetric('payoffRatio');
  const expectancyMetric = getMetric('expectancy');
  const profitFactorMetric = getMetric('profitFactor');
  const tradeCountMetric = metrics.find((item) =>
    (item.id ?? normalizeMetricId(item.label)) === 'closedTrades'
  );
  const winRate = winRateMetric ? parseStatisticNumber(winRateMetric.value) : null;
  const payoff = payoffMetric ? parseStatisticNumber(payoffMetric.value) : null;
  const expectancy = expectancyMetric ? parseStatisticNumber(expectancyMetric.value) : null;
  const profitFactor = profitFactorMetric ? parseStatisticNumber(profitFactorMetric.value) : null;
  const rows: string[] = [];
  const signals: number[] = [];

  if (
    winRateMetric &&
    payoff !== null &&
    payoff >= 0 &&
    winRate !== null &&
    winRate >= 0 &&
    winRate <= 100
  ) {
    const breakEven = 100 / (1 + payoff);
    const margin = winRate - breakEven;
    rows.push(
      `${localizeMetricLabel('winRate', locale)} ${winRateMetric.value} · ${interpolate(messages.portfolio.breakeven, { value: formatNumber(breakEven, locale) })} · ${margin > 0 ? '+' : ''}${formatNumber(margin, locale)} ${messages.portfolio.percentagePoints}`
    );
    signals.push(Math.sign(margin));
  }
  if (expectancyMetric && expectancy !== null) {
    signals.push(Math.sign(expectancy));
  }
  if (profitFactor !== null) {
    signals.push(Math.sign(profitFactor - 1));
  } else if (profitFactorMetric?.value.startsWith('∞')) {
    signals.push(1);
  }

  const summary = [
    expectancy !== null
      ? `${localizeMetricLabel('expectancy', locale)} ${expectancyMetric?.value}`
      : '',
    profitFactorMetric
      ? `${localizeMetricLabel('profitFactor', locale)} ${profitFactorMetric.value}`
      : '',
    tradeCountMetric
      ? interpolate(messages.portfolio.trades, {
          count: tradeCountMetric.value,
        })
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (summary) {
    rows.push(summary);
  }
  if (rows.length === 0) {
    return null;
  }

  const hasPositive = signals.some((signal) => signal > 0);
  const hasNegative = signals.some((signal) => signal < 0);
  const isMixed = hasPositive && hasNegative;
  return {
    tone: isMixed ? 'caution' : hasPositive ? 'positive' : hasNegative ? 'negative' : 'caution',
    label: isMixed
      ? messages.portfolio.mixed
      : hasPositive
        ? messages.portfolio.positive
        : hasNegative
          ? messages.portfolio.negative
          : messages.portfolio.neutral,
    rows,
  } as const;
}

const ASSESSMENT_COLORS = {
  positive: '#16803C',
  negative: '#C62828',
  caution: '#A05A00',
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    ...Platform.select({
      web: {
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.five,
      },
    }),
  },
  header: { gap: Spacing.two, marginBottom: Spacing.four },
  brandLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: { width: 20, height: 20, borderRadius: Spacing.one },
  title: {
    fontSize: 32,
    lineHeight: 38,
    ...Platform.select({
      web: {
        fontSize: 40,
        lineHeight: 46,
      },
    }),
  },
  emptyState: { gap: Spacing.two, marginTop: Spacing.four },
  emptyTitle: { fontSize: 24, lineHeight: 30 },
  dashboard: { gap: Spacing.five },
  section: { gap: Spacing.one },
  sectionTitle: { letterSpacing: 1.2, marginBottom: Spacing.two },
  metricList: { gap: Spacing.one },
  metricRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  metricLabel: { flex: 1 },
  metricValue: { flex: 1, textAlign: 'right' },
  metricPressed: { opacity: 0.65 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: '#00000066',
  },
  metricDialog: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  metricDialogTitle: { fontSize: 22, lineHeight: 28 },
  assessment: { gap: Spacing.one },
  closeButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
});
