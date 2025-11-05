import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Phone, Loader2, ArrowLeft } from "lucide-react";

interface ShowcaseSite {
  id: string;
  subdomain: string;
  business_name: string;
  business_description: string | null;
  owner_name: string;
  owner_photo_url: string | null;
  whatsapp_number: string;
  phone_number: string;
  formation_title: string | null;
  formation_description: string | null;
  formation_price: string | null;
  formation_image_url: string | null;
}

export default function ShowcaseView() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<ShowcaseSite | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSite();
  }, [subdomain]);

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
        setSite(data);
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
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold">{site.business_name}</h1>
          {site.business_description && (
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {site.business_description}
            </p>
          )}
          
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Button size="lg" onClick={handleWhatsAppClick} className="gap-2">
              <MessageCircle className="h-5 w-5" />
              Contactez-nous via WhatsApp
            </Button>
            <Button size="lg" variant="outline" onClick={handlePhoneClick} className="gap-2">
              <Phone className="h-5 w-5" />
              Appelez-nous
            </Button>
          </div>
        </div>
      </section>

      {/* Formation Section */}
      {site.formation_title && (
        <section className="container mx-auto px-4 py-16">
          <Card className="max-w-4xl mx-auto">
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold">{site.formation_title}</h2>
                {site.formation_description && (
                  <p className="text-lg text-muted-foreground">
                    {site.formation_description}
                  </p>
                )}
                {site.formation_price && (
                  <p className="text-2xl font-bold text-primary">
                    {site.formation_price}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-4 justify-center pt-4">
                <Button size="lg" onClick={handleWhatsAppClick} className="gap-2">
                  <MessageCircle className="h-5 w-5" />
                  S'inscrire via WhatsApp
                </Button>
                <Button size="lg" variant="outline" onClick={handlePhoneClick} className="gap-2">
                  <Phone className="h-5 w-5" />
                  Appeler pour plus d'infos
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* About Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold">À propos</h2>
            <p className="text-lg">
              Ce site est géré par <strong>{site.owner_name}</strong>
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Button onClick={handleWhatsAppClick} className="gap-2">
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </Button>
              <Button variant="outline" onClick={handlePhoneClick} className="gap-2">
                <Phone className="h-5 w-5" />
                Téléphone
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>Site créé avec VisualPro • {site.subdomain}.visualpro.app</p>
        </div>
      </footer>
    </div>
  );
}