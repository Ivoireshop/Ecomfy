import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

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
    { icon: ImageIcon, key: "ads", color: "from-orange-500 to-pink-500", bgLight: "bg-orange-50 dark:bg-orange-950/30", route: "/generator" },
    { icon: Video, key: "videos", color: "from-blue-500 to-cyan-500", bgLight: "bg-blue-50 dark:bg-blue-950/30", route: "/video-creator" },
    { icon: Store, key: "shops", color: "from-emerald-500 to-teal-500", bgLight: "bg-emerald-50 dark:bg-emerald-950/30", route: "/shop-manager" },
    { icon: GraduationCap, key: "courses", color: "from-amber-500 to-yellow-500", bgLight: "bg-amber-50 dark:bg-amber-950/30", route: "/courses-manager" },
    { icon: Code, key: "api", color: "from-slate-500 to-gray-500", bgLight: "bg-slate-50 dark:bg-slate-950/30", route: "/api-documentation" },
  ] as const;

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const greeting = new Date().getHours() < 18 ? t("dashboard.greetingMorning") : t("dashboard.greetingEvening");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="container mx-auto px-4 py-10 md:py-16">
        <div className="max-w-5xl mx-auto text-center mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" style={{ fontFamily: "'Georgia', serif" }}>
              {greeting}{firstName ? ` ${firstName}` : ""}, {t("dashboard.welcome")}
            </span>
            <span className="inline-block animate-wiggle ml-2">👋</span>
          </h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
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
      </section>
    </div>
  );
};

export default Dashboard;