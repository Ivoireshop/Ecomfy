import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ShowcaseHomeProps {
  site: any;
  onContactClick: () => void;
  onNavigate: (section: string) => void;
}

export const ShowcaseHome = ({ site, onContactClick, onNavigate }: ShowcaseHomeProps) => {
  const heroStyles = {
    background: site.theme_mode === 'dark' 
      ? `linear-gradient(135deg, ${site.primary_color}20, ${site.secondary_color}20)`
      : `linear-gradient(135deg, ${site.primary_color}10, ${site.secondary_color}10)`,
    color: site.text_color || '#000000',
  };

  const features = site.features || [];

  return (
    <div className="min-h-screen">
      {/* Hero Section avec animation */}
      <section 
        className="relative min-h-[90vh] flex items-center justify-center overflow-hidden animate-fade-in"
        style={heroStyles}
      >
        <div className="absolute inset-0 overflow-hidden">
          {site.hero_video_url ? (
            <video
              src={site.hero_video_url}
              autoPlay
              loop
              muted
              playsInline
              className="absolute w-full h-full object-cover opacity-30"
            />
          ) : site.hero_image_url ? (
            <img
              src={site.hero_image_url}
              alt="Hero"
              className="absolute w-full h-full object-cover opacity-30"
            />
          ) : null}
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {site.logo_url && (
              <div className="mb-8 animate-fade-in">
                <img 
                  src={site.logo_url} 
                  alt={site.business_name}
                  className="h-24 w-auto mx-auto"
                />
              </div>
            )}
            
            <h1 
              className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in"
              style={{ 
                color: site.text_color || '#000000',
                animationDelay: '0.2s',
                animationFillMode: 'backwards'
              }}
            >
              {site.hero_title || site.business_name}
            </h1>
            
            <p 
              className="text-xl md:text-2xl mb-8 opacity-90 animate-fade-in"
              style={{ 
                color: site.text_color || '#000000',
                animationDelay: '0.4s',
                animationFillMode: 'backwards'
              }}
            >
              {site.hero_subtitle || site.business_description}
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.6s', animationFillMode: 'backwards' }}>
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
              
              {features.length > 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onNavigate('about')}
                  className="hover-scale"
                  style={{ 
                    borderColor: site.primary_color || '#D4AF37',
                    color: site.text_color || '#000000'
                  }}
                >
                  En savoir plus
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section avec scroll animations */}
      {features.length > 0 && (
        <section className="py-20 px-4">
          <div className="container mx-auto">
            <h2 
              className="text-3xl md:text-4xl font-bold text-center mb-12 scroll-fade-in"
              style={{ color: site.text_color || '#000000' }}
            >
              Nos Services
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature: any, index: number) => (
                <Card 
                  key={index}
                  className="scroll-fade-in hover-scale overflow-hidden group cursor-pointer"
                  style={{ 
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'backwards'
                  }}
                >
                  {feature.image_url && (
                    <div className="relative overflow-hidden h-48">
                      <img 
                        src={feature.image_url}
                        alt={feature.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                        style={{ backgroundColor: site.primary_color || '#D4AF37' }}
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 
                      className="text-xl font-semibold mb-3 flex items-center gap-2"
                      style={{ color: site.primary_color || '#D4AF37' }}
                    >
                      <Sparkles className="h-5 w-5" />
                      {feature.title}
                    </h3>
                    <p style={{ color: site.text_color || '#000000' }}>
                      {feature.description}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {site.cta_title && (
        <section 
          className="py-20 px-4 scroll-fade-in"
          style={{ 
            background: `linear-gradient(135deg, ${site.primary_color}15, ${site.secondary_color}15)`
          }}
        >
          <div className="container mx-auto text-center">
            <h2 
              className="text-3xl md:text-4xl font-bold mb-6"
              style={{ color: site.text_color || '#000000' }}
            >
              {site.cta_title}
            </h2>
            <p 
              className="text-xl mb-8 max-w-2xl mx-auto"
              style={{ color: site.text_color || '#000000' }}
            >
              {site.cta_description}
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
              Contactez-nous maintenant
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
