import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight, Sparkles, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface ShowcaseHomeProps {
  site: any;
  onContactClick: () => void;
  onNavigate: (section: string) => void;
}

export const ShowcaseHome = ({ site, onContactClick, onNavigate }: ShowcaseHomeProps) => {
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : (site.text_color || 'hsl(var(--foreground))');
  const features = site.features || [];
  const formations = site.formations || [];
  
  const servicesSection = useScrollAnimation({ threshold: 0.2 });
  const ctaSection = useScrollAnimation({ threshold: 0.3 });

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        className="relative min-h-[90vh] flex items-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${site.primary_color || 'hsl(var(--primary))'}, ${site.secondary_color || 'hsl(var(--secondary))'})`,
        }}
      >
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

      {/* Services */}
      {features.length > 0 && (
        <section ref={servicesSection.ref} className="section-spacing px-4">
          <div className="container mx-auto max-w-7xl">
            <div className={`text-center mb-16 scroll-fade-up ${servicesSection.isVisible ? 'visible' : ''}`}>
              <Badge className="mb-6" variant="outline">NOS SERVICES</Badge>
              <h2 className="heading-lg mb-6" style={{ color: textColor }}>Ce que nous offrons</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {features.slice(0, 3).map((feature: any, idx: number) => (
                <Card 
                  key={idx} 
                  className={`card-modern p-8 group cursor-pointer scroll-scale ${servicesSection.isVisible ? 'visible' : ''} delay-${(idx + 1) * 100}`}
                  onClick={() => onNavigate('services')}
                >
                  <Sparkles className="h-12 w-12 mb-6 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="heading-md mb-4" style={{ color: textColor }}>{feature.title}</h3>
                  <p className="text-muted-foreground mb-6">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
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
