import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import featureRapide from "@/assets/feature-rapide.jpg";
import featureAfrique from "@/assets/feature-afrique.jpg";
import featureIA from "@/assets/feature-ia.jpg";
import founderImage from "@/assets/founder-ulrich-djate.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [publishedFeedback, setPublishedFeedback] = useState<any[]>([]);

  useEffect(() => {
    loadPublishedFeedback();
  }, []);

  const loadPublishedFeedback = async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("Error loading feedback:", error);
      return;
    }

    setPublishedFeedback(data || []);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <Header />
      
      {/* Hero Section */}
      <section id="home" className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Intelligence Artificielle Africaine</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            VisualPro
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
            Créez des visuels publicitaires professionnels adaptés au marché africain en moins d'une minute
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate("/auth")}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Créer mon premier visuel
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-6"
              onClick={() => navigate("/auth")}
            >
              Se connecter
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-6">
            <div className="w-32 h-32 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
              <img 
                src={featureRapide} 
                alt="Rapidité et simplicité" 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">Rapide et Simple</h3>
            <p className="text-muted-foreground">
              Obtenez votre visuel professionnel en moins d'une minute, sans compétences en design
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-32 h-32 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
              <img 
                src={featureAfrique} 
                alt="Adapté au marché africain" 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">Adapté à l'Afrique</h3>
            <p className="text-muted-foreground">
              Des visuels qui reflètent la diversité et la richesse culturelle du marché africain
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-32 h-32 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
              <img 
                src={featureIA} 
                alt="Intelligence artificielle" 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">IA Intelligente</h3>
            <p className="text-muted-foreground">
              Notre IA génère automatiquement le visuel et le texte publicitaire parfaits pour votre produit
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {publishedFeedback.length > 0 && (
        <section id="testimonials" className="container mx-auto px-4 py-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Ce que disent nos utilisateurs
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {publishedFeedback.map((feedback) => (
              <div
                key={feedback.id}
                className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4 mb-4">
                  {feedback.photo_url && (
                    <img
                      src={feedback.photo_url}
                      alt={feedback.full_name || "Utilisateur"}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold">
                        {feedback.full_name || "Utilisateur anonyme"}
                      </h4>
                      <div className="flex text-yellow-400">
                        {Array.from({ length: feedback.rating }).map((_, i) => (
                          <span key={i}>⭐</span>
                        ))}
                      </div>
                    </div>
                    {feedback.country && (
                      <p className="text-sm text-muted-foreground">
                        {feedback.country}
                      </p>
                    )}
                  </div>
                </div>
                {feedback.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    "{feedback.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Founder Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-card to-accent/5 rounded-2xl shadow-xl overflow-hidden border">
            <div className="grid md:grid-cols-2 gap-8 items-center p-8 md:p-12">
              <div className="order-2 md:order-1 text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Notre Fondateur
                </h2>
                <h3 className="text-2xl font-semibold text-primary mb-6">
                  Ulrich Djaté
                </h3>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6 italic">
                  "La détermination forge le succès. Ne jamais abandonner, c'est la clé pour transformer chaque obstacle en opportunité. Poursuivez vos rêves avec passion et courage, car chaque grand projet commence par un premier pas audacieux."
                </p>
                <div className="inline-block bg-primary/10 text-primary px-6 py-3 rounded-lg font-medium">
                  Fondateur & CEO - VisualPro
                </div>
              </div>
              <div className="order-1 md:order-2">
                <div className="relative w-64 h-64 md:w-80 md:h-80 mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl blur-2xl"></div>
                  <img 
                    src={founderImage} 
                    alt="Ulrich Djaté - Fondateur de VisualPro" 
                    className="relative w-full h-full object-cover object-[center_30%] rounded-2xl shadow-2xl border-4 border-background"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-12 border">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à transformer votre marketing ?
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Rejoignez les entrepreneurs africains qui créent déjà leurs visuels avec VisualPro
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-6"
            onClick={() => navigate("/auth")}
          >
            Commencer maintenant
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-[hsl(150,60%,15%)] to-[hsl(0,0%,10%)] text-white py-12 mt-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                VisualPro
              </h3>
              <p className="text-gray-300">
                L'outil de création de visuels publicitaires adapté au marché africain
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Liens Utiles</h4>
              <ul className="space-y-2">
                <li>
                  <a href="/auth" className="text-gray-300 hover:text-white transition-colors">
                    Créer un compte
                  </a>
                </li>
                <li>
                  <a href="/auth" className="text-gray-300 hover:text-white transition-colors">
                    Se connecter
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Légal</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-gray-300 hover:text-white transition-colors">
                    Politique de confidentialité
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-300 hover:text-white transition-colors">
                    Conditions d'utilisation
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/20 pt-8 text-center">
            <p className="text-gray-300">
              © {new Date().getFullYear()} VisualPro. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
