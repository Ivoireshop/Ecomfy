import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Phone, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { Helmet } from "react-helmet";

interface Feature {
  title: string;
  description: string;
}

interface ShowcaseSite {
  id: string;
  subdomain: string;
  business_name: string;
  owner_name: string;
  whatsapp_number: string;
  phone_number: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  about_title: string | null;
  about_description: string | null;
  features: Feature[] | null;
  cta_title: string | null;
  cta_description: string | null;
  formation_title: string | null;
  formation_description: string | null;
  formation_price: string | null;
  theme: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  about_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  og_image_url: string | null;
}

interface GalleryImage {
  id: string;
  image_url: string;
  image_caption: string | null;
  section_type: string;
  section_title: string | null;
}

export default function ShowcaseView() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<ShowcaseSite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [galleries, setGalleries] = useState<Record<string, GalleryImage[]>>({});

  useEffect(() => {
    loadSite();
  }, [subdomain]);

  // Track analytics
  useEffect(() => {
    if (!site) return;

    const trackVisit = async () => {
      try {
        // Generate a session ID (or retrieve from sessionStorage)
        let sessionId = sessionStorage.getItem('showcase_session_id');
        if (!sessionId) {
          sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sessionStorage.setItem('showcase_session_id', sessionId);
        }

        // Detect device type
        const userAgent = navigator.userAgent.toLowerCase();
        let deviceType = 'Desktop';
        if (/mobile|android|iphone|ipod/i.test(userAgent)) {
          deviceType = 'Mobile';
        } else if (/tablet|ipad/i.test(userAgent)) {
          deviceType = 'Tablet';
        }

        // Detect browser
        let browser = 'Unknown';
        if (userAgent.indexOf('chrome') > -1) browser = 'Chrome';
        else if (userAgent.indexOf('firefox') > -1) browser = 'Firefox';
        else if (userAgent.indexOf('safari') > -1) browser = 'Safari';
        else if (userAgent.indexOf('edge') > -1) browser = 'Edge';

        await supabase.from('showcase_analytics').insert({
          showcase_site_id: site.id,
          visitor_ip: null, // Could be enhanced with an IP detection service
          visitor_country: null, // Could be enhanced with geolocation
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
          page_path: window.location.pathname,
          session_id: sessionId,
          device_type: deviceType,
          browser: browser,
        });
      } catch (error) {
        console.error('Error tracking visit:', error);
      }
    };

    trackVisit();
  }, [site]);

  const loadSite = async () => {
    if (!subdomain) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("showcase_sites")
        .select("*")
        .eq("subdomain", subdomain)
        .eq("is_published", true)
        .single();

      if (error) {
        console.error("Error loading site:", error);
      } else {
        const siteData = {
          ...data,
          features: data.features ? (data.features as unknown as Feature[]) : null
        };
        setSite(siteData as ShowcaseSite);
        
        // Load galleries for this site
        const { data: galleryData } = await supabase
          .from("showcase_galleries")
          .select("*")
          .eq("showcase_site_id", data.id)
          .order("image_order", { ascending: true });
        
        if (galleryData) {
          const grouped = galleryData.reduce((acc, img) => {
            const section = img.section_type;
            if (!acc[section]) acc[section] = [];
            acc[section].push(img as GalleryImage);
            return acc;
          }, {} as Record<string, GalleryImage[]>);
          setGalleries(grouped);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (!site) return;
    const cleanNumber = site.whatsapp_number.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanNumber}`, "_blank");
  };

  const handlePhoneClick = () => {
    if (!site) return;
    window.location.href = `tel:${site.phone_number}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-2xl font-bold">Site non trouvé</h2>
            <p className="text-muted-foreground">
              Ce site vitrine n'existe pas ou n'est pas encore publié.
            </p>
            <Button onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = site.primary_color || "#2563eb";
  const secondaryColor = site.secondary_color || "#7c3aed";

  // SEO metadata
  const seoTitle = site.seo_title || site.hero_title || site.business_name;
  const seoDescription = site.seo_description || site.hero_subtitle || `Découvrez ${site.business_name}`;
  const ogImage = site.og_image_url || site.hero_image_url || site.logo_url;
  const keywords = site.seo_keywords?.join(', ') || '';

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        {keywords && <meta name="keywords" content={keywords} />}
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={window.location.href} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>
      
      <div className="min-h-screen" style={{
      "--theme-primary": primaryColor,
      "--theme-secondary": secondaryColor,
    } as React.CSSProperties}>
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
      {/* Hero Section - HubSpot Style */}
      <section className="relative theme-gradient-hero">
        {site.hero_image_url && (
          <div className="absolute inset-0 overflow-hidden">
            <img 
              src={site.hero_image_url} 
              alt="Hero background" 
              className="w-full h-full object-cover opacity-20"
            />
          </div>
        )}
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {site.logo_url ? (
              <div className="flex justify-center mb-4">
                <img 
                  src={site.logo_url} 
                  alt="Logo" 
                  className="h-16 md:h-20 object-contain"
                />
              </div>
            ) : (
              <Badge variant="outline" className="text-sm px-4 py-2">
                {site.business_name}
              </Badge>
            )}
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
              {site.hero_title || site.business_name}
            </h1>
            
            {site.hero_subtitle && (
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                {site.hero_subtitle}
              </p>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button size="lg" onClick={handleWhatsAppClick} className="text-lg px-8 py-6">
                <MessageCircle className="mr-2 h-5 w-5" />
                Contactez-nous via WhatsApp
              </Button>
              <Button size="lg" variant="outline" onClick={handlePhoneClick} className="text-lg px-8 py-6">
                <Phone className="mr-2 h-5 w-5" />
                Appelez-nous
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      {site.about_description && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                {site.about_title || "À propos"}
              </h2>
              <div className={`grid ${site.about_image_url ? 'md:grid-cols-2' : 'grid-cols-1'} gap-12 items-center`}>
                {site.about_image_url && (
                  <div className="order-2 md:order-1">
                    <img 
                      src={site.about_image_url} 
                      alt="About" 
                      className="w-full rounded-lg shadow-xl"
                    />
                  </div>
                )}
                <div className={`prose prose-lg max-w-none text-muted-foreground ${site.about_image_url ? 'order-1 md:order-2' : ''}`}>
                  <p className="text-lg leading-relaxed whitespace-pre-line">
                    {site.about_description}
                  </p>
                </div>
              </div>
              
              {/* Author Gallery */}
              {galleries.author && galleries.author.length > 0 && (
                <div className="mt-12">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {galleries.author.map((image) => (
                      <div key={image.id} className="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                        <img
                          src={image.image_url}
                          alt={image.image_caption || "Gallery"}
                          className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {image.image_caption && (
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                            <p className="text-white text-sm">{image.image_caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Formations Gallery */}
      {galleries.formations && galleries.formations.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                Nos Formations
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {galleries.formations.map((image) => (
                  <Card key={image.id} className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow">
                    <div className="relative h-64">
                      <img
                        src={image.image_url}
                        alt={image.image_caption || "Formation"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {image.image_caption && (
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-lg">{image.image_caption}</h3>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Events/Conferences Gallery */}
      {galleries.events && galleries.events.length > 0 && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                Conférences & Événements
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {galleries.events.map((image) => (
                  <div key={image.id} className="group relative overflow-hidden rounded-lg shadow-xl">
                    <img
                      src={image.image_url}
                      alt={image.image_caption || "Event"}
                      className="w-full h-96 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {image.image_caption && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-6">
                        <p className="text-white text-lg font-medium">{image.image_caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Portfolio Gallery */}
      {galleries.portfolio && galleries.portfolio.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                Portfolio
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {galleries.portfolio.map((image) => (
                  <div key={image.id} className="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow aspect-square">
                    <img
                      src={image.image_url}
                      alt={image.image_caption || "Portfolio"}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    {image.image_caption && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                        <p className="text-white text-center font-medium">{image.image_caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {site.features && site.features.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {site.features.map((feature, index) => (
                  <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-shadow">
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
      {site.formation_title && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto theme-border-primary shadow-2xl">
              <CardContent className="p-12 space-y-8">
                <div className="text-center space-y-6">
                  <Badge className="text-base px-4 py-2">Formation Professionnelle</Badge>
                  <h2 className="text-3xl md:text-4xl font-bold">{site.formation_title}</h2>
                  {site.formation_description && (
                    <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
                      {site.formation_description}
                    </p>
                  )}
                  {site.formation_price && (
                    <div className="pt-4">
                      <p className="text-4xl font-bold theme-text-primary">
                        {site.formation_price}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                  <Button size="lg" onClick={handleWhatsAppClick} className="text-lg px-8 py-6">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    S'inscrire via WhatsApp
                  </Button>
                  <Button size="lg" variant="outline" onClick={handlePhoneClick} className="text-lg px-8 py-6">
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
      {site.cta_title && (
        <section className="py-20 theme-gradient-cta">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-8 text-white">
              <h2 className="text-3xl md:text-5xl font-bold">
                {site.cta_title}
              </h2>
              {site.cta_description && (
                <p className="text-xl md:text-2xl opacity-90 leading-relaxed">
                  {site.cta_description}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={handleWhatsAppClick} 
                  className="text-lg px-8 py-6"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  WhatsApp
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={handlePhoneClick} 
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
            {site.logo_url && (
              <div className="flex justify-center mb-4">
                <img 
                  src={site.logo_url} 
                  alt="Logo" 
                  className="h-12 object-contain"
                />
              </div>
            )}
            <p className="text-lg font-medium">{site.owner_name}</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button variant="ghost" onClick={handleWhatsAppClick} className="gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button variant="ghost" onClick={handlePhoneClick} className="gap-2">
                <Phone className="h-4 w-4" />
                Téléphone
              </Button>
            </div>
            <p className="text-sm text-muted-foreground pt-6">
              Site créé avec VisualPro • {site.subdomain}.visualpro.app
            </p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}