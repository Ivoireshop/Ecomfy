import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  Video, Image as ImageIcon, Globe, Zap,
  Code, CheckCircle2, ArrowRight, Store,
  GraduationCap, ChevronRight, Star, Crown,
  Wallet, Truck, MessageCircle, Sparkles, ShieldCheck,
  Smartphone, Globe2, Headphones, PlayCircle
} from "lucide-react";
import { useEffect, useState, lazy, Suspense } from "react";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import founderImage from "@/assets/founder-ulrich-djate.jpg";
import entrepreneur1 from "@/assets/entrepreneur-1.jpg";
import entrepreneur2 from "@/assets/entrepreneur-2.jpg";
import entrepreneur3 from "@/assets/entrepreneur-3.jpg";
import entrepreneur4 from "@/assets/entrepreneur-4.jpg";
const OnboardingTutorial = lazy(() =>
  import("@/components/OnboardingTutorial").then((m) => ({ default: m.OnboardingTutorial }))
);
import { useAuthReady } from "@/hooks/useAuthReady";
import { useTranslation } from "react-i18next";
const LandingMediaSections = lazy(() => import("@/components/LandingMediaSections"));
const TopSellersLeaderboard = lazy(() => import("@/components/TopSellersLeaderboard"));
const LandingTeamSection = lazy(() =>
  import("@/components/LandingMediaSections").then((module) => ({ default: module.LandingTeamSection }))
);

