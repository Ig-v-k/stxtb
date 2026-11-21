import type { Locale } from './provider';
import { getMessages } from './translations';
import type { en } from './translations';

const METRIC_LABELS: Record<string, { en: string; ru: string }> = {
  'Стоимость счета': { en: 'Account value', ru: 'Счёт' },
  'Стоимость счёта': { en: 'Account value', ru: 'Счёт' },
  'Account Value': { en: 'Account value', ru: 'Счёт' },
  'Net Asset Value': { en: 'Net asset value', ru: 'Счёт' },
  Equity: { en: 'Equity', ru: 'Счёт' },
  Баланс: { en: 'Balance', ru: 'Баланс' },
  Balance: { en: 'Balance', ru: 'Баланс' },
  'Свободные средства': { en: 'Free funds', ru: 'Св. средства' },
  Обеспечение: { en: 'Margin', ru: 'Обеспечение' },
  'Unrealized PnL': { en: 'Unrealized P&L', ru: 'Откр. результат' },
  'Unrealized PnL (%)': { en: 'Unrealized P&L %', ru: 'Откр. результат %' },
  'Realized PnL': { en: 'Realized P&L', ru: 'Closed P&L' },
  'Realized PnL (%)': { en: 'Realized P&L %', ru: 'Closed P&L %' },
  'Стоимость открытых позиций': { en: 'Open positions', ru: 'Откр. позиции' },
  'Закрытых сделок': { en: 'Closed trades', ru: 'Сделки' },
  'Closed trades': { en: 'Closed trades', ru: 'Сделки' },
  'Прибыль / убыток': { en: 'Profit / loss', ru: 'P&L' },
  Дивиденды: { en: 'Dividends', ru: 'Дивиденды' },
  'Проценты на свободные средства': { en: 'Interest on free funds', ru: 'Проценты' },
  'Общий доход': { en: 'Total income', ru: 'Доход' },
  'Объем сделок': { en: 'Trading volume', ru: 'Оборот' },
  'Объём сделок': { en: 'Trading volume', ru: 'Оборот' },
  Пополнения: { en: 'Deposits', ru: 'Пополнения' },
  Выводы: { en: 'Withdrawals', ru: 'Выводы' },
  Комиссии: { en: 'Fees', ru: 'Комиссии' },
  Свопы: { en: 'Swaps', ru: 'Свопы' },
  'Изменение счёта': { en: 'Account change', ru: 'Δ счёта' },
  'Стоимость бумаг': { en: 'Securities value', ru: 'Бумаги' },
  'Доля бумаг в счёте': { en: 'Securities / account', ru: 'Бумаги / счёт' },
  'Доля бумаг в счете': { en: 'Securities / account', ru: 'Бумаги / счёт' },
  Оценено: { en: 'Valued', ru: 'Оценено' },
  'Эфф. позиций': { en: 'Effective positions', ru: 'Эфф. поз.' },
  'Топ-3 (доля счёта)': { en: 'Top 3 / account', ru: 'Топ-3 счёта, %' },
  'Топ-3 (доля счета)': { en: 'Top 3 / account', ru: 'Топ-3 счёта, %' },
  'Топ-3 (доля бумаг)': { en: 'Top 3 / securities', ru: 'Топ-3 бумаг, %' },
  'Топ-1 (доля счёта)': { en: 'Top position / account', ru: 'Топ-1 счёта, %' },
  'Топ-1 (доля счета)': { en: 'Top position / account', ru: 'Топ-1 счёта, %' },
  'Топ-1 (доля бумаг)': { en: 'Top position / securities', ru: 'Топ-1 бумаг, %' },
  'Топ-5 (доля счёта)': { en: 'Top 5 / account', ru: 'Топ-5 счёта, %' },
  'Топ-5 (доля счета)': { en: 'Top 5 / account', ru: 'Топ-5 счёта, %' },
  'Топ-5 (доля бумаг)': { en: 'Top 5 / securities', ru: 'Топ-5 бумаг, %' },
  'Без оценки': { en: 'Unvalued', ru: 'Без цены' },
  'Периодов с денежными потоками': { en: 'Cash flow periods', ru: 'Периоды' },
  'Cumulative Return (TWR)': { en: 'Cumulative return (TWR)', ru: 'Доходность TWR' },
  'Annualized Return': { en: 'Annualized return', ru: 'Год. доходность' },
  'Стандартное отклонение (год.)': { en: 'Annualized volatility', ru: 'σ (год.)' },
  'Downside Deviation (год.)': { en: 'Downside deviation', ru: 'Downside σ год.' },
  'Max Drawdown': { en: 'Max drawdown', ru: 'Макс. просадка' },
  'Drawdown Duration': { en: 'Drawdown duration', ru: 'DD (дни)' },
  'Sharpe (безрисковая ставка 0%)': { en: 'Sharpe ratio (0% risk-free)', ru: 'Sharpe (Rf 0%)' },
  'Sortino (целевая доходность 0%)': { en: 'Sortino ratio (0% target)', ru: 'Sortino (0%)' },
  'Omega (порог 0%)': { en: 'Omega ratio (0% threshold)', ru: 'Omega (0%)' },
  'Снимков портфеля': { en: 'Portfolio snapshots', ru: 'Снимки стоимости' },
  'Tracking Error': { en: 'Tracking error', ru: 'TE' },
  'Information Ratio': { en: 'Information ratio', ru: 'IR' },
  'Upside/Downside Capture': { en: 'Upside/downside capture', ru: 'Capture ↑/↓' },
  'Jensen’s Alpha': { en: 'Jensen’s alpha', ru: 'Jensen α' },
  'Alpha Fama–French': { en: 'Fama–French alpha', ru: 'F-F α' },
  'Brinson Allocation': { en: 'Brinson allocation', ru: 'Brinson Alloc.' },
  'Brinson Selection': { en: 'Brinson selection', ru: 'Brinson Sel.' },
  'Бенчмарк (FRED)': { en: 'Benchmark (FRED)', ru: 'Бенчмарк' },
  'Contribution to Return': { en: 'Contribution to return', ru: 'Вклад в доход' },
  'Yield on Cost': { en: 'Yield on cost', ru: 'YoC' },
  'Текущая дивидендная доходность': { en: 'Current dividend yield', ru: 'Див. доходн.' },
  'Секторная экспозиция': { en: 'Sector exposure', ru: 'Сектор' },
  'Страновая экспозиция': { en: 'Country exposure', ru: 'Страна' },
  'Валютная экспозиция': { en: 'Currency exposure', ru: 'Валюта' },
  'Win Rate': { en: 'Win rate', ru: 'Win %' },
  'Profit Factor': { en: 'Profit factor', ru: 'Фактор прибыли' },
  'Payoff Ratio': { en: 'Payoff ratio', ru: 'Payoff' },
  Expectancy: { en: 'Expectancy', ru: 'Среднее на сделку' },
  'Turnover Rate': { en: 'Turnover rate', ru: 'Оборот' },
  'Fee / Tax Drag': { en: 'Fees / tax drag', ru: 'Комис./налог' },
  'Средневзвешенный P/E': { en: 'Weighted P/E', ru: 'Взвеш. P/E' },
  'Средневзвешенный P/S': { en: 'Weighted P/S', ru: 'Взвеш. P/S' },
  'Средневзвешенный P/B': { en: 'Weighted P/B', ru: 'Взвеш. P/B' },
  'Средневзвешенный EV/EBITDA': { en: 'Weighted EV/EBITDA', ru: 'Взвеш. EV/EBITDA' },
  'Средневзвешенный ROE': { en: 'Weighted ROE', ru: 'Взвеш. ROE' },
  'Средневзвешенный Debt/Equity': { en: 'Weighted debt/equity', ru: 'Взвеш. D/E' },
  'MWR / XIRR': { en: 'Money-weighted return (XIRR)', ru: 'MWR (XIRR)' },
  'VaR 95% (период)': { en: 'VaR 95% (period)', ru: 'VaR 95%' },
  'CVaR 95% (период)': { en: 'CVaR 95% (period)', ru: 'CVaR 95%' },
};

