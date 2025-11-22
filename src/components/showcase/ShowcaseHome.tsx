import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight, Sparkles, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import Particles from "@tsparticles/react";
import { useMemo, useEffect } from "react";
import type { Container } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";

interface ShowcaseHomeProps {
  site: any;
  onContactClick: () => void;
  onNavigate: (section: string) => void;
}

export const ShowcaseHome = ({ site, onContactClick, onNavigate }: ShowcaseHomeProps) => {
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : (site.text_color || 'hsl(var(--foreground))');
  const backgroundColor = site.background_color || (site.theme_mode === 'dark' ? '#0f172a' : '#ffffff');
  const features = site.features || [];
  const formations = site.formations || [];
  
  const servicesSection = useScrollAnimation({ threshold: 0.2 });
  const aboutSection = useScrollAnimation({ threshold: 0.2 });
  const statsSection = useScrollAnimation({ threshold: 0.2 });
  const formationsSection = useScrollAnimation({ threshold: 0.2 });
  const ctaSection = useScrollAnimation({ threshold: 0.3 });

  useEffect(() => {
    loadSlim(window.tsParticles);
  }, []);

  const particlesOptions = useMemo(() => ({
    background: {
      color: {
        value: "transparent",
      },
    },
    fpsLimit: 120,
    particles: {
      color: {
        value: "#ffffff",
      },
      links: {
        color: "#ffffff",
        distance: 150,
        enable: true,
        opacity: 0.3,
        width: 1,
      },
      move: {
        direction: "none" as const,
        enable: true,
        outModes: {
          default: "bounce" as const,
        },
        random: false,
        speed: 1,
        straight: false,
      },
      number: {
        density: {
          enable: true,
          area: 800,
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
  }), []);

  return (
    <div className="min-h-screen" style={{ backgroundColor }}>
      {/* Hero Section */}
      <section 
        className="relative min-h-[90vh] flex items-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${site.primary_color || 'hsl(var(--primary))'}, ${site.secondary_color || 'hsl(var(--secondary))'})`,
        }}
      >
        <Particles
          id="tsparticles"
          options={particlesOptions}
          className="absolute inset-0"
        />
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in text-white z-10">
              {site.logo_url && <img src={site.logo_url} alt={site.business_name} className="h-16 w-auto mb-8" />}
              <h1 className="heading-xl mb-6 text-white" style={{ fontSize: site.hero_title_size ? `${site.hero_title_size}px` : undefined }}>
                {site.hero_title || site.business_name}
              </h1>
              {site.hero_subtitle && <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed max-w-2xl">{site.hero_subtitle}</p>}
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={onContactClick} className="btn-cta bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                  <MessageCircle className="mr-2 h-5 w-5" />Contactez-nous
                </Button>
                {features.length > 0 && (
                  <Button size="lg" variant="outline" onClick={() => onNavigate('services')} className="bg-white/10 border-white/30 text-white hover:bg-white hover:text-primary backdrop-blur-sm font-semibold px-8 py-6 text-lg transition-all">
                    En savoir plus<ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="relative animate-fade-in lg:block hidden z-10">
              {site.hero_image_url && (
                <div className="relative"><div className="absolute -inset-4 bg-white/20 rounded-3xl blur-2xl" />
                  <img src={site.hero_image_url} alt="Hero" className="relative w-full h-auto rounded-3xl shadow-2xl" />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Services Preview */}
      {features.length > 0 && (
        <section ref={servicesSection.ref} className="section-spacing px-4">
          <div className="container mx-auto max-w-7xl">
            <div className={`text-center mb-16 scroll-fade-up ${servicesSection.isVisible ? 'visible' : ''}`}>
              <Badge className="mb-6" variant="outline">NOS SERVICES</Badge>
              <h2 className="heading-lg mb-6" style={{ color: textColor }}>Ce que nous offrons</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Des solutions professionnelles pour répondre à vos besoins</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {features.slice(0, 3).map((feature: any, idx: number) => (
                <Card 
                  key={idx} 
                  className={`card-modern p-8 group cursor-pointer scroll-scale ${servicesSection.isVisible ? 'visible' : ''} delay-${(idx + 1) * 100}`}
                  onClick={() => onNavigate('services')}
                >
                  {feature.image_url ? (
                    <div className="mb-6 rounded-lg overflow-hidden">
                      <img 
                        src={feature.image_url} 
                        alt={feature.title}
                        className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <Sparkles className="h-12 w-12 mb-6 text-primary group-hover:scale-110 transition-transform" />
                  )}
                  <h3 className="heading-md mb-4" style={{ color: textColor }}>{feature.title}</h3>
                  <p className="text-muted-foreground mb-6">{feature.description}</p>
                  <Button variant="ghost" className="group-hover:translate-x-2 transition-transform">
                    En savoir plus <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About/Biography Preview */}
      {(site.biography_content || site.about_description) && (
        <section ref={aboutSection.ref} className="section-spacing px-4 bg-muted/30">
          <div className="container mx-auto max-w-7xl">
            <div className={`grid md:grid-cols-2 gap-12 items-center scroll-fade-up ${aboutSection.isVisible ? 'visible' : ''}`}>
              {site.biography_image_url && (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <img 
                    src={site.biography_image_url}
                    alt={site.owner_name}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
              <div>
                <Badge className="mb-6" variant="outline">
                  <BookOpen className="h-4 w-4 mr-2" />
                  {site.biography_title || "À Propos"}
                </Badge>
                <h2 className="heading-lg mb-6" style={{ color: textColor }}>
                  {site.owner_name}
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  {(site.biography_content || site.about_description)?.split('\n')[0]}
                </p>
                <Button onClick={() => onNavigate('biography')} size="lg">
                  Découvrir mon parcours <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats Section */}
      {site.stats_show_section !== false && (
        <section ref={statsSection.ref} className="section-spacing px-4">
          <div className="container mx-auto max-w-7xl">
            <div className={`grid md:grid-cols-4 gap-8 scroll-fade-up ${statsSection.isVisible ? 'visible' : ''}`}>
              <Card 
                className="text-center p-8 card-modern"
                style={{ 
                  backgroundColor: site.stats_bg_color || 'rgba(0,0,0,0.7)',
                  color: site.stats_text_color || '#ffffff'
                }}
              >
                <div className="text-4xl font-bold mb-2" style={{ color: site.stats_text_color || '#ffffff' }}>
                  {site.stats_satisfied_clients || 100}+
                </div>
                <p className="opacity-80">Clients Satisfaits</p>
              </Card>
              <Card 
                className="text-center p-8 card-modern"
                style={{ 
                  backgroundColor: site.stats_bg_color || 'rgba(0,0,0,0.7)',
                  color: site.stats_text_color || '#ffffff'
                }}
              >
                <div className="text-4xl font-bold mb-2" style={{ color: site.stats_text_color || '#ffffff' }}>
                  {site.stats_years_experience || 5}+
                </div>
                <p className="opacity-80">Années d'Expérience</p>
              </Card>
              <Card 
                className="text-center p-8 card-modern"
                style={{ 
                  backgroundColor: site.stats_bg_color || 'rgba(0,0,0,0.7)',
                  color: site.stats_text_color || '#ffffff'
                }}
              >
                <div className="text-4xl font-bold mb-2" style={{ color: site.stats_text_color || '#ffffff' }}>
                  {site.stats_projects_completed || 50}+
                </div>
                <p className="opacity-80">Projets Réalisés</p>
              </Card>
              <Card 
                className="text-center p-8 card-modern"
                style={{ 
                  backgroundColor: site.stats_bg_color || 'rgba(0,0,0,0.7)',
                  color: site.stats_text_color || '#ffffff'
                }}
              >
                <div className="text-4xl font-bold mb-2" style={{ color: site.stats_text_color || '#ffffff' }}>98%</div>
                <p className="opacity-80">Taux de Satisfaction</p>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Formations Preview */}
      {formations.length > 0 && (
        <section ref={formationsSection.ref} className="section-spacing px-4 bg-muted/30">
          <div className="container mx-auto max-w-7xl">
            <div className={`text-center mb-16 scroll-fade-up ${formationsSection.isVisible ? 'visible' : ''}`}>
              <Badge className="mb-6" variant="outline">NOS FORMATIONS</Badge>
              <h2 className="heading-lg mb-6" style={{ color: textColor }}>Développez vos compétences</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Des formations complètes pour atteindre vos objectifs</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {formations.slice(0, 3).map((formation: any, idx: number) => (
                <Card 
                  key={idx} 
                  className={`card-modern group cursor-pointer overflow-hidden scroll-scale ${formationsSection.isVisible ? 'visible' : ''} delay-${(idx + 1) * 100}`}
                  onClick={() => onNavigate('formations')}
                >
                  {formation.image_url && (
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={formation.image_url}
                        alt={formation.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="heading-md mb-3" style={{ color: textColor }}>{formation.title}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-2">{formation.description}</p>
                    {formation.price && (
                      <div 
                        className="text-2xl font-bold mb-4 px-4 py-2 rounded-lg inline-block" 
                        style={{ 
                          color: site.price_text_color || '#ffffff',
                          backgroundColor: site.price_bg_color || '#2563eb'
                        }}
                      >
                        {formation.price}
                      </div>
                    )}
                    <Button variant="outline" className="w-full">
                      Voir les détails <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Final */}
      {site.cta_title && (
        <section ref={ctaSection.ref} className="section-spacing px-4">
          <div 
            className={`container mx-auto max-w-5xl rounded-3xl p-12 md:p-20 text-center scroll-scale ${ctaSection.isVisible ? 'visible' : ''}`}
            style={{ 
              background: `linear-gradient(135deg, ${site.primary_color || 'hsl(var(--primary))'}, ${site.secondary_color || 'hsl(var(--secondary))'})` 
            }}
          >
            <h2 className="heading-lg text-white mb-6">{site.cta_title}</h2>
            <Button size="lg" onClick={onContactClick} className="bg-white text-primary hover:bg-white/90 font-semibold px-10 py-7 text-lg rounded-full">
              Contactez-nous<ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
