import { useEffect, useState } from 'react';

import {
  loadBenchmarkData,
  type BenchmarkData,
} from '@/utils/benchmark-data';

type BenchmarkState = {
  data: BenchmarkData | null;
  error: string | null;
  loading: boolean;
  stale: boolean;
};

const EMPTY_STATE: BenchmarkState = {
  data: null,
  error: null,
  loading: false,
  stale: false,
};

export function useBenchmarkData(enabled: boolean): BenchmarkState {
  const [state, setState] = useState<BenchmarkState>(EMPTY_STATE);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY_STATE);
      return;
    }

    let active = true;
    setState({ data: null, error: null, loading: true, stale: false });
    void loadBenchmarkData()
      .then(({ data, stale }) => {
        if (active) {
          setState({ data, error: null, loading: false, stale });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : 'Неизвестная ошибка FRED.',
            loading: false,
            stale: false,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}
