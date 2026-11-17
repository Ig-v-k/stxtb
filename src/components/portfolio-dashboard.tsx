import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import type { Metric } from '@/utils/portfolio-metrics';
import type { ImportedReport } from '@/utils/imported-files';
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
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">XTB · ПОРТФЕЛЬ</ThemedText>
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
                    Всего доступно метрик: {availableMetricCount.toFixed(2).replace('.', ',')}
                  </ThemedText>
                  <MetricList metrics={otherMetrics} onSelect={onSelectMetric} />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <MetricDialog metric={selectedMetric} onClose={onCloseMetric} />
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

function MetricDialog({ metric, onClose }: { metric: Metric | null; onClose: () => void }) {
  return (
    <Modal animationType="fade" transparent visible={metric !== null} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView type="backgroundElement" style={styles.metricDialog}>
          <ThemedText type="subtitle" style={styles.metricDialogTitle}>{metric?.label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {metric ? getMetricDescription(metric.label) : ''}
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <ThemedText type="smallBold">Закрыть</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.three },
  title: { fontSize: 32, lineHeight: 38 },
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
  closeButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
});