const POLISH_METRIC_LABELS: Record<string, string> = {
  'Стоимость счета': 'Wartość rachunku',
  'Стоимость счёта': 'Wartość rachunku',
  'Account Value': 'Wartość rachunku',
  'Net Asset Value': 'Wartość aktywów netto',
  Equity: 'Kapitał własny',
  Баланс: 'Saldo',
  Balance: 'Saldo',
  'Свободные средства': 'Wolne środki',
  Обеспечение: 'Depozyt zabezpieczający',
  'Unrealized PnL': 'Niezrealizowany zysk/strata',
  'Unrealized PnL (%)': 'Niezrealizowany wynik %',
  'Realized PnL': 'Zrealizowany zysk/strata',
  'Realized PnL (%)': 'Zrealizowany wynik %',
  'Стоимость открытых позиций': 'Otwarte pozycje',
  'Закрытых сделок': 'Zamknięte transakcje',
  'Closed trades': 'Zamknięte transakcje',
  'Прибыль / убыток': 'Zysk / strata',
  Дивиденды: 'Dywidendy',
  'Проценты на свободные средства': 'Odsetki od wolnych środków',
  'Общий доход': 'Łączny dochód',
  'Объем сделок': 'Wolumen transakcji',
  'Объём сделок': 'Wolumen transakcji',
  Пополнения: 'Wpłaty',
  Выводы: 'Wypłaty',
  Комиссии: 'Opłaty',
  Свопы: 'Swapy',
  'Изменение счёта': 'Zmiana wartości rachunku',
  'Стоимость бумаг': 'Wartość papierów wartościowych',
  'Доля бумаг в счёте': 'Papiery / rachunek',
  'Доля бумаг в счете': 'Papiery / rachunek',
  Оценено: 'Wycenione',
  'Эфф. позиций': 'Efektywne pozycje',
  'Топ-3 (доля счёта)': 'Top 3 / rachunek',
  'Топ-3 (доля счета)': 'Top 3 / rachunek',
  'Топ-3 (доля бумаг)': 'Top 3 / papiery',
  'Топ-1 (доля счёта)': 'Top 1 / rachunek',
  'Топ-1 (доля счета)': 'Top 1 / rachunek',
  'Топ-1 (доля бумаг)': 'Top 1 / papiery',
  'Топ-5 (доля счёта)': 'Top 5 / rachunek',
  'Топ-5 (доля счета)': 'Top 5 / rachunek',
  'Топ-5 (доля бумаг)': 'Top 5 / papiery',
  'Без оценки': 'Bez wyceny',
  'Периодов с денежными потоками': 'Okresy przepływów pieniężnych',
  'Cumulative Return (TWR)': 'Skumulowana stopa zwrotu (TWR)',
  'Annualized Return': 'Roczna stopa zwrotu',
  'Стандартное отклонение (год.)': 'Zmienność roczna',
  'Downside Deviation (год.)': 'Odchylenie w dół',
  'Max Drawdown': 'Maksymalne obsunięcie',
  'Drawdown Duration': 'Czas obsunięcia',
  'Sharpe (безрисковая ставка 0%)': 'Wskaźnik Sharpe’a (stopa 0%)',
  'Sortino (целевая доходность 0%)': 'Wskaźnik Sortino (cel 0%)',
  'Omega (порог 0%)': 'Wskaźnik Omega (próg 0%)',
  'Снимков портфеля': 'Migawki portfela',
  'Tracking Error': 'Błąd odwzorowania',
  'Information Ratio': 'Wskaźnik informacyjny',
  'Upside/Downside Capture': 'Udział we wzrostach/spadkach',
  'Jensen’s Alpha': 'Alfa Jensena',
  'Alpha Fama–French': 'Alfa Fama–Frencha',
  'Brinson Allocation': 'Alokacja Brinsona',
  'Brinson Selection': 'Selekcja Brinsona',
  'Бенчмарк (FRED)': 'Benchmark (FRED)',
  'Contribution to Return': 'Wkład w stopę zwrotu',
  'Yield on Cost': 'Stopa zwrotu względem kosztu',
  'Текущая дивидендная доходность': 'Bieżąca stopa dywidendy',
  'Секторная экспозиция': 'Ekspozycja sektorowa',
  'Страновая экспозиция': 'Ekspozycja geograficzna',
  'Валютная экспозиция': 'Ekspozycja walutowa',
  'Win Rate': 'Skuteczność',
  'Profit Factor': 'Współczynnik zysku',
  'Payoff Ratio': 'Stosunek zysku do straty',
  Expectancy: 'Wartość oczekiwana',
  'Turnover Rate': 'Wskaźnik obrotu',
  'Fee / Tax Drag': 'Wpływ opłat i podatków',
  'Средневзвешенный P/E': 'Średnia ważona P/E',
  'Средневзвешенный P/S': 'Średnia ważona P/S',
  'Средневзвешенный P/B': 'Średnia ważona P/B',
  'Средневзвешенный EV/EBITDA': 'Średnia ważona EV/EBITDA',
  'Средневзвешенный ROE': 'Średnia ważona ROE',
  'Средневзвешенный Debt/Equity': 'Średni ważony dług/kapitał',
  'MWR / XIRR': 'Stopa ważona przepływami (XIRR)',
  'VaR 95% (период)': 'VaR 95% (okres)',
  'CVaR 95% (период)': 'CVaR 95% (okres)',
};

