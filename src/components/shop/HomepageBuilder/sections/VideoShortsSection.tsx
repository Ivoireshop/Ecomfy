import React, { useState, useRef } from "react";
import { VideoShortsSectionSettings } from "../types";
import { Play, Volume2, VolumeX, Maximize2, Video, Clock, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface VideoShortsSectionProps {
  settings: VideoShortsSectionSettings;
  primaryColor?: string;
}

export const VideoShortsSection: React.FC<VideoShortsSectionProps> = ({
  settings,
  primaryColor = "#0E7C66",
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [mutedStates, setMutedStates] = useState<Record<string, boolean>>({});
  const [fullscreenVideoUrl, setFullscreenVideoUrl] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const items = settings.items || [];
  if (items.length === 0) return null;

  const togglePlay = (id: string) => {
    const el = videoRefs.current[id];
    if (!el) return;

    if (el.paused) {
      Object.entries(videoRefs.current).forEach(([vId, vEl]) => {
        if (vId !== id && vEl) vEl.pause();
      });
      el.play().catch(console.warn);
      setPlayingId(id);
    } else {
      el.pause();
      setPlayingId(null);
    }
  };

  const toggleMute = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRefs.current[id];
    const isMuted = !mutedStates[id];
    if (el) el.muted = isMuted;
    setMutedStates((prev) => ({ ...prev, [id]: isMuted }));
  };

  return (
    <section className="py-12 md:py-16 px-4 md:px-8 border-y border-slate-200/80 bg-slate-900 text-white" style={{ backgroundColor: settings.bg_color || undefined }}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg text-white font-bold" style={{ backgroundColor: primaryColor }}>
                <Video className="h-4 w-4" />
              </span>
              <h2 className="text-xl md:text-3xl font-extrabold text-white font-space">
                {settings.title || "Vidéos Shorts & Démonstrations (30s max)"}
              </h2>
            </div>
            {settings.subtitle && (
              <p className="text-slate-400 text-xs md:text-sm">
                {settings.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Scrollable Shorts Grid / Carousel */}
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-700">
          {items.map((vid) => {
            const isPlaying = playingId === vid.id;
            const isMuted = mutedStates[vid.id] ?? false;
            const videoSrc = vid.video_url ? (vid.video_url.includes("#t=") ? vid.video_url : `${vid.video_url}#t=0.001`) : "";

            return (
              <div
                key={vid.id}
                className="shrink-0 snap-center w-[220px] sm:w-[260px] aspect-[9/16] max-h-[440px] rounded-2xl overflow-hidden bg-slate-950 relative group shadow-xl border border-slate-800 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                onClick={() => togglePlay(vid.id)}
              >
                <video
                  ref={(el) => (videoRefs.current[vid.id] = el)}
                  src={videoSrc}
                  poster={vid.thumbnail_url || undefined}
                  loop
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />

                {/* Top Badge: 30s max */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-white/10">
                  <Clock className="w-3 h-3" />
                  <span>30s max</span>
                </div>

                {/* Top Right: Volume Toggle */}
                <button
                  onClick={(e) => toggleMute(vid.id, e)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center border border-white/10 hover:bg-black/80 transition-all"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>

                {/* Center Overlay: Play Button */}
                {!isPlaying && (
                  <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform pl-1">
                      <Play className="w-6 h-6 fill-slate-900" />
                    </div>
                  </div>
                )}

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent pt-8 space-y-1">
                  {vid.title && (
                    <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                      {vid.title}
                    </h4>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullscreenVideoUrl(vid.video_url);
                    }}
                    className="text-[10px] text-slate-300 flex items-center gap-1 hover:text-white pt-1"
                  >
                    <Maximize2 className="w-3 h-3 text-amber-400" />
                    <span>Plein écran</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fullscreen Video Modal */}
        <Dialog open={!!fullscreenVideoUrl} onOpenChange={() => setFullscreenVideoUrl(null)}>
          <DialogContent className="max-w-lg p-0 bg-black border-slate-800 overflow-hidden">
            {fullscreenVideoUrl && (
              <video src={fullscreenVideoUrl} controls autoPlay className="w-full max-h-[85vh] object-contain" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};
