import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { extractText, isAvailable } from 'expo-pdf-text-extract';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSessionReports } from '@/hooks/use-session-reports';
import { useTheme } from '@/hooks/use-theme';
import { sanitizeImportedFileName } from '@/utils/imported-files';
import type { ImportedReport, StatementPeriod } from '@/utils/imported-files';
import { createStatementPeriod, parseStatement } from '@/utils/statement-stats';
import { parseXtbWorkbook } from '@/utils/xtb-workbook';

function formatFileSize(size: number | null) {
  if (size === null) {
    return 'Размер не указан';
  }
  if (size < 1024) {
    return `${size} Б`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatPeriodDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function formatPeriod(period: StatementPeriod | null) {
  if (!period) {
    return 'Период не определен';
  }
  if (period.kind === 'all-time') {
    return 'За всё время';
  }
  return `${formatPeriodDate(period.start)} – ${formatPeriodDate(period.end)}`;
}

function getPeriodSourceLabel(period: StatementPeriod) {
  if (period.source === 'filename') {
    return 'Определен по имени файла — проверьте';
  }
  if (period.source === 'manual') {
    return 'Указан вручную';
  }
  if (period.source === 'xlsx') {
    return 'Определен по XLSX';
  }
  return 'Определен по тексту PDF';
}

function getPdfErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

export default function ImportsScreen() {
  const theme = useTheme();
  const { reports, addReports, updateReportPeriod, clearReports } = useSessionReports();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [editingPeriodIds, setEditingPeriodIds] = useState<string[]>([]);
  const [periodDrafts, setPeriodDrafts] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const passwordResolver = useRef<((password: string | null) => void) | null>(null);

  function requestPdfPassword(incorrect = false) {
    setPdfPassword('');
    setPasswordMessage(
      incorrect
        ? 'Пароль не подошел. Проверьте его и попробуйте еще раз.'
        : 'Введите пароль отчета. Он используется только для чтения PDF и не сохраняется.'
    );
    setPasswordPromptVisible(true);

    return new Promise<string | null>((resolve) => {
      passwordResolver.current = resolve;
    });
  }

  function finishPasswordPrompt(password: string | null) {
    const resolve = passwordResolver.current;
    passwordResolver.current = null;
    setPasswordPromptVisible(false);
    setPdfPassword('');
    resolve?.(password);
  }

  async function extractPdfText(uri: string) {
    let password: string | undefined;

    while (true) {
      try {
        return await extractText(uri, password);
      } catch (extractError) {
        const code = getPdfErrorCode(extractError);
        if (code !== 'PASSWORD_REQUIRED' && code !== 'INCORRECT_PASSWORD') {
          throw extractError;
        }

        const enteredPassword = await requestPdfPassword(code === 'INCORRECT_PASSWORD');
        if (enteredPassword === null) {
          throw new Error('Ввод пароля отменен; файл не обработан.');
        }
        password = enteredPassword;
      }
    }
  }

  function openPeriodEditor(report: ImportedReport) {
    const period =
      report.period?.kind === 'range'
        ? { start: formatPeriodDate(report.period.start), end: formatPeriodDate(report.period.end) }
        : { start: '', end: '' };
    setPeriodDrafts((current) => ({ ...current, [report.id]: period }));
    setEditingPeriodIds((current) =>
      current.includes(report.id) ? current : [...current, report.id]
    );
  }

  function closePeriodEditor(id: string) {
    setEditingPeriodIds((current) => current.filter((reportId) => reportId !== id));
  }

  function saveReportPeriod(id: string) {
    const draft = periodDrafts[id];
    const period = draft ? createStatementPeriod(draft.start, draft.end) : null;
    if (!period) {
      return;
    }

    updateReportPeriod(id, period);
    closePeriodEditor(id);
  }

  function setReportAsAllTime(id: string) {
    updateReportPeriod(id, { kind: 'all-time', source: 'manual' });
    closePeriodEditor(id);
  }

  function clearCurrentReports() {
    clearReports();
    setEditingPeriodIds([]);
    setPeriodDrafts({});
  }

  async function readWorkbookBytes(file: DocumentPicker.DocumentPickerAsset) {
    if (file.file) {
      return new Uint8Array(await file.file.arrayBuffer());
    }
    return new File(file.uri).bytes();
  }

  async function importFiles() {
    setError(null);
    setImporting(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const selectedFiles = result.assets.filter(
        (asset) =>
          asset.name.toLowerCase().endsWith('.pdf') ||
          asset.name.toLowerCase().endsWith('.xlsx') ||
          asset.mimeType === 'application/pdf' ||
          asset.mimeType ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      if (selectedFiles.length === 0) {
        setError('Выберите PDF-отчет или XLSX-экспорт истории операций XTB.');
        return;
      }

      const additions: ImportedReport[] = [];

      for (const [index, file] of selectedFiles.entries()) {
        const isXlsx =
          file.name.toLowerCase().endsWith('.xlsx') ||
          file.mimeType ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (isXlsx) {
          additions.push(
            parseXtbWorkbook(
              await readWorkbookBytes(file),
              sanitizeImportedFileName(file.name),
              typeof file.size === 'number' ? file.size : null
            )
          );
          continue;
        }

        let statement: ReturnType<typeof parseStatement> | undefined;
        let analysisError: string | undefined;

        if (isAvailable()) {
          const text = await extractPdfText(file.uri);
          statement = parseStatement(text, file.name);
          if (statement.statistics.length === 0 && statement.positions.length === 0) {
            analysisError = 'В отчете не найдены знакомые финансовые показатели.';
          }
        } else {
          analysisError =
            'Для извлечения данных нужен development build приложения на iOS или Android.';
        }

        additions.push({
          id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          name: sanitizeImportedFileName(file.name),
          size: typeof file.size === 'number' ? file.size : null,
          period: statement?.period ?? null,
          periodConflict: statement?.periodConflict,
          statistics: statement?.statistics ?? [],
          accountCurrency: statement?.accountCurrency,
          positions: statement?.positions ?? [],
          hasOtherAssets: statement?.hasOtherAssets,
          analysisError,
        });
      }

      addReports(additions);
      const reportsWithoutPeriod = additions.filter((report) => !report.period);
      if (reportsWithoutPeriod.length) {
        setEditingPeriodIds((current) => [
          ...current,
          ...reportsWithoutPeriod.map((report) => report.id),
        ]);
        setPeriodDrafts((current) => ({
          ...current,
          ...Object.fromEntries(
            reportsWithoutPeriod.map((report) => [report.id, { start: '', end: '' }])
          ),
        }));
      }
    } catch (importError) {
      setError(
        importError instanceof Error
          ? `Не удалось добавить файл: ${importError.message}`
          : 'Не удалось добавить выбранные файлы.'
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              XTB · АНАЛИЗ ОТЧЕТОВ
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Анализ
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              PDF и XLSX обрабатываются на устройстве. Результаты доступны только пока приложение открыто.
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={importing}
            onPress={importFiles}
            style={({ pressed }) => [
              styles.importButton,
              { backgroundColor: theme.text },
              pressed && !importing && styles.pressed,
            ]}>
            {importing ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.importButtonText, { color: theme.background }]}>
                Выбрать PDF- или XLSX-файлы
              </ThemedText>
            )}
          </Pressable>

          <View style={styles.historyHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Отчеты в этой сессии
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {reports.length} {reports.length === 1 ? 'отчет' : 'отчетов'}
            </ThemedText>
          </View>

          {reports.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={clearCurrentReports}
              style={styles.clearButton}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Очистить результаты
              </ThemedText>
            </Pressable>
          )}

          {error && (
            <ThemedView type="backgroundElement" style={styles.errorCard} accessibilityRole="alert">
              <ThemedText type="small">{error}</ThemedText>
            </ThemedView>
          )}

          {reports.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="subtitle" style={styles.emptyIcon}>
                PDF / XLSX
              </ThemedText>
              <ThemedText type="smallBold">
                Импортируйте PDF-отчет или XLSX-историю операций
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                Операции, сделки и открытые позиции будут включены в аналитику, если они есть в файле.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.fileList}>
              {reports.map((report) => {
                const draft = periodDrafts[report.id] ?? { start: '', end: '' };
                const periodIsValid = createStatementPeriod(draft.start, draft.end) !== null;
                const editingPeriod = editingPeriodIds.includes(report.id);
                const profit = report.statistics?.find(
                  (statistic) => statistic.label === 'Прибыль / убыток'
                );

                return (
                  <ThemedView
                    key={report.id}
                    type="backgroundElement"
                    style={styles.fileCard}>
                    <View style={styles.fileBadge}>
                      <ThemedText type="smallBold" style={styles.fileBadgeText}>
                        {report.name.toLowerCase().endsWith('.xlsx') ? 'XLSX' : 'PDF'}
                      </ThemedText>
                    </View>
                    <View style={styles.fileDetails}>
                      <ThemedText type="smallBold" numberOfLines={2}>
                        {report.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatFileSize(report.size)} · {formatPeriod(report.period)}
                      </ThemedText>
                      {report.period && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {getPeriodSourceLabel(report.period)}
                        </ThemedText>
                      )}
                      {report.periodConflict && (
                        <ThemedText type="small" themeColor="textSecondary">
                          Даты в PDF и имени файла расходятся — проверьте период.
                        </ThemedText>
                      )}
                      <ThemedText type="small" themeColor="textSecondary">
                        {report.positions?.length ?? 0} позиций
                        {profit ? ` · Прибыль / убыток: ${profit.value}` : ''}
                      </ThemedText>
                      {report.analysisError && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {report.analysisError}
                        </ThemedText>
                      )}

                      {!editingPeriod ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => openPeriodEditor(report)}
                          style={styles.periodAction}>
                          <ThemedText type="smallBold">
                            {report.period ? 'Изменить период' : 'Указать период'}
                          </ThemedText>
                        </Pressable>
                      ) : (
                        <View style={styles.periodEditor}>
                          <ThemedText type="smallBold">Период отчета</ThemedText>
                          <View style={styles.periodInputs}>
                            <TextInput
                              accessibilityLabel="Начало периода, ДД.ММ.ГГГГ"
                              autoCapitalize="none"
                              onChangeText={(start) =>
                                setPeriodDrafts((current) => ({
                                  ...current,
                                  [report.id]: { ...draft, start },
                                }))
                              }
                              placeholder="ДД.ММ.ГГГГ"
                              placeholderTextColor={theme.textSecondary}
                              style={[
                                styles.periodInput,
                                { borderColor: theme.textSecondary, color: theme.text },
                              ]}
                              value={draft.start}
                            />
                            <TextInput
                              accessibilityLabel="Конец периода, ДД.ММ.ГГГГ"
                              autoCapitalize="none"
                              onChangeText={(end) =>
                                setPeriodDrafts((current) => ({
                                  ...current,
                                  [report.id]: { ...draft, end },
                                }))
                              }
                              placeholder="ДД.ММ.ГГГГ"
                              placeholderTextColor={theme.textSecondary}
                              style={[
                                styles.periodInput,
                                { borderColor: theme.textSecondary, color: theme.text },
                              ]}
                              value={draft.end}
                            />
                          </View>
                          <View style={styles.periodActions}>
                            <Pressable
                              accessibilityRole="button"
                              disabled={!periodIsValid}
                              onPress={() => saveReportPeriod(report.id)}
                              style={styles.periodAction}>
                              <ThemedText
                                type="smallBold"
                                themeColor={periodIsValid ? 'text' : 'textSecondary'}>
                                Применить даты
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => setReportAsAllTime(report.id)}
                              style={styles.periodAction}>
                              <ThemedText type="smallBold" themeColor="textSecondary">
                                За всё время
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => closePeriodEditor(report.id)}
                              style={styles.periodAction}>
                              <ThemedText type="small" themeColor="textSecondary">
                                Отмена
                              </ThemedText>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  </ThemedView>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        animationType="fade"
        transparent
        visible={passwordPromptVisible}
        onRequestClose={() => finishPasswordPrompt(null)}>
        <View style={styles.modalBackdrop}>
          <ThemedView type="backgroundElement" style={styles.passwordCard}>
            <ThemedText type="subtitle" style={styles.passwordTitle}>
              Пароль PDF
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {passwordMessage}
            </ThemedText>
            <TextInput
              accessibilityLabel="Пароль PDF"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPdfPassword}
              onSubmitEditing={() => finishPasswordPrompt(pdfPassword)}
              placeholder="Пароль отчета"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              secureTextEntry
              style={[
                styles.passwordInput,
                {
                  borderColor: theme.textSecondary,
                  color: theme.text,
                },
              ]}
              value={pdfPassword}
            />
            <View style={styles.passwordActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => finishPasswordPrompt(null)}
                style={styles.passwordButton}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Отмена
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => finishPasswordPrompt(pdfPassword)}
                style={styles.passwordButton}>
                <ThemedText type="smallBold">Продолжить</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
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
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  title: {
    fontSize: 40,
    lineHeight: 46,
  },
  importButton: {
    minHeight: 54,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  importButtonText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
  },
  clearButton: {
    alignSelf: 'flex-end',
    minHeight: 40,
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  errorCard: {
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Spacing.three,
  },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.five,
    borderRadius: Spacing.four,
  },
  emptyIcon: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: Spacing.two,
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  fileList: {
    gap: Spacing.two,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  fileBadge: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B4231820',
  },
  fileBadgeText: {
    color: '#B42318',
  },
  fileDetails: {
    flex: 1,
    gap: Spacing.one,
  },
  periodEditor: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  periodInputs: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  periodInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    fontFamily: Fonts.mono,
  },
  periodActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  periodAction: {
    minHeight: 40,
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: '#00000066',
  },
  passwordCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  passwordTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  passwordInput: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
    fontFamily: Fonts.mono,
  },
  passwordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.four,
  },
  passwordButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  pressed: {
    opacity: 0.75,
  },
});