const DESCRIPTION_KEYS: Record<string, keyof typeof en.portfolio.descriptions> = {
  'Стоимость счета': 'accountValue',
  'Стоимость счёта': 'accountValue',
  'Account Value': 'accountValue',
  'Net Asset Value': 'netAssetValue',
  Equity: 'equity',
  Баланс: 'balance',
  Balance: 'balance',
  'Свободные средства': 'freeFunds',
  Обеспечение: 'collateral',
  'Закрытых сделок': 'closedTrades',
  'Closed trades': 'closedTrades',
  'Изменение счёта': 'accountChange',
  'Прибыль / убыток': 'profitLoss',
  Дивиденды: 'dividends',
  Пополнения: 'deposits',
  Deposits: 'deposits',
  Выводы: 'withdrawals',
  Withdrawals: 'withdrawals',
  Комиссии: 'fees',
  Fees: 'fees',
  Свопы: 'swaps',
  'Unrealized PnL': 'unrealized',
  'Unrealized PnL (%)': 'unrealizedPercent',
  'Realized PnL': 'realized',
  'Realized PnL (%)': 'realizedPercent',
  'Общий доход': 'totalIncome',
  'Объем сделок': 'tradedVolume',
  'Стоимость бумаг': 'securitiesValue',
  'Доля бумаг в счёте': 'securitiesShare',
  'Доля бумаг в счете': 'securitiesShare',
  'Топ-3 (доля счёта)': 'topThreeAccount',
  'Топ-3 (доля счета)': 'topThreeAccount',
  'Топ-3 (доля бумаг)': 'topThreeSecurities',
  'Снимков портфеля': 'snapshots',
  'Периодов с денежными потоками': 'cashFlowPeriods',
  'Cumulative Return (TWR)': 'cumulativeReturn',
  'Annualized Return': 'annualizedReturn',
  'MWR / XIRR': 'moneyWeightedReturn',
  'Max Drawdown': 'maxDrawdown',
  'Drawdown Duration': 'drawdownDuration',
  'Win Rate': 'winRate',
  'Profit Factor': 'profitFactor',
  'Payoff Ratio': 'payoffRatio',
  Expectancy: 'expectancy',
};

