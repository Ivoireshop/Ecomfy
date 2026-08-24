import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, BookOpen, Clock, CheckCircle2, Play, LogOut, Award, 
  GraduationCap, Trophy, Lock, Sparkles, Zap, ShieldCheck, 
  ShoppingCart, ArrowRight, Video, Flame, Star, Check, ExternalLink
} from "lucide-react";

interface PremiumCourse {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  duration: string;
  level: string;
  category: string;
  image_url: string;
  isUnlocked: boolean;
  unlockedVia: "subscription" | "purchase" | "free" | null;
  modulesCount: number;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<PremiumCourse[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // Demo simulation mode state for easy testing by the user
  const [simulatedAccessMode, setSimulatedAccessMode] = useState<"subscription" | "purchase" | "none">("subscription");
  const [isSubscriber, setIsSubscriber] = useState<boolean>(true);

  // Default Masterclasses Catalogue
  const DEFAULT_MASTERCLASSES: PremiumCourse[] = [
    {
      id: "course-fb-ads-pro",
      title: "Masterclass : Publicités Facebook & Instagram Ads pour E-Commerce",
      description: "Apprenez à paramétrer des campagnes rentables, cibler des acheteurs qualifiés en Afrique et en Europe et rediriger le trafic vers votre Single-Page Checkout Ecomfy.",
      price: 10000,
      currency: "FCFA",
      duration: "3h 45min",
      level: "Tous niveaux",
      category: "Marketing & Ads",
      image_url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80",
      isUnlocked: true,
      unlockedVia: "subscription",
      modulesCount: 8
    },
    {
      id: "course-tiktok-closing",
      title: "Masterclass : Dompter TikTok Ads & Closing WhatsApp Express",
      description: "Stratégies virales pour convertir des spectateurs TikTok en acheteurs WhatsApp. Modèles de scripts vendeurs, gestion des objections et closing en 5 minutes.",
      price: 12000,
      currency: "FCFA",
      duration: "2h 30min",
      level: "Intermédiaire",
      category: "Social Selling",
      image_url: "https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=800&q=80",
      isUnlocked: true,
      unlockedVia: "subscription",
      modulesCount: 6
    },
    {
      id: "course-ai-mastery",
      title: "Masterclass : Maîtrise de l'Intelligence Artificielle E-commerce",
      description: "Générez des visuels studio haute définition, des vidéos publicitaires avec voix-off professionnelle IA et des fiches produits persuasives qui doublent votre taux de conversion.",
      price: 15000,
      currency: "FCFA",
      duration: "4h 15min",
      level: "Avancé",
      category: "Intelligence Artificielle",
      image_url: "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80",
      isUnlocked: true,
      unlockedVia: "subscription",
      modulesCount: 10
    }
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    applyAccessRules(simulatedAccessMode);
  }, [simulatedAccessMode]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch real profile & subscriptions
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .maybeSingle();

        setProfile(profileData);

        // Check if user has active 35,000 FCFA subscription or shop activated
        const { data: activeSub } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        const { data: shopActive } = await supabase
          .from("shops")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_activated", true)
          .maybeSingle();

        const realIsSub = !!(activeSub || shopActive);
        setIsSubscriber(realIsSub);
        
        // Initial simulation state defaults to real subscription status or subscription demo
        applyAccessRules(realIsSub ? "subscription" : "subscription");
      } else {
        applyAccessRules("subscription");
      }
    } catch (e) {
      console.error(e);
      applyAccessRules("subscription");
    } finally {
      setLoading(false);
    }
  };

  const applyAccessRules = (mode: "subscription" | "purchase" | "none") => {
    const updated = DEFAULT_MASTERCLASSES.map(c => {
      if (mode === "subscription") {
        return { ...c, isUnlocked: true, unlockedVia: "subscription" as const };
      } else if (mode === "purchase") {
        // Unlock first masterclass as an individual purchase
        const isFirst = c.id === "course-fb-ads-pro";
        return { ...c, isUnlocked: isFirst, unlockedVia: isFirst ? ("purchase" as const) : null };
      } else {
        return { ...c, isUnlocked: false, unlockedVia: null };
      }
    });

    setCourses(updated);

    // Initialise sample progress
    setProgress({
      "course-fb-ads-pro": mode !== "none" ? 65 : 0,
      "course-tiktok-closing": mode === "subscription" ? 30 : 0,
      "course-ai-mastery": mode === "subscription" ? 100 : 0,
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const unlockedCourses = courses.filter(c => c.isUnlocked);
  const lockedCourses = courses.filter(c => !c.isUnlocked);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] flex flex-col items-center justify-center space-y-4 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-[#0E7C66]" />
        <p className="text-xs font-bold font-inter text-slate-400">Chargement de votre Espace Étudiant Ecomfy...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white">
      
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-space font-extrabold text-base md:text-xl text-white">Espace Étudiant Ecomfy</h1>
                <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  LMS VIP
                </Badge>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Vos formations débloquées, progression et certificats certifiés.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/student/certificates")}
              className="rounded-full border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs font-bold gap-1.5"
            >
              <Award className="h-4 w-4 text-emerald-400" />
              <span className="hidden sm:inline">Mes Certificats</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/academy")}
              className="rounded-full text-slate-400 hover:text-white text-xs font-bold"
            >
              Académie Gratuit
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* Demo Switcher Tester Banner for the User */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 backdrop-blur-xl shadow-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-space">
                Testeur de Mode d'Accès Étudiant (Démo Interactive)
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Sélectionnez un profil pour tester le comportement de déverrouillage :
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={simulatedAccessMode === "subscription" ? "default" : "outline"}
              onClick={() => setSimulatedAccessMode("subscription")}
              className={`rounded-full text-xs font-bold gap-1.5 ${
                simulatedAccessMode === "subscription"
                  ? "bg-[#0E7C66] text-white"
                  : "border-slate-800 text-slate-300 bg-slate-950"
              }`}
            >
              <span>👑 Abonné VIP (35 000 FCFA/mois)</span>
              <Badge className="bg-emerald-400/20 text-emerald-300 border-0 text-[10px]">Toutes Débloquées</Badge>
            </Button>

            <Button
              size="sm"
              variant={simulatedAccessMode === "purchase" ? "default" : "outline"}
              onClick={() => setSimulatedAccessMode("purchase")}
              className={`rounded-full text-xs font-bold gap-1.5 ${
                simulatedAccessMode === "purchase"
                  ? "bg-[#0E7C66] text-white"
                  : "border-slate-800 text-slate-300 bg-slate-950"
              }`}
            >
              <span>🛒 Achat à l'Unité (10 000 FCFA)</span>
              <Badge className="bg-amber-400/20 text-amber-300 border-0 text-[10px]">1 Formation Accès à vie</Badge>
            </Button>

            <Button
              size="sm"
              variant={simulatedAccessMode === "none" ? "default" : "outline"}
              onClick={() => setSimulatedAccessMode("none")}
              className={`rounded-full text-xs font-bold gap-1.5 ${
                simulatedAccessMode === "none"
                  ? "bg-slate-800 text-white"
                  : "border-slate-800 text-slate-400 bg-slate-950"
              }`}
            >
              <span>🔒 Non-Abonné / Compte Gratuit</span>
            </Button>
          </div>
        </div>

        {/* Access Status Header Banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs font-bold px-3 py-1 rounded-full gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {simulatedAccessMode === "subscription"
                  ? "Pass VIP Actif • 35 000 FCFA/mois"
                  : simulatedAccessMode === "purchase"
                  ? "Formations Achetées à l'Unité"
                  : "Compte Gratuit (Tutoriels uniquement)"}
              </Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-space font-extrabold text-white">
              {profile?.full_name ? `Bienvenue, ${profile.full_name.split(" ")[0]}` : "Bienvenue dans votre Espace d'Apprentissage"} 👋
            </h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {simulatedAccessMode === "subscription"
                ? "Votre abonnement mensuel de 35 000 FCFA vous donne un accès illimité à l'intégralité des masterclasses Ecomfy et à leurs mises à jour mensuelles."
                : simulatedAccessMode === "purchase"
                ? "Vous avez accès à vie aux formations achetées individuellement. Vous pouvez acheter d'autres masterclasses à l'unité ou souscrire au Pass VIP."
                : "Abonnez-vous au Pass VIP (35 000 FCFA/mois) ou achetez vos formations individuellement pour débloquer les cours certifiants."}
            </p>
          </div>

          <div className="flex items-center gap-3 z-10 shrink-0">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center min-w-[120px]">
              <div className="text-2xl font-space font-extrabold text-white">{unlockedCourses.length}</div>
              <div className="text-[10px] text-slate-400">Formations Débloquées</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center min-w-[120px]">
              <div className="text-2xl font-space font-extrabold text-amber-400">
                {Object.values(progress).filter(v => v === 100).length}
              </div>
              <div className="text-[10px] text-slate-400">Certificats Obtenus</div>
            </div>
          </div>
        </div>

        {/* SECTION 1: UNLOCKED COURSES */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-space font-bold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#0E7C66]" />
              <span>Mes Formations Débloquées ({unlockedCourses.length})</span>
            </h3>
          </div>

          {unlockedCourses.length === 0 ? (
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-8 text-center space-y-4">
              <Lock className="h-12 w-12 text-slate-500 mx-auto" />
              <h4 className="text-lg font-bold text-white">Aucune formation débloquée</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Achetez une formation à l'unité ou souscrivez au Pass VIP (35 000 FCFA/mois) pour accéder aux masterclasses de vente et publicités.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unlockedCourses.map((c) => {
                const prog = progress[c.id] || 0;
                return (
                  <Card key={c.id} className="bg-slate-900/90 border-slate-800 rounded-3xl overflow-hidden shadow-xl hover:border-slate-700 transition-all flex flex-col group">
                    <div className="relative aspect-video overflow-hidden bg-slate-950">
                      <img
                        src={c.image_url}
                        alt={c.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85 group-hover:opacity-100"
                      />
                      <Badge className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                        {c.unlockedVia === "subscription" ? "👑 Accès VIP Abonné" : "🛒 Achat à l'unité (Accès à vie)"}
                      </Badge>
                      <Badge className="absolute top-3 right-3 bg-slate-950/80 text-white border-0 text-[10px]">
                        {c.duration}
                      </Badge>
                    </div>

                    <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px]">
                          {c.category}
                        </Badge>
                        <h4 className="font-space font-bold text-base text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                          {c.title}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                          {c.description}
                        </p>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-slate-800/80">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Progression</span>
                            <span className="font-bold text-white">{prog}%</span>
                          </div>
                          <Progress value={prog} className="h-2 bg-slate-950" />
                        </div>

                        <Button
                          onClick={() => navigate(`/student/course/${c.id}`)}
                          className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 py-2.5 shadow-lg"
                        >
                          <Play className="h-4 w-4" />
                          <span>{prog > 0 ? "Continuer la Formation" : "Commencer la Formation"}</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: LOCKED PREMIUM MASTERCLASSES / INDIVIDUAL PURCHASES */}
        {lockedCourses.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Lock className="h-5 w-5 text-amber-400" />
                  <span>Catalogue des Masterclasses Verrouillées ({lockedCourses.length})</span>
                </h3>
                <p className="text-xs text-slate-400">Achetez séparément à l'unité ou débloquez TOUT avec le Pass VIP (35 000 FCFA/mois).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lockedCourses.map((c) => (
                <Card key={c.id} className="bg-slate-900/60 border-slate-800/80 rounded-3xl overflow-hidden shadow-xl flex flex-col">
                  <div className="relative aspect-video overflow-hidden bg-slate-950">
                    <img
                      src={c.image_url}
                      alt={c.title}
                      className="w-full h-full object-cover opacity-40 grayscale"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-slate-900/90 border border-slate-700 text-amber-400 flex items-center justify-center shadow-2xl">
                        <Lock className="h-6 w-6" />
                      </div>
                    </div>
                    <Badge className="absolute top-3 left-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                      {c.price.toLocaleString()} {c.currency} à l'unité
                    </Badge>
                  </div>

                  <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px]">
                        {c.category}
                      </Badge>
                      <h4 className="font-space font-bold text-base text-white line-clamp-2">
                        {c.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {c.description}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <Button
                        onClick={() => navigate(`/enroll/${c.id}`)}
                        className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 py-2.5 shadow-lg"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        <span>Acheter la Formation ({c.price.toLocaleString()} {c.currency})</span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => navigate("/pricing")}
                        className="w-full rounded-full border-slate-800 bg-slate-950 text-slate-300 text-[11px] font-bold gap-1.5"
                      >
                        <span>👑 Débloquer TOUT via l'Abonnement (35k FCFA/mo)</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
