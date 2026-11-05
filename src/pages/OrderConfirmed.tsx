import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Phone, MessageCircle, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initShopPixels, trackEvent } from "@/lib/tracking";

interface OrderConfirmedState {
  shopName?: string;
  shopSlug?: string;
  primaryColor?: string;
  message?: string;
  advisorPhone?: string;
  whatsappNumber?: string;
  orderNumber?: string;
  total?: number;
  isPaid?: boolean;
}

const DEFAULT_MESSAGE =
  "Félicitations ! Votre commande a été validée. Un conseiller va vous appeler très bientôt pour organiser la livraison.";

export default function OrderConfirmed() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state || {}) as OrderConfirmedState;
  const primary = state.primaryColor || "#2563eb";
  const message = state.message || DEFAULT_MESSAGE;
  const cleanPhone = (p?: string) => (p || "").replace(/[^0-9+]/g, "");
  const trackedRef = useRef(false);
  // Retour du prestataire de paiement : /order-confirmed?payment_ref=ECM-PAY-… (aucun état de navigation).
  const paymentRef = new URLSearchParams(location.search).get("payment_ref");
  const [returnOrderNumber, setReturnOrderNumber] = useState<string | undefined>();

  useEffect(() => {
    if (trackedRef.current || !state.orderNumber || !state.shopSlug) return;
    
    // Deduplication check via sessionStorage
    const storageKey = `vp_tracked_purchase_${state.orderNumber}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(storageKey)) {
      trackedRef.current = true;
      return;
    }

    trackedRef.current = true;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey, "1");
    }

    (async () => {
      try {
        const { data: shop } = await supabase
          .from("shops")
          .select("id, tracking_enabled, facebook_pixels, tiktok_pixels, snapchat_pixels, ga4_measurement_id, google_analytics_ids")
          .eq("slug", state.shopSlug)
          .maybeSingle();

        if (shop) {
          initShopPixels(shop);
          trackEvent(shop, "Purchase", {
            value: state.total || 0,
            order_id: state.orderNumber,
          });
        }
      } catch (e) {
        console.warn("[OrderConfirmed] tracking error", e);
      }
    })();
  }, [state.orderNumber, state.shopSlug, state.total]);

  // Paiement en ligne : le Purchase serveur part du webhook, à l'encaissement. Ici le navigateur n'envoie que le pendant
  // « pixel », avec le même event_id (ord_<n° de commande>) : Meta garde alors un seul achat. On attend la confirmation du
  // webhook (quelques secondes) et on n'envoie jamais tant que le paiement n'est pas encaissé.
  useEffect(() => {
    if (state.orderNumber || !paymentRef || !/^ECM-PAY-[A-F0-9]{12}$/.test(paymentRef)) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC absente des types générés de Supabase
          const { data } = await (supabase as any).rpc("get_payment_return_status", { p_reference: paymentRef });
          if (data?.found && data.order_number) setReturnOrderNumber(String(data.order_number));
          if (data?.found && ["FAILED", "EXPIRED", "CANCELLED", "REFUNDED"].includes(data.status)) return;
          if (data?.found && data.paid && data.order_number && data.shop_slug) {
            const storageKey = `vp_tracked_purchase_${data.order_number}`;
            try { if (sessionStorage.getItem(storageKey)) return; sessionStorage.setItem(storageKey, "1"); } catch { /* stockage indisponible : l'event_id déduplique de toute façon */ }
            const { data: shop } = await supabase
              .from("shops")
              .select("id, tracking_enabled, facebook_pixels, tiktok_pixels, snapchat_pixels, ga4_measurement_id, google_analytics_ids")
              .eq("slug", data.shop_slug)
              .maybeSingle();
            if (shop) {
              initShopPixels(shop);
              void trackEvent(shop, "Purchase", {
                value: Number(data.amount) || 0,
                currency: data.currency || "XOF",
                order_id: String(data.order_number),
              }, { serverMirror: false });
            }
            return;
          }
        } catch (e) {
          console.warn("[OrderConfirmed] retour de paiement", e);
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => { cancelled = true; };
  }, [paymentRef, state.orderNumber]);

  const shownOrderNumber = state.orderNumber || returnOrderNumber;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-xl w-full p-8 md:p-10 text-center">
        <div
          className="h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: primary + "15" }}
        >
          <CheckCircle2 className="h-12 w-12" style={{ color: primary }} />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-3">
          Félicitations, votre commande est confirmée !
        </h1>
        <p className="text-muted-foreground mb-2 leading-relaxed">{message}</p>
        {shownOrderNumber && (
          <p className="text-sm text-muted-foreground mb-6">
            Numéro de commande&nbsp;:{" "}
            <span className="font-mono font-semibold">{shownOrderNumber}</span>
          </p>
        )}

        {state.advisorPhone && (
          <div
            className="rounded-2xl p-5 mb-6 text-left"
            style={{ backgroundColor: primary + "10" }}
          >
            <p className="text-sm font-medium mb-3">
              Pour plus d'informations, vous pouvez contacter notre conseiller :
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="flex-1" style={{ backgroundColor: primary }}>
                <a href={`tel:${cleanPhone(state.advisorPhone)}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Appeler {state.advisorPhone}
                </a>
              </Button>
              {state.whatsappNumber && (
                <Button asChild variant="outline" className="flex-1">
                  <a
                    href={`https://wa.me/${cleanPhone(state.whatsappNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {state.shopSlug ? (
            <Button asChild variant="outline">
              <Link to={`/shop/${state.shopSlug}`}>
                <Home className="h-4 w-4 mr-2" />
                Continuer mes achats
              </Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate(-1)}>
              <Home className="h-4 w-4 mr-2" />
              Retour
            </Button>
          )}
        </div>

        {state.shopName && (
          <p className="text-xs text-muted-foreground mt-8">
            Merci pour votre confiance envers <strong>{state.shopName}</strong>
          </p>
        )}
      </Card>
    </div>
  );
}