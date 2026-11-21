import type { Locale } from './provider';
import { getMessages } from './translations';
import type { en } from './translations';

export type MetricId =
  | 'accountValue'
  | 'netAssetValue'
  | 'equity'
  | 'balance'
  | 'freeFunds'
  | 'collateral'
  | 'closedTrades'
  | 'profitLoss'
  | 'accountChange'
  | 'dividends'
  | 'deposits'
  | 'withdrawals'
  | 'fees'
  | 'swaps'
  | 'unrealizedPnl'
  | 'unrealizedPnlPercent'
  | 'realizedPnl'
  | 'realizedPnlPercent'
  | 'totalIncome'
  | 'tradedVolume'
  | 'securitiesValue'
  | 'securitiesShare'
  | 'positions'
  | 'assetClasses'
  | 'valued'
  | 'unvalued'
  | 'hhi'
  | 'effectivePositions'
  | 'topThreeAccount'
  | 'topThreeSecurities'
  | 'topOneAccount'
  | 'topOneSecurities'
  | 'topFiveAccount'
  | 'topFiveSecurities'
  | 'snapshots'
  | 'cashFlowPeriods'
  | 'cumulativeReturn'
  | 'twr'
  | 'cagr'
  | 'annualizedReturn'
  | 'annualizedVolatility'
  | 'downsideDeviation'
  | 'maxDrawdown'
  | 'drawdownDuration'
  | 'calmar'
  | 'sharpe'
  | 'sortino'
  | 'omega'
  | 'trackingError'
  | 'informationRatio'
  | 'upsideDownsideCapture'
  | 'jensenAlpha'
  | 'famaFrenchAlpha'
  | 'brinsonAllocation'
  | 'brinsonSelection'
  | 'benchmarkFred'
  | 'alpha'
  | 'beta'
  | 'rSquared'
  | 'treynor'
  | 'activeShare'
  | 'contributionToReturn'
  | 'yieldOnCost'
  | 'currentDividendYield'
  | 'sectorExposure'
  | 'countryExposure'
  | 'currencyExposure'
  | 'winRate'
  | 'profitFactor'
  | 'payoffRatio'
  | 'expectancy'
  | 'turnoverRate'
  | 'feeTaxDrag'
  | 'weightedPE'
  | 'weightedPS'
  | 'weightedPB'
  | 'weightedEvEbitda'
  | 'weightedROE'
  | 'weightedDebtEquity'
  | 'mwrXirr'
  | 'var95'
  | 'cvar95'
  | 'largestPosition'
  | 'positionShare'
  | 'unknown';

