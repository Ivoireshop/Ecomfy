import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, MessageCircle, HelpCircle, Video, ExternalLink, Phone } from "lucide-react";

const WHATSAPP = "https://wa.me/2250758152761?text=" + encodeURIComponent("Bonjour, j'ai besoin d'aide avec ma boutique Ecomfy.");

const RESOURCES = [
  {
    icon: Video,
    title: "Tutoriel : créer ma première fiche produit",
    description: "Apprenez à publier un produit en 6 étapes guidées.",
    href: "/tutorial",
  },
  {
    icon: BookOpen,
    title: "Guide de lancement",
    description: "Personnaliser, configurer le paiement et publier votre boutique.",
    href: "/documentation",
  },
  {
    icon: HelpCircle,
    title: "Questions fréquentes",
    description: "Paiement, livraison, frais et commissions.",
    href: "/documentation",
  },
];

export function ShopResources() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h3 className="font-bold">Ressources & aide</h3>
          <p className="text-xs text-muted-foreground">Tout pour réussir votre boutique</p>
        </div>
        <Button asChild size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map(({ icon: Icon, title, description, href }) => (
          <a
            key={title}
            href={href}
            className="group flex gap-3 p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight flex items-center gap-1">
                {title}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
            </div>
          </a>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Phone className="h-3 w-3" />
        <span>Support direct : +225 07 58 15 27 61</span>
      </div>
    </Card>
  );
}