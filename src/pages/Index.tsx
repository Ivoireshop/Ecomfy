import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  Video, Image as ImageIcon, Globe, Zap, 
  Shield, Users, Code, BookOpen, FileText, Lock,
  CheckCircle2, ArrowRight, TrendingUp, Wand2, Store,
  GraduationCap, Sparkles, Layers, Rocket, Eye,
  Play, ChevronRight, Star
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
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

/* ── Scroll-reveal hook ── */
const useReveal = (threshold = 0.15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold, rootMargin: "0px 0px -60px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
};

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

/* ── Animated service section ── */
interface ServiceSectionProps {
  title: string;
  subtitle: string;
  description: string;
  images: string[];
  icon: React.ElementType;
  gradient: string;
  reversed?: boolean;
  cta: string;
  onClick: () => void;
}

const ServiceSection = ({ title, subtitle, description, images, icon: Icon, gradient, reversed, cta, onClick }: ServiceSectionProps) => {
  const { ref, visible } = useReveal();
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(() => setImgIdx(p => (p + 1) % images.length), 2500);
    return () => clearInterval(iv);
  }, [images.length]);

  return (
    <div
      ref={ref}
      className={`flex flex-col ${reversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 md:gap-14 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      {/* Visual */}
      <div className="w-full md:w-1/2 relative">
        <div className={`absolute -inset-4 bg-gradient-to-br ${gradient} rounded-3xl opacity-20 blur-2xl`} />
        <div className="relative h-[260px] md:h-[340px] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={title}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                i === imgIdx ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <span key={i} className={`block h-1.5 rounded-full transition-all ${i === imgIdx ? 'w-6 bg-white' : 'w-3 bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Text */}
      <div className="w-full md:w-1/2 space-y-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${gradient} text-white text-xs font-semibold`}>
          <Icon className="w-3.5 h-3.5" />
          {subtitle}
        </div>
        <h3 className="text-2xl md:text-4xl font-extrabold text-foreground leading-tight">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-base">{description}</p>
        <Button onClick={onClick} className="group mt-2" size="lg">
          {cta}
          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
};

/* ── Stats section (extracted to avoid hooks-in-render) ── */
const StatsSection = () => {
  const { ref, visible } = useReveal(0.2);
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`grid grid-cols-3 gap-6 max-w-3xl mx-auto transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {[
            { val: "500+", label: "Utilisateurs actifs" },
            { val: "10k+", label: "Créations générées" },
            { val: "98%", label: "Satisfaction client" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-1">{s.val}</div>
              <div className="text-sm text-muted-foreground font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const [publishedFeedback, setPublishedFeedback] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadPublishedFeedback();
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    if (session?.user) {
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(profileData);
      if (profileData && !profileData.onboarding_completed) setShowOnboarding(true);
      const { data: subData } = await supabase.from("subscriptions").select("*").eq("user_id", session.user.id).eq("status", "active").maybeSingle();
      setSubscription(subData);
    }
  };

  const loadPublishedFeedback = async () => {
    const { data } = await supabase.from("feedback").select("*").eq("status", "published").order("created_at", { ascending: false });
    setPublishedFeedback(data || []);
  };

  // Services cards for hub (logged-in)
  const hubServices = [
    { icon: ImageIcon, title: "Visuels Publicitaires", desc: "Créez des images IA professionnelles", color: "from-orange-500 to-pink-500", bgLight: "bg-orange-50 dark:bg-orange-950/30", route: "/generator", cta: "Créer un visuel" },
    { icon: Video, title: "Vidéos Animées", desc: "Transformez vos visuels en vidéos", color: "from-blue-500 to-cyan-500", bgLight: "bg-blue-50 dark:bg-blue-950/30", route: "/generator", cta: "Créer une vidéo" },
    { icon: Globe, title: "Sites Vitrine", desc: "Lancez votre site pro en minutes", color: "from-violet-500 to-purple-500", bgLight: "bg-violet-50 dark:bg-violet-950/30", route: "/showcase-manager", cta: "Créer un site" },
    { icon: Store, title: "Boutiques E-commerce", desc: "Vendez en ligne avec paiements intégrés", color: "from-emerald-500 to-teal-500", bgLight: "bg-emerald-50 dark:bg-emerald-950/30", route: "/shop-manager", cta: "Créer une boutique" },
    { icon: GraduationCap, title: "Formations en Ligne", desc: "Créez et vendez vos cours avec certificats", color: "from-amber-500 to-yellow-500", bgLight: "bg-amber-50 dark:bg-amber-950/30", route: "/showcase-manager?tab=courses", cta: "Créer une formation" },
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
            {session && profile ? (
              <>
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 leading-tight animate-fade-in">
                  <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Bonjour {profile.full_name?.split(' ')[0]} 👋
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground mb-10 animate-fade-in">
                  Que souhaitez-vous faire aujourd'hui ? Choisissez votre outil ci-dessous.
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
                <Card key={idx} className={`group relative overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all duration-300 hover:shadow-2xl cursor-pointer ${s.bgLight}`} onClick={() => navigate(s.route)}>
                  <div className="p-6 md:p-8">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                      <s.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-foreground">{s.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-5">{s.desc}</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                      {s.cta}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== ANIMATED SERVICE SECTIONS (visitors) ===== */}
      {!session && (
        <section id="services" className="py-16 md:py-24 space-y-20 md:space-y-32">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Une plateforme, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">toutes les solutions</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Chaque outil dont vous avez besoin pour lancer et développer votre activité en ligne
              </p>
            </div>

            <div className="space-y-20 md:space-y-32 max-w-6xl mx-auto">
              <ServiceSection
                title="Visuels Publicitaires IA"
                subtitle="Création de visuels"
                description="Générez des images publicitaires professionnelles en quelques secondes grâce à l'intelligence artificielle. Parfait pour vos campagnes marketing sur les réseaux sociaux."
                images={[exampleHandbag, examplePhone, exampleFood]}
                icon={ImageIcon}
                gradient="from-orange-500 to-pink-500"
                cta="Créer un visuel"
                onClick={() => navigate("/auth")}
              />

              <ServiceSection
                title="Vidéos Animées Pro"
                subtitle="Vidéo & Animation"
                description="Transformez n'importe quel visuel en vidéo captivante avec des animations fluides et des effets professionnels. Idéal pour capturer l'attention sur TikTok, Instagram et Facebook."
                images={[exampleBeauty, exampleFitness]}
                icon={Video}
                gradient="from-blue-500 to-cyan-500"
                reversed
                cta="Créer une vidéo"
                onClick={() => navigate("/auth")}
              />

              <ServiceSection
                title="Sites Vitrine Professionnels"
                subtitle="Site vitrine"
                description="Lancez votre site web professionnel en quelques minutes. Présentez vos services, votre portfolio et recevez des réservations — sans aucune compétence technique."
                images={[featureRapide, featureAfrique]}
                icon={Globe}
                gradient="from-violet-500 to-purple-500"
                cta="Créer un site vitrine"
                onClick={() => navigate("/auth")}
              />

              <ServiceSection
                title="Boutiques E-commerce"
                subtitle="E-commerce"
                description="Vendez vos produits en ligne avec une boutique complète : gestion des stocks, paiements Mobile Money, suivi des commandes et livraisons intégrées."
                images={[exampleRealestate, exampleHandbag]}
                icon={Store}
                gradient="from-emerald-500 to-teal-500"
                reversed
                cta="Créer une boutique"
                onClick={() => navigate("/auth")}
              />

              <ServiceSection
                title="Formations en Ligne"
                subtitle="E-learning"
                description="Créez et vendez vos formations avec des modules structurés, un espace étudiant dédié, des certificats automatiques et des liens de paiement intégrés."
                images={[featureIA, featureAfrique]}
                icon={GraduationCap}
                gradient="from-amber-500 to-yellow-500"
                cta="Créer une formation"
                onClick={() => navigate("/auth")}
              />
            </div>
          </div>
        </section>
      )}

      {/* ===== STATS ===== */}
      {!session && <StatsSection />}

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
      {!session && (
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Notre équipe</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Des passionnés dévoués à démocratiser la création digitale en Afrique</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="p-8 text-center hover:shadow-xl transition-all">
                <img src={founderImage} alt="Ulrich DJATÉ" className="w-28 h-28 rounded-full mx-auto mb-4 object-cover ring-4 ring-primary/20" />
                <h3 className="text-xl font-bold mb-1">Ulrich DJATÉ</h3>
                <p className="text-primary font-semibold text-sm mb-3">Fondateur, CEO & Architecte</p>
                <p className="text-muted-foreground text-sm mb-4">Expert en IA, développement et vibe coding</p>
                <blockquote className="italic text-xs text-primary border-l-4 border-primary pl-3 py-1 text-left">"L'innovation en Afrique commence par croire en nos propres capacités."</blockquote>
              </Card>
              <Card className="p-8 text-center hover:shadow-xl transition-all">
                <img src={cofounderImage} alt="Regnis AGNISSAN" className="w-28 h-28 rounded-full mx-auto mb-4 object-cover ring-4 ring-secondary/20" />
                <h3 className="text-xl font-bold mb-1">Regnis AGNISSAN</h3>
                <p className="text-secondary font-semibold text-sm mb-3">Co-fondateur</p>
                <p className="text-muted-foreground text-sm mb-4">Entrepreneur digital et expert en e-commerce</p>
                <blockquote className="italic text-xs text-secondary border-l-4 border-secondary pl-3 py-1 text-left">"Ensemble, bâtissons l'avenir du commerce en ligne en Afrique."</blockquote>
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
