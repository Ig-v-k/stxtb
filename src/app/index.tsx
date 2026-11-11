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
  type StatementPosition,
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
    month: 'long',
    year: 'numeric',
  });
}

function StatisticRow({
  statistic,
  currency,
}: {
  statistic: StatementStatistic;
  currency?: string;
}) {
  return (
    <View style={styles.statisticCard}>
      <ThemedText type="small" themeColor="textSecondary">
        {statistic.label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.metricValue}>
        {formatStatisticValue(statistic.value, currency)}
      </ThemedText>
    </View>
  );
}

function PositionCard({ position }: { position: StatementPosition }) {
  return (
    <ThemedView type="backgroundSelected" style={styles.positionCard}>
      <View style={styles.positionHeading}>
        <View style={styles.positionTitle}>
          <ThemedText type="smallBold">{position.symbol}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            № {position.number}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {position.instrumentName}
          </ThemedText>
        </View>
        {position.assetClass ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.assetClass}>
            {position.assetClass}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {position.isin}
      </ThemedText>
      <View style={styles.positionValues}>
        <View style={styles.positionValue}>
          <ThemedText type="small" themeColor="textSecondary">
            Рыночная стоимость
          </ThemedText>
          <ThemedText type="smallBold">{position.marketValue || '—'}</ThemedText>
        </View>
        <View style={[styles.positionValue, styles.volumeValue]}>
          <ThemedText type="small" themeColor="textSecondary">
            Объем
          </ThemedText>
          <ThemedText type="smallBold">{position.volume || '—'}</ThemedText>
        </View>
      </View>
    </ThemedView>
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

  const hasReportData = files.some(
    (file) =>
      (file.statistics?.length ?? 0) > 0 ||
      (file.positions?.length ?? 0) > 0 ||
      file.hasOtherAssets === false
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              XTB · ОБЗОР
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Результаты
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Основные показатели из импортированных отчетов.
            </ThemedText>
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
          ) : files.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.messageCard}>
              <ThemedText type="small">
                Импортируйте PDF на вкладке «Файлы» — здесь появятся найденные показатели.
              </ThemedText>
            </ThemedView>
          ) : hasReportData ? (
            <View style={styles.reportList}>
              {files.map((file) => {
                const statistics = file.statistics ?? [];
                const accountValue = statistics.find(
                  (statistic) => statistic.label === 'Стоимость счета'
                );
                const secondaryStatistics = statistics.filter(
                  (statistic) => statistic !== accountValue
                );
                const positions = file.positions ?? [];

                if (!statistics.length && !positions.length && file.hasOtherAssets !== false) {
                  return (
                    <ThemedView
                      key={file.id}
                      type="backgroundElement"
                      style={styles.messageCard}>
                      <ThemedText type="smallBold" numberOfLines={2}>
                        {file.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {file.analysisError ??
                          'Для этого файла нет сохраненных показателей. Импортируйте его повторно.'}
                      </ThemedText>
                    </ThemedView>
                  );
                }

                return (
                  <ThemedView key={file.id} type="backgroundElement" style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <View style={styles.reportTitle}>
                        <ThemedText type="smallBold" themeColor="textSecondary">
                          XTB · ОТЧЕТ
                        </ThemedText>
                        <ThemedText type="smallBold" numberOfLines={2}>
                          {file.name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Импортирован {formatDate(file.importedAt)}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {positions.length
                          ? `${positions.length} ${positions.length === 1 ? 'позиция' : 'позиций'}`
                          : 'Сводка'}
                      </ThemedText>
                    </View>

                    {accountValue ? (
                      <ThemedView type="backgroundSelected" style={styles.accountValueCard}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {accountValue.label}
                        </ThemedText>
                        <ThemedText type="subtitle" style={styles.accountValue}>
                          {formatStatisticValue(accountValue.value, file.accountCurrency)}
                        </ThemedText>
                      </ThemedView>
                    ) : null}

                    {secondaryStatistics.length ? (
                      <View style={styles.statisticsGrid}>
                        {secondaryStatistics.map((statistic) => (
                          <StatisticRow
                            key={statistic.label}
                            statistic={statistic}
                            currency={file.accountCurrency}
                          />
                        ))}
                      </View>
                    ) : null}

                    {positions.length ? (
                      <View style={styles.positionsSection}>
                        <View style={styles.positionsHeader}>
                          <ThemedText type="smallBold">Позиции</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {positions.length}
                          </ThemedText>
                        </View>
                        <View style={styles.positionList}>
                          {positions.map((position, index) => (
                            <PositionCard key={`${position.isin}-${index}`} position={position} />
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {file.hasOtherAssets === false ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Других активов нет
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                );
              })}
            </View>
          ) : (
            <View style={styles.reportList}>
              {files.map((file) => (
                <ThemedView key={file.id} type="backgroundElement" style={styles.messageCard}>
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {file.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {file.analysisError ??
                      (file.statistics === undefined
                        ? 'Этот файл добавлен до анализа. Импортируйте его повторно.'
                        : 'В отчете не найдены знакомые финансовые показатели. Проверьте таблицу PDF.')}
                  </ThemedText>
                </ThemedView>
              ))}
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  title: {
    fontSize: 40,
    lineHeight: 46,
  },
  loader: {
    marginTop: Spacing.five,
  },
  messageCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  reportList: {
    gap: Spacing.three,
  },
  reportCard: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  reportTitle: {
    flex: 1,
    gap: Spacing.one,
  },
  accountValueCard: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  accountValue: {
    fontSize: 30,
    lineHeight: 38,
  },
  statisticsGrid: {
    gap: Spacing.two,
  },
  statisticCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#88888844',
  },
  metricValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  positionsSection: {
    gap: Spacing.two,
  },
  positionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionList: {
    gap: Spacing.two,
  },
  positionCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  positionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  positionTitle: {
    flex: 1,
    gap: Spacing.one,
  },
  assetClass: {
    flexShrink: 1,
    textAlign: 'right',
  },
  positionValues: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  positionValue: {
    flex: 1,
    gap: Spacing.one,
  },
  volumeValue: {
    alignItems: 'flex-end',
  },
});
