// Liste des pays supportés pour la validation des numéros de téléphone
// Longueurs nationales = nombre de chiffres SANS l'indicatif international

export interface PhoneCountry {
  code: string; // ISO alpha-2
  name: string;
  dial: string; // ex: "+225"
  flag: string; // emoji
  lengths: number[]; // longueurs nationales valides
  example: string; // exemple national
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "CI", name: "Côte d'Ivoire", dial: "+225", flag: "🇨🇮", lengths: [10], example: "07 00 00 00 00" },
  { code: "BF", name: "Burkina Faso", dial: "+226", flag: "🇧🇫", lengths: [8], example: "70 00 00 00" },
  { code: "BJ", name: "Bénin", dial: "+229", flag: "🇧🇯", lengths: [8, 10], example: "01 90 00 00 00" },
  { code: "TG", name: "Togo", dial: "+228", flag: "🇹🇬", lengths: [8], example: "90 00 00 00" },
  { code: "ML", name: "Mali", dial: "+223", flag: "🇲🇱", lengths: [8], example: "65 00 00 00" },
  { code: "NE", name: "Niger", dial: "+227", flag: "🇳🇪", lengths: [8], example: "90 00 00 00" },
  { code: "SN", name: "Sénégal", dial: "+221", flag: "🇸🇳", lengths: [9], example: "70 000 00 00" },
  { code: "GN", name: "Guinée", dial: "+224", flag: "🇬🇳", lengths: [9], example: "620 00 00 00" },
  { code: "MR", name: "Mauritanie", dial: "+222", flag: "🇲🇷", lengths: [8], example: "22 00 00 00" },
  { code: "CM", name: "Cameroun", dial: "+237", flag: "🇨🇲", lengths: [9], example: "6 70 00 00 00" },
  { code: "GA", name: "Gabon", dial: "+241", flag: "🇬🇦", lengths: [8, 9], example: "06 00 00 00" },
  { code: "CG", name: "Congo", dial: "+242", flag: "🇨🇬", lengths: [9], example: "06 000 00 00" },
  { code: "CD", name: "RD Congo", dial: "+243", flag: "🇨🇩", lengths: [9], example: "81 000 00 00" },
  { code: "TD", name: "Tchad", dial: "+235", flag: "🇹🇩", lengths: [8], example: "60 00 00 00" },
  { code: "CF", name: "Centrafrique", dial: "+236", flag: "🇨🇫", lengths: [8], example: "70 00 00 00" },
  { code: "MA", name: "Maroc", dial: "+212", flag: "🇲🇦", lengths: [9], example: "6 12 34 56 78" },
  { code: "DZ", name: "Algérie", dial: "+213", flag: "🇩🇿", lengths: [9], example: "5 12 34 56 78" },
  { code: "TN", name: "Tunisie", dial: "+216", flag: "🇹🇳", lengths: [8], example: "20 000 000" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷", lengths: [9], example: "6 12 34 56 78" },
  { code: "BE", name: "Belgique", dial: "+32", flag: "🇧🇪", lengths: [9], example: "4 70 12 34 56" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦", lengths: [10], example: "514 000 0000" },
  { code: "US", name: "États-Unis", dial: "+1", flag: "🇺🇸", lengths: [10], example: "212 000 0000" },
];

export const DEFAULT_COUNTRY: PhoneCountry =
  PHONE_COUNTRIES.find((c) => c.code === "CI") || PHONE_COUNTRIES[0];

/** Retire tout sauf les chiffres */
export const onlyDigits = (v: string) => (v || "").replace(/\D+/g, "");

/** Vérifie qu'un numéro national correspond aux longueurs autorisées pour ce pays */
export function isValidNationalNumber(national: string, country: PhoneCountry): boolean {
  const digits = onlyDigits(national);
  return country.lengths.includes(digits.length);
}

/** Vérifie un numéro complet (E.164 ou +CCC + national) */
export function isValidFullPhone(full: string): boolean {
  if (!full) return false;
  const cleaned = full.trim().replace(/\s+/g, "");
  // Trouve le pays par indicatif (le plus long match en premier)
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (cleaned.startsWith(c.dial)) {
      const national = cleaned.slice(c.dial.length);
      return isValidNationalNumber(national, c);
    }
  }
  return false;
}

/** Détecte le pays par défaut à partir d'un texte (nom de pays ou code) */
export function detectCountry(hint?: string | null): PhoneCountry {
  if (!hint) return DEFAULT_COUNTRY;
  const h = hint.toLowerCase().trim();
  const found = PHONE_COUNTRIES.find(
    (c) =>
      c.name.toLowerCase() === h ||
      c.code.toLowerCase() === h ||
      h.includes(c.name.toLowerCase())
  );
  return found || DEFAULT_COUNTRY;
}

/** Construit le numéro complet E.164-like */
export function buildFullPhone(country: PhoneCountry, national: string): string {
  const digits = onlyDigits(national);
  if (!digits) return "";
  return `${country.dial}${digits}`;
}

/** Décompose un numéro complet en pays + national */
export function parseFullPhone(full: string): { country: PhoneCountry; national: string } {
  if (!full) return { country: DEFAULT_COUNTRY, national: "" };
  const cleaned = full.trim().replace(/\s+/g, "");
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (cleaned.startsWith(c.dial)) {
      return { country: c, national: cleaned.slice(c.dial.length) };
    }
  }
  return { country: DEFAULT_COUNTRY, national: onlyDigits(cleaned) };
}

/**
 * Normalise un numéro au format E.164 ("+225XXXXXXXXXX").
 * - Retire espaces, tirets, points, parenthèses
 * - Convertit "00CC..." en "+CC..."
 * - Si pas d'indicatif détecté, utilise le pays par défaut (ou hint fourni)
 * - Retourne "" si vide ou si la longueur nationale est invalide pour le pays détecté
 */
export function normalizeToE164(raw: string, defaultCountryHint?: string | null): string {
  if (!raw) return "";
  let s = String(raw).trim().replace(/[\s\-().]/g, "");
  if (!s) return "";
  if (s.startsWith("00")) s = "+" + s.slice(2);
  // Si commence par +, tenter de matcher un indicatif connu
  if (s.startsWith("+")) {
    const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (s.startsWith(c.dial)) {
        const national = onlyDigits(s.slice(c.dial.length));
        if (!national) return "";
        if (!isValidNationalNumber(national, c)) return "";
        return `${c.dial}${national}`;
      }
    }
    // Indicatif inconnu : on garde tel quel en ne laissant que + et chiffres
    const digits = onlyDigits(s);
    return digits ? `+${digits}` : "";
  }
  // Pas de + : on suppose le pays par défaut
  const country = detectCountry(defaultCountryHint);
  const national = onlyDigits(s);
  if (!national) return "";
  if (!isValidNationalNumber(national, country)) return "";
  return `${country.dial}${national}`;
}