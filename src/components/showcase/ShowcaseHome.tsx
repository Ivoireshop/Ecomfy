import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

interface ShowcaseHomeProps {
  site: any;
  onContactClick: () => void;
  onNavigate: (section: string) => void;
}

export const ShowcaseHome = ({ site, onContactClick, onNavigate }: ShowcaseHomeProps) => {
  const [scrollY, setScrollY] = useState(0);
  const [init, setInit] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const heroStyles = {
    background: site.theme_mode === 'dark' 
      ? `linear-gradient(135deg, ${site.primary_color}20, ${site.secondary_color}20)`
      : `linear-gradient(135deg, ${site.primary_color}10, ${site.secondary_color}10)`,
    color: site.text_color || '#000000',
  };

  const features = site.features || [];

  return (
    <div className="min-h-screen">
      {/* Hero Section avec animation améliorée et parallax */}
      <section 
        className="relative min-h-[90vh] flex items-center justify-center overflow-hidden animate-fade-in"
        style={heroStyles}
      >
        {/* Particles Effect */}
        {init && (
          <Particles
            id="tsparticles"
            className="absolute inset-0 z-0"
            options={{
              background: {
                color: {
                  value: "transparent",
                },
              },
              fpsLimit: 120,
              interactivity: {
                events: {
                  onClick: {
                    enable: true,
                    mode: "push",
                  },
                  onHover: {
                    enable: true,
                    mode: "repulse",
                  },
                  resize: {
                    enable: true,
                    delay: 0.5,
                  },
                },
                modes: {
                  push: {
                    quantity: 4,
                  },
                  repulse: {
                    distance: 100,
                    duration: 0.4,
                  },
                },
              },
              particles: {
                color: {
                  value: site.primary_color || '#D4AF37',
                },
                links: {
                  color: site.primary_color || '#D4AF37',
                  distance: 150,
                  enable: true,
                  opacity: 0.3,
                  width: 1,
                },
                move: {
                  direction: "none",
                  enable: true,
                  outModes: {
                    default: "bounce",
                  },
                  random: false,
                  speed: 1,
                  straight: false,
                },
                number: {
                  density: {
                    enable: true,
                    width: 800,
                    height: 800,
                  },
                  value: 80,
                },
                opacity: {
                  value: 0.5,
                },
                shape: {
                  type: "circle",
                },
                size: {
                  value: { min: 1, max: 3 },
                },
              },
              detectRetina: true,
            }}
          />
        )}

        <div className="absolute inset-0 overflow-hidden z-[1]">
          {site.hero_video_url ? (
            <video
              src={site.hero_video_url}
              autoPlay
              loop
              muted
              playsInline
              className="absolute w-full h-full object-cover opacity-30"
              style={{ transform: `translateY(${scrollY * 0.5}px)` }}
            />
          ) : site.hero_image_url ? (
            <img
              src={site.hero_image_url}
              alt="Hero"
              className="absolute w-full h-full object-cover opacity-30"
              style={{ transform: `translateY(${scrollY * 0.5}px)` }}
            />
          ) : null}
        </div>
        
        <div 
          className="container mx-auto px-4 sm:px-6 relative z-10"
          style={{ transform: `translateY(${scrollY * -0.2}px)` }}
        >
          <div className="max-w-4xl mx-auto text-center">
            {site.logo_url && (
              <div className="mb-6 sm:mb-8 animate-fade-in">
                <img 
                  src={site.logo_url} 
                  alt={site.business_name}
                  className="h-16 sm:h-20 md:h-24 w-auto mx-auto"
                />
              </div>
            )}
            
            <h1 
              className="font-bold mb-4 sm:mb-6 animate-fade-in leading-tight px-2"
              style={{ 
                fontSize: `${site.hero_title_size || 48}px`,
                color: site.hero_title_color || site.text_color || '#000000',
                animationDelay: '0.2s',
                animationFillMode: 'backwards'
              }}
            >
              {site.hero_title || site.business_name}
            </h1>
            
            <p 
              className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 opacity-90 animate-fade-in leading-relaxed px-4"
              style={{ 
                color: site.text_color || '#000000',
                animationDelay: '0.4s',
                animationFillMode: 'backwards'
              }}
            >
              {site.hero_subtitle || site.business_description}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center animate-fade-in px-4" style={{ animationDelay: '0.6s', animationFillMode: 'backwards' }}>
              <Button
                size="lg"
                onClick={onContactClick}
                className="hover-scale text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 w-full sm:w-auto"
                style={{ 
                  backgroundColor: site.primary_color || '#D4AF37',
                  color: '#ffffff'
                }}
              >
                <MessageCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Contactez-nous
              </Button>
              
              {features.length > 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onNavigate('about')}
                  className="hover-scale text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 w-full sm:w-auto"
                  style={{ 
                    borderColor: site.primary_color || '#D4AF37',
                    color: site.text_color || '#000000'
                  }}
                >
                  En savoir plus
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section avec scroll animations */}
      {features.length > 0 && (
        <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6">
          <div className="container mx-auto">
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 scroll-fade-in px-2"
              style={{ color: site.text_color || '#000000' }}
            >
              Nos Services
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {features.map((feature: any, index: number) => (
                <Card 
                  key={index}
                  className="scroll-fade-in hover-scale overflow-hidden group cursor-pointer shadow-lg"
                  style={{ 
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'backwards'
                  }}
                >
                  {feature.image_url && (
                    <div className="relative overflow-hidden h-40 sm:h-48">
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
                  <div className="p-4 sm:p-6">
                    <h3 
                      className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 flex items-center gap-2 leading-tight"
                      style={{ color: site.primary_color || '#D4AF37' }}
                    >
                      <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                      <span>{feature.title}</span>
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed" style={{ color: site.text_color || '#000000' }}>
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
          className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 scroll-fade-in"
          style={{ 
            background: `linear-gradient(135deg, ${site.primary_color}15, ${site.secondary_color}15)`
          }}
        >
          <div className="container mx-auto text-center">
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 leading-tight px-2"
              style={{ color: site.text_color || '#000000' }}
            >
              {site.cta_title}
            </h2>
            <p 
              className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-4"
              style={{ color: site.text_color || '#000000' }}
            >
              {site.cta_description}
            </p>
            <Button
              size="lg"
              onClick={onContactClick}
              className="hover-scale text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 w-full sm:w-auto max-w-md mx-auto"
              style={{ 
                backgroundColor: site.primary_color || '#D4AF37',
                color: '#ffffff'
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Contactez-nous maintenant
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
