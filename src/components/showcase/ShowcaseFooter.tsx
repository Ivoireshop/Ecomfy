import { Facebook, Instagram, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface ShowcaseFooterProps {
  site: any;
  onNavigate: (section: string) => void;
}

export const ShowcaseFooter = ({ site, onNavigate }: ShowcaseFooterProps) => {
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : 'hsl(var(--foreground))';
  const mutedColor = site.theme_mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'hsl(var(--muted-foreground))';

  const navigationLinks = [
    { label: 'Accueil', section: 'home' },
    { label: 'À propos', section: 'about' },
    { label: 'Services', section: 'services' },
    { label: 'Formations', section: 'formations' },
    { label: 'Contact', section: 'contact' },
  ];

  const legalLinks = [
    { label: 'Mentions légales', href: '/legal' },
    { label: 'Politique de confidentialité', href: '/privacy' },
    { label: 'Conditions d\'utilisation', href: '/terms' },
  ];

  return (
    <footer className="bg-card border-t mt-24">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Logo & Description */}
          <div className="md:col-span-1">
            {site.logo_url ? (
              <img 
                src={site.logo_url} 
                alt={site.business_name}
                className="h-12 w-auto mb-6"
              />
            ) : (
              <h3 
                className="text-2xl font-bold mb-6"
                style={{ color: textColor }}
              >
                {site.business_name}
              </h3>
            )}
            <p className="text-sm leading-relaxed" style={{ color: mutedColor }}>
              {site.business_description || 'Excellence et professionnalisme au service de vos projets'}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold mb-6" style={{ color: textColor }}>
              Navigation
            </h4>
            <ul className="space-y-3">
              {navigationLinks.map((link, index) => (
                <li key={index}>
                  <button
                    onClick={() => onNavigate(link.section)}
                    className="text-sm hover:text-primary transition-colors"
                    style={{ color: mutedColor }}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-6" style={{ color: textColor }}>
              Contact
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: mutedColor }} />
                <a 
                  href={`tel:${site.phone_number}`}
                  className="text-sm hover:text-primary transition-colors"
                  style={{ color: mutedColor }}
                >
                  {site.phone_number}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: mutedColor }} />
                <a 
                  href={`https://wa.me/${site.whatsapp_number.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-primary transition-colors"
                  style={{ color: mutedColor }}
                >
                  WhatsApp: {site.whatsapp_number}
                </a>
              </li>
            </ul>
          </div>

          {/* Réseaux sociaux */}
          <div>
            <h4 className="font-semibold mb-6" style={{ color: textColor }}>
              Suivez-nous
            </h4>
            <div className="flex gap-3">
              <Button 
                size="icon" 
                variant="outline"
                className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Facebook className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="outline"
                className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Instagram className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="outline"
                className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm" style={{ color: mutedColor }}>
            © {new Date().getFullYear()} {site.business_name}. Tous droits réservés.
          </p>
          
          <div className="flex flex-wrap gap-6 justify-center">
            {legalLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="text-sm hover:text-primary transition-colors"
                style={{ color: mutedColor }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
