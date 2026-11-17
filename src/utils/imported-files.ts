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

export function isMetricValueAvailable(value: string) {
  const normalized = value.trim();
  return (
    !/^(?:—|–|н\/д|н\.д\.|n\/a|na)(?:\s|$|[.(])/i.test(normalized) &&
    !/^(?:недоступен:|доступен только|загрузка общедоступных рядов)/i.test(normalized) &&
    !/(?:·\s*)[—–]\s*\(/.test(normalized)
  );
}

export type StatementPeriod =
  | {
      kind: 'range';
      start: string;
      end: string;
      source: 'pdf' | 'filename' | 'manual' | 'xlsx';
    }
  | {
      kind: 'all-time';
      source: 'pdf' | 'manual';
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

export type ImportedReport = {
  id: string;
  name: string;
  size: number | null;
  period: StatementPeriod | null;
  periodConflict?: boolean;
  statistics?: StatementStatistic[];
  accountCurrency?: string;
  positions?: StatementPosition[];
  hasOtherAssets?: boolean;
  analysisError?: string;
};
