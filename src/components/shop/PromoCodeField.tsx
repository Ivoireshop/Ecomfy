import { useEffect, useRef, useState } from "react";
import { Loader2, Tag, X, CheckCircle2 } from "lucide-react";
import { previewPromoCode } from "@/services/publicOrderService";

export interface AppliedPromo {
  code: string;
  discount: number;
}

interface PromoCodeFieldProps {
  shopId: string;
  /** Sous-total du panier avant remise (aperçu : le serveur recalcule à la commande). */
  subtotal: number;
  customerPhone?: string | null;
  customerEmail?: string | null;
  primaryColor?: string;
  applied: AppliedPromo | null;
  onChange: (promo: AppliedPromo | null) => void;
}

/** Champ « code promo » du tunnel de commande : aperçu de la remise, jamais source du montant final. */
export function PromoCodeField({
  shopId, subtotal, customerPhone, customerEmail, primaryColor = "#2563eb", applied, onChange,
}: PromoCodeFieldProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);

  const check = async (code: string, silent: boolean) => {
    const id = ++seq.current;
    if (!silent) { setLoading(true); setError(""); }
    try {
      const res = await previewPromoCode({ shopId, code, subtotal, customerPhone, customerEmail });
      if (id !== seq.current) return;
      if (res.valid) {
        setError("");
        onChange({ code: res.code || code.trim().toUpperCase(), discount: res.discount });
      } else {
        setError(res.message);
        onChange(null);
      }
    } catch (e: any) {
      if (id !== seq.current) return;
      setError(e?.message || "Impossible de vérifier le code promo.");
      if (silent) onChange(null);
    } finally {
      if (id === seq.current && !silent) setLoading(false);
    }
  };

  // Le panier ou les coordonnées changent : la remise (pourcentage, minimum, ciblage) est recalculée.
  const appliedCode = applied?.code;
  useEffect(() => {
    if (!appliedCode) return;
    const t = setTimeout(() => check(appliedCode, true), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, customerPhone, customerEmail]);

  const submit = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!value.trim() || loading) return;
    check(value, false);
  };

  const remove = () => {
    seq.current++;
    setValue("");
    setError("");
    onChange(null);
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Code {applied.code} appliqué
        </span>
        <button type="button" onClick={remove} className="text-emerald-700 hover:text-emerald-900" aria-label="Retirer le code promo">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold hover:underline" style={{ color: primaryColor }}>
        <Tag className="h-3.5 w-3.5" /> J'ai un code promo
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value.toUpperCase()); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(e); }}
          placeholder="Code promo"
          maxLength={40}
          autoCapitalize="characters"
          className="flex-1 min-w-0 h-9 rounded-lg border bg-background px-3 text-xs font-mono uppercase tracking-wide outline-none focus:ring-2"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || loading}
          className="h-9 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1"
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Appliquer"}
        </button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
