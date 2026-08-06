import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Phone, CheckCircle } from "lucide-react";

interface Feature {
  title: string;
  description: string;
}

interface ShowcasePreviewProps {
  data: {
    heroTitle?: string;
    heroSubtitle?: string;
    aboutTitle?: string;
    aboutDescription?: string;
    ctaTitle?: string;
    ctaDescription?: string;
    formationTitle?: string;
    formationDescription?: string;
    formationPrice?: string;
    businessName?: string;
    ownerName?: string;
    theme?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoPreview?: string | null;
    heroImagePreview?: string | null;
    aboutImagePreview?: string | null;
    features?: Feature[];
  };
}

export function ShowcasePreview({ data }: ShowcasePreviewProps) {
  const primaryColor = data.primaryColor || "#2563eb";
  const secondaryColor = data.secondaryColor || "#7c3aed";

  return (
    <div 
      className="min-h-screen bg-background"
      style={{
        "--theme-primary": primaryColor,
        "--theme-secondary": secondaryColor,
      } as React.CSSProperties}
    >
      <style>{`
        .theme-gradient-hero {
          background: linear-gradient(135deg, ${primaryColor}08 0%, transparent 50%, ${secondaryColor}08 100%);
        }
        .theme-gradient-cta {
          background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);
        }
        .theme-text-primary {
          color: ${primaryColor};
        }
        .theme-bg-primary {
          background-color: ${primaryColor};
        }
        .theme-border-primary {
          border-color: ${primaryColor}33;
        }
      `}</style>

      {/* Hero Section */}
      <section className="relative theme-gradient-hero">
        {data.heroImagePreview && (
          <div className="absolute inset-0 overflow-hidden">
            <img 
              src={data.heroImagePreview} 
              alt="Hero background" 
              className="w-full h-full object-cover opacity-20"
            />
          </div>
        )}
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {data.logoPreview ? (
              <div className="flex justify-center mb-4">
                <img 
                  src={data.logoPreview} 
                  alt="Logo" 
                  className="h-16 md:h-20 object-contain"
                />
              </div>
            ) : (
              <Badge variant="outline" className="text-sm px-4 py-2">
                {data.businessName || "Votre Entreprise"}
              </Badge>
            )}
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
              {data.heroTitle || "Titre principal de votre site"}
            </h1>
            
            {data.heroSubtitle && (
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                {data.heroSubtitle}
              </p>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button size="lg" className="text-lg px-8 py-6">
                <MessageCircle className="mr-2 h-5 w-5" />
                Contactez-nous via WhatsApp
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                <Phone className="mr-2 h-5 w-5" />
                Appelez-nous
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      {data.aboutDescription && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                {data.aboutTitle || "À propos"}
              </h2>
              <div className={`grid ${data.aboutImagePreview ? 'md:grid-cols-2' : 'grid-cols-1'} gap-12 items-center`}>
                {data.aboutImagePreview && (
                  <div className="order-2 md:order-1">
                    <img 
                      src={data.aboutImagePreview} 
                      alt="About" 
                      className="w-full rounded-lg shadow-xl"
                    />
                  </div>
                )}
                <div className={`prose prose-lg max-w-none text-muted-foreground ${data.aboutImagePreview ? 'order-1 md:order-2' : ''}`}>
                  <p className="text-lg leading-relaxed whitespace-pre-line">
                    {data.aboutDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {data.features && data.features.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {data.features.map((feature, index) => (
                  <Card key={index} className="border-none shadow-lg">
                    <CardContent className="p-8 space-y-4">
                      <div className="w-12 h-12 rounded-full theme-bg-primary opacity-10 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 theme-text-primary" />
                      </div>
                      <h3 className="text-xl font-bold">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Formation Section */}
      {data.formationTitle && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto theme-border-primary shadow-2xl">
              <CardContent className="p-12 space-y-8">
                <div className="text-center space-y-6">
                  <Badge className="text-base px-4 py-2">Formation Professionnelle</Badge>
                  <h2 className="text-3xl md:text-4xl font-bold">{data.formationTitle}</h2>
                  {data.formationDescription && (
                    <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
                      {data.formationDescription}
                    </p>
                  )}
                  {data.formationPrice && (
                    <div className="pt-4">
                      <p className="text-4xl font-bold theme-text-primary">
                        {data.formationPrice}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                  <Button size="lg" className="text-lg px-8 py-6">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    S'inscrire via WhatsApp
                  </Button>
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                    <Phone className="mr-2 h-5 w-5" />
                    Appeler pour plus d'infos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {data.ctaTitle && (
        <section className="py-20 theme-gradient-cta">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-8 text-white">
              <h2 className="text-3xl md:text-5xl font-bold">
                {data.ctaTitle}
              </h2>
              {data.ctaDescription && (
                <p className="text-xl md:text-2xl opacity-90 leading-relaxed">
                  {data.ctaDescription}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                <Button 
                  size="lg" 
                  variant="secondary"
                  className="text-lg px-8 py-6"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  WhatsApp
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6 bg-white/10 hover:bg-white/20 border-white/30 text-white"
                >
                  <Phone className="mr-2 h-5 w-5" />
                  Téléphone
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto text-center space-y-4">
            {data.logoPreview && (
              <div className="flex justify-center mb-4">
                <img 
                  src={data.logoPreview} 
                  alt="Logo" 
                  className="h-12 object-contain"
                />
              </div>
            )}
            <p className="text-lg font-medium">{data.ownerName || "Votre nom"}</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button variant="ghost" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button variant="ghost" className="gap-2">
                <Phone className="h-4 w-4" />
                Téléphone
              </Button>
            </div>
            <p className="text-sm text-muted-foreground pt-6">
              Prévisualisation • Votre site Ecomfy
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
