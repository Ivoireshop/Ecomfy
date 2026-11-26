import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

interface Options<T> {
  /**
   * Lit au plus `limit` lignes situées après `after` (la dernière ligne affichée), ou les premières si `after` est null.
   * Doit lever une erreur si la lecture échoue.
   */
  fetchBatch: (after: T | null, limit: number) => Promise<T[]>;
  batchSize?: number;
  /** Tout changement relit la liste depuis le début. */
  refreshKey?: string | number;
  enabled?: boolean;
}

/**
 * Liste « Charger plus » : reprend après la dernière ligne connue, sans doublon ni trou
 * même si de nouvelles lignes arrivent entre deux lectures.
 */
export function useLoadMore<T>({ fetchBatch, batchSize = 25, refreshKey = "", enabled = true }: Options<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  const fetchRef = useRef(fetchBatch);
  fetchRef.current = fetchBatch;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Une relecture depuis le début rend caduques les lectures encore en cours.
  const generation = useRef(0);
  const busy = useRef(false);

  // Une ligne de plus que demandé dit s'il en reste, sans requête de comptage.
  const read = useCallback(async (after: T | null) => {
    const batch = await fetchRef.current(after, batchSize + 1);
    return { batch: batch.slice(0, batchSize), more: batch.length > batchSize };
  }, [batchSize]);

  useEffect(() => {
    const current = ++generation.current;
    busy.current = false;
    setLoadingMore(false);
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (rowsRef.current.length === 0) setLoading(true);
    read(null).then(
      ({ batch, more }) => {
        if (current !== generation.current) return;
        setRows(batch);
        setHasMore(more);
        setError(null);
        setLoading(false);
      },
      (e: unknown) => {
        if (current !== generation.current) return;
        setRows([]);
        setHasMore(false);
        setError(toError(e));
        setLoading(false);
      },
    );
  }, [enabled, refreshKey, version, read]);

  const loadMore = useCallback(async () => {
    const last = rowsRef.current[rowsRef.current.length - 1];
    if (busy.current || !last) return;
    busy.current = true;
    setLoadingMore(true);
    const current = generation.current;
    try {
      const { batch, more } = await read(last);
      if (current !== generation.current) return;
      setRows((previous) => [...previous, ...batch]);
      setHasMore(more);
      setError(null);
    } catch (e) {
      // Les lignes déjà affichées restent ; le bouton permet de réessayer.
      if (current === generation.current) setError(toError(e));
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [read]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { rows, setRows: setRows as Dispatch<SetStateAction<T[]>>, hasMore, loading, loadingMore, error, loadMore, reload };
}

const toError = (e: unknown) =>
  e instanceof Error ? e : new Error(String((e as { message?: string })?.message ?? e));
