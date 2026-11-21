import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import type { ImportedReport } from '@/utils/imported-files';
import { formatDecimal } from '@/utils/number-format';
import type { Metric } from '@/utils/portfolio-metrics';
import { parseStatisticNumber } from '@/utils/statement-stats';
import {
  getMetricDescription,
  SHORT_METRIC_LABELS,
} from '@/utils/portfolio-screen';
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

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.brandLine}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logo}
                accessibilityLabel="Логотип STXTB"
              />
              <ThemedText type="smallBold" themeColor="textSecondary">
                STXTB · ПОРТФЕЛЬ
              </ThemedText>
            </View>
            <ThemedText type="title" style={styles.title}>Аналитика</ThemedText>
            {latestReport && (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {periodLabel} · {latestReport.name}
              </ThemedText>
            )}
          </View>

          {!latestReport ? (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>Пока пусто</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Импортируйте PDF-отчет на вкладке «Файлы», чтобы увидеть показатели портфеля.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.dashboard}>
              {primaryMetrics.length > 0 && (
                <MetricSection title="ГЛАВНОЕ" metrics={primaryMetrics} onSelect={onSelectMetric} />
              )}
              {otherMetrics.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                    ПОДРОБНЫЕ ПОКАЗАТЕЛИ
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Всего доступно метрик: {formatDecimal(availableMetricCount)}
                  </ThemedText>
                  <MetricList metrics={otherMetrics} onSelect={onSelectMetric} />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <MetricDialog metric={selectedMetric} metrics={metrics} onClose={onCloseMetric} />
    </ThemedView>
  );
}

function MetricSection({ title, metrics, onSelect }: { title: string; metrics: Metric[]; onSelect: (metric: Metric) => void }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>{title}</ThemedText>
      <MetricList metrics={metrics} onSelect={onSelect} />
    </View>
  );
}

function MetricList({ metrics, onSelect }: { metrics: Metric[]; onSelect: (metric: Metric) => void }) {
  return (
    <View style={styles.metricList}>
      {metrics.map((metric, index) => (
        <Pressable
          key={`${metric.label}-${index}`}
          accessibilityRole="button"
          accessibilityLabel={`${SHORT_METRIC_LABELS[metric.label] ?? metric.label}, ${metric.value}`}
          accessibilityHint="Открыть описание показателя"
          onPress={() => onSelect(metric)}
          style={({ pressed }) => [styles.metricRow, pressed && styles.metricPressed]}>
          <ThemedText type="small" style={styles.metricLabel}>
            {SHORT_METRIC_LABELS[metric.label] ?? metric.label}
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
  const tradeDetails = metric ? getTradeDetails(metric.label, metrics) : null;

  return (
    <Modal animationType="fade" transparent visible={metric !== null} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView type="backgroundElement" style={styles.metricDialog}>
          <ThemedText type="subtitle" style={styles.metricDialogTitle}>{metric?.label}</ThemedText>
          <ThemedText type="smallBold">{metric?.value}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {metric ? getMetricDescription(metric.label) : ''}
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
            <ThemedText type="smallBold">Закрыть</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

function getTradeDetails(label: string, metrics: Metric[]) {
  if (!/^(?:Win Rate|Profit Factor|Payoff Ratio|Expectancy)$/i.test(label)) {
    return null;
  }

  const getMetric = (name: string) =>
    metrics.find((metric) => metric.label.toLowerCase() === name.toLowerCase());
  const winRateMetric = getMetric('Win Rate');
  const payoffMetric = getMetric('Payoff Ratio');
  const expectancyMetric = getMetric('Expectancy');
  const profitFactorMetric = getMetric('Profit Factor');
  const tradeCountMetric = getMetric('Закрытых сделок');
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
      `Win Rate ${winRateMetric.value} · безубыточный порог ${formatDecimal(breakEven)}% · ${margin > 0 ? '+' : ''}${formatDecimal(margin)} п.п.`
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
    expectancy !== null ? `Expectancy ${expectancyMetric?.value}` : '',
    profitFactorMetric ? `Profit Factor ${profitFactorMetric.value}` : '',
    tradeCountMetric ? `Сделок ${tradeCountMetric.value}` : '',
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
    label: isMixed ? 'Смешанный результат' : hasPositive ? 'В плюсе' : hasNegative ? 'В минусе' : 'Около нуля',
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
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
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
