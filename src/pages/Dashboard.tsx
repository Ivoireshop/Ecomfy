import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { StartChecklist } from "@/components/dashboard/StartChecklist";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useTranslation } from "react-i18next";
import {
  Video,
  Image as ImageIcon,
  Store,
  GraduationCap,
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

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const greeting = new Date().getHours() < 18 ? t("dashboard.greetingMorning") : t("dashboard.greetingEvening");

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Topbar for Dashboard */}
      <header className="h-[65px] flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-6 text-[13.5px] font-medium text-muted-foreground font-inter">
            <span className="cursor-pointer hover:text-foreground transition-colors">{t("header.home")}</span>
            <span className="cursor-pointer hover:text-foreground transition-colors">{t("header.tutorial")}</span>
            <span className="cursor-pointer hover:text-foreground transition-colors">{t("header.community", "Communauté")}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[13px] font-semibold text-muted-foreground font-inter bg-muted px-2.5 py-1 rounded-full hidden sm:block">
            {profile?.full_name || "Utilisateur"}
          </div>
          <button 
            onClick={() => navigate("/generator")}
            className="h-9 px-4 rounded-[9px] bg-accent text-accent-foreground font-inter text-[13.5px] font-semibold hover:bg-accent/90 transition-colors shadow-sm"
          >
            {t("common.start")}
          </button>
        </div>
      </header>

      <div className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        <div className="mb-8 animate-fade-in">
          <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-3">
            Espace de travail
          </div>
          <h1 className="font-space font-bold text-[28px] tracking-tight text-foreground">
            {greeting}{firstName ? ` ${firstName}` : ""}, {t("dashboard.welcome")} 👋
          </h1>
        </div>

        {session && (
          <div className="max-w-3xl mx-auto">
            <StartChecklist userId={session.user.id} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Cartes Visuels & Vidéos */}
          <div 
            onClick={() => navigate("/generator")}
            className="group cursor-pointer bg-card rounded-[14px] p-6 border border-border shadow-sm hover:shadow-md transition-all flex flex-col items-start hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0E7C66] group-hover:w-1.5 transition-all"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-[30px] h-[30px] rounded-lg bg-[#E3F1EC] text-[#0A5F4F] flex items-center justify-center">
                <ImageIcon className="w-4 h-4" />
              </div>
              <h3 className="font-space font-bold text-[17px] tracking-tight">{t("hub.services.ads.title")}</h3>
            </div>
            <p className="font-inter text-[13.5px] text-muted-foreground leading-relaxed mb-4">
              {t("hub.services.ads.desc")}
            </p>
            <div className="mt-auto font-inter text-[13px] font-semibold text-[#0E7C66] flex items-center gap-1 group-hover:gap-2 transition-all">
              {t("hub.services.ads.cta")} <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div 
            onClick={() => navigate("/video-creator")}
            className="group cursor-pointer bg-card rounded-[14px] p-6 border border-border shadow-sm hover:shadow-md transition-all flex flex-col items-start hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2A5DB0] group-hover:w-1.5 transition-all"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-[30px] h-[30px] rounded-lg bg-[#EAF0F9] text-[#1D4486] flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
              <h3 className="font-space font-bold text-[17px] tracking-tight">{t("hub.services.videos.title")}</h3>
            </div>
            <p className="font-inter text-[13.5px] text-muted-foreground leading-relaxed mb-4">
              {t("hub.services.videos.desc")}
            </p>
            <div className="mt-auto font-inter text-[13px] font-semibold text-[#2A5DB0] flex items-center gap-1 group-hover:gap-2 transition-all">
              {t("hub.services.videos.cta")} <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Cartes Boutiques & Formations */}
          <div 
            onClick={() => navigate("/shop-manager")}
            className="group cursor-pointer bg-card rounded-[14px] p-6 border border-border shadow-sm hover:shadow-md transition-all flex flex-col items-start hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-foreground group-hover:w-1.5 transition-all"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-[30px] h-[30px] rounded-lg bg-muted text-foreground flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
              <h3 className="font-space font-bold text-[17px] tracking-tight">{t("hub.services.shops.title")}</h3>
            </div>
            <p className="font-inter text-[13.5px] text-muted-foreground leading-relaxed mb-4">
              {t("hub.services.shops.desc")}
            </p>
            <div className="mt-auto font-inter text-[13px] font-semibold text-foreground flex items-center gap-1 group-hover:gap-2 transition-all">
              {t("hub.services.shops.cta")} <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div 
            onClick={() => navigate("/courses-manager")}
            className="group cursor-pointer bg-card rounded-[14px] p-6 border border-border shadow-sm hover:shadow-md transition-all flex flex-col items-start hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#B9761F] group-hover:w-1.5 transition-all"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-[30px] h-[30px] rounded-lg bg-[#F7ECDC] text-[#8C5712] flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h3 className="font-space font-bold text-[17px] tracking-tight">{t("hub.services.courses.title")}</h3>
            </div>
            <p className="font-inter text-[13.5px] text-muted-foreground leading-relaxed mb-4">
              {t("hub.services.courses.desc")}
            </p>
            <div className="mt-auto font-inter text-[13px] font-semibold text-[#B9761F] flex items-center gap-1 group-hover:gap-2 transition-all">
              {t("hub.services.courses.cta")} <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;