import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoGenerator } from "@/components/VideoGenerator";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles, Film, Clapperboard, Wand2, Zap, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import videoModelCosmetics from "@/assets/video-model-cosmetics.mp4.asset.json";
import videoModelHandbag from "@/assets/video-model-handbag-v2.mp4.asset.json";
import videoModelHandbagV1 from "@/assets/video-model-handbag.mp4.asset.json";
import videoPreview1 from "@/assets/video-preview-1.jpg";
import videoPreview2 from "@/assets/video-preview-2.jpg";

const demoVideos = [
  { url: videoModelCosmetics.url, title: "Cosmétiques Lumineux", style: "Beauté" },
  { url: videoModelHandbag.url, title: "Sac à main Premium", style: "Mode" },
  { url: videoModelHandbagV1.url, title: "Accessoires Élégants", style: "Lifestyle" },
];

const VideoCreator = () => {
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [videoGenerationsRemaining, setVideoGenerationsRemaining] = useState(0);

  const loadStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      // @ts-ignore
      .in("role", ["founder", "co_founder"]);
    const isFounderOrCo = Array.isArray(roleData) && roleData.length > 0;
    setIsFounder(isFounderOrCo);

    if (isFounderOrCo) {
      setHasActiveSubscription(true);
      setVideoGenerationsRemaining(999999);
      return;
    }

    const { data: subData } = await supabase
      .from("subscriptions")
      .select("status, video_generations_remaining")
      .eq("user_id", user.id)
      .maybeSingle();
    setHasActiveSubscription(subData?.status === "active");
    setVideoGenerationsRemaining(subData?.video_generations_remaining || 0);
  };

  useEffect(() => { loadStatus(); }, []);

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Header />

      {/* ===== HERO COLORÉ ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-cyan-500 to-purple-600 text-white">
        <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="container relative mx-auto px-4 py-10 md:py-16">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur px-4 py-1.5 animate-fade-in">
              <Clapperboard className="w-4 h-4 mr-2" />
              Studio Vidéo IA
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight animate-fade-in">
              Transformez vos idées
              <br />
              <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-white bg-clip-text text-transparent">
                en vidéos publicitaires
              </span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-white/90 animate-fade-in max-w-2xl mx-auto">
              Importez vos images, décrivez votre idée, et obtenez une vidéo HD prête pour TikTok, Instagram et Facebook en 1 à 2 minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {[
                { icon: Zap, label: "1-2 min" },
                { icon: Film, label: "HD 5-10s" },
                { icon: Wand2, label: "IA Premium" },
                { icon: Sparkles, label: "Qualité Pro" },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-white/20">
                  <b.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {b.label}
                </div>
              ))}
            </div>
            <div className="pt-3">
              <Button
                size="lg"
                onClick={() => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full bg-white text-blue-700 hover:bg-white/90"
              >
                Commencer la création
                <ArrowDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== GENERATOR ===== */}
      <section id="create" className="py-6 md:py-10 scroll-mt-20">
        <VideoGenerator
          hasActiveSubscription={hasActiveSubscription}
          isFounder={isFounder}
          videoGenerationsRemaining={videoGenerationsRemaining}
          onVideoGenerated={loadStatus}
        />
      </section>

      <Footer />
    </div>
  );
};

export default VideoCreator;