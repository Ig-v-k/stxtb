import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { extractText, isAvailable } from 'expo-pdf-text-extract';
import { useEffect, useRef, useState } from 'react';
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
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  IMPORTED_FILES_STORAGE_KEY,
  isImportedFile,
  sanitizeImportedFileName,
  type ImportedFile,
} from '@/utils/imported-files';
import { parseStatement } from '@/utils/statement-stats';

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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Дата неизвестна';
  }
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPdfErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

export default function ImportsScreen() {
  const theme = useTheme();
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const passwordResolver = useRef<((password: string | null) => void) | null>(null);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const storedHistory = await AsyncStorage.getItem(IMPORTED_FILES_STORAGE_KEY);
        if (storedHistory === null) {
          return;
        }

        const parsed: unknown = JSON.parse(storedHistory);
        if (!Array.isArray(parsed) || !parsed.every(isImportedFile)) {
          throw new Error('Формат сохраненной истории поврежден.');
        }
        const safeHistory = parsed.map((file) => ({
          ...file,
          name: sanitizeImportedFileName(file.name),
        }));
        if (active) {
          setFiles(safeHistory);
        }
        if (safeHistory.some((file, index) => file.name !== parsed[index].name)) {
          await AsyncStorage.setItem(IMPORTED_FILES_STORAGE_KEY, JSON.stringify(safeHistory));
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? `Не удалось загрузить историю: ${loadError.message}`
              : 'Не удалось загрузить историю файлов.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, []);

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

  async function importPdfs() {
    setError(null);
    setImporting(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const selectedFiles = result.assets.filter(
        (asset) => asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf')
      );
      if (selectedFiles.length === 0) {
        setError('Выберите PDF-файл, чтобы добавить его в историю.');
        return;
      }

      const importedAt = new Date().toISOString();
      const additions: ImportedFile[] = [];

      for (const [index, file] of selectedFiles.entries()) {
        let statement: ReturnType<typeof parseStatement> | undefined;
        let analysisError: string | undefined;

        if (isAvailable()) {
          const text = await extractPdfText(file.uri);
          statement = parseStatement(text);
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
          importedAt,
          size: typeof file.size === 'number' ? file.size : null,
          statistics: statement?.statistics ?? [],
          accountCurrency: statement?.accountCurrency,
          positions: statement?.positions ?? [],
          hasOtherAssets: statement?.hasOtherAssets,
          analysisError,
        });
      }

      const updatedHistory = [...additions, ...files];

      await AsyncStorage.setItem(IMPORTED_FILES_STORAGE_KEY, JSON.stringify(updatedHistory));
      setFiles(updatedHistory);
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
              XTB · ИСТОРИЯ ИМПОРТА
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Файлы
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Выберите PDF-отчет, чтобы извлечь основные финансовые показатели.
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={importing || loading}
            onPress={importPdfs}
            style={({ pressed }) => [
              styles.importButton,
              { backgroundColor: theme.text },
              pressed && !importing && styles.pressed,
            ]}>
            {importing ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.importButtonText, { color: theme.background }]}>
                Выбрать PDF-файлы
              </ThemedText>
            )}
          </Pressable>

          <View style={styles.historyHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              История
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {files.length} {files.length === 1 ? 'файл' : 'файлов'}
            </ThemedText>
          </View>

          {error && (
            <ThemedView type="backgroundElement" style={styles.errorCard} accessibilityRole="alert">
              <ThemedText type="small">{error}</ThemedText>
            </ThemedView>
          )}

          {loading ? (
            <ActivityIndicator color={theme.textSecondary} style={styles.loader} />
          ) : files.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="subtitle" style={styles.emptyIcon}>
                PDF
              </ThemedText>
              <ThemedText type="smallBold">Здесь пока пусто</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                Добавленные отчеты появятся в этой истории.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.fileList}>
              {files.map((file) => (
                <ThemedView key={file.id} type="backgroundElement" style={styles.fileCard}>
                  <View style={styles.fileBadge}>
                    <ThemedText type="smallBold" style={styles.fileBadgeText}>
                      PDF
                    </ThemedText>
                  </View>
                  <View style={styles.fileDetails}>
                    <ThemedText type="smallBold" numberOfLines={2}>
                      {file.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDate(file.importedAt)} · {formatFileSize(file.size)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {file.statistics?.length
                        ? `Показателей: ${file.statistics.length}`
                        : file.analysisError ?? 'Импортируйте файл повторно для анализа'}
                    </ThemedText>
                  </View>
                </ThemedView>
              ))}
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
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  errorCard: {
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Spacing.three,
  },
  loader: {
    marginTop: Spacing.five,
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
