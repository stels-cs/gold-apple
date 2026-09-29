import { useCallback, useEffect, useRef } from 'react';
import { DATA_URL } from './data';
import type { Field } from './types';

/** Обёртка над воркером полнотекстового поиска. */
export function useSearch() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (ids: number[]) => void>());
  const seq = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ reqId: number; ids: number[] }>) => {
      pending.current.get(e.data.reqId)?.(e.data.ids);
      pending.current.delete(e.data.reqId);
    };
    w.postMessage({ reqId: 0, base: DATA_URL });
    worker.current = w;
    const map = pending.current;
    return () => {
      w.terminate();
      map.clear();
    };
  }, []);

  return useCallback(
    (field: Field, query: string, limit = 50) =>
      new Promise<number[]>((resolve) => {
        const reqId = ++seq.current;
        pending.current.set(reqId, resolve);
        worker.current?.postMessage({ reqId, field, query, limit });
      }),
    [],
  );
}
