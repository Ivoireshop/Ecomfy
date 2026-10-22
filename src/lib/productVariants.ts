// Variantes d'un produit : saisie dans l'éditeur, valeurs choisies par le client, affichage dans les commandes.

/**
 * Sépare « Blanc (S, M, L), Noir (S, M) » en deux options : une virgule à l'intérieur d'une parenthèse ne sépare pas.
 * Un simple split(",") cassait les options groupées dès qu'on retouchait la saisie.
 */
export function splitVariantOptions(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input || "") {
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if ((char === "," || char === ";") && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  const seen = new Set<string>();
  return parts
    .map((p) => p.trim())
    .filter((p) => {
      const key = p.toLowerCase();
      if (!p || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export interface VariantGroupLike {
  name?: string | null;
  options?: string[] | null;
}

/** Groupes utilisables : nom renseigné et au moins une option. Le nom est rogné, car c'est la clé du choix du client. */
export function usableVariantGroups<T extends VariantGroupLike>(variants: T[] | null | undefined): { name: string; options: string[] }[] {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((g) => ({
      name: String(g?.name ?? "").trim(),
      options: Array.isArray(g?.options) ? g!.options!.map((o) => String(o ?? "").trim()).filter(Boolean) : [],
    }))
    .filter((g) => g.name && g.options.length > 0);
}

/** Noms des groupes pour lesquels le client n'a encore rien choisi. */
export function missingVariantGroups(variants: VariantGroupLike[] | null | undefined, chosen: Record<string, string> | null | undefined): string[] {
  const selection = chosen || {};
  return usableVariantGroups(variants).filter((g) => !selection[g.name]).map((g) => g.name);
}

/**
 * Le sélecteur intelligent mémorise aussi « Couleur_main » et « Couleur_sub » pour piloter ses boutons.
 * Ces clés techniques ne doivent ni partir dans la commande ni s'afficher : seule la clé « Couleur » compte.
 */
export function cleanSelectedVariants(selection: Record<string, unknown> | null | undefined): Record<string, string> | null {
  if (!selection) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(selection)) {
    const technical = key.match(/^(.*)_(main|sub)$/);
    if (technical && Object.prototype.hasOwnProperty.call(selection, technical[1])) continue;
    if (value === undefined || value === null || value === "") continue;
    out[key] = String(value);
  }
  return Object.keys(out).length > 0 ? out : null;
}
