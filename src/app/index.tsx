import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  IMPORTED_FILES_STORAGE_KEY,
  isImportedFile,
  sanitizeImportedFileName,
  type ImportedFile,
  type StatementStatistic,
} from '@/utils/imported-files';

function formatStatisticValue(value: string, currency?: string) {
  const hasCurrency =
    /\b(?:USD|EUR|GBP|RUB|PLN|CZK|HUF|CHF|JPY|CAD|AUD|HKD|USDT)\b|[$€£₽]/i.test(value);
  if (!currency || hasCurrency) {
    return value;
  }
  return `${value} ${currency}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Дата неизвестна';
  }
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatisticCard({
  statistic,
  currency,
}: {
  statistic: StatementStatistic;
  currency?: string;
}) {
  return (
    <ThemedView type="backgroundSelected" style={styles.statisticCard}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {statistic.label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
        {formatStatisticValue(statistic.value, currency)}
      </ThemedText>
    </ThemedView>
  );
}

function AssetRow({
  instrumentName,
  symbol,
  assetClass,
  marketValue,
  volume,
}: {
  instrumentName: string;
  symbol: string;
  assetClass: string;
  marketValue: string;
  volume: string;
}) {
  return (
    <View style={styles.assetRow}>
      <View style={styles.assetName}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {instrumentName || symbol}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {assetClass ? `${symbol} · ${assetClass}` : symbol}
        </ThemedText>
      </View>
      <View style={styles.assetValue}>
        <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
          {marketValue || '—'}
        </ThemedText>
      </View>
      <View style={[styles.assetValue, styles.volumeValue]}>
        <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
          {volume || '—'}
        </ThemedText>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let active = true;

    async function loadFiles() {
      setLoading(true);
      setError(null);
      try {
        const storedFiles = await AsyncStorage.getItem(IMPORTED_FILES_STORAGE_KEY);
        if (storedFiles === null) {
          if (active) {
            setFiles([]);
          }
          return;
        }

        const parsed: unknown = JSON.parse(storedFiles);
        if (!Array.isArray(parsed) || !parsed.every(isImportedFile)) {
          throw new Error('Формат сохраненной истории поврежден.');
        }
        const safeFiles = parsed.map((file) => ({
          ...file,
          name: sanitizeImportedFileName(file.name),
        }));
        if (active) {
          setFiles(safeFiles);
        }
        if (safeFiles.some((file, index) => file.name !== parsed[index].name)) {
          await AsyncStorage.setItem(IMPORTED_FILES_STORAGE_KEY, JSON.stringify(safeFiles));
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? `Не удалось загрузить результаты: ${loadError.message}`
              : 'Не удалось загрузить результаты импорта.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFiles();
    return () => {
      active = false;
    };
  }, [isFocused]);

  const latestReport = files
    .filter(
      (file) =>
        (file.statistics?.length ?? 0) > 0 ||
        (file.positions?.length ?? 0) > 0 ||
        file.hasOtherAssets === false
    )
    .sort((first, second) => Date.parse(second.importedAt) - Date.parse(first.importedAt))[0];
  const positions = latestReport?.positions ?? [];
  const statistics = [...(latestReport?.statistics ?? [])].sort((first, second) => {
    const priority = ['Стоимость счета', 'Баланс', 'Свободные средства', 'Обеспечение'];
    const firstPriority = priority.indexOf(first.label);
    const secondPriority = priority.indexOf(second.label);
    return (firstPriority < 0 ? priority.length : firstPriority) -
      (secondPriority < 0 ? priority.length : secondPriority);
  });
  const metrics = latestReport
    ? [
        ...statistics.slice(0, 3).map((statistic) => ({
          label: statistic.label,
          value: formatStatisticValue(statistic.value, latestReport.accountCurrency),
        })),
        { label: 'Позиций', value: String(positions.length) },
        {
          label: 'Классов активов',
          value: String(new Set(positions.map((position) => position.assetClass).filter(Boolean)).size),
        },
        { label: 'Отчетов', value: String(files.length) },
      ].slice(0, 4)
    : [];

  const latestImportedFile = files
    .slice()
    .sort((first, second) => Date.parse(second.importedAt) - Date.parse(first.importedAt))[0];
  const emptyMessage =
    latestImportedFile?.analysisError ??
    'Импортируйте PDF-отчет с позициями или финансовыми показателями — они появятся здесь.';

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              XTB · ОБЗОР ПОРТФЕЛЯ
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Портфель
            </ThemedText>
            {latestReport ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {formatDate(latestReport.importedAt)} · {latestReport.name}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Данные из последнего импортированного отчета.
              </ThemedText>
            )}
          </View>

          {error ? (
            <ThemedView
              type="backgroundElement"
              style={styles.messageCard}
              accessibilityRole="alert">
              <ThemedText type="small">{error}</ThemedText>
            </ThemedView>
          ) : loading ? (
            <ActivityIndicator color={theme.textSecondary} style={styles.loader} />
          ) : !latestReport ? (
            <ThemedView type="backgroundElement" style={styles.messageCard}>
              <ThemedText type="small">{emptyMessage}</ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.dashboard}>
              <View style={styles.metricsGrid}>
                {metrics.map((metric, index) => (
                  <StatisticCard
                    key={`${metric.label}-${index}`}
                    statistic={metric}
                  />
                ))}
              </View>

              <View style={styles.positionsSection}>
                <View style={styles.positionsHeader}>
                  <ThemedText type="smallBold">Активы</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {positions.length}
                  </ThemedText>
                </View>

                {positions.length ? (
                  <ThemedView type="background" style={styles.assetList}>
                    <View style={styles.assetColumnHeader}>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.assetColumnTitle}>
                        Название
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.assetColumnLabel}>
                        Стоимость
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={[styles.assetColumnLabel, styles.volumeValue]}>
                        Объем
                      </ThemedText>
                    </View>
                    {positions.map((position, index) => (
                      <AssetRow
                        key={`${position.isin}-${index}`}
                        instrumentName={position.instrumentName}
                        symbol={position.symbol}
                        assetClass={position.assetClass}
                        marketValue={position.marketValue}
                        volume={position.volume}
                      />
                    ))}
                  </ThemedView>
                ) : (
                  <ThemedView type="backgroundElement" style={styles.messageCard}>
                    <ThemedText type="small" themeColor="textSecondary">
                      В последнем отчете позиции не найдены.
                    </ThemedText>
                  </ThemedView>
                )}
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
  loader: {
    marginTop: Spacing.five,
  },
  messageCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  dashboard: {
    gap: Spacing.four,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statisticCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 64,
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  positionsSection: {
    gap: Spacing.two,
  },
  positionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetList: {
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
  assetColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#88888844',
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 56,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#88888844',
  },
  assetName: {
    flex: 1,
    gap: Spacing.one,
  },
  assetColumnTitle: {
    flex: 1,
  },
  assetValue: {
    width: 82,
    alignItems: 'flex-end',
  },
  assetColumnLabel: {
    width: 82,
    textAlign: 'right',
  },
  volumeValue: {
    width: 54,
  },
});
