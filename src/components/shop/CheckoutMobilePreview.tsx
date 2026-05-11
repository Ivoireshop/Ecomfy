import { Smartphone } from "lucide-react";

interface CheckoutField {
  id: string;
  label: string;
  type: string;
  enabled: boolean;
  required: boolean;
}

interface Props {
  shop: any;
}

/**
 * Aperçu fidèle (et live) du tunnel de checkout côté client, dans un cadre mobile.
 * Reflète : checkout_fields, theme_config (single_page_checkout, sticky_order_button,
 * hide_product_header), primary_color, social_proof_enabled.
 */
export function CheckoutMobilePreview({ shop }: Props) {
  const primary = shop?.primary_color || "#111827";
  const fields: CheckoutField[] = (shop?.checkout_fields || [
    { id: "first_name", label: "Prénom", type: "text", enabled: true, required: true },
    { id: "phone", label: "Numéro de téléphone", type: "tel", enabled: true, required: true },
    { id: "country", label: "Pays", type: "text", enabled: true, required: true },
    { id: "city", label: "Ville / Commune", type: "text", enabled: true, required: true },
    { id: "address", label: "Adresse de livraison", type: "text", enabled: true, required: false },
    { id: "email", label: "E-mail", type: "email", enabled: false, required: false },
    { id: "last_name", label: "Nom de famille", type: "text", enabled: false, required: false },
  ]).filter((f) => f.enabled);

  const theme = shop?.theme_config || {};
  const sticky = !!theme.sticky_order_button;
  const hideHeader = !!theme.hide_product_header;
  const singlePage = !!theme.single_page_checkout;
  const socialProof = !!shop?.social_proof_enabled;

  const hasFirst = fields.some((f) => f.id === "first_name");
  const hasLast = fields.some((f) => f.id === "last_name");
  const nameLabel = hasFirst && hasLast ? "Nom complet" : hasFirst ? "Prénom" : "Nom";

  return (
    <div className="sticky top-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
        <Smartphone className="h-4 w-4" />
        Aperçu mobile en direct
      </div>

      {/* Cadre téléphone */}
      <div className="mx-auto rounded-[2.2rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl" style={{ width: 300 }}>
        <div className="relative rounded-[1.6rem] bg-white overflow-hidden" style={{ height: 560 }}>
          {/* Encoche */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 w-24 h-5 bg-slate-900 rounded-b-2xl" />

          {/* Contenu scrollable */}
          <div className="h-full overflow-y-auto pt-6 pb-2">
            {!hideHeader && (
              <div className="px-3 py-2 border-b flex items-center justify-between text-[11px] text-gray-600">
                <span className="font-semibold truncate" style={{ color: primary }}>{shop?.business_name || "Ma boutique"}</span>
                <span>Panier (1)</span>
              </div>
            )}

            {/* Mini fiche produit */}
            <div className="px-3 pt-3">
              <div className="rounded-lg bg-gray-100 h-24 flex items-center justify-center text-[10px] text-gray-400">
                Image produit
              </div>
              <div className="mt-2 text-[12px] font-semibold">Produit exemple</div>
              <div className="text-[12px] font-bold" style={{ color: primary }}>9 900 FCFA</div>
            </div>

            {/* Section checkout */}
            <div className="px-3 mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-700 mb-2">
                {singlePage ? "Finaliser ma commande" : "Étape 1 — Informations"}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {fields.map((f) => {
                  // Adresse pleine largeur pour rester lisible
                  const fullWidth = f.id === "address" || f.id === "email";
                  const label = f.id === "first_name" || f.id === "last_name" ? nameLabel : f.label;
                  const showOnce = f.id === "last_name" && hasFirst; // évite doublon avec "Nom complet"
                  if (showOnce) return null;
                  return (
                    <div key={f.id} className={fullWidth ? "col-span-2" : ""}>
                      <div className="text-[9px] text-gray-500 mb-0.5">
                        {label}{f.required && <span className="text-red-500"> *</span>}
                      </div>
                      <div className="h-7 rounded-md border border-gray-200 bg-gray-50 px-2 flex items-center text-[10px] text-gray-300">
                        {f.type === "tel" ? "+225 ..." : f.type === "email" ? "ex@mail.com" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paiement */}
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-700 mt-3 mb-2">
                {singlePage ? "Mode de paiement" : "Étape 2 — Paiement"}
              </div>
              <div className="space-y-1.5">
                <div className="rounded-md border-2 px-2 py-1.5 text-[10px]" style={{ borderColor: primary }}>
                  💵 Paiement à la livraison
                </div>
                <div className="rounded-md border px-2 py-1.5 text-[10px] text-gray-600">
                  📱 Mobile Money
                </div>
              </div>

              {/* Bouton confirmer (inline) */}
              {!sticky && (
                <button
                  className="w-full mt-3 rounded-md py-2 text-[11px] font-bold text-white"
                  style={{ backgroundColor: primary }}
                  type="button"
                >
                  Confirmer ma commande
                </button>
              )}
              <div className="h-20" />
            </div>

            {/* Preuve sociale */}
            {socialProof && (
              <div className="absolute left-2 right-2 z-20 rounded-lg bg-white shadow-lg border px-2 py-1.5 flex items-center gap-2"
                   style={{ bottom: sticky ? 56 : 8 }}>
                <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">👤</div>
                <div className="text-[9px] leading-tight">
                  <div className="font-semibold">Aïcha vient d'acheter</div>
                  <div className="text-gray-500">Produit exemple · il y a 2 min</div>
                </div>
              </div>
            )}

            {/* Bouton flottant */}
            {sticky && (
              <div className="absolute bottom-0 left-0 right-0 z-20 p-2 bg-white/95 backdrop-blur border-t">
                <button
                  className="w-full rounded-md py-2.5 text-[12px] font-bold text-white animate-pulse"
                  style={{ backgroundColor: primary }}
                  type="button"
                >
                  Commander maintenant
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-2">
        Mise à jour en temps réel selon vos réglages
      </p>
    </div>
  );
}