import AsyncStorage from '@react-native-async-storage/async-storage';

export type MarketDataPoint = {
  date: string;
  value: number;
};

export type BenchmarkData = {
  prices: MarketDataPoint[];
  riskFreeRates: MarketDataPoint[];
  fetchedAt: number;
};

export type BenchmarkDataResult = {
  data: BenchmarkData;
  stale: boolean;
};

const STORAGE_KEY = '@stxtb/benchmark-data/fred-sp500-dgs3mo-v1';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const FRED_BASE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
let loadingBenchmarkData: Promise<BenchmarkDataResult> | null = null;

function isMarketDataPoint(value: unknown): value is MarketDataPoint {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const point = value as Record<string, unknown>;
  return (
    typeof point.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
    typeof point.value === 'number' &&
    Number.isFinite(point.value)
  );
}

function parseCachedData(value: unknown): BenchmarkData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const cache = value as Record<string, unknown>;
  if (
    typeof cache.fetchedAt !== 'number' ||
    !Number.isFinite(cache.fetchedAt) ||
    !Array.isArray(cache.prices) ||
    !cache.prices.every(isMarketDataPoint) ||
    cache.prices.length < 2 ||
    !Array.isArray(cache.riskFreeRates) ||
    !cache.riskFreeRates.every(isMarketDataPoint) ||
    cache.riskFreeRates.length < 2
  ) {
    return null;
  }
  return {
    prices: cache.prices,
    riskFreeRates: cache.riskFreeRates,
    fetchedAt: cache.fetchedAt,
  };
}

function parseFredCsv(csv: string, series: string) {
  const rows = csv.trim().split(/\r?\n/).slice(1);
  const points = rows.flatMap((row) => {
    const [date, rawValue] = row.split(',');
    const value = Number(rawValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !rawValue || !Number.isFinite(value)) {
      return [];
    }
    return [{ date, value }];
  });
  if (points.length < 2) {
    throw new Error(`FRED вернул недостаточно точек для ряда ${series}.`);
  }
  return points;
}

async function fetchFredSeries(series: 'SP500' | 'DGS3MO') {
  const url = `${FRED_BASE_URL}?id=${series}&cosd=2006-01-01`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FRED вернул HTTP ${response.status} для ряда ${series}.`);
  }
  return parseFredCsv(await response.text(), series);
}

export function loadBenchmarkData(): Promise<BenchmarkDataResult> {
  if (loadingBenchmarkData) {
    return loadingBenchmarkData;
  }

  const pending = fetchAndCacheBenchmarkData().finally(() => {
    loadingBenchmarkData = null;
  });
  loadingBenchmarkData = pending;
  return pending;
}

async function fetchAndCacheBenchmarkData(): Promise<BenchmarkDataResult> {
  const cachedText = await AsyncStorage.getItem(STORAGE_KEY);
  let cached: BenchmarkData | null = null;
  if (cachedText !== null) {
    try {
      cached = parseCachedData(JSON.parse(cachedText));
    } catch (error) {
      console.error('Failed to parse the cached FRED benchmark data.', error);
    }
    if (!cached) {
      console.error('The cached FRED benchmark data is invalid and will be removed.');
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }

  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) {
    return { data: cached, stale: false };
  }

  try {
    const [prices, riskFreeRates] = await Promise.all([
      fetchFredSeries('SP500'),
      fetchFredSeries('DGS3MO'),
    ]);
    const data = { prices, riskFreeRates, fetchedAt: Date.now() };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to cache the FRED benchmark data locally.', error);
    }
    return { data, stale: false };
  } catch (error) {
    if (cached) {
      console.error('FRED refresh failed; using the locally cached benchmark data.', error);
      return { data: cached, stale: true };
    }
    throw error;
  }
}
