import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import featureRapide from "@/assets/feature-rapide.jpg";
import featureAfrique from "@/assets/feature-afrique.jpg";
import featureIA from "@/assets/feature-ia.jpg";
import founderImage from "@/assets/founder-ulrich-djate.jpg";
import cofounderImage from "@/assets/cofounder-agnissan-regnis.jpg";
import exampleHandbag from "@/assets/example-handbag-ad.jpg";
import examplePhone from "@/assets/example-phone-ad.jpg";
import exampleFood from "@/assets/example-food-ad.jpg";
import exampleBeauty from "@/assets/example-beauty-ad.jpg";
import exampleFitness from "@/assets/example-fitness-ad.jpg";
import exampleRealestate from "@/assets/example-realestate-ad.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [publishedFeedback, setPublishedFeedback] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const carouselImages = [
    { src: exampleHandbag, alt: "Publicité sac à main" },
    { src: examplePhone, alt: "Publicité smartphone" },
    { src: exampleFood, alt: "Publicité restaurant" },
    { src: exampleBeauty, alt: "Publicité beauté" },
    { src: exampleFitness, alt: "Publicité fitness" },
    { src: exampleRealestate, alt: "Publicité immobilier" },
  ];

  useEffect(() => {
    loadPublishedFeedback();
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    
    if (session?.user) {
      // Charger le profil
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setProfile(profileData);
      
      // Vérifier si l'utilisateur doit voir le tutoriel
      if (profileData && !profileData.onboarding_completed) {
        setShowOnboarding(true);
      }
      
      // Charger l'abonnement
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();
      setSubscription(subData);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % carouselImages.length);
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, [carouselImages.length]);

  const loadPublishedFeedback = async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading feedback:", error);
      return;
    }

    setPublishedFeedback(data || []);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      {/* Onboarding Tutorial */}
      {showOnboarding && session?.user && (
        <OnboardingTutorial 
          userId={session.user.id} 
          onComplete={() => setShowOnboarding(false)} 
        />
      )}
      
      {/* Hero Section */}
      <section id="home" className="container mx-auto px-4 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4" variant="secondary">
              <Sparkles className="w-3 h-3 mr-1" />
              Plateforme de création visuelle pour l'Afrique
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent leading-tight">
              {session && profile 
                ? `Bienvenue ${profile.full_name?.split(' ')[0]}`
                : "Créez des Visuels Pros en Quelques Secondes"
              }
            </h1>
            
            {session && profile ? (
              <>
                <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Vous pouvez maintenant créer des visuels professionnels en un clic !
                </p>
                
                {/* CTA Buttons selon statut abonnement */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                  {subscription || profile.purchased_credits > 0 ? (
                    <>
                      <Button 
                        size="lg" 
                        className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                        onClick={() => navigate("/generator")}
                      >
                        <Sparkles className="mr-2 h-5 w-5" />
                        Création de visual
                      </Button>
                      <Button 
                        size="lg" 
                        variant="secondary"
                        className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                        onClick={() => navigate("/generator")}
                      >
                        Publicité
                      </Button>
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                        onClick={() => navigate("/generator")}
                      >
                        Vidéo
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="lg" 
                      className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                      onClick={() => navigate("/generator")}
                    >
                      <Sparkles className="mr-2 h-5 w-5" />
                      Création de visual
                    </Button>
                  )}
                </div>

                {/* Social Proof Stats */}
                <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-2xl mx-auto mb-8">
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-1">500+</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Utilisateurs actifs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-1">10k+</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Visuels créés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-1">4.8/5</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Satisfaction</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Transformez vos idées en publicités professionnelles avec l'IA. Rejoignez des centaines d'entrepreneurs africains qui créent déjà.
                </p>

                {/* Social Proof Stats */}
                <div className="grid grid-cols-3 gap-4 md:gap-8 mb-8 max-w-2xl mx-auto">
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-1">500+</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Utilisateurs actifs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-1">10k+</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Visuels créés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-1">4.8/5</div>
                    <div className="text-xs md:text-sm text-muted-foreground flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 fill-primary text-primary" />
                      Satisfaction
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {!session && (
            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="inline-block bg-primary/10 border border-primary/20 rounded-lg px-6 py-3 animate-pulse-glow">
                <p className="text-base font-medium text-foreground animate-wiggle">
                  🎁 Connectez-vous pour profiter de <span className="text-primary font-bold">3 essais gratuits</span>
                </p>
              </div>
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                onClick={() => navigate("/auth")}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Inscrivez-vous maintenant
              </Button>
            </div>
          )}

          {/* Image Carousel - Dynamic showcase */}
          <div className="relative mb-12 max-w-4xl mx-auto">
            <div className="relative h-96 rounded-2xl overflow-hidden shadow-2xl">
              {carouselImages.map((image, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    index === currentImageIndex ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-8 left-8 right-8">
                    <p className="text-white text-xl font-semibold drop-shadow-lg">
                      {image.alt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Carousel indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {carouselImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentImageIndex
                      ? "w-8 bg-primary"
                      : "w-2 bg-primary/30 hover:bg-primary/50"
                  }`}
                  aria-label={`Aller à l'image ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {!session && (
            <div className="text-center">
              <Button 
                size="lg" 
                className="text-xl px-12 py-7 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                onClick={() => navigate("/auth")}
              >
                <Sparkles className="mr-2 h-6 w-6" />
                Commencer maintenant
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6">
              <div className="w-48 h-48 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src={featureRapide} 
                  alt="Rapidité et simplicité" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-semibold mb-2">Rapide et Simple</h3>
              <p className="text-muted-foreground">
                Créez vos visuels professionnels en moins d'une minute
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-48 h-48 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src={featureAfrique} 
                  alt="Adapté au marché africain" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-semibold mb-2">Adapté à l'Afrique</h3>
              <p className="text-muted-foreground">
                Visuels qui reflètent la diversité du marché africain
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-48 h-48 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src={featureIA} 
                  alt="Intelligence artificielle" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-semibold mb-2">IA Intelligente</h3>
              <p className="text-muted-foreground">
                L'IA génère automatiquement visuels et textes publicitaires
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section id="examples" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Exemples de Visuels
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Découvrez la qualité des visuels générés par notre IA
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all">
            <img 
              src={exampleHandbag} 
              alt="Exemple publicité sac à main - VisualPro" 
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-4 left-4 text-white">
                <p className="font-semibold">Mode & Accessoires</p>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all">
            <img 
              src={examplePhone} 
              alt="Exemple publicité smartphone - VisualPro" 
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-4 left-4 text-white">
                <p className="font-semibold">Technologie</p>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all">
            <img 
              src={exampleFood} 
              alt="Exemple publicité restaurant - VisualPro" 
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-4 left-4 text-white">
                <p className="font-semibold">Restauration</p>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all">
            <img 
              src={exampleBeauty} 
              alt="Exemple publicité produits beauté - VisualPro" 
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-4 left-4 text-white">
                <p className="font-semibold">Beauté & Cosmétiques</p>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all">
            <img 
              src={exampleFitness} 
              alt="Exemple publicité fitness - VisualPro" 
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-4 left-4 text-white">
                <p className="font-semibold">Sport & Fitness</p>
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all">
            <img 
              src={exampleRealestate} 
              alt="Exemple publicité immobilier - VisualPro" 
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-4 left-4 text-white">
                <p className="font-semibold">Immobilier</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-card to-accent/5 rounded-2xl shadow-xl overflow-hidden border">
            <div className="grid md:grid-cols-2 gap-8 items-center p-8 md:p-12">
              <div className="order-2 md:order-1 text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Notre Fondateur
                </h2>
                <h3 className="text-2xl font-semibold text-primary mb-4">
                  Ulrich Djaté
                </h3>
                <p className="text-base text-muted-foreground mb-6">
                  Ex prof de collège | Entrepreneur Ivoirien | Développeur No-Code | Expert en Intelligence Artificielle
                </p>
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

      {/* Co-Founder Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-card to-accent/5 rounded-2xl shadow-xl overflow-hidden border">
            <div className="grid md:grid-cols-2 gap-8 items-center p-8 md:p-12">
              <div className="order-1 md:order-1">
                <div className="relative w-64 h-64 md:w-80 md:h-80 mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-primary/20 rounded-2xl blur-2xl"></div>
                  <img 
                    src={cofounderImage} 
                    alt="Agnissan se Regnis - Cofondateur de VisualPro" 
                    className="relative w-full h-full object-cover object-[center_20%] rounded-2xl shadow-2xl border-4 border-background"
                  />
                </div>
              </div>
              <div className="order-2 md:order-2 text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Notre Cofondateur
                </h2>
                <h3 className="text-2xl font-semibold text-primary mb-4">
                  Agnissan se Regnis
                </h3>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6 italic">
                  "L'innovation naît de la collaboration. Ensemble, nous transformons les idées audacieuses en réalités extraordinaires. Chaque défi est une invitation à repousser nos limites et à créer l'avenir que nous imaginons."
                </p>
                <div className="inline-block bg-secondary/10 text-secondary px-6 py-3 rounded-lg font-medium">
                  Cofondateur - VisualPro
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {publishedFeedback.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Ce que disent nos utilisateurs
            </h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {publishedFeedback.slice(0, 3).map((feedback) => (
                <div
                  key={feedback.id}
                  className="bg-card border rounded-xl p-6 shadow-lg hover:shadow-xl transition-all"
                >
                  <div className="flex items-start gap-4 mb-4">
                    {feedback.photo_url && (
                      <img
                        src={feedback.photo_url}
                        alt={feedback.full_name || "Utilisateur"}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold mb-1">
                        {feedback.full_name || "Utilisateur anonyme"}
                      </h4>
                      <div className="flex text-yellow-400 mb-1">
                        {Array.from({ length: feedback.rating }).map((_, i) => (
                          <span key={i}>⭐</span>
                        ))}
                      </div>
                      {feedback.country && (
                        <p className="text-xs text-muted-foreground">
                          {feedback.country}
                        </p>
                      )}
                    </div>
                  </div>
                  {feedback.comment && (
                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                      "{feedback.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {!session && (
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-12 border">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Prêt à créer vos visuels ?
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Rejoignez des centaines d'entrepreneurs africains
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
      )}

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