/* Compact amount formatter — 3 200 000 → "3M", 540 000 → "540k" */
const compactFcfa = (n: number): string => {
  if (!n || n < 1000) return `${Math.round(n)}`;
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}M`;
  }
  const v = n / 1000;
  return `${Math.round(v)}k`;
};

type PodiumSeller = {
  shop_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_sales: number;
};

const FALLBACK_PODIUM: PodiumSeller[] = [
  { shop_id: "f1", full_name: "Eloïse D.",   avatar_url: null, total_sales: 3_200_000 },
  { shop_id: "f2", full_name: "Boga M.",     avatar_url: null, total_sales: 540_000   },
  { shop_id: "f3", full_name: "Aminata K.",  avatar_url: null, total_sales: 310_000   },
];

/* ── EasyAfrik-style Hero with floating phone mockup + podium card ── */
const HeroVisualPro = ({ onStart, onDiscover }: { onStart: () => void; onDiscover: () => void }) => {
  const { t } = useTranslation();
  const [podium, setPodium] = useState<PodiumSeller[]>(FALLBACK_PODIUM);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc("get_top_sellers", { p_limit: 3 });
        const rows = (data as PodiumSeller[]) || [];
        if (rows.length >= 3) setPodium(rows.slice(0, 3));
      } catch { /* keep fallback */ }
    })();
  }, []);
  // Reorder for podium display: [#2, #1, #3]
  const podiumDisplay = [podium[1], podium[0], podium[2]].filter(Boolean) as PodiumSeller[];
  const firstName = (n: string | null) => (n?.trim().split(/\s+/)[0]) || "Vendeur";
  const initials = (n: string | null) => {
    const p = (n || "").trim().split(/\s+/).filter(Boolean);
    return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : (p[0]?.[0] || "?")).toUpperCase();
  };

  const trustPeople = [
    { src: founderImage,     alt: "Eloïse Djaté, fondateur" },
    { src: entrepreneur1,    alt: "Entrepreneuse ivoirienne" },
    { src: entrepreneur2,    alt: "Entrepreneur burkinabé" },
    { src: entrepreneur3,    alt: "Entrepreneuse béninoise" },
    { src: entrepreneur4,    alt: "Entrepreneur africain-américain" },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* soft brand glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-32 w-[420px] h-[420px] rounded-full bg-secondary/20 blur-3xl" />
      <div className="container relative mx-auto px-4 pt-14 md:pt-20 pb-20 md:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* LEFT */}
          <div className="relative z-10 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] uppercase tracking-[0.2em] font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Conçu pour l'Afrique. Pensé pour vous.
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-[4.25rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground mb-6">
              Créez, vendez et<br />développez votre{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">business en ligne</span>{" "}en Afrique
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-7 max-w-xl leading-relaxed">
              VisualPro est la plateforme tout-en-un pour entrepreneurs africains :
              visuels publicitaires IA, vidéos animées, boutique e-commerce et formations,
              sans friction.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-md mb-8">
              {[
                { Icon: Wallet, label: "Paiement à la livraison" },
                { Icon: Smartphone, label: "Mobile Money intégré" },
                { Icon: Truck, label: "Livraison partout en Afrique" },
                { Icon: Headphones, label: "Support local 24/7" },
              ].map(({ Icon, label }, i) => (
                <div key={i} className="flex items-center gap-2 text-xs md:text-sm text-foreground/80">
                  <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  {label}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Button size="lg" className="text-base px-7 py-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25" onClick={onStart}>
                Démarrer gratuitement
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-7 py-6 rounded-full" onClick={onDiscover}>
                <PlayCircle className="mr-2 h-4 w-4" /> Voir une démo
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {trustPeople.map((p, i) => (
                  <img
                    key={i}
                    src={p.src}
                    alt={p.alt}
                    loading="lazy"
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full border-2 border-background object-cover"
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Rejoint par <span className="font-bold text-foreground">+10 000 entrepreneurs</span> à travers l'Afrique
              </p>
            </div>
          </div>

          {/* RIGHT — floating phone + podium card */}
          <div className="relative h-[480px] md:h-[560px] z-10">
            {/* Phone mock */}
            <div className="absolute left-2 sm:left-8 md:left-12 top-4 animate-float">
              <div className="w-[220px] md:w-[260px] h-[440px] md:h-[520px] rounded-[2.4rem] bg-foreground p-2 shadow-2xl shadow-primary/30 border border-foreground/10">
                <div className="w-full h-full rounded-[2rem] bg-background overflow-hidden flex flex-col">
                  <div className="px-3 pt-3 pb-2 flex items-center gap-2 border-b border-border/60">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary" />
                    <div className="text-[10px] font-bold tracking-wide">VisualPro</div>
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  {/* Chiffre du jour */}
                  <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-muted-foreground">Chiffre du jour</div>
                  <div className="px-3 flex items-baseline gap-2">
                    <span className="text-lg font-extrabold text-primary">12,5M FCFA</span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600">
                      ▲ +18%
                    </span>
                  </div>
                  {/* Statistiques boutique */}
                  <div className="px-3 mt-3 text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Statistiques boutique</div>
                  <div className="px-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Cmd. du jour</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-extrabold text-foreground">+24</span>
                        <span className="text-[9px] font-bold text-emerald-600">▲ 12%</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Total cmd.</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-extrabold text-foreground">1 248</span>
                        <span className="text-[9px] font-bold text-emerald-600">▲ 7%</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-2 col-span-2">
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground mb-1">Commandes validées</div>
                      <div className="flex items-end gap-1 h-8">
                        {[40,55,48,72,60,85,95].map((h,i)=>(
                          <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-primary to-primary/40" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto px-3 py-2.5 border-t border-border/60 flex items-center justify-between">
                    <div className="text-[9px] text-muted-foreground">Taux conversion</div>
                    <div className="text-[11px] font-bold text-emerald-600">▲ 3,8%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Leaderboard card — top vendeurs réels */}
            <div className="absolute right-0 top-16 md:top-12 w-[270px] md:w-[320px] animate-float-slow">
              <div className="rounded-2xl bg-[#0f1b3d] text-white p-5 shadow-2xl border border-white/10">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-white/70 mb-4">
                  <Crown className="w-3.5 h-3.5 text-[#c9a84c]" /> Classement de la semaine
                </div>
                <div className="flex items-end justify-center gap-3 mb-4">
                  {podiumDisplay.map((s, i) => {
                    // i=0 → #2 (left), i=1 → #1 (center), i=2 → #3 (right)
                    const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
                    const ring = rank===1 ? "ring-[#c9a84c]" : rank===2 ? "ring-[#d8d8e0]" : "ring-[#c98a4c]";
                    const size = rank===1 ? "w-16 h-16" : "w-12 h-12";
                    const barH = rank===1 ? "h-20" : rank===2 ? "h-14" : "h-12";
                    return (
                      <div key={s.shop_id} className="flex flex-col items-center w-1/3">
                        <div className={`${size} rounded-full bg-gradient-to-br from-primary to-secondary ring-2 ring-offset-2 ring-offset-[#0f1b3d] ${ring} overflow-hidden flex items-center justify-center text-xs font-bold relative`}>
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt={firstName(s.full_name)} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <span>{initials(s.full_name)}</span>
                          )}
                          {rank===1 && <Crown className="absolute -top-3 w-4 h-4 text-[#c9a84c] drop-shadow-[0_0_6px_rgba(201,168,76,0.9)]" />}
                        </div>
                        <div className="mt-1.5 text-[10px] font-medium text-center truncate w-full">{firstName(s.full_name)}</div>
                        <div className={`text-xs font-extrabold ${rank===1 ? "text-[#c9a84c]" : "text-white"}`}>
                          {compactFcfa(s.total_sales)}
                        </div>
                        <div className={`mt-1.5 w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary/10 ${barH}`} />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-white/70 text-center mb-3">Qui sera le leader cette semaine ?</p>
                <Button size="sm" className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9" onClick={onStart}>
                  Entrer dans la course
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ── L'innovation qui change la donne ── */
const InnovationBento = () => {
  const navigate = useNavigate();
  const items = [
    { n: "01", title: "Visuels publicitaires IA", desc: "Créez des visuels professionnels en quelques secondes pour toutes vos campagnes.", route: "/generator", color: "from-primary/15 to-primary/5" },
    { n: "02", title: "Vidéos animées", desc: "Transformez vos produits en vidéos qui captivent et convertissent.", route: "/video-creator", color: "from-secondary/15 to-secondary/5" },
    { n: "03", title: "Boutique e-commerce", desc: "Lancez votre boutique en ligne en 60 secondes, paiement local intégré.", route: "/shop-manager", color: "from-emerald-500/15 to-emerald-500/5" },
    { n: "04", title: "Formations", desc: "Apprenez à vendre, convertir et faire passer votre business au niveau supérieur.", route: "/courses-manager", color: "from-amber-500/15 to-amber-500/5" },
    { n: "05", title: "Communauté & Support", desc: "Échangez avec d'autres entrepreneurs et obtenez de l'aide en temps réel.", route: "/community", color: "from-pink-500/15 to-pink-500/5" },
  ];
  return (
    <section id="services" className="py-20 md:py-28 bg-muted/20 border-y border-border/60">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 md:mb-16">
          <Badge variant="outline" className="mb-5 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] border-primary/30 text-primary bg-primary/5">
            Des fonctionnalités innovantes
          </Badge>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            L'innovation qui <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">change la donne</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
          {items.map((it, i) => (
            <Card
              key={i}
              onClick={() => navigate(it.route)}
              className={`group p-5 cursor-pointer border bg-gradient-to-br ${it.color} hover:-translate-y-1 hover:shadow-xl transition-all duration-300 animate-fade-in`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="text-[10px] font-bold text-primary tracking-widest mb-3">{it.n}</div>
              <h3 className="text-base font-bold mb-2 leading-tight">{it.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4 min-h-[3rem]">{it.desc}</p>
              <div className="mt-auto h-24 rounded-lg bg-background/60 border border-border/60 flex items-center justify-center text-[10px] text-muted-foreground">
                Aperçu
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Explorer <ChevronRight className="w-3 h-3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ── Trust strip ── */
const TrustStrip = () => {
  const items = [
    { Icon: Wallet, label: "Paiement à la livraison" },
    { Icon: Smartphone, label: "Mobile Money intégré" },
    { Icon: Truck, label: "Livraison locale" },
    { Icon: Globe2, label: "Multi-pays · Multi-devises" },
    { Icon: Headphones, label: "Support en français 24/7" },
    { Icon: ShieldCheck, label: "Sécurité de niveau bancaire" },
  ];
  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container mx-auto px-4">
        <p className="text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-8">
          Pensé pour l'Afrique, dès le premier jour
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
          {items.map(({ Icon, label }, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-border/60 bg-card/40">
              <span className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <span className="text-xs font-medium leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ── Stats + testimonial ── */
const StatsTestimonial = () => {
  const stats = [
    { v: "+10 000", l: "entrepreneurs nous font confiance" },
    { v: "54", l: "pays où VisualPro est utilisé" },
    { v: "99,9%", l: "uptime garanti" },
    { v: "24/7", l: "support local en Afrique" },
  ];
  return (
    <section className="py-14 md:py-20">
      <div className="container mx-auto px-4">
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-6 md:p-10 max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div className="grid grid-cols-2 gap-6">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-2xl md:text-3xl font-extrabold text-primary mb-1">{s.v}</div>
                <p className="text-xs text-muted-foreground leading-snug">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="border-l-0 md:border-l border-border/60 md:pl-8">
            <p className="text-base md:text-lg text-foreground italic leading-relaxed mb-4">
              « VisualPro a transformé mon business. Je gère tout depuis mon téléphone,
              même mes livraisons et mes paiements COD. »
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">
                AD
              </div>
              <div>
                <div className="text-sm font-semibold">Awa Diallo</div>
                <div className="text-xs text-muted-foreground">CEO, Boutique Awa</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ── Ticker / scrolling banner ── */
const TickerBanner = () => {
  const { t } = useTranslation();
  const items = [
    t("landing.ticker.ads"),
    t("landing.ticker.videos"),
    t("landing.ticker.sites"),
    t("landing.ticker.shops"),
    t("landing.ticker.courses"),
    t("landing.ticker.platform"),
    t("landing.ticker.instant"),
  ];
  const repeated = [...items, ...items];
  return (
    <div className="bg-foreground text-background overflow-hidden whitespace-nowrap py-2 relative border-b border-foreground/10">
      <div className="inline-flex animate-[ticker_30s_linear_infinite]">
        {repeated.map((t, i) => (
          <span key={i} className="mx-10 text-[12px] uppercase tracking-[0.22em] font-medium opacity-80">{t}</span>
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
  const { t } = useTranslation();

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
    { icon: ImageIcon, key: "ads", color: "from-orange-500 to-pink-500", bgLight: "bg-orange-50 dark:bg-orange-950/30", route: "/generator" },
    { icon: Video, key: "videos", color: "from-blue-500 to-cyan-500", bgLight: "bg-blue-50 dark:bg-blue-950/30", route: "/video-creator" },
    { icon: Store, key: "shops", color: "from-emerald-500 to-teal-500", bgLight: "bg-emerald-50 dark:bg-emerald-950/30", route: "/shop-manager" },
    { icon: GraduationCap, key: "courses", color: "from-amber-500 to-yellow-500", bgLight: "bg-amber-50 dark:bg-amber-950/30", route: "/courses-manager" },
    { icon: Code, key: "api", color: "from-slate-500 to-gray-500", bgLight: "bg-slate-50 dark:bg-slate-950/30", route: "/api-documentation" },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <link rel="canonical" href="https://visuelpro.cloud/" />
      </Helmet>
      <Header />

      {showOnboarding && session?.user && (
        <Suspense fallback={null}>
          <OnboardingTutorial userId={session.user.id} onComplete={() => setShowOnboarding(false)} />
        </Suspense>
      )}

      {/* ===== SCROLLING TICKER ===== */}
      <TickerBanner />

      {/* ===== HERO ===== */}
      {session?.user ? (
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="container relative mx-auto px-4 py-20 md:py-32 text-center">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 leading-tight animate-fade-in tracking-tight">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" style={{ fontFamily: "'Georgia', serif" }}>
                {new Date().getHours() < 18 ? t("dashboard.greetingMorning") : t("dashboard.greetingEvening")} {session.user.user_metadata?.full_name?.split(' ')[0] || session.user.email?.split('@')[0]}, {t("dashboard.welcome")}
              </span>
              <span className="inline-block animate-wiggle text-4xl sm:text-5xl md:text-6xl ml-2">👋</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-10 animate-fade-in tracking-wide font-medium">
              {t("dashboard.subtitle")}
            </p>
          </div>
        </section>
      ) : (
        <HeroVisualPro onStart={() => navigate("/auth")} onDiscover={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} />
      )}

      {/* ===== INNOVATION BENTO ===== */}
      {!session && <InnovationBento />}

      {/* ===== TRUST STRIP ===== */}
      {!session && <TrustStrip />}

      {/* ===== STATS + TESTIMONIAL ===== */}
      {!session && <StatsTestimonial />}

      {/* ===== HALL OF FAME ===== */}
      {loadDeferredSections && (
        <Suspense fallback={null}>
          <TopSellersLeaderboard />
        </Suspense>
      )}

      {session && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">{t("hub.heading")}</h2>
              <p className="text-muted-foreground">{t("hub.subheading")}</p>
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
                    <h3 className="text-xl font-bold mb-2 text-foreground">{t(`hub.services.${s.key}.title`)}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-5">{t(`hub.services.${s.key}.desc`)}</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                      {t(`hub.services.${s.key}.cta`)}
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
            <h2 className="text-3xl md:text-5xl font-semibold mb-4 tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
              {t("landing.sections.platformTitleA")} <span className="italic text-primary">{t("landing.sections.platformTitleB")}</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.sections.platformSub")}
            </p>
          </div>
        </section>
      )}

      {/* ===== COMMENT CA MARCHE ===== */}
      {!session && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-semibold mb-4 tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>{t("landing.sections.stepsTitle")}</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("landing.sections.stepsSub")}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                { step: "01", title: t("landing.sections.step1Title"), desc: t("landing.sections.step1Desc") },
                { step: "02", title: t("landing.sections.step2Title"), desc: t("landing.sections.step2Desc") },
                { step: "03", title: t("landing.sections.step3Title"), desc: t("landing.sections.step3Desc") },
              ].map((item, idx) => (
                <div key={idx} className="text-center group animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                  <div className="w-14 h-14 border border-foreground/15 rounded-full flex items-center justify-center mx-auto mb-5 text-sm font-semibold tracking-widest text-muted-foreground group-hover:border-foreground/40 transition-colors">
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
        <section id="pricing" className="py-16 md:py-24 bg-muted/20 border-y border-border/60">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-semibold mb-4 tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
                Des tarifs <span className="italic text-primary">accessibles</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Commencez gratuitement, évoluez selon vos besoins</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
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
            </div>
          </div>
        </section>
      )}

      {/* ===== TÉMOIGNAGES ===== */}
      {!session && publishedFeedback.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-semibold mb-4 tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
                {t("landing.sections.trustTitle")} <span className="italic text-primary">{t("landing.sections.trustTitleB")}</span>
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
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto rounded-2xl border border-border/60 bg-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="flex items-start md:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl">🚀</div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-1">Prêt à lancer votre boutique et à changer votre vie ?</h3>
                  <p className="text-sm text-muted-foreground">Rejoignez des milliers d'entrepreneurs africains qui développent leur business avec VisualPro.</p>
                </div>
              </div>
              <Button size="lg" className="text-base px-7 py-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap shadow-lg shadow-primary/20" onClick={() => navigate("/auth")}>
                Créer ma boutique gratuitement
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default Index;
