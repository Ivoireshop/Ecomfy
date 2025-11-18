import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, Mail, MapPin } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { useState, useEffect } from "react";

interface ShowcaseContactProps {
  site: any;
}

export const ShowcaseContact = ({ site }: ShowcaseContactProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleWhatsApp = () => {
    const message = encodeURIComponent(`Bonjour ${site.business_name}, je souhaite obtenir plus d'informations.`);
    window.open(`https://wa.me/${site.whatsapp_number.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const handleCall = () => {
    window.location.href = `tel:${site.phone_number}`;
  };

  return (
    <div className={`min-h-screen py-20 px-4 transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <Badge className="mb-4" variant="outline">
            <MessageCircle className="h-4 w-4 mr-2" />
            Contact
          </Badge>
          <h1 
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: site.text_color || '#000000' }}
          >
            Contactez-nous
          </h1>
          <p 
            className="text-xl max-w-3xl mx-auto opacity-90"
            style={{ color: site.text_color || '#000000' }}
          >
            Nous sommes là pour répondre à toutes vos questions
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-12">
          {/* Contact Form */}
          <div className="scroll-fade-in">
            <Card className="p-8">
              <h2 
                className="text-2xl font-bold mb-6"
                style={{ color: site.primary_color || '#D4AF37' }}
              >
                Envoyez-nous un message
              </h2>
              <ContactForm 
                showcaseSiteId={site.id} 
                businessName={site.business_name}
                theme={{
                  primaryColor: site.primary_color,
                  secondaryColor: site.secondary_color
                }}
              />
            </Card>
          </div>

          {/* Contact Info */}
          <div className="space-y-6 scroll-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
            <Card className="p-6 hover-scale">
              <div className="flex items-start gap-4">
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${site.primary_color}20` || '#D4AF3720' }}
                >
                  <Phone className="h-6 w-6" style={{ color: site.primary_color || '#D4AF37' }} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Téléphone</h3>
                  <a 
                    href={`tel:${site.phone_number}`}
                    className="hover:underline"
                    style={{ color: site.primary_color || '#D4AF37' }}
                  >
                    {site.phone_number}
                  </a>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover-scale">
              <div className="flex items-start gap-4">
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${site.secondary_color}20` || '#10B98120' }}
                >
                  <MessageCircle className="h-6 w-6" style={{ color: site.secondary_color || '#10B981' }} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">WhatsApp</h3>
                  <button 
                    onClick={handleWhatsApp}
                    className="hover:underline text-left"
                    style={{ color: site.secondary_color || '#10B981' }}
                  >
                    {site.whatsapp_number}
                  </button>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover-scale">
              <div className="flex items-start gap-4">
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${site.primary_color}20` || '#D4AF3720' }}
                >
                  <MapPin className="h-6 w-6" style={{ color: site.primary_color || '#D4AF37' }} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Localisation</h3>
                  <p style={{ color: site.text_color || '#000000' }}>
                    {site.business_name}
                  </p>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <div 
              className="p-8 rounded-2xl text-center"
              style={{ 
                background: `linear-gradient(135deg, ${site.primary_color}15, ${site.secondary_color}15)`
              }}
            >
              <h3 
                className="text-xl font-bold mb-4"
                style={{ color: site.text_color || '#000000' }}
              >
                Besoin d'une réponse rapide ?
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleWhatsApp}
                  className="px-6 py-3 rounded-lg font-semibold hover-scale flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: site.secondary_color || '#10B981',
                    color: '#ffffff'
                  }}
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </button>
                <button
                  onClick={handleCall}
                  className="px-6 py-3 rounded-lg font-semibold hover-scale flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: site.primary_color || '#D4AF37',
                    color: '#ffffff'
                  }}
                >
                  <Phone className="h-5 w-5" />
                  Appeler
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Map or Additional Info */}
        <div 
          className="p-12 rounded-2xl text-center scroll-fade-in"
          style={{ 
            background: `linear-gradient(135deg, ${site.primary_color}10, ${site.secondary_color}10)`
          }}
        >
          <h3 
            className="text-2xl font-bold mb-4"
            style={{ color: site.text_color || '#000000' }}
          >
            Nous sommes à votre écoute
          </h3>
          <p 
            className="max-w-2xl mx-auto opacity-90"
            style={{ color: site.text_color || '#000000' }}
          >
            Notre équipe est disponible pour répondre à toutes vos questions et vous accompagner dans vos projets.
          </p>
        </div>
      </div>
    </div>
  );
};
