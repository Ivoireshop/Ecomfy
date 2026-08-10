import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/ecomfy-logo.png";

export function Footer() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      toast({
        title: "Inscription réussie !",
        description: "Vous recevrez nos dernières actualités par email.",
      });
      setEmail("");
    }
  };

  const productLinks = [
    { label: "Créer une boutique", path: "/#features" },
    { label: "Intelligence Artificielle", path: "/#ai" },
    { label: "Gestion des commandes", path: "/#manage" },
    { label: "Catalogue produits", path: "/#features" },
    { label: "Statistiques et Finances", path: "/#finance" },
  ];

  const resourcesLinks = [
    { label: "Documentation", path: "/docs" },
    { label: "Tutoriels", path: "/tutorial" },
    { label: "Centre d'aide", path: "/community" },
  ];

  const legalLinks = [
    { label: "Politique de confidentialité", path: "/privacy-policy" },
    { label: "Conditions d'utilisation", path: "/terms-of-service" },
    { label: "Mentions légales", path: "/legal-notice" },
  ];

  return (
    <footer className="bg-[#0F1B2C] text-slate-300 border-t border-slate-800 pt-20 pb-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-16">
          {/* ECOMFY */}
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <img src={logo} alt="Logo Ecomfy" className="h-8 w-8 brightness-0 invert" />
              <span className="text-2xl font-extrabold text-white">
                Ecomfy
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-6 max-w-sm leading-relaxed">
              Le système d'exploitation du e-commerce moderne. Créez, vendez, gérez et développez votre activité depuis une seule plateforme propulsée par l'IA.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Mail className="w-4 h-4 text-[#0E7C66]" />
                <span>contact@ecomfy.cloud</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Phone className="w-4 h-4 text-[#0E7C66]" />
                <span>+225 07 58 15 27 61</span>
              </div>
            </div>
          </div>

          {/* Produit */}
          <div>
            <h3 className="font-semibold text-white mb-5">Produit</h3>
            <ul className="space-y-3">
              {productLinks.map((link, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Ressources */}
          <div>
            <h3 className="font-semibold text-white mb-5">Ressources</h3>
            <ul className="space-y-3">
              {resourcesLinks.map((link, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Légal */}
          <div>
            <h3 className="font-semibold text-white mb-5">Légal</h3>
            <ul className="space-y-3">
              {legalLinks.map((link, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="font-semibold text-white mb-5">Newsletter</h3>
            <p className="text-sm text-slate-400 mb-4">
              Conseils e-commerce et nouveautés Ecomfy.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="space-y-3">
              <Input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-[#0E7C66]"
              />
              <Button type="submit" className="w-full bg-[#0E7C66] hover:bg-[#0A5F4F] text-white">
                S'inscrire
              </Button>
            </form>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Ecomfy. Tous droits réservés.
          </p>
          
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Tous les systèmes sont opérationnels
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
