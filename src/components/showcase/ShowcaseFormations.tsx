import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Clock, Users, CheckCircle, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface ShowcaseFormationsProps {
  site: any;
  onContactClick: () => void;
}

export const ShowcaseFormations = ({ site, onContactClick }: ShowcaseFormationsProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const formations = site.formations || [];

  useEffect(() => {
    setIsVisible(true);
  }, []);

  if (!formations || formations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20 px-4">
        <div className="text-center">
          <GraduationCap className="h-20 w-20 mx-auto mb-6 opacity-30" />
          <h2 className="text-2xl font-semibold mb-4">Aucune formation disponible</h2>
          <p className="text-muted-foreground mb-8">Revenez bientôt pour découvrir nos formations</p>
          <Button onClick={onContactClick}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Contactez-nous
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-20 px-4 transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <Badge className="mb-4" variant="outline">
            <GraduationCap className="h-4 w-4 mr-2" />
            Formations
          </Badge>
          <h1 
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: site.text_color || '#000000' }}
          >
            {site.formation_title || "Nos Formations"}
          </h1>
          {site.formation_description && (
            <p 
              className="text-xl max-w-3xl mx-auto opacity-90"
              style={{ color: site.text_color || '#000000' }}
            >
              {site.formation_description}
            </p>
          )}
        </div>

        {/* Formations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {formations.map((formation: any, index: number) => (
            <Card 
              key={index}
              className="scroll-fade-in hover-scale overflow-hidden group"
              style={{ 
                animationDelay: `${index * 0.15}s`,
                animationFillMode: 'backwards'
              }}
            >
              {formation.image_url && (
                <div className="relative overflow-hidden h-56">
                  <img 
                    src={formation.image_url}
                    alt={formation.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div 
                    className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                  <Badge 
                    className="absolute top-4 right-4"
                    style={{ 
                      backgroundColor: site.primary_color || '#D4AF37',
                      color: '#ffffff'
                    }}
                  >
                    Nouveau
                  </Badge>
                </div>
              )}
              
              <CardContent className="p-6">
                <h3 
                  className="text-2xl font-bold mb-3 group-hover:translate-x-1 transition-transform"
                  style={{ color: site.primary_color || '#D4AF37' }}
                >
                  {formation.title}
                </h3>
                
                <p 
                  className="mb-4 leading-relaxed"
                  style={{ color: site.text_color || '#000000' }}
                >
                  {formation.description}
                </p>

                {formation.price && (
                  <div 
                    className="text-3xl font-bold mb-4"
                    style={{ color: site.secondary_color || '#10B981' }}
                  >
                    {formation.price}
                  </div>
                )}

                {formation.duration && (
                  <div className="flex items-center gap-2 mb-2 text-sm opacity-80">
                    <Clock className="h-4 w-4" />
                    <span>{formation.duration}</span>
                  </div>
                )}

                {formation.participants && (
                  <div className="flex items-center gap-2 mb-4 text-sm opacity-80">
                    <Users className="h-4 w-4" />
                    <span>{formation.participants}</span>
                  </div>
                )}

                {formation.benefits && formation.benefits.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {formation.benefits.slice(0, 3).map((benefit: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle 
                          className="h-4 w-4 mt-0.5 flex-shrink-0" 
                          style={{ color: site.secondary_color || '#10B981' }}
                        />
                        <span style={{ color: site.text_color || '#000000' }}>{benefit}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={onContactClick}
                  className="w-full mt-4 hover-scale"
                  style={{ 
                    backgroundColor: site.primary_color || '#D4AF37',
                    color: '#ffffff'
                  }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  S'inscrire
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div 
          className="mt-16 text-center p-8 rounded-2xl scroll-fade-in"
          style={{ 
            background: `linear-gradient(135deg, ${site.primary_color}15, ${site.secondary_color}15)`
          }}
        >
          <h3 
            className="text-2xl font-bold mb-4"
            style={{ color: site.text_color || '#000000' }}
          >
            Besoin de plus d'informations ?
          </h3>
          <p 
            className="mb-6 max-w-2xl mx-auto"
            style={{ color: site.text_color || '#000000' }}
          >
            Contactez-nous pour obtenir plus de détails sur nos formations et trouver celle qui vous convient le mieux.
          </p>
          <Button
            size="lg"
            onClick={onContactClick}
            className="hover-scale"
            style={{ 
              backgroundColor: site.primary_color || '#D4AF37',
              color: '#ffffff'
            }}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Contactez-nous
          </Button>
        </div>
      </div>
    </div>
  );
};
