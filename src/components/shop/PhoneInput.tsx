import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  placeholder,
  required,
}: PhoneInputProps) {
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

  return (
    <div className={className}>
      <div className="flex gap-1.5 w-full">
        <Select value={country.code} onValueChange={setCountry}>
          <SelectTrigger
            className={`w-[96px] shrink-0 rounded-lg ${inputClassName || "h-10 text-sm"}`}
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
        <Input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => setNational(e.target.value)}
          placeholder={placeholder || country.example}
          className={`flex-1 min-w-0 rounded-lg ${inputClassName || "h-10 text-sm"} ${
            showError ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
          aria-invalid={showError}
        />
      </div>
      {showError ? (
        <p className="mt-1 text-[10.5px] text-destructive">
          Le numéro doit contenir {expected} chiffres pour {country.name}.
        </p>
      ) : (
        <p className="mt-1 text-[10.5px] text-muted-foreground">
          Format attendu : {expected} chiffres ({country.name}).
        </p>
      )}
    </div>
  );
}

export default PhoneInput;