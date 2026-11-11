export const IMPORTED_FILES_STORAGE_KEY = '@stxtb/imported-files';

export function sanitizeImportedFileName(name: string) {
  const sanitized = name
    .replace(/^\d+[_-]+/, '')
    .replace(/\d{5,}/g, '')
    .replace(/[_-]{2,}/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '');
  return sanitized || 'PDF-отчет';
}

export type StatementStatistic = {
  label: string;
  value: string;
};

export type StatementPosition = {
  number: string;
  symbol: string;
  instrumentName: string;
  isin: string;
  assetClass: string;
  marketValue: string;
  volume: string;
};

export type ImportedFile = {
  id: string;
  name: string;
  importedAt: string;
  size: number | null;
  statistics?: StatementStatistic[];
  accountCurrency?: string;
  positions?: StatementPosition[];
  hasOtherAssets?: boolean;
  analysisError?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isStatementStatistic(value: unknown): value is StatementStatistic {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.value === 'string'
  );
}

function isStatementPosition(value: unknown): value is StatementPosition {
  return (
    isRecord(value) &&
    typeof value.number === 'string' &&
    typeof value.symbol === 'string' &&
    typeof value.instrumentName === 'string' &&
    typeof value.isin === 'string' &&
    typeof value.assetClass === 'string' &&
    typeof value.marketValue === 'string' &&
    typeof value.volume === 'string'
  );
}

export function isImportedFile(value: unknown): value is ImportedFile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.importedAt === 'string' &&
    (typeof value.size === 'number' || value.size === null) &&
    (value.statistics === undefined ||
      (Array.isArray(value.statistics) && value.statistics.every(isStatementStatistic))) &&
    (value.accountCurrency === undefined || typeof value.accountCurrency === 'string') &&
    (value.positions === undefined ||
      (Array.isArray(value.positions) && value.positions.every(isStatementPosition))) &&
    (value.hasOtherAssets === undefined || typeof value.hasOtherAssets === 'boolean') &&
    (value.analysisError === undefined || typeof value.analysisError === 'string')
  );
}
