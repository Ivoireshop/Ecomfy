import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  Video, Image as ImageIcon, Globe, Zap, 
  Shield, Users, Code, BookOpen, FileText, Lock,
  CheckCircle2, ArrowRight, TrendingUp, Wand2
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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
      
      {showOnboarding && session?.user && (
        <OnboardingTutorial 
          userId={session.user.id} 
          onComplete={() => setShowOnboarding(false)} 
        />
      )}
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-5xl mx-auto text-center">
          <Badge className="mb-6 animate-fade-in" variant="secondary">
            <Wand2 className="w-4 h-4 mr-2" />
            Plateforme de création visuelle pour l'Afrique
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent leading-tight animate-fade-in">
            {session && profile 
              ? `Bienvenue ${profile.full_name?.split(' ')[0]}`
              : "Créez des Visuels Pros en Quelques Secondes"
            }
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto animate-fade-in">
            La première plateforme africaine de création visuelle propulsée par l'IA. 
            Créez des publicités, vidéos et sites vitrine professionnels instantanément.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in">
            <Button 
              size="lg" 
              className="text-lg px-10 py-7 shadow-lg hover:shadow-xl transition-all hover:scale-105"
              onClick={() => navigate(session ? "/generator" : "/auth")}
            >
              <Wand2 className="mr-2 h-5 w-5" />
              {session ? "Créer maintenant" : "Commencer gratuitement"}
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-10 py-7 shadow-lg hover:shadow-xl transition-all hover:scale-105"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Découvrir les fonctionnalités
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Carousel d'exemples */}
          <div className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl mb-8 animate-fade-in">
            {carouselImages.map((image, index) => (
              <img
                key={index}
                src={image.src}
                alt={image.alt}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                  index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto animate-fade-in">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">500+</div>
              <div className="text-muted-foreground">Utilisateurs actifs</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">10k+</div>
              <div className="text-muted-foreground">Visuels créés</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">98%</div>
              <div className="text-muted-foreground">Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Fonctionnalités Principales */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Toutes les fonctionnalités dont vous avez besoin
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Visual Pro combine intelligence artificielle et simplicité pour vous offrir 
              une suite complète d'outils de création professionnels.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="p-8 hover:shadow-xl transition-all hover:scale-105 cursor-pointer" onClick={() => navigate(session ? "/generator" : "/auth")}>
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <ImageIcon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Génération d'Images IA</h3>
              <p className="text-muted-foreground mb-6">
                Créez des visuels publicitaires professionnels en quelques secondes. 
                Parfait pour réseaux sociaux, sites web et campagnes marketing.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                  <span>Templates optimisés pour chaque secteur</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                  <span>Adaptation automatique aux formats sociaux</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                  <span>Génération en moins de 30 secondes</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all hover:scale-105 cursor-pointer" onClick={() => navigate(session ? "/generator" : "/auth")}>
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6">
                <Video className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Création de Vidéos</h3>
              <p className="text-muted-foreground mb-6">
                Transformez vos visuels en vidéos animées captivantes avec effets 
                et transitions professionnels automatiques.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                  <span>Animations fluides et professionnelles</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                  <span>Musique d'ambiance personnalisable</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                  <span>Export HD pour toutes plateformes</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all hover:scale-105 cursor-pointer" onClick={() => navigate(session ? "/showcase-manager" : "/auth")}>
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Globe className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Sites Vitrine IA</h3>
              <p className="text-muted-foreground mb-6">
                Créez votre site web professionnel en quelques minutes. 
                Idéal pour présenter vos services et attirer de nouveaux clients.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Design responsive automatique</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Formulaire de contact intégré</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Domaine personnalisé disponible</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Section Comment ça marche */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Simple, Rapide, Efficace
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Créez du contenu professionnel en 3 étapes simples
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold text-primary-foreground">
                1
              </div>
              <h3 className="text-2xl font-bold mb-4">Décrivez votre projet</h3>
              <p className="text-muted-foreground">
                Entrez une description simple de ce que vous voulez créer. 
                L'IA comprend vos besoins et génère les bonnes suggestions.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold text-secondary-foreground">
                2
              </div>
              <h3 className="text-2xl font-bold mb-4">Personnalisez</h3>
              <p className="text-muted-foreground">
                Ajustez les couleurs, textes, images selon votre marque. 
                Notre éditeur intuitif vous donne un contrôle total.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold text-white">
                3
              </div>
              <h3 className="text-2xl font-bold mb-4">Téléchargez & Partagez</h3>
              <p className="text-muted-foreground">
                Exportez en haute qualité et partagez directement sur vos 
                réseaux sociaux ou téléchargez pour usage offline.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Exemples/Templates */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Des résultats professionnels garantis
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Découvrez quelques exemples de visuels créés avec Visual Pro
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { img: exampleHandbag, title: "Mode & Accessoires", color: "bg-pink-500" },
              { img: examplePhone, title: "Technologie", color: "bg-blue-500" },
              { img: exampleFood, title: "Restauration", color: "bg-orange-500" },
              { img: exampleBeauty, title: "Beauté & Cosmétiques", color: "bg-purple-500" },
              { img: exampleFitness, title: "Sport & Fitness", color: "bg-green-500" },
              { img: exampleRealestate, title: "Immobilier", color: "bg-indigo-500" },
            ].map((example, idx) => (
              <Card key={idx} className="overflow-hidden hover:shadow-xl transition-all hover:scale-105 cursor-pointer group">
                <div className="relative h-64 overflow-hidden">
                  <img src={example.img} alt={example.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className={`absolute inset-0 ${example.color} opacity-0 group-hover:opacity-20 transition-opacity`}></div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg">{example.title}</h3>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Section Tarification */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Des tarifs adaptés à vos besoins
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Commencez gratuitement, puis choisissez le plan qui vous convient
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="p-8 hover:shadow-xl transition-all">
              <Badge className="mb-4" variant="secondary">Gratuit</Badge>
              <h3 className="text-3xl font-bold mb-4">Découverte</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold">0€</span>
                <span className="text-muted-foreground">/mois</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>3 générations d'images gratuites</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>1 vidéo gratuite</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>Tous les templates</span>
                </li>
              </ul>
              <Button className="w-full" variant="outline" onClick={() => navigate("/auth")}>
                Commencer gratuitement
              </Button>
            </Card>

            <Card className="p-8 border-2 border-primary hover:shadow-xl transition-all relative">
              <Badge className="mb-4 bg-primary">Populaire</Badge>
              <h3 className="text-3xl font-bold mb-4">Packs à la Carte</h3>
              <div className="mb-6">
                <span className="text-2xl font-bold text-muted-foreground">À partir de</span>
                <br />
                <span className="text-4xl font-bold">1000 FCFA</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>10 images - 1000 FCFA</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>20 images - 2000 FCFA</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>30 images - 3000 FCFA</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>50 images + Site vitrine - 5000 FCFA</span>
                </li>
              </ul>
              <Button className="w-full" onClick={() => navigate(session ? "/subscription" : "/auth")}>
                Voir tous les packs
              </Button>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all">
              <Badge className="mb-4" variant="secondary">Entreprise</Badge>
              <h3 className="text-3xl font-bold mb-4">Business</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">65 000 FCFA</span>
                <span className="text-muted-foreground">/mois</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>Générations illimitées d'images</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>Générations illimitées de vidéos</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>Sites vitrine illimités</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-2 mt-0.5" />
                  <span>Accès API</span>
                </li>
              </ul>
              <Button className="w-full" variant="outline" onClick={() => navigate(session ? "/subscription" : "/auth")}>
                Choisir Business
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Section API & Intégrations */}
      <section id="api" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                API & Intégrations
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Connectez Visual Pro à vos outils préférés et automatisez votre workflow
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-8">
                <Code className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-4">API REST Complète</h3>
                <p className="text-muted-foreground mb-6">
                  Intégrez Visual Pro directement dans vos applications avec notre API REST. 
                  Créez, modifiez et gérez vos contenus par programmation.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-primary mr-2" />
                    <span>Documentation complète</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-primary mr-2" />
                    <span>SDKs JavaScript, Python, PHP</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-primary mr-2" />
                    <span>Webhooks en temps réel</span>
                  </li>
                </ul>
                <Button variant="outline" onClick={() => window.open('https://docs.visualpro.africa', '_blank')}>
                  Voir la documentation API
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Card>

              <Card className="p-8">
                <Zap className="w-12 h-12 text-secondary mb-4" />
                <h3 className="text-2xl font-bold mb-4">Intégrations Natives</h3>
                <p className="text-muted-foreground mb-6">
                  Connectez-vous facilement à vos outils marketing préférés et 
                  automatisez la création de contenu.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="border rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
                    <div className="font-semibold">Zapier</div>
                    <div className="text-xs text-muted-foreground">Automatisation</div>
                  </div>
                  <div className="border rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
                    <div className="font-semibold">Make</div>
                    <div className="text-xs text-muted-foreground">Workflows</div>
                  </div>
                  <div className="border rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
                    <div className="font-semibold">WordPress</div>
                    <div className="text-xs text-muted-foreground">Plugin</div>
                  </div>
                  <div className="border rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
                    <div className="font-semibold">Shopify</div>
                    <div className="text-xs text-muted-foreground">E-commerce</div>
                  </div>
                </div>
                <Button variant="outline" onClick={() => navigate(session ? "/subscription" : "/auth")}>
                  Voir toutes les intégrations
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Section Témoignages - Défilement automatique */}
      {publishedFeedback.length > 0 && (
        <section className="py-20 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ils nous font confiance
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Découvrez ce que nos utilisateurs disent de Visual Pro
              </p>
            </div>
          </div>

          {/* Marquee scrolling testimonials */}
          <div className="relative">
            <div className="flex animate-marquee gap-6" style={{ width: 'max-content' }}>
              {[...publishedFeedback, ...publishedFeedback].map((feedback, idx) => (
                <Card key={`${feedback.id}-${idx}`} className="p-6 min-w-[350px] max-w-[400px] shrink-0 hover:shadow-xl transition-all">
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        className={`w-5 h-5 ${
                          i < feedback.rating
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300 fill-none'
                        }`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 italic line-clamp-4">
                    "{feedback.comment}"
                  </p>
                  <div className="flex items-center gap-3">
                    {feedback.photo_url && (
                      <img
                        src={feedback.photo_url}
                        alt={feedback.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <div className="font-semibold">{feedback.full_name}</div>
                      {feedback.country && (
                        <div className="text-sm text-muted-foreground">{feedback.country}</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section Équipe */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Notre équipe
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Des passionnés dévoués à démocratiser la création visuelle en Afrique
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-8 text-center hover:shadow-xl transition-all">
              <img
                src={founderImage}
                alt="Ulrich DJATÉ"
                className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
              />
              <h3 className="text-2xl font-bold mb-2">Ulrich DJATÉ</h3>
              <p className="text-primary font-semibold mb-4">Fondateur, CEO & Architecte</p>
              <p className="text-muted-foreground mb-4">
                Expert en intelligence artificielle, développement, vibe coding et entrepreneur à succès
              </p>
              <blockquote className="italic text-sm text-primary border-l-4 border-primary pl-4 py-2">
                "L'innovation en Afrique commence par croire en nos propres capacités. Avec VisualPro, nous donnons aux entrepreneurs africains les outils pour transformer leurs visions en réalité."
              </blockquote>
            </Card>

            <Card className="p-8 text-center hover:shadow-xl transition-all">
              <img
                src={cofounderImage}
                alt="Regnis AGNISSAN"
                className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
              />
              <h3 className="text-2xl font-bold mb-2">Regnis AGNISSAN</h3>
              <p className="text-secondary font-semibold mb-4">Co-fondateur</p>
              <p className="text-muted-foreground mb-4">
                Entrepreneur ivoirien, entrepreneur digital et expert en e-commerce
              </p>
              <blockquote className="italic text-sm text-secondary border-l-4 border-secondary pl-4 py-2">
                "Le succès digital ne se mesure pas seulement en chiffres, mais par l'impact qu'on crée. Ensemble, bâtissons l'avenir du commerce en ligne en Afrique."
              </blockquote>
            </Card>
          </div>
        </div>
      </section>

      {/* Section CTA Final */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-secondary/10 p-12 text-center max-w-4xl mx-auto">
            <TrendingUp className="w-16 h-16 mx-auto mb-6 text-primary" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Prêt à transformer votre communication visuelle ?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Rejoignez les centaines d'entrepreneurs africains qui utilisent Visual Pro 
              pour créer du contenu professionnel en quelques clics.
            </p>
            <Button 
              size="lg" 
              className="text-lg px-10 py-7 shadow-lg hover:shadow-xl"
              onClick={() => navigate(session ? "/generator" : "/auth")}
            >
              <Wand2 className="mr-2 h-5 w-5" />
              {session ? "Créer maintenant" : "Commencer gratuitement"}
            </Button>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};


export default Index;