export function localizeMetricLabel(label: string, locale: Locale) {
  if (locale === 'pl') {
    if (label.startsWith('Доля ')) {
      const symbol = /^Доля (.+?) \(/.exec(label)?.[1];
      if (symbol) return `Udział ${symbol}`;
    }
    if (label.startsWith('Макс. ')) {
      const match = /^Макс\. (.+?) \((сч\.|поз\.)\)$/.exec(label);
      if (match) {
        return `Największa: ${match[1]} (${match[2] === 'сч.' ? 'rachunek' : 'pozycja'})`;
      }
    }
    return POLISH_METRIC_LABELS[label] ?? label;
  }
  if (label.startsWith('Доля ')) {
    const symbol = /^Доля (.+?) \(/.exec(label)?.[1];
    if (symbol) return locale === 'en' ? `${symbol} weight` : `Доля ${symbol}`;
  }
  if (label.startsWith('Макс. ')) {
    const match = /^Макс\. (.+?) \((сч\.|поз\.)\)$/.exec(label);
    if (match) {
      return locale === 'en'
        ? `Largest: ${match[1]} (${match[2] === 'сч.' ? 'account' : 'position'})`
        : label;
    }
  }
  return METRIC_LABELS[label]?.[locale] ?? label;
}

export function getLocalizedMetricDescription(label: string, locale: Locale) {
  const key =
    DESCRIPTION_KEYS[label] ??
    (/^Доля /.test(label)
      ? 'positionShare'
      : /^Макс\./.test(label)
        ? 'largestPosition'
        : /комисс|налог|fee|tax/i.test(label)
          ? 'feesOrTaxes'
          : /дивиденд|dividend/i.test(label)
            ? 'dividendMetric'
            : /доходност|return|profit|p.?l|прибыл|убыток/i.test(label)
              ? 'performanceMetric'
              : 'generic');
  return getMessages(locale).portfolio.descriptions[key];
}
