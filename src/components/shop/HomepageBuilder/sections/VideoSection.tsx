import React from "react";
import { VideoSectionSettings } from "../types";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

interface VideoSectionProps {
  settings: VideoSectionSettings;
  primaryColor?: string;
  onAction?: (actionType: string, url?: string) => void;
}

export const VideoSection: React.FC<VideoSectionProps> = ({
  settings,
  primaryColor = "#0E7C66",
  onAction,
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);

  const isYouTube = settings.video_url?.includes("youtube.com") || settings.video_url?.includes("youtu.be");
  const isVimeo = settings.video_url?.includes("vimeo.com");

  const getEmbedUrl = (url: string) => {
    if (url.includes("youtube.com/watch?v=")) {
      return url.replace("watch?v=", "embed/");
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("vimeo.com/")) {
      const id = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  };

  return (
    <section className="py-12 md:py-20 px-4 md:px-8 bg-slate-900 text-white relative overflow-hidden" style={{ backgroundColor: settings.bg_color || undefined }}>
      <div className="max-w-5xl mx-auto space-y-8 text-center">
        
        <div className="space-y-3 max-w-2xl mx-auto">
          {settings.subtitle && (
            <span className="text-amber-400 font-bold text-xs uppercase tracking-widest block">
              {settings.subtitle}
            </span>
          )}
          <h2 className="text-2xl md:text-4xl font-extrabold text-white font-space">
            {settings.title || "Découvrez notre boutique en vidéo"}
          </h2>
          {settings.description && (
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              {settings.description}
            </p>
          )}
        </div>

        {/* Video Player Box */}
        <div className="relative aspect-video rounded-3xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-2xl max-w-4xl mx-auto group">
          {!isPlaying && settings.cover_image_url ? (
            <div className="relative w-full h-full">
              <img
                src={settings.cover_image_url}
                alt={settings.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                <Button
                  onClick={() => setIsPlaying(true)}
                  className="w-20 h-20 rounded-full bg-white/90 text-slate-900 hover:bg-white hover:scale-110 shadow-2xl transition-all flex items-center justify-center pl-1"
                >
                  <Play className="w-8 h-8 fill-slate-900" />
                </Button>
              </div>
            </div>
          ) : isYouTube || isVimeo ? (
            <iframe
              src={`${getEmbedUrl(settings.video_url)}?autoplay=1`}
              title={settings.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={settings.video_url}
              controls
              autoPlay={settings.autoplay}
              poster={settings.cover_image_url}
              className="w-full h-full object-cover"
            >
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
          )}
        </div>

        {/* CTA Button */}
        {settings.button_text && (
          <div className="pt-4">
            <Button
              onClick={() => onAction?.(settings.button_link_type || "products", settings.button_custom_url)}
              className="h-12 px-8 text-sm font-bold rounded-xl shadow-lg text-white font-space uppercase tracking-wider"
              style={{ backgroundColor: primaryColor }}
            >
              {settings.button_text}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
