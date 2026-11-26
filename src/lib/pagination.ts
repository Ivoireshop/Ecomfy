// Pagination côté serveur : calculs partagés par toutes les listes.

export const PAGE_SIZE = 25;

export interface PageResult<T> {
  rows: T[];
  total: number;
}

/** Bornes (incluses) à passer à `.range()` pour la page demandée, la première étant la page 1. */
export function pageRange(page: number, pageSize: number = PAGE_SIZE): [number, number] {
  const from = (Math.max(1, Math.floor(page) || 1) - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function pageCount(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Numéros à afficher : première, dernière, voisines de la page courante ; `null` marque une coupure. */
export function pageNumbers(page: number, pages: number): (number | null)[] {
  const wanted = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  wanted.forEach((n, i) => {
    const previous = wanted[i - 1];
    // Un seul numéro manquant s'affiche : « … » prendrait la même place.
    if (previous !== undefined && n - previous === 2) out.push(n - 1);
    else if (previous !== undefined && n - previous > 2) out.push(null);
    out.push(n);
  });
  return out;
}

/**
 * Filtre `.or()` « une de ces colonnes contient le texte ».
 * La valeur est mise entre guillemets (virgules et parenthèses font partie de la syntaxe de PostgREST),
 * et les jokers saisis par l'utilisateur sont neutralisés. Renvoie `null` si la recherche est vide.
 */
export function searchFilter(columns: string[], query: string): string | null {
  const term = query.trim();
  if (!term) return null;
  const like = term.replace(/[\\%_]/g, "\\$&").replace(/\*/g, "_");
  const quoted = `"%${like.replace(/[\\"]/g, "\\$&")}%"`;
  return columns.map((c) => `${c}.ilike.${quoted}`).join(",");
}
