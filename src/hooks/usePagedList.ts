import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_SIZE, pageCount, type PageResult } from "@/lib/pagination";

interface Options<T> {
  /** Lit une page. Doit lever une erreur si la lecture échoue : une liste vide signifie « aucun résultat ». */
  fetchPage: (args: { page: number; pageSize: number; search: string }) => Promise<PageResult<T>>;
  /** Tout ce qui change le contenu (boutique, filtres…) : la liste revient à la page 1. */
  filterKey?: string;
  search?: string;
  pageSize?: number;
  /** Tout changement relit la page affichée, sans revenir à la première. */
  refreshKey?: string | number;
  /** Tant que false, rien n'est lu. */
  enabled?: boolean;
}

/** Liste paginée par le serveur, avec numéros de page et total. */
export function usePagedList<T>({ fetchPage, filterKey = "", search = "", pageSize = PAGE_SIZE, refreshKey = "", enabled = true }: Options<T>) {
  const debouncedSearch = useDebounced(search.trim(), 300);
  const resetKey = JSON.stringify([filterKey, debouncedSearch, pageSize]);

  // La page est liée aux filtres qui l'ont produite : en changer ramène à la page 1 sans lire la mauvaise page.
  const [position, setPosition] = useState({ key: resetKey, page: 1 });
  const page = position.key === resetKey ? position.page : 1;
  // L'ancienne position est oubliée : revenir à un filtre déjà utilisé ne doit pas rouvrir son ancienne page.
  if (position.key !== resetKey) setPosition({ key: resetKey, page: 1 });
  const setPage = useCallback((next: number) => setPosition({ key: resetKey, page: next }), [resetKey]);

  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const loadedKeyRef = useRef("");

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const viewKey = `${resetKey}#${page}`;
    // Une actualisation de la même vue garde les lignes à l'écran ; un changement de vue montre le chargement.
    if (loadedKeyRef.current !== viewKey) setLoading(true);
    fetchRef.current({ page, pageSize, search: debouncedSearch }).then(
      (result) => {
        if (cancelled) return;
        const pages = pageCount(result.total, pageSize);
        // Dernières lignes de la dernière page supprimées : on recule.
        if (result.rows.length === 0 && page > pages) {
          setPosition({ key: resetKey, page: pages });
          return;
        }
        loadedKeyRef.current = viewKey;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
        setLoading(false);
      },
      (e: unknown) => {
        if (cancelled) return;
        loadedKeyRef.current = "";
        setRows([]);
        setError(e instanceof Error ? e : new Error(String((e as { message?: string })?.message ?? e)));
        setLoading(false);
      },
    );
    return () => { cancelled = true; };
  }, [enabled, resetKey, page, pageSize, debouncedSearch, version, refreshKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { rows, total, page, pageSize, setPage, loading, error, reload, search: debouncedSearch };
}

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
