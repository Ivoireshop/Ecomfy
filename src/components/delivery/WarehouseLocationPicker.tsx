import { lazy, Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCoordinates, mapsUrl } from "@/lib/deliveryDossier";

// La carte (Leaflet) n'est chargée qu'à l'affichage de cette étape : elle n'alourdit pas le reste de l'application.
const LocationMap = lazy(() => import("./LocationMap"));

export interface WarehouseLocationValue {
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  source: "gps" | "map";
}

interface WarehouseLocationPickerProps {
  value: WarehouseLocationValue | null;
  onChange: (next: WarehouseLocationValue) => void;
  required?: boolean;
}

/** Au-delà de ce rayon, un point GPS est trop imprécis pour guider quelqu'un jusqu'à l'entrepôt. */
const POOR_ACCURACY_M = 100;

function geolocationMessage(code: number | undefined): string {
  if (code === 1) return "Accès à la position refusé. Autorisez-le dans votre navigateur, ou placez le point sur la carte.";
  if (code === 2) return "Position indisponible pour le moment. Placez le point sur la carte.";
  if (code === 3) return "La position met trop de temps à arriver. Réessayez ou placez le point sur la carte.";
  return "Position impossible à obtenir. Placez le point sur la carte.";
}

/**
 * Localisation précise de l'entrepôt : bouton « ma position » (GPS) et carte cliquable pour ajuster ou choisir à la main.
 * Les deux alimentent la même valeur ; la source (gps ou carte) est conservée pour l'équipe qui vérifie.
 */
export function WarehouseLocationPicker({ value, onChange, required }: WarehouseLocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  const useMyPosition = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Votre navigateur ne fournit pas la position. Placez le point sur la carte.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
          source: "gps",
        });
        setRecenterKey((k) => k + 1);
      },
      (err) => {
        setLocating(false);
        setError(geolocationMessage(err.code));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const pick = (latitude: number, longitude: number) => {
    setError(null);
    onChange({ latitude, longitude, accuracy_m: null, source: "map" });
  };

  const poor = value?.source === "gps" && (value.accuracy_m ?? 0) > POOR_ACCURACY_M;

  return (
    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label className="text-xs font-bold text-white flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Localisation précise de l'entrepôt{required ? " *" : ""}
          </Label>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Idéalement depuis l'entrepôt : appuyez sur « Utiliser ma position ». Sinon, cliquez sur la carte ou déplacez le repère.
            L'équipe s'en sert pour s'y rendre directement ; elle n'est visible que de vous et d'elle.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={useMyPosition} disabled={locating}
          className="bg-slate-900 hover:text-white border-emerald-500/40 text-emerald-300 hover:bg-slate-800 text-xs shrink-0">
          {locating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5 mr-1.5" />}
          {locating ? "Localisation…" : "Utiliser ma position"}
        </Button>
      </div>

      <Suspense fallback={<div className="h-64 w-full rounded-lg bg-slate-900 animate-pulse" aria-label="Chargement de la carte" />}>
        <LocationMap value={value} onPick={pick} recenterKey={recenterKey} />
      </Suspense>

      {error && <p role="alert" className="text-[11px] text-rose-300 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}</p>}

      {value ? (
        <div className="space-y-1">
          <p className="text-[11px] text-emerald-300 flex flex-wrap items-center gap-x-2 gap-y-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              {value.source === "gps" ? "Position GPS" : "Point placé sur la carte"} : {formatCoordinates(value)}
              {value.source === "gps" && value.accuracy_m ? ` (précision ≈ ${value.accuracy_m} m)` : ""}
            </span>
            <a href={mapsUrl(value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline hover:text-emerald-200">
              Vérifier dans Google Maps <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          {poor && (
            <p role="status" className="text-[11px] text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> Précision faible : déplacez le repère à l'emplacement exact de l'entrepôt.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Aucun point choisi pour le moment.</p>
      )}
    </div>
  );
}