const SOURCE_METRIC_IDS: Record<string, MetricId> = {
  'Стоимость счета': 'accountValue', 'Стоимость счёта': 'accountValue', 'Account Value': 'accountValue',
  'Net Asset Value': 'netAssetValue', Equity: 'equity', Баланс: 'balance', Balance: 'balance',
  'Свободные средства': 'freeFunds', Обеспечение: 'collateral',
  'Закрытых сделок': 'closedTrades', 'Closed trades': 'closedTrades',
  'Прибыль / убыток': 'profitLoss', 'Изменение счёта': 'accountChange',
  Дивиденды: 'dividends', Dividends: 'dividends',
  Пополнения: 'deposits', Deposits: 'deposits', Выводы: 'withdrawals', Withdrawals: 'withdrawals',
  Комиссии: 'fees', Fees: 'fees', Свопы: 'swaps', Swaps: 'swaps',
  'Unrealized PnL': 'unrealizedPnl', 'Unrealized PnL (%)': 'unrealizedPnlPercent',
  'Realized PnL': 'realizedPnl', 'Realized PnL (%)': 'realizedPnlPercent',
  'Общий доход': 'totalIncome', 'Объем сделок': 'tradedVolume', 'Объём сделок': 'tradedVolume',
  'Стоимость бумаг': 'securitiesValue', 'Доля бумаг в счёте': 'securitiesShare',
  'Доля бумаг в счете': 'securitiesShare', Позиции: 'positions', Positions: 'positions',
  Классы: 'assetClasses', 'Asset classes': 'assetClasses', Оценено: 'valued', 'Без оценки': 'unvalued',
  HHI: 'hhi', 'Эфф. позиций': 'effectivePositions',
  'Топ-3 (доля счёта)': 'topThreeAccount', 'Топ-3 (доля счета)': 'topThreeAccount',
  'Топ-3 (доля бумаг)': 'topThreeSecurities',
  'Снимков портфеля': 'snapshots', 'Периодов с денежными потоками': 'cashFlowPeriods',
  'Cumulative Return (TWR)': 'cumulativeReturn', TWR: 'twr', CAGR: 'cagr',
  'Annualized Return': 'annualizedReturn', 'Стандартное отклонение (год.)': 'annualizedVolatility',
  'Downside Deviation (год.)': 'downsideDeviation', 'Max Drawdown': 'maxDrawdown',
  'Drawdown Duration': 'drawdownDuration', Calmar: 'calmar',
  'Sharpe (безрисковая ставка 0%)': 'sharpe', 'Sortino (целевая доходность 0%)': 'sortino',
  'Omega (порог 0%)': 'omega', 'Tracking Error': 'trackingError', 'Information Ratio': 'informationRatio',
  'Upside/Downside Capture': 'upsideDownsideCapture', 'Jensen’s Alpha': 'jensenAlpha',
  'Alpha Fama–French': 'famaFrenchAlpha', 'Brinson Allocation': 'brinsonAllocation',
  'Brinson Selection': 'brinsonSelection', 'Бенчмарк (FRED)': 'benchmarkFred',
  Alpha: 'alpha', Beta: 'beta', 'R²': 'rSquared', Treynor: 'treynor', 'Active Share': 'activeShare',
  'Contribution to Return': 'contributionToReturn', 'Yield on Cost': 'yieldOnCost',
  'Текущая дивидендная доходность': 'currentDividendYield',
  'Секторная экспозиция': 'sectorExposure', 'Страновая экспозиция': 'countryExposure',
  'Валютная экспозиция': 'currencyExposure', 'Win Rate': 'winRate',
  'Profit Factor': 'profitFactor', 'Payoff Ratio': 'payoffRatio', Expectancy: 'expectancy',
  'Turnover Rate': 'turnoverRate', 'Fee / Tax Drag': 'feeTaxDrag',
  'Средневзвешенный P/E': 'weightedPE', 'Средневзвешенный P/S': 'weightedPS',
  'Средневзвешенный P/B': 'weightedPB', 'Средневзвешенный EV/EBITDA': 'weightedEvEbitda',
  'Средневзвешенный ROE': 'weightedROE', 'Средневзвешенный Debt/Equity': 'weightedDebtEquity',
  'MWR / XIRR': 'mwrXirr', 'VaR 95% (период)': 'var95', 'CVaR 95% (период)': 'cvar95',
};

const DESCRIPTION_KEYS: Partial<Record<MetricId, keyof typeof en.portfolio.descriptions>> = {
  accountValue: 'accountValue', netAssetValue: 'netAssetValue', equity: 'equity', balance: 'balance',
  freeFunds: 'freeFunds', collateral: 'collateral', accountChange: 'accountChange',
  closedTrades: 'closedTrades', profitLoss: 'profitLoss', dividends: 'dividends',
  deposits: 'deposits', withdrawals: 'withdrawals', fees: 'fees', swaps: 'swaps',
  unrealizedPnl: 'unrealized', unrealizedPnlPercent: 'unrealizedPercent',
  realizedPnl: 'realized', realizedPnlPercent: 'realizedPercent', totalIncome: 'totalIncome',
  tradedVolume: 'tradedVolume', securitiesValue: 'securitiesValue', securitiesShare: 'securitiesShare',
  topThreeAccount: 'topThreeAccount', topThreeSecurities: 'topThreeSecurities',
  snapshots: 'snapshots', cashFlowPeriods: 'cashFlowPeriods', cumulativeReturn: 'cumulativeReturn',
  annualizedReturn: 'annualizedReturn', mwrXirr: 'moneyWeightedReturn', maxDrawdown: 'maxDrawdown',
  drawdownDuration: 'drawdownDuration', winRate: 'winRate', profitFactor: 'profitFactor',
  payoffRatio: 'payoffRatio', expectancy: 'expectancy',
};

