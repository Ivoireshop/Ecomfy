import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import {
  Video,
  Image as ImageIcon,
  Globe,
  Store,
  GraduationCap,
  Code,
  ChevronRight,
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { session, isReady } = useAuthReady();
  const [profile, setProfile] = useState<{ full_name?: string | null } | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }
    void supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [isReady, session, navigate]);

  const hubServices = [
    { icon: ImageIcon, title: "Visuels Publicitaires", desc: "Créez des images IA professionnelles", color: "from-orange-500 to-pink-500", bgLight: "bg-orange-50 dark:bg-orange-950/30", route: "/generator", cta: "Créer un visuel" },
    { icon: Video, title: "Vidéos Animées", desc: "Transformez vos visuels en vidéos", color: "from-blue-500 to-cyan-500", bgLight: "bg-blue-50 dark:bg-blue-950/30", route: "/video-creator", cta: "Créer une vidéo" },
    { icon: Globe, title: "Sites Vitrine", desc: "Lancez votre site pro en minutes", color: "from-violet-500 to-purple-500", bgLight: "bg-violet-50 dark:bg-violet-950/30", route: "/showcase-manager", cta: "Créer un site" },
    { icon: Store, title: "Boutiques E-commerce", desc: "Vendez en ligne avec paiements intégrés", color: "from-emerald-500 to-teal-500", bgLight: "bg-emerald-50 dark:bg-emerald-950/30", route: "/shop-manager", cta: "Créer une boutique" },
    { icon: GraduationCap, title: "Formations en Ligne", desc: "Créez et vendez vos cours avec certificats", color: "from-amber-500 to-yellow-500", bgLight: "bg-amber-50 dark:bg-amber-950/30", route: "/courses-manager", cta: "Créer une formation" },
    { icon: Code, title: "API & Intégrations", desc: "Connectez VisualPro à vos outils", color: "from-slate-500 to-gray-500", bgLight: "bg-slate-50 dark:bg-slate-950/30", route: "/api-documentation", cta: "Voir la doc API" },
  ];

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const greeting = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="container mx-auto px-4 py-10 md:py-16">
        <div className="max-w-5xl mx-auto text-center mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" style={{ fontFamily: "'Georgia', serif" }}>
              {greeting}{firstName ? ` ${firstName}` : ""}, bienvenue
            </span>
            <span className="inline-block animate-wiggle ml-2">👋</span>
          </h1>
          <p className="text-muted-foreground">Votre espace de travail est prêt. Choisissez votre outil.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {hubServices.map((s, idx) => (
            <Card
              key={idx}
              className={`group relative overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all duration-500 hover:shadow-2xl cursor-pointer animate-fade-in ${s.bgLight}`}
              style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" }}
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
      </section>
    </div>
  );
};

export default Dashboard;