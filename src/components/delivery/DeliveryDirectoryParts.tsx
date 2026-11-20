import type { ReactNode } from "react";
import { Building2, Globe, MapPin, Phone, ShieldCheck, Star, Truck, User, Mail, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deliveryService } from "@/lib/deliveryService";
import type { DeliveryDirectoryCard } from "@/types/delivery";

const typeLabel = (c: DeliveryDirectoryCard) => (c.profile_type === "driver" ? "Livreur indépendant" : "Structure de livraison");

/** Logo de la structure, ou une pastille à son initiale. */
export function DeliveryLogo({ card, size = 44 }: { card: Pick<DeliveryDirectoryCard, "logo_url" | "company_name" | "profile_type">; size?: number }) {
  const url = deliveryService.logoPublicUrl(card.logo_url);
  const Icon = card.profile_type === "driver" ? User : Building2;
  return url ? (
    <img
      src={url}
      alt={`Logo ${card.company_name}`}
      width={size}
      height={size}
      loading="lazy"
      className="rounded-xl object-cover border border-slate-700 bg-slate-800 shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-xl border border-slate-700 bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon className="w-5 h-5" />
    </div>
  );
}

export function VerifiedBadge({ card }: { card: Pick<DeliveryDirectoryCard, "verified"> }) {
  if (!card.verified) return null;
  return (
    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] py-0">
      <ShieldCheck className="w-3 h-3 mr-0.5" /> Vérifiée par eComfy
    </Badge>
  );
}

export function RatingLine({ card }: { card: DeliveryDirectoryCard }) {
  return (
    <span className="flex items-center gap-1 text-amber-400">
      <Star className="w-3 h-3 fill-amber-400" />
      {card.reviews_count > 0 ? `${Number(card.rating_score ?? 0).toFixed(1)} (${card.reviews_count} avis)` : "Pas encore d'avis"}
    </span>
  );
}

/** Résumé d'une fiche, utilisé dans les listes. */
export function DeliveryCardSummary({ card, coversCity }: { card: DeliveryDirectoryCard; coversCity?: boolean }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <DeliveryLogo card={card} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-white text-sm">{card.company_name}</span>
          <VerifiedBadge card={card} />
          {card.profile_type === "driver" && (
            <Badge className="bg-slate-700/60 text-slate-200 border-slate-600 text-[10px] py-0">Indépendant</Badge>
          )}
          {coversCity && <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px] py-0">Couvre votre zone</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {card.city}
          </span>
          <RatingLine card={card} />
          <span>{card.successful_deliveries_count} livraison{card.successful_deliveries_count > 1 ? "s" : ""} réussie{card.successful_deliveries_count > 1 ? "s" : ""}</span>
          {card.profile_type !== "driver" && <span>{Math.max(card.drivers_count, 0)} livreur{card.drivers_count > 1 ? "s" : ""} actif{card.drivers_count > 1 ? "s" : ""}</span>}
        </div>
        {card.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{card.description}</p>}
      </div>
    </div>
  );
}

interface ProfileDialogProps {
  card: DeliveryDirectoryCard | null;
  onClose: () => void;
  /** Si fourni, un bouton permet de choisir cette structure. */
  onChoose?: (card: DeliveryDirectoryCard) => void;
  chooseLabel?: string;
}

/** Fiche complète (cahier §2.1) : tout ce que le commerçant peut consulter avant de choisir. */
export function DeliveryCompanyProfileDialog({ card, onClose, onChoose, chooseLabel = "Choisir cette structure" }: ProfileDialogProps) {
  const tel = card?.phone?.replace(/[^\d+]/g, "");
  const wa = card?.whatsapp?.replace(/[^\d]/g, "");
  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
        {card && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <DeliveryLogo card={card} size={56} />
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold text-white">{card.company_name}</DialogTitle>
                  <DialogDescription className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                    <span>{typeLabel(card)}</span>
                    <VerifiedBadge card={card} />
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Note" value={card.reviews_count > 0 ? Number(card.rating_score ?? 0).toFixed(1) : "—"} />
                <Stat label="Livraisons réussies" value={String(card.successful_deliveries_count)} />
                <Stat label={card.profile_type === "driver" ? "Type" : "Livreurs actifs"} value={card.profile_type === "driver" ? "Indépendant" : String(card.drivers_count)} />
              </div>

              {card.description && <Block title="Présentation">{card.description}</Block>}
              {card.services_info && <Block title="Services">{card.services_info}</Block>}

              <Block title="Zones couvertes">
                {card.covered_cities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {card.covered_cities.map((city) => (
                      <Badge key={city} className="bg-slate-800 text-slate-200 border-slate-700 text-[11px] font-normal">
                        {city}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">Non renseignées. Basée à {card.city}.</span>
                )}
              </Block>

              <Block title="Localisation et contact">
                <ul className="space-y-1.5 text-slate-300">
                  <li className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <span>{[card.address, card.city, card.country].filter(Boolean).join(", ")}</span>
                  </li>
                  {card.phone && (
                    <li className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                      <a className="text-emerald-400 underline-offset-2 hover:underline" href={`tel:${tel}`}>{card.phone}</a>
                    </li>
                  )}
                  {wa && (
                    <li className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-slate-500 shrink-0" />
                      <a className="text-emerald-400 underline-offset-2 hover:underline" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    </li>
                  )}
                  {card.email && (
                    <li className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                      <a className="text-emerald-400 underline-offset-2 hover:underline break-all" href={`mailto:${card.email}`}>{card.email}</a>
                    </li>
                  )}
                </ul>
                {card.profile_type === "driver" && (
                  <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> L'adresse personnelle d'un livreur indépendant n'est pas affichée.
                  </p>
                )}
              </Block>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" onClick={onClose} className="bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700">
                Fermer
              </Button>
              {onChoose && (
                <Button type="button" onClick={() => onChoose(card)} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
                  <Truck className="w-4 h-4 mr-2" /> {chooseLabel}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5">
      <div className="text-base font-bold text-white">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">{title}</h3>
      <div className="text-slate-300 whitespace-pre-line">{children}</div>
    </section>
  );
}
