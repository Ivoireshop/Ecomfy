import { useLocation, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Phone, MessageCircle, Home } from "lucide-react";

interface OrderConfirmedState {
  shopName?: string;
  shopSlug?: string;
  primaryColor?: string;
  message?: string;
  advisorPhone?: string;
  whatsappNumber?: string;
  orderNumber?: string;
  total?: number;
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
        {state.orderNumber && (
          <p className="text-sm text-muted-foreground mb-6">
            Numéro de commande&nbsp;:{" "}
            <span className="font-mono font-semibold">{state.orderNumber}</span>
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