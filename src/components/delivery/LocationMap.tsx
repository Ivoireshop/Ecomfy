import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Abidjan : centre de départ tant qu'aucun point n'est choisi. */
const DEFAULT_CENTER: [number, number] = [5.36, -4.0083];

// Repère dessiné en CSS : évite les images par défaut de Leaflet, que les bundlers ne résolvent pas sans configuration.
const PIN_HTML =
  '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#10b981;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>';

export interface LocationMapProps {
  value: { latitude: number; longitude: number; accuracy_m?: number | null } | null;
  /** Appelé quand l'utilisateur clique sur la carte ou déplace le repère. */
  onPick: (latitude: number, longitude: number) => void;
  /** Incrémenté par le parent pour recentrer la carte (position GPS reçue). */
  recenterKey: number;
}

/** Carte OpenStreetMap : un clic ou un glisser du repère choisit l'emplacement de l'entrepôt. Chargée à la demande. */
export default function LocationMap({ value, onPick, recenterKey }: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const handledRecenter = useRef(recenterKey);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = L.map(container.current, {
      center: value ? [value.latitude, value.longitude] : DEFAULT_CENTER,
      zoom: value ? 17 : 12,
      scrollWheelZoom: false, // la molette sert à faire défiler la page, pas à zoomer par erreur
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(instance);
    instance.on("click", (e: L.LeafletMouseEvent) => onPickRef.current(e.latlng.lat, e.latlng.lng));
    map.current = instance;
    // La carte peut naître dans une zone encore masquée ou en transition : recalculer sa taille.
    const t = window.setTimeout(() => instance.invalidateSize(), 250);
    return () => {
      window.clearTimeout(t);
      instance.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
    };
    // La carte est créée une seule fois ; les changements de valeur sont traités par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    if (!value) {
      marker.current?.remove();
      circle.current?.remove();
      marker.current = null;
      circle.current = null;
      return;
    }

    const pos: L.LatLngExpression = [value.latitude, value.longitude];
    if (!marker.current) {
      marker.current = L.marker(pos, {
        draggable: true,
        icon: L.divIcon({ className: "", html: PIN_HTML, iconSize: [26, 26], iconAnchor: [4, 26] }),
        keyboard: false,
      }).addTo(instance);
      marker.current.on("dragend", () => {
        const p = marker.current?.getLatLng();
        if (p) onPickRef.current(p.lat, p.lng);
      });
    } else {
      marker.current.setLatLng(pos);
    }

    circle.current?.remove();
    circle.current = null;
    if (value.accuracy_m && value.accuracy_m > 0) {
      circle.current = L.circle(pos, { radius: value.accuracy_m, color: "#10b981", weight: 1, fillOpacity: 0.12 }).addTo(instance);
    }

    if (handledRecenter.current !== recenterKey) {
      handledRecenter.current = recenterKey;
      instance.setView(pos, Math.max(instance.getZoom(), 17));
    }
  }, [value, recenterKey]);

  return <div ref={container} className="isolate h-64 w-full rounded-lg border border-slate-800 bg-slate-900" role="application" aria-label="Carte pour placer l'entrepôt" />;
}
