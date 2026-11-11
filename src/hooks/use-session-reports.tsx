import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ImportedReport, StatementPeriod } from '@/utils/imported-files';

type SessionReportsContextValue = {
  reports: ImportedReport[];
  addReports: (reports: ImportedReport[]) => void;
  updateReportPeriod: (id: string, period: StatementPeriod) => void;
  clearReports: () => void;
};

const SessionReportsContext = createContext<SessionReportsContextValue | null>(null);
const LEGACY_IMPORTED_REPORTS_STORAGE_KEY = '@stxtb/imported-files';

export function SessionReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<ImportedReport[]>([]);

  useEffect(() => {
    void AsyncStorage.removeItem(LEGACY_IMPORTED_REPORTS_STORAGE_KEY).catch((error: unknown) => {
      console.error('Failed to remove the legacy imported-report cache.', error);
    });
  }, []);

  const addReports = useCallback((additions: ImportedReport[]) => {
    setReports((current) => [...additions, ...current]);
  }, []);

  const updateReportPeriod = useCallback((id: string, period: StatementPeriod) => {
    setReports((current) =>
      current.map((report) =>
        report.id === id ? { ...report, period, periodConflict: false } : report
      )
    );
  }, []);

  const clearReports = useCallback(() => {
    setReports([]);
  }, []);

  const value = useMemo(
    () => ({ reports, addReports, updateReportPeriod, clearReports }),
    [reports, addReports, updateReportPeriod, clearReports]
  );

  return (
    <SessionReportsContext.Provider value={value}>
      {children}
    </SessionReportsContext.Provider>
  );
}

export function useSessionReports() {
  const context = useContext(SessionReportsContext);
  if (!context) {
    throw new Error('useSessionReports must be used within SessionReportsProvider.');
  }
  return context;
}
