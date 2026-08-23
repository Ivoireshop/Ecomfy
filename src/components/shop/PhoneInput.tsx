import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PHONE_COUNTRIES,
  PhoneCountry,
  DEFAULT_COUNTRY,
  onlyDigits,
  isValidNationalNumber,
  parseFullPhone,
  buildFullPhone,
} from "@/lib/phoneCountries";

interface PhoneInputProps {
  /** Valeur complète au format E.164 ("+225XXXXXXXXXX") */
  value: string;
  onChange: (fullPhone: string) => void;
  /** Pays par défaut (code ISO ou nom). Utilisé si la valeur ne contient pas d'indicatif. */
  defaultCountryHint?: string | null;
  className?: string;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
  placeholder?: string;
  required?: boolean;
}

/**
 * Champ téléphone avec sélecteur de pays et validation de longueur par pays.
 * Affiche une erreur inline si le nombre de chiffres ne correspond pas.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountryHint,
  className,
  inputClassName,
  inputStyle,
  placeholder,
  required,
}: PhoneInputProps) {
  const isMobile = useIsMobile();

  // Pays initial déduit de la valeur ou du hint
  const initialCountry = useMemo(() => {
    if (value && value.startsWith("+")) return parseFullPhone(value).country;
    return (
      PHONE_COUNTRIES.find(
        (c) =>
          defaultCountryHint &&
          (c.code.toLowerCase() === defaultCountryHint.toLowerCase() ||
            c.name.toLowerCase() === defaultCountryHint.toLowerCase())
      ) || DEFAULT_COUNTRY
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [country, setCountryState] = useState<PhoneCountry>(initialCountry);

  // Si la valeur externe change avec un indicatif, on synchronise le pays
  useEffect(() => {
    if (value && value.startsWith("+")) {
      const parsedCountry = parseFullPhone(value).country;
      if (parsedCountry.code !== country.code) setCountryState(parsedCountry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const national = useMemo(() => {
    if (value && value.startsWith("+")) {
      const p = parseFullPhone(value);
      if (p.country.code === country.code) return p.national;
      return "";
    }
    return onlyDigits(value || "");
  }, [value, country.code]);

  const setCountry = (code: string) => {
    const next = PHONE_COUNTRIES.find((c) => c.code === code) || DEFAULT_COUNTRY;
    setCountryState(next);
    onChange(national ? buildFullPhone(next, national) : "");
  };

  const setNational = (raw: string) => {
    const digits = onlyDigits(raw).slice(0, Math.max(...country.lengths));
    onChange(digits ? buildFullPhone(country, digits) : "");
  };

  const valid = national.length === 0 ? !required : isValidNationalNumber(national, country);
  const showError = national.length > 0 && !isValidNationalNumber(national, country);
  const expected = country.lengths.join(" ou ");
  const hasLengthOk = country.lengths.includes(national.length);
  const prefixInvalid =
    hasLengthOk &&
    !!country.prefixes &&
    country.prefixes.length > 0 &&
    !country.prefixes.some((p) => national.startsWith(p));

  // Sur mobile, on utilise un <select> natif pour déclencher le picker iOS/Android
  const countrySelector = isMobile ? (
    <div className="relative w-[88px] sm:w-[96px] shrink-0">
      <select
        value={country.code}
        onChange={(e) => setCountry(e.target.value)}
        className={`appearance-none w-full h-12 sm:h-10 rounded-lg border border-input bg-background px-2 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
        aria-label="Pays"
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dial} {c.name}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  ) : (
    <Select value={country.code} onValueChange={setCountry}>
      <SelectTrigger
        className="w-[96px] shrink-0 rounded-lg h-10 text-sm"
      >
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span>{country.flag}</span>
            <span className="text-xs">{country.dial}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className="max-h-[60vh] w-[260px]"
        position="popper"
        sideOffset={4}
      >
        {PHONE_COUNTRIES.map((c) => (
          <SelectItem key={c.code} value={c.code} className="py-2">
            <span className="flex items-center gap-2">
              <span>{c.flag}</span>
              <span className="text-xs font-medium">{c.dial}</span>
              <span className="text-xs text-muted-foreground">{c.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className={className}>
      <div className="flex gap-2 w-full">
        {countrySelector}
        <Input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          style={inputStyle}
          value={national}
          onChange={(e) => setNational(e.target.value)}
          placeholder={placeholder || country.example}
          className={`flex-1 min-w-0 h-12 sm:h-10 rounded-lg text-base sm:text-sm ${
            inputClassName || ""
          } ${showError ? "border-destructive focus-visible:ring-destructive" : ""}`}
          aria-invalid={showError}
        />
      </div>
      {showError ? (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1.5">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive leading-snug">
            {prefixInvalid ? (
              <>
                En <strong>{country.name}</strong>, un numéro valide commence par{" "}
                <strong>{country.prefixes!.join(", ")}</strong>&nbsp;: Orange = 07, MTN = 05, Moov = 01.
                <br />
                Exemple correct&nbsp;: <strong>{country.example}</strong>.
              </>
            ) : (
              <>
                Le numéro doit contenir <strong>{expected}</strong> chiffres pour{" "}
                <strong>{country.name}</strong>. Exemple&nbsp;: <strong>{country.example}</strong>.
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground leading-snug">
          Format attendu : <strong>{expected}</strong> chiffres ({country.name})
          {country.prefixes && country.prefixes.length > 0
            ? `, commençant par ${country.prefixes.join(", ")} (Orange 07, MTN 05, Moov 01)`
            : ""}
          . Exemple&nbsp;: <strong>{country.example}</strong>.
        </p>
      )}
    </div>
  );
}

export default PhoneInput;