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
    <Card className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Ressources & aide</h3>
          <p className="text-sm text-slate-500">Tout pour réussir votre boutique</p>
        </div>
        <Button asChild size="sm" className="gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl shadow-sm h-9 px-4">
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map(({ icon: Icon, title, description, href }) => (
          <a
            key={title}
            href={href}
            className="group flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-colors"
          >
            <div className="h-10 w-10 rounded-xl bg-[#0E7C66]/10 text-[#0E7C66] flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 leading-tight flex items-center gap-1">
                <span className="truncate">{title}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity shrink-0" />
              </p>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{description}</p>
            </div>
          </a>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-medium text-slate-500">
        <Phone className="h-3.5 w-3.5 text-slate-400" />
        <span>Support direct : +225 07 58 15 27 61</span>
      </div>
    </Card>
  );
}