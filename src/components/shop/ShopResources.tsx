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
    <Card className="p-8 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-xl">Ressources & Support</h3>
          <p className="text-sm text-slate-600 mt-1">Tout pour réussir la création et la gestion de votre boutique</p>
        </div>
        
        {/* Emphasized Support Contact */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <p className="text-sm font-medium text-slate-700">Besoin d'aide avec votre boutique ?</p>
          <Button asChild size="default" className="gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl shadow-md px-5 font-semibold">
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" /> Contacter le Support
            </a>
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map(({ icon: Icon, title, description, href }) => (
          <a
            key={title}
            href={href}
            className="group flex gap-4 p-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100/50 hover:border-[#0E7C66]/30 transition-all shadow-sm hover:shadow"
          >
            <div className="h-12 w-12 rounded-xl bg-[#0E7C66]/10 text-[#0E7C66] flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-slate-900 leading-tight flex items-center gap-1">
                <span className="truncate">{title}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-[#0E7C66] transition-opacity shrink-0" />
              </p>
              <p className="text-[12px] text-slate-500 mt-1.5 leading-snug font-medium">{description}</p>
            </div>
          </a>
        ))}
      </div>
      
      <div className="mt-8 pt-5 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-medium text-slate-500">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-slate-400" />
          <span>Support direct : +225 07 58 15 27 61</span>
        </div>
        <p>Disponible du Lundi au Samedi, 08h - 18h</p>
      </div>
    </Card>
  );
}