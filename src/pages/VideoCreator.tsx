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

      {/* ===== HERO DYNAMIQUE ===== */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/[0.08] via-background to-secondary/[0.08]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.15),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(var(--secondary)/0.10),_transparent_50%)]" />
        <div className="container relative mx-auto px-4 py-8 md:py-12">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <Badge variant="secondary" className="px-3 py-1 backdrop-blur-sm bg-background/80">
              <Clapperboard className="w-3.5 h-3.5 mr-1.5" />
              Studio Vidéo IA
            </Badge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight">
              Créez votre vidéo publicitaire
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
              Importez vos images, décrivez votre idée, recevez une vidéo HD, 2K ou 4K en 1 à 2 minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {[
                { icon: Zap, label: "1-2 min" },
                { icon: Film, label: "HD / 2K / 4K" },
                { icon: Sparkles, label: "Qualité Pro" },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-muted/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                  <b.icon className="w-3.5 h-3.5" />
                  {b.label}
                </div>
              ))}
            </div>
            <div className="pt-3">
              <Button
                size="lg"
                onClick={() => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full shadow-lg hover:shadow-xl transition-all"
              >
                Commencer la création
                <ArrowDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DEMO VIDEOS MARQUEE (3 uniques) ===== */}
      <section className="py-4 md:py-6 bg-muted/30 overflow-hidden border-b">
        <div className="container mx-auto px-4 mb-3">
          <p className="text-center text-xs md:text-sm text-muted-foreground">
            🎬 Exemples générés sur la plateforme
          </p>
        </div>
        <div className="relative">
          <div className="flex gap-3 animate-marquee w-max">
            {demoVideos.map((v, i) => (
              <Card key={i} className="w-36 md:w-44 flex-shrink-0 overflow-hidden shadow-md">
                <div className="aspect-[9/16] bg-black relative">
                  <video
                    src={v.url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <p className="absolute bottom-2 left-2 right-2 text-white font-medium text-xs">{v.title}</p>
                </div>
              </Card>
            ))}
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