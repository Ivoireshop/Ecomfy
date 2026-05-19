import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  Video, Image as ImageIcon, Globe, Zap, 
  Code, CheckCircle2, ArrowRight, Wand2, Store,
  GraduationCap, Rocket, ChevronRight, Star
} from "lucide-react";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { useAuthReady } from "@/hooks/useAuthReady";
const LandingMediaSections = lazy(() => import("@/components/LandingMediaSections"));
const LandingTeamSection = lazy(() =>
  import("@/components/LandingMediaSections").then((module) => ({ default: module.LandingTeamSection }))
);

/* ── Ticker / scrolling banner ── */
const TickerBanner = () => {
  const items = [
    "🎨 Création de visuels IA",
    "🎬 Vidéos animées professionnelles",
    "🌐 Sites vitrine en quelques minutes",
    "🛒 Boutiques e-commerce complètes",
    "🎓 Formations en ligne avec certificats",
    "🚀 La plateforme tout-en-un pour entrepreneurs africains",
    "⚡ Résultats professionnels instantanés",
  ];
  const repeated = [...items, ...items];
  return (
    <div className="bg-primary text-primary-foreground overflow-hidden whitespace-nowrap py-2.5 relative">
      <div className="inline-flex animate-[ticker_30s_linear_infinite]">
        {repeated.map((t, i) => (
          <span key={i} className="mx-8 text-sm font-medium">{t}</span>
        ))}
      </div>
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const [publishedFeedback, setPublishedFeedback] = useState<any[]>([]);
  const { session, isReady } = useAuthReady();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loadDeferredSections, setLoadDeferredSections] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = idleWindow.requestIdleCallback?.(() => {
      setLoadDeferredSections(true);
      void loadPublishedFeedback();
    }, { timeout: 1200 });
    const timeoutId = idleId ? undefined : window.setTimeout(() => {
      setLoadDeferredSections(true);
      void loadPublishedFeedback();
    }, 700);

    return () => {
      if (idleId) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (isReady && session?.user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isReady, navigate, session]);

  const loadPublishedFeedback = async () => {
    const { data } = await supabase.from("feedback").select("*").eq("status", "published").order("created_at", { ascending: false });
    setPublishedFeedback(data || []);
  };

  const hubServices = [
    { icon: ImageIcon, title: "Visuels Publicitaires", desc: "Créez des images IA professionnelles", color: "from-orange-500 to-pink-500", bgLight: "bg-orange-50 dark:bg-orange-950/30", route: "/generator", cta: "Créer un visuel" },
    { icon: Video, title: "Vidéos Animées", desc: "Transformez vos visuels en vidéos", color: "from-blue-500 to-cyan-500", bgLight: "bg-blue-50 dark:bg-blue-950/30", route: "/video-creator", cta: "Créer une vidéo" },
    { icon: Globe, title: "Sites Vitrine", desc: "Lancez votre site pro en minutes", color: "from-violet-500 to-purple-500", bgLight: "bg-violet-50 dark:bg-violet-950/30", route: "/showcase-manager", cta: "Créer un site" },
    { icon: Store, title: "Boutiques E-commerce", desc: "Vendez en ligne avec paiements intégrés", color: "from-emerald-500 to-teal-500", bgLight: "bg-emerald-50 dark:bg-emerald-950/30", route: "/shop-manager", cta: "Créer une boutique" },
    { icon: GraduationCap, title: "Formations en Ligne", desc: "Créez et vendez vos cours avec certificats", color: "from-amber-500 to-yellow-500", bgLight: "bg-amber-50 dark:bg-amber-950/30", route: "/courses-manager", cta: "Créer une formation" },
    { icon: Code, title: "API & Intégrations", desc: "Connectez VisualPro à vos outils", color: "from-slate-500 to-gray-500", bgLight: "bg-slate-50 dark:bg-slate-950/30", route: "/api-documentation", cta: "Voir la doc API" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {showOnboarding && session?.user && (
        <OnboardingTutorial userId={session.user.id} onComplete={() => setShowOnboarding(false)} />
      )}

      {/* ===== SCROLLING TICKER ===== */}
      <TickerBanner />

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" />

        <div className="container relative mx-auto px-4 py-16 md:py-28">
          <div className="max-w-5xl mx-auto text-center">
            {session?.user ? (
              <>
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 leading-tight animate-fade-in tracking-tight">
                  <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" style={{ fontFamily: "'Georgia', serif" }}>
                    {new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'} {session.user.user_metadata?.full_name?.split(' ')[0] || session.user.email?.split('@')[0]}, Bienvenue
                  </span>
                  <span className="inline-block animate-wiggle text-4xl sm:text-5xl md:text-6xl ml-2">👋</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground mb-10 animate-fade-in tracking-wide font-medium">
                  Votre espace de travail est prêt.
                </p>
              </>
            ) : (
              <>
                <Badge className="mb-6 px-4 py-1.5 text-sm animate-fade-in bg-primary/10 text-primary border-primary/20">
                  <Zap className="w-4 h-4 mr-2" />
                  La plateforme tout-en-un pour les entrepreneurs africains
                </Badge>
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 leading-tight animate-fade-in">
                  <span className="text-foreground">Créez. Vendez.</span>
                  <br />
                  <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
                    Développez votre business.
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto animate-fade-in leading-relaxed">
                  Visuels IA, vidéos animées, sites vitrine, boutiques e-commerce et formations en ligne — tout ce qu'il faut pour réussir en ligne, depuis une seule plateforme.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in">
                  <Button size="lg" className="text-lg px-10 py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 bg-gradient-to-r from-primary to-primary/90" onClick={() => navigate("/auth")}>
                    <Rocket className="mr-2 h-5 w-5" />
                    Commencer gratuitement
                  </Button>
                  <Button size="lg" variant="outline" className="text-lg px-10 py-7 shadow-lg hover:shadow-xl transition-all hover:scale-105" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>
                    Découvrir la plateforme
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== SERVICE HUB (logged in) ===== */}
      {session && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Choisissez votre outil</h2>
              <p className="text-muted-foreground">Sélectionnez l'action que vous souhaitez effectuer</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
              {hubServices.map((s, idx) => (
                <Card
                  key={idx}
                  className={`group relative overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all duration-500 hover:shadow-2xl cursor-pointer animate-fade-in ${s.bgLight}`}
                  style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
                  onClick={() => navigate(s.route)}
                >
                  <div className="p-6 md:p-8">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                      <s.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-foreground">{s.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-5">{s.desc}</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                      {s.cta}
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== ANIMATED SERVICE SECTIONS ===== */}
      {loadDeferredSections ? (
        <Suspense fallback={<section id="services" className="py-16 md:py-24" />}>
          <LandingMediaSections session={session} />
        </Suspense>
      ) : (
        <section id="services" className="py-16 md:py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Une plateforme, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">toutes les solutions</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Chaque outil dont vous avez besoin pour lancer et développer votre activité en ligne
            </p>
          </div>
        </section>
      )}

      {/* ===== COMMENT CA MARCHE ===== */}
      {!session && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">3 étapes pour démarrer</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Une expérience simplifiée pour créer du contenu de qualité pro</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                { step: "1", title: "Créez votre compte", desc: "Inscription gratuite en 30 secondes.", color: "bg-primary" },
                { step: "2", title: "Choisissez votre outil", desc: "Visuels IA, boutique, site vitrine ou formation.", color: "bg-secondary" },
                { step: "3", title: "Lancez-vous !", desc: "Publiez, vendez et développez votre activité.", color: "bg-gradient-to-r from-primary to-secondary" },
              ].map((item, idx) => (
                <div key={idx} className="text-center group animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
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
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Commencez gratuitement, évoluez selon vos besoins</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <Card className="p-7 hover:shadow-xl transition-all border-2 border-transparent hover:border-primary/10">
                <Badge className="mb-4" variant="secondary">Gratuit</Badge>
                <h3 className="text-2xl font-bold mb-3">Découverte</h3>
                <div className="mb-5"><span className="text-4xl font-extrabold">0€</span><span className="text-muted-foreground">/mois</span></div>
                <ul className="space-y-2.5 mb-7 text-sm">
                  {["3 générations d'images", "1 vidéo gratuite", "Tous les templates"].map((f, i) => (
                    <li key={i} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span>{f}</span></li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline" onClick={() => navigate("/auth")}>Commencer gratuitement</Button>
              </Card>

              <Card className="p-7 border-2 border-primary hover:shadow-xl transition-all relative bg-primary/[0.02]">
                <Badge className="mb-4 bg-primary text-primary-foreground">Populaire</Badge>
                <h3 className="text-2xl font-bold mb-3">Packs à la Carte</h3>
                <div className="mb-5"><span className="text-sm text-muted-foreground">À partir de</span><br /><span className="text-4xl font-extrabold">1 000 FCFA</span></div>
                <ul className="space-y-2.5 mb-7 text-sm">
                  {["10 images — 1 000 FCFA", "20 images — 2 000 FCFA", "50 images + Site — 5 000 FCFA"].map((f, i) => (
                    <li key={i} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span>{f}</span></li>
                  ))}
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>Voir tous les packs</Button>
              </Card>

              <Card className="p-7 hover:shadow-xl transition-all border-2 border-transparent hover:border-primary/10">
                <Badge className="mb-4" variant="secondary">Entreprise</Badge>
                <h3 className="text-2xl font-bold mb-3">Business</h3>
                <div className="mb-5"><span className="text-4xl font-extrabold">65 000</span><span className="text-muted-foreground"> FCFA/mois</span></div>
                <ul className="space-y-2.5 mb-7 text-sm">
                  {["Images illimitées", "Vidéos illimitées", "Sites & boutiques illimités", "Accès API"].map((f, i) => (
                    <li key={i} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span>{f}</span></li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline" onClick={() => navigate("/auth")}>Choisir Business</Button>
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
                      <Star key={i} className={`w-4 h-4 ${i < feedback.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm mb-4 italic line-clamp-4">"{feedback.comment}"</p>
                  <div className="flex items-center gap-3">
                    {feedback.photo_url && <img src={feedback.photo_url} alt={feedback.full_name} className="w-9 h-9 rounded-full object-cover" />}
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
      {!session && loadDeferredSections && (
        <Suspense fallback={<section className="py-16 md:py-24 bg-muted/30" />} >
          <LandingTeamSection />
        </Suspense>
      )}

      {/* ===== CTA FINAL ===== */}
      {!session && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-600 to-secondary opacity-90" />
              <div className="relative p-10 md:p-16 text-center text-white">
                <Rocket className="w-12 h-12 mx-auto mb-6 opacity-90" />
                <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Prêt à transformer votre business ?</h2>
                <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">Rejoignez les centaines d'entrepreneurs africains qui utilisent VisualPro pour réussir en ligne.</p>
                <Button size="lg" className="text-lg px-10 py-7 bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl font-bold" onClick={() => navigate("/auth")}>
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