export function normalizeMetricId(value: string): MetricId {
  const directId = value as MetricId;
  if (value in SOURCE_METRIC_IDS) return SOURCE_METRIC_IDS[value];
  if (value.includes('.')) return 'unknown';
  if (/^(?:accountValue|netAssetValue|equity|balance|freeFunds|collateral|closedTrades|profitLoss|accountChange|dividends|deposits|withdrawals|fees|swaps|unrealizedPnl|unrealizedPnlPercent|realizedPnl|realizedPnlPercent|totalIncome|tradedVolume|securitiesValue|securitiesShare|positions|assetClasses|valued|unvalued|hhi|effectivePositions|topThreeAccount|topThreeSecurities|topOneAccount|topOneSecurities|topFiveAccount|topFiveSecurities|snapshots|cashFlowPeriods|cumulativeReturn|twr|cagr|annualizedReturn|annualizedVolatility|downsideDeviation|maxDrawdown|drawdownDuration|calmar|sharpe|sortino|omega|trackingError|informationRatio|upsideDownsideCapture|jensenAlpha|famaFrenchAlpha|brinsonAllocation|brinsonSelection|benchmarkFred|alpha|beta|rSquared|treynor|activeShare|contributionToReturn|yieldOnCost|currentDividendYield|sectorExposure|countryExposure|currencyExposure|winRate|profitFactor|payoffRatio|expectancy|turnoverRate|feeTaxDrag|weightedPE|weightedPS|weightedPB|weightedEvEbitda|weightedROE|weightedDebtEquity|mwrXirr|var95|cvar95|largestPosition|positionShare|unknown)$/.test(directId)) {
    return directId;
  }
  return 'unknown';
}

export function localizeMetricLabel(metric: MetricId | string, locale: Locale, fallbackLabel?: string) {
  const id = normalizeMetricId(metric);
  if (id === 'unknown') {
    if (/^Доля /.test(fallbackLabel ?? metric)) {
      const symbol = /^Доля (.+?) \(/.exec(fallbackLabel ?? metric)?.[1];
      if (symbol) return locale === 'en' ? `${symbol} weight` : locale === 'pl' ? `Udział ${symbol}` : `Доля ${symbol}`;
    }
    if (/^Макс\. /.test(fallbackLabel ?? metric)) {
      const match = /^Макс\. (.+?) \((сч\.|поз\.)\)$/.exec(fallbackLabel ?? metric);
      if (match) {
        if (locale === 'en') return `Largest: ${match[1]} (${match[2] === 'сч.' ? 'account' : 'position'})`;
        if (locale === 'pl') return `Największa: ${match[1]} (${match[2] === 'сч.' ? 'rachunek' : 'pozycja'})`;
        return fallbackLabel ?? metric;
      }
    }
  }
  return getMessages(locale).portfolio.metrics[id] ?? fallbackLabel ?? metric;
}

export function getLocalizedMetricDescription(metric: MetricId | string, locale: Locale) {
  const id = normalizeMetricId(metric);
  const key = DESCRIPTION_KEYS[id] ??
    (/комисс|налог|fee|tax/i.test(metric)
      ? 'feesOrTaxes'
      : /дивиденд|dividend/i.test(metric)
        ? 'dividendMetric'
        : /доходност|return|profit|p.?l|прибыл|убыток/i.test(metric)
          ? 'performanceMetric'
          : 'generic');
  return getMessages(locale).portfolio.descriptions[key];
}
