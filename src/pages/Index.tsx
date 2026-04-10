import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  Video, Image as ImageIcon, Globe, Zap, 
  Shield, Users, Code, BookOpen, FileText, Lock,
  CheckCircle2, ArrowRight, TrendingUp, Wand2, Store,
  GraduationCap, Sparkles, Layers, Rocket, Eye,
  Play, ChevronRight
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
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setProfile(profileData);
      
      if (profileData && !profileData.onboarding_completed) {
        setShowOnboarding(true);
      }
      
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
    }, 3000);
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

  // Services cards for the hub
  const services = [
    {
      icon: ImageIcon,
      title: "Visuels Publicitaires",
      desc: "Créez des images professionnelles pour vos campagnes marketing en quelques secondes grâce à l'IA.",
      color: "from-orange-500 to-pink-500",
      bgLight: "bg-orange-50 dark:bg-orange-950/30",
      iconColor: "text-orange-600",
      route: session ? "/generator" : "/auth",
      cta: "Créer un visuel",
    },
    {
      icon: Video,
      title: "Vidéos Animées",
      desc: "Transformez vos visuels en vidéos captivantes avec des animations et effets professionnels.",
      color: "from-blue-500 to-cyan-500",
      bgLight: "bg-blue-50 dark:bg-blue-950/30",
      iconColor: "text-blue-600",
      route: session ? "/generator" : "/auth",
      cta: "Créer une vidéo",
    },
    {
      icon: Globe,
      title: "Sites Vitrine",
      desc: "Lancez votre site web professionnel en quelques minutes. Idéal pour présenter vos services.",
      color: "from-violet-500 to-purple-500",
      bgLight: "bg-violet-50 dark:bg-violet-950/30",
      iconColor: "text-violet-600",
      route: session ? "/showcase-manager" : "/auth",
      cta: "Créer un site",
    },
    {
      icon: Store,
      title: "Boutiques E-commerce",
      desc: "Vendez vos produits en ligne avec une boutique complète : paiements, commandes et livraison.",
      color: "from-emerald-500 to-teal-500",
      bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
      iconColor: "text-emerald-600",
      route: session ? "/shop-manager" : "/auth",
      cta: "Créer une boutique",
    },
    {
      icon: GraduationCap,
      title: "Formations en Ligne",
      desc: "Créez et vendez vos formations avec modules, certificats et espace étudiant intégré.",
      color: "from-amber-500 to-yellow-500",
      bgLight: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600",
      route: session ? "/showcase-manager" : "/auth",
      cta: "Créer une formation",
    },
    {
      icon: Code,
      title: "API & Intégrations",
      desc: "Connectez VisualPro à vos outils via notre API REST complète avec documentation.",
      color: "from-slate-500 to-gray-500",
      bgLight: "bg-slate-50 dark:bg-slate-950/30",
      iconColor: "text-slate-600",
      route: "/api-documentation",
      cta: "Voir la doc API",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {showOnboarding && session?.user && (
        <OnboardingTutorial 
          userId={session.user.id} 
          onComplete={() => setShowOnboarding(false)} 
        />
      )}
      
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="container relative mx-auto px-4 py-16 md:py-28">
          <div className="max-w-5xl mx-auto text-center">
            <Badge className="mb-6 px-4 py-1.5 text-sm animate-fade-in bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
              <Sparkles className="w-4 h-4 mr-2" />
              La plateforme tout-en-un pour les entrepreneurs africains
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 leading-tight animate-fade-in">
              {session && profile 
                ? <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Bonjour {profile.full_name?.split(' ')[0]} 👋
                  </span>
                : <>
                    <span className="text-foreground">Tout ce qu'il faut pour</span>
                    <br />
                    <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
                      réussir en ligne
                    </span>
                  </>
              }
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in leading-relaxed">
              {session 
                ? "Que souhaitez-vous faire aujourd'hui ? Choisissez votre outil ci-dessous."
                : "Visuels IA, vidéos, sites vitrine, boutiques e-commerce et formations — créez, vendez et développez votre business depuis une seule plateforme."
              }
            </p>
            
            {!session && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in">
                <Button 
                  size="lg" 
                  className="text-lg px-10 py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 bg-gradient-to-r from-primary to-primary/90"
                  onClick={() => navigate("/auth")}
                >
                  <Rocket className="mr-2 h-5 w-5" />
                  Commencer gratuitement
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-10 py-7 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Découvrir la plateforme
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== SERVICES HUB ===== */}
      <section id="services" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          {!session && (
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Une plateforme, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">toutes les solutions</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Chaque outil dont vous avez besoin pour lancer et développer votre activité en ligne
              </p>
            </div>
          )}

          {session && (
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Choisissez votre outil</h2>
              <p className="text-muted-foreground">Sélectionnez l'action que vous souhaitez effectuer</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {services.map((service, idx) => (
              <Card 
                key={idx} 
                className={`group relative overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all duration-300 hover:shadow-2xl cursor-pointer ${service.bgLight}`}
                onClick={() => navigate(service.route)}
              >
                <div className="p-6 md:p-8">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                    <service.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">{service.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">{service.desc}</p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                    {service.cta}
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CAROUSEL D'EXEMPLES ===== */}
      {!session && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Des résultats <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">époustouflants</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Découvrez ce que nos utilisateurs créent avec VisualPro
              </p>
            </div>

            <div className="relative h-[350px] md:h-[500px] rounded-3xl overflow-hidden shadow-2xl max-w-4xl mx-auto">
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
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex gap-2">
                  {carouselImages.map((_, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'w-8 bg-white' : 'w-4 bg-white/50'}`} 
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto mt-14">
              <div className="text-center">
                <div className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-1">500+</div>
                <div className="text-sm text-muted-foreground font-medium">Utilisateurs actifs</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-1">10k+</div>
                <div className="text-sm text-muted-foreground font-medium">Créations générées</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-1">98%</div>
                <div className="text-sm text-muted-foreground font-medium">Satisfaction client</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== COMMENT CA MARCHE ===== */}
      {!session && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                3 étapes pour démarrer
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Une expérience simplifiée pour créer du contenu de qualité pro
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                { step: "1", title: "Créez votre compte", desc: "Inscription gratuite en 30 secondes. Choisissez votre outil et commencez immédiatement.", color: "bg-primary" },
                { step: "2", title: "Choisissez votre outil", desc: "Visuels IA, boutique e-commerce, site vitrine ou formation — tout est à portée de clic.", color: "bg-secondary" },
                { step: "3", title: "Lancez-vous !", desc: "Publiez, vendez et développez votre activité. Résultats professionnels garantis.", color: "bg-gradient-to-r from-primary to-secondary" },
              ].map((item, idx) => (
                <div key={idx} className="text-center group">
                  <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl font-bold text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== TARIFICATION ===== */}
      {!session && (
        <section id="pricing" className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Des tarifs <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">accessibles</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Commencez gratuitement, évoluez selon vos besoins
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <Card className="p-7 hover:shadow-xl transition-all border-2 border-transparent hover:border-primary/10">
                <Badge className="mb-4" variant="secondary">Gratuit</Badge>
                <h3 className="text-2xl font-bold mb-3">Découverte</h3>
                <div className="mb-5">
                  <span className="text-4xl font-extrabold">0€</span>
                  <span className="text-muted-foreground">/mois</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm">
                  {["3 générations d'images", "1 vidéo gratuite", "Tous les templates"].map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline" onClick={() => navigate("/auth")}>
                  Commencer gratuitement
                </Button>
              </Card>

              <Card className="p-7 border-2 border-primary hover:shadow-xl transition-all relative bg-primary/[0.02]">
                <Badge className="mb-4 bg-primary text-primary-foreground">Populaire</Badge>
                <h3 className="text-2xl font-bold mb-3">Packs à la Carte</h3>
                <div className="mb-5">
                  <span className="text-sm text-muted-foreground">À partir de</span>
                  <br />
                  <span className="text-4xl font-extrabold">1 000 FCFA</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm">
                  {["10 images — 1 000 FCFA", "20 images — 2 000 FCFA", "50 images + Site — 5 000 FCFA"].map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Voir tous les packs
                </Button>
              </Card>

              <Card className="p-7 hover:shadow-xl transition-all border-2 border-transparent hover:border-primary/10">
                <Badge className="mb-4" variant="secondary">Entreprise</Badge>
                <h3 className="text-2xl font-bold mb-3">Business</h3>
                <div className="mb-5">
                  <span className="text-4xl font-extrabold">65 000</span>
                  <span className="text-muted-foreground"> FCFA/mois</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm">
                  {["Images illimitées", "Vidéos illimitées", "Sites & boutiques illimités", "Accès API"].map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline" onClick={() => navigate("/auth")}>
                  Choisir Business
                </Button>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* ===== TÉMOIGNAGES ===== */}
      {!session && publishedFeedback.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Ils nous font <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">confiance</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {publishedFeedback.map((feedback) => (
                <Card key={feedback.id} className="p-6 hover:shadow-xl transition-all">
                  <div className="flex items-center mb-3">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
                        className={`w-4 h-4 ${i < feedback.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 fill-none'}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm mb-4 italic line-clamp-4">"{feedback.comment}"</p>
                  <div className="flex items-center gap-3">
                    {feedback.photo_url && (
                      <img src={feedback.photo_url} alt={feedback.full_name} className="w-9 h-9 rounded-full object-cover" />
                    )}
                    <div>
                      <div className="font-semibold text-sm">{feedback.full_name}</div>
                      {feedback.country && <div className="text-xs text-muted-foreground">{feedback.country}</div>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== ÉQUIPE ===== */}
      {!session && (
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Notre équipe</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Des passionnés dévoués à démocratiser la création digitale en Afrique
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="p-8 text-center hover:shadow-xl transition-all">
                <img src={founderImage} alt="Ulrich DJATÉ" className="w-28 h-28 rounded-full mx-auto mb-4 object-cover ring-4 ring-primary/20" />
                <h3 className="text-xl font-bold mb-1">Ulrich DJATÉ</h3>
                <p className="text-primary font-semibold text-sm mb-3">Fondateur, CEO & Architecte</p>
                <p className="text-muted-foreground text-sm mb-4">Expert en IA, développement et vibe coding</p>
                <blockquote className="italic text-xs text-primary border-l-4 border-primary pl-3 py-1 text-left">
                  "L'innovation en Afrique commence par croire en nos propres capacités."
                </blockquote>
              </Card>

              <Card className="p-8 text-center hover:shadow-xl transition-all">
                <img src={cofounderImage} alt="Regnis AGNISSAN" className="w-28 h-28 rounded-full mx-auto mb-4 object-cover ring-4 ring-secondary/20" />
                <h3 className="text-xl font-bold mb-1">Regnis AGNISSAN</h3>
                <p className="text-secondary font-semibold text-sm mb-3">Co-fondateur</p>
                <p className="text-muted-foreground text-sm mb-4">Entrepreneur digital et expert en e-commerce</p>
                <blockquote className="italic text-xs text-secondary border-l-4 border-secondary pl-3 py-1 text-left">
                  "Ensemble, bâtissons l'avenir du commerce en ligne en Afrique."
                </blockquote>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA FINAL ===== */}
      {!session && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-600 to-secondary opacity-90" />
              <div className="relative p-10 md:p-16 text-center text-white">
                <Rocket className="w-12 h-12 mx-auto mb-6 opacity-90" />
                <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
                  Prêt à transformer votre business ?
                </h2>
                <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                  Rejoignez les centaines d'entrepreneurs africains qui utilisent VisualPro pour réussir en ligne.
                </p>
                <Button 
                  size="lg" 
                  className="text-lg px-10 py-7 bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl font-bold"
                  onClick={() => navigate("/auth")}
                >
                  <Wand2 className="mr-2 h-5 w-5" />
                  Commencer gratuitement
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default Index;
