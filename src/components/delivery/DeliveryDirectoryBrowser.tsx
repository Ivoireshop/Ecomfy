import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deliveryService } from "@/lib/deliveryService";
import type { DeliveryDirectoryCard, DeliveryProfileType } from "@/types/delivery";
import { DeliveryCardSummary, DeliveryCompanyProfileDialog } from "./DeliveryDirectoryParts";

const PAGE = 12;

type Kind = "all" | DeliveryProfileType;
const KINDS: Array<{ id: Kind; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "manager", label: "Structures de livraison" },
  { id: "driver", label: "Livreurs indépendants" },
];

interface Props {
  /** Ville de départ du filtre « zone » (par exemple la ville du client). */
  defaultCity?: string;
  /** Zone du client : proposée en un clic, jamais appliquée d'office (aucune structure ne couvre forcément cette ville). */
  suggestedCity?: string;
  /** Si fourni, chaque fiche propose de choisir la structure. */
  onChoose?: (card: DeliveryDirectoryCard) => void;
  chooseLabel?: string;
  /** Identifiant surligné (structure déjà choisie). */
  selectedId?: string;
  /** Classes de la liste (hauteur maximale en fenêtre modale). */
  listClassName?: string;
}

/** Répertoire des structures et livreurs vérifiés : recherche par nom, par zone, fiche détaillée (cahier §2). */
export default function DeliveryDirectoryBrowser({ defaultCity = "", suggestedCity = "", onChoose, chooseLabel, selectedId, listClassName }: Props) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [kind, setKind] = useState<Kind>("all");
  const [items, setItems] = useState<DeliveryDirectoryCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<DeliveryDirectoryCard | null>(null);
  // Une réponse tardive d'une ancienne recherche ne doit pas écraser la plus récente.
  const seq = useRef(0);

  const run = useCallback(
    async (offset: number) => {
      const mine = ++seq.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await deliveryService.searchDirectory({
          query,
          city,
          profileType: kind === "all" ? null : kind,
          limit: PAGE,
          offset,
        });
        if (mine !== seq.current) return;
        setTotal(res.total);
        setItems((prev) => (offset === 0 ? res.items : [...prev, ...res.items]));
      } catch (e) {
        if (mine !== seq.current) return;
        setError(e instanceof Error ? e.message : "Recherche impossible.");
        if (offset === 0) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query, city, kind],
  );

  // Recherche différée pendant la frappe.
  useEffect(() => {
    const t = setTimeout(() => void run(0), 300);
    return () => clearTimeout(t);
  }, [run]);

  const covers = (card: DeliveryDirectoryCard) => {
    const wanted = (city.trim() || suggestedCity.trim()).toLowerCase();
    if (!wanted) return false;
    return card.city.toLowerCase().includes(wanted) || card.covered_cities.some((c) => c.toLowerCase().includes(wanted));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom de la structure"
            aria-label="Rechercher par nom"
            className="pl-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="relative">
          <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Zone ou ville couverte"
            aria-label="Filtrer par zone géographique"
            className="pl-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {suggestedCity.trim() && city.trim().toLowerCase() !== suggestedCity.trim().toLowerCase() && (
        <button
          type="button"
          onClick={() => setCity(suggestedCity.trim())}
          className="text-[11px] text-sky-300 hover:underline flex items-center gap-1"
        >
          <MapPin className="w-3 h-3" /> Ne montrer que les structures qui couvrent {suggestedCity.trim()} (zone du client)
        </button>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type de prestataire">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              kind === k.id
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold"
                : "bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
          >
            {k.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400 self-center" aria-live="polite">
          {loading ? "Recherche…" : `${total} résultat${total > 1 ? "s" : ""}`}
        </span>
      </div>

      <div className={`space-y-2 ${listClassName ?? ""}`}>
        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-xs text-red-300">
            {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
            Aucune structure vérifiée ne correspond à votre recherche. Essayez un autre nom ou élargissez la zone.
          </div>
        )}
        {items.map((card) => {
          const selected = card.id === selectedId;
          return (
            <div
              key={card.id}
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                selected ? "bg-emerald-950/40 border-emerald-500" : "bg-slate-950 border-slate-800 hover:border-slate-700"
              }`}
            >
              <DeliveryCardSummary card={card} coversCity={covers(card)} />
              <div className="flex gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setOpen(card)}
                  className="bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 text-xs"
                >
                  Voir la fiche
                </Button>
                {onChoose && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onChoose(card)}
                    className={`text-xs font-bold ${selected ? "bg-emerald-700 text-white" : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"}`}
                  >
                    {selected ? "Choisie ✓" : (chooseLabel ?? "Choisir")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {loading && items.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Recherche des structures de livraison…
          </div>
        )}
        {items.length < total && (
          <div className="text-center pt-1">
            <Button
              type="button"
              size="sm"
              disabled={loadingMore}
              onClick={() => void run(items.length)}
              className="bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 text-xs"
            >
              {loadingMore ? "Chargement…" : `Afficher plus (${total - items.length})`}
            </Button>
          </div>
        )}
      </div>

      <DeliveryCompanyProfileDialog
        card={open}
        onClose={() => setOpen(null)}
        onChoose={
          onChoose
            ? (c) => {
                onChoose(c);
                setOpen(null);
              }
            : undefined
        }
        chooseLabel={chooseLabel}
      />
    </div>
  );
}
