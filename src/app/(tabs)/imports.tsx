import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { extractText, isAvailable } from 'expo-pdf-text-extract';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { SettingsButton } from '@/components/settings-button';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSessionReports } from '@/hooks/use-session-reports';
import { useTheme } from '@/hooks/use-theme';
import {
  formatNumber,
  formatReportCount,
  formatReportPeriod,
  interpolate,
} from '@/i18n/formatters';
import { useLocalization, type Locale } from '@/i18n/provider';
import type { LocalizationMessages } from '@/i18n/translations';
import type { ImportedReport, StatementPeriod } from '@/utils/imported-files';
import { sanitizeImportedFileName } from '@/utils/imported-files';
import { parseStatement } from '@/utils/statement-stats';
import { parseXtbWorkbook } from '@/utils/xtb-workbook';

function formatFileSize(
  size: number | null,
  locale: Locale,
  messages: LocalizationMessages['imports']
) {
  if (size === null) {
    return messages.noSize;
  }
  if (size < 1024) {
    return `${formatNumber(size, locale)} ${messages.fileSize.bytes}`;
  }
  if (size < 1024 * 1024) {
    return `${formatNumber(size / 1024, locale)} ${messages.fileSize.kilobytes}`;
  }
  return `${formatNumber(size / (1024 * 1024), locale)} ${messages.fileSize.megabytes}`;
}

function getPeriodSourceLabel(
  period: StatementPeriod,
  messages: LocalizationMessages['imports']
) {
  if (period.source === 'filename') {
    return messages.sourceFilename;
  }
  if (period.source === 'manual') {
    return messages.sourceManual;
  }
  if (period.source === 'xlsx') {
    return messages.sourceXlsx;
  }
  return messages.sourcePdf;
}

function getPdfErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

export default function ImportsScreen() {
  const theme = useTheme();
  const { locale, messages } = useLocalization();
  const { reports, addReports, clearReports } = useSessionReports();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const passwordResolver = useRef<((password: string | null) => void) | null>(null);
  function requestPdfPassword(incorrect = false) {
    setPdfPassword('');
    setPasswordMessage(
      incorrect
        ? messages.imports.passwordIncorrect
        : messages.imports.passwordPrompt
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
          throw new Error(messages.imports.passwordCancelled);
        }
        password = enteredPassword;
      }
    }
  }

  function clearCurrentReports() {
    clearReports();
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
        setError(messages.imports.selectFileError);
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
        let analysisIssue: ImportedReport['analysisIssue'];

        if (isAvailable()) {
          const text = await extractPdfText(file.uri);
          statement = parseStatement(text, file.name);
          if (statement.statistics.length === 0 && statement.positions.length === 0) {
            analysisIssue = 'no-metrics';
          }
        } else {
          analysisIssue = 'pdf-unavailable';
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
          analysisIssue,
          analysisError,
        });
      }

      addReports(additions);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? interpolate(messages.imports.fileError, { message: importError.message })
          : messages.imports.filesError
      );
    } finally {
      setImporting(false);
    }
  }

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
                  {messages.imports.brand}
                </ThemedText>
              </View>
              <SettingsButton />
            </View>
            <ThemedText type="title" style={styles.title}>
              {messages.imports.title}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {messages.imports.description}
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
                {messages.imports.chooseFiles}
              </ThemedText>
            )}
          </Pressable>

          <View style={styles.historyHeader}>
            <View style={styles.historyHeading}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                {messages.imports.reportsTitle}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {messages.imports.reportsSubtitle}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {formatReportCount(reports.length, locale)}
            </ThemedText>
          </View>
          {reports.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={clearCurrentReports}
              style={styles.clearButton}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {messages.imports.clearResults}
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
                {messages.imports.emptyTitle}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                {messages.imports.emptyDescription}
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.fileList}>
              {reports.map((report) => {
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
                        {formatFileSize(report.size, locale, messages.imports)} · {formatReportPeriod(report.period, locale)}
                      </ThemedText>
                      {report.period && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {getPeriodSourceLabel(report.period, messages.imports)}
                        </ThemedText>
                      )}
                      {report.periodConflict && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {messages.imports.periodConflict}
                        </ThemedText>
                      )}
                      {report.analysisIssue && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {report.analysisIssue === 'no-metrics'
                            ? messages.imports.noMetricsError
                            : messages.imports.developmentBuildError}
                        </ThemedText>
                      )}
                      {report.analysisError && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {report.analysisError}
                        </ThemedText>
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
              {messages.imports.passwordTitle}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {passwordMessage}
            </ThemedText>
            <TextInput
              accessibilityLabel={messages.imports.passwordLabel}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPdfPassword}
              onSubmitEditing={() => finishPasswordPrompt(pdfPassword)}
              placeholder={messages.imports.passwordPlaceholder}
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
                  {messages.common.cancel}
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => finishPasswordPrompt(pdfPassword)}
                style={styles.passwordButton}>
                <ThemedText type="smallBold">{messages.common.continue}</ThemedText>
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
  },
  scrollView: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
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
  logo: {
    width: 20,
    height: 20,
    borderRadius: Spacing.one,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
  },
  historyHeading: {
    gap: Spacing.one,
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
