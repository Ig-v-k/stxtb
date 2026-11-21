import { useMemo, useState } from 'react';

import { PortfolioDashboard } from '@/components/portfolio-dashboard';
import { useBenchmarkData } from '@/hooks/use-benchmark-data';
import { useSessionReports } from '@/hooks/use-session-reports';
import { hasBenchmarkHistory, type Metric } from '@/utils/portfolio-metrics';
import { buildPortfolioScreenData } from '@/utils/portfolio-screen';
import { formatReportPeriod } from '@/i18n/formatters';
import { useLocalization } from '@/i18n/provider';

export default function HomeScreen() {
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const { reports } = useSessionReports();
  const { locale } = useLocalization();

  const sortedReports = useMemo(
    () =>
      reports
        .slice()
        .sort((first, second) => {
          const firstEnd = first.period?.kind === 'range' ? first.period.end : '';
          const secondEnd = second.period?.kind === 'range' ? second.period.end : '';
          return secondEnd.localeCompare(firstEnd);
        }),
    [reports]
  );

  const latestReport = sortedReports[0];
  const benchmarkState = useBenchmarkData(
    Boolean(
      latestReport &&
        latestReport.accountCurrency === 'USD' &&
        hasBenchmarkHistory(sortedReports, latestReport.accountCurrency)
    )
  );

  const dashboard = buildPortfolioScreenData(
    sortedReports,
    latestReport,
    benchmarkState
  );

  return (
    <PortfolioDashboard
      latestReport={latestReport}
      periodLabel={formatReportPeriod(latestReport?.period ?? null, locale)}
      primaryMetrics={dashboard.primaryMetrics}
      otherMetrics={dashboard.otherMetrics}
      availableMetricCount={dashboard.availableMetricCount}
      selectedMetric={selectedMetric}
      onSelectMetric={setSelectedMetric}
      onCloseMetric={() => setSelectedMetric(null)}
    />
  );
}
