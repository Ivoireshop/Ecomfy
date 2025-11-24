import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface ShowcaseServicesProps {
  site: any;
  onContactClick: () => void;
}

export const ShowcaseServices = ({ site, onContactClick }: ShowcaseServicesProps) => {
  const features = site.features || [];
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : (site.text_color || 'hsl(var(--foreground))');
  
  const heroSection = useScrollAnimation({ threshold: 0.1 });
  const servicesGrid = useScrollAnimation({ threshold: 0.2 });
  const ctaSection = useScrollAnimation({ threshold: 0.3 });

  console.log('ShowcaseServices - Features:', features);
  console.log('ShowcaseServices - Site:', site);

  if (!features || features.length === 0) {
    return (
      <div className="min-h-screen py-20 px-4">
        <div className="container mx-auto text-center space-y-4">
          <h2 className="text-2xl font-bold" style={{ color: textColor }}>Nos Services</h2>
          <p className="text-muted-foreground">Aucun service disponible pour le moment.</p>
          <p className="text-sm text-muted-foreground">Veuillez configurer vos services dans l'éditeur.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section ref={heroSection.ref} className="section-spacing px-4">
        <div className={`container mx-auto max-w-4xl text-center scroll-fade-up ${heroSection.isVisible ? 'visible' : ''}`}>
          <Badge className="mb-6" variant="outline">
            Nos Services
          </Badge>
          <h1 className="heading-xl mb-6 text-balance" style={{ color: textColor }}>
            Des solutions professionnelles adaptées à vos besoins
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Découvrez nos services conçus pour vous accompagner vers l'excellence
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section ref={servicesGrid.ref} className="pb-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature: any, index: number) => (
              <Card 
                key={index}
                className={`card-modern group hover-scale scroll-scale ${servicesGrid.isVisible ? 'visible' : ''} delay-${Math.min((index % 3 + 1) * 100, 400)}`}
              >
                {feature.image_url && (
                  <div className="relative h-64 overflow-hidden">
                    <img 
                      src={feature.image_url}
                      alt={feature.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  </div>
                )}
                
                <div className="p-8">
                  <h3 
                    className="heading-md mb-4"
                    style={{ color: textColor }}
                  >
                    {feature.title}
                  </h3>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {feature.description}
                  </p>

                  {feature.benefits && feature.benefits.length > 0 && (
                    <div className="space-y-3 mb-6">
                      {feature.benefits.map((benefit: string, i: number) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button 
                    onClick={onContactClick}
                    className="w-full group"
                    variant="default"
                  >
                    En savoir plus
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaSection.ref} className="pb-24 px-4">
        <div 
          className={`container mx-auto max-w-4xl rounded-3xl p-12 md:p-16 text-center scroll-scale ${ctaSection.isVisible ? 'visible' : ''}`}
          style={{ 
            background: `linear-gradient(135deg, ${site.primary_color || 'hsl(var(--primary))'}, ${site.secondary_color || 'hsl(var(--secondary))'})` 
          }}
        >
          <h2 className="heading-lg text-white mb-6">
            Prêt à commencer ?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Contactez-nous dès aujourd'hui pour discuter de votre projet
          </p>
          <Button 
            size="lg"
            onClick={onContactClick}
            className="bg-white text-primary hover:bg-white/90 font-semibold px-8 py-6 text-lg rounded-full shadow-xl hover:scale-105 transition-all"
          >
            Contactez-nous
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};
