import { useState, useRef } from "react";
import { Play, Volume2, VolumeX, Maximize2, X, Clock, Video, CheckCircle2 } from "lucide-react";
import { ProductVideo } from "@/lib/productAppearance";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ProductShortVideosPublicProps {
  videos: ProductVideo[];
  primaryColor?: string;
  themeSettings?: any;
}

export function ProductShortVideosPublic({
  videos = [],
  primaryColor = "#2563eb",
  themeSettings,
}: ProductShortVideosPublicProps) {
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [mutedStates, setMutedStates] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  if (!videos || videos.length === 0) return null;

  const togglePlay = (id: string) => {
    const el = videoRefs.current[id];
    if (!el) return;

    if (el.paused) {
      // Pause all other videos
      Object.entries(videoRefs.current).forEach(([vId, vEl]) => {
        if (vId !== id && vEl) {
          vEl.pause();
        }
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
    if (el) {
      el.muted = isMuted;
    }
    setMutedStates((prev) => ({ ...prev, [id]: isMuted }));
  };

  const formatDuration = (secs?: number | null) => {
    if (!secs) return "30s";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m > 0 ? `${m}:${s < 10 ? "0" : ""}${s}` : `${s}s`;
  };

  return (
    <section 
      className="border-t py-8 sm:py-12"
      style={{ background: themeSettings?.section_bg_color || "#FAFAFA" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg text-white" style={{ backgroundColor: primaryColor }}>
                <Video className="h-4 w-4" />
              </span>
              <h2 className="text-xl sm:text-2xl font-bold" style={{ color: themeSettings?.title_color || undefined }}>
                Vidéos Shorts & Démonstrations
              </h2>
            </div>
            <p className="text-xs sm:text-sm opacity-70">
              Découvrez le produit en action et les avis vidéos authentiques de nos clients.
            </p>
          </div>

          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> {videos.length} vidéo{videos.length > 1 ? "s" : ""} disponible{videos.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* Mobile & Desktop Shorts Scrollable Grid */}
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300">
          {videos.map((vid, idx) => {
            const isPlaying = playingId === vid.id;
            const isMuted = mutedStates[vid.id] ?? false;

            return (
              <div
                key={vid.id}
                className="shrink-0 snap-center w-[220px] sm:w-[260px] aspect-[9/16] max-h-[440px] rounded-2xl overflow-hidden bg-black relative group shadow-lg border border-black/10 transition-transform duration-300 hover:scale-[1.02] cursor-pointer"
                onClick={() => togglePlay(vid.id)}
              >
                <video
                  ref={(el) => (videoRefs.current[vid.id] = el)}
                  src={vid.url}
                  className="w-full h-full object-cover"
                  playsInline
                  loop
                  preload="metadata"
                  onEnded={() => setPlayingId(null)}
                />

                {/* Gradient Overlays */}
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

                {/* Top Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDuration(vid.duration)}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => toggleMute(vid.id, e)}
                    className="h-8 w-8 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-black/80 transition-colors"
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>

                {/* Center Play Button Overlay */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="h-14 w-14 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center border border-white/50 shadow-2xl group-hover:scale-110 transition-transform">
                      <Play className="h-7 w-7 fill-white text-white ml-1" />
                    </div>
                  </div>
                )}

                {/* Bottom Caption & Expand Button */}
                <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-bold text-sm truncate drop-shadow-md">
                      {vid.title || `Shorts #${idx + 1}`}
                    </div>
                    <div className="text-white/80 text-[11px] font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Appuyez pour lire</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveVideoIndex(idx);
                    }}
                    className="h-8 w-8 rounded-full bg-white/20 text-white backdrop-blur-md flex items-center justify-center border border-white/30 hover:bg-white/40 transition-colors shrink-0"
                    title="Plein écran"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Video Modal Viewer */}
      {activeVideoIndex !== null && (
        <Dialog open={activeVideoIndex !== null} onOpenChange={() => setActiveVideoIndex(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden bg-black border-0 rounded-3xl h-[85vh] sm:h-[750px]">
            <DialogTitle className="sr-only">Lecteur vidéo Shorts</DialogTitle>
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              <video
                src={videos[activeVideoIndex]?.url}
                className="w-full h-full object-contain"
                controls
                autoPlay
                playsInline
              />

              <button
                type="button"
                onClick={() => setActiveVideoIndex(null)}
                className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-black/80 transition-colors z-50"
              >
                <X className="h-5 w-5" />
              </button>

              {videos.length > 1 && (
                <div className="absolute bottom-4 left-4 right-4 flex justify-between z-50">
                  <button
                    type="button"
                    disabled={activeVideoIndex === 0}
                    onClick={() => setActiveVideoIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : 0))}
                    className="px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-bold backdrop-blur-md disabled:opacity-30"
                  >
                    ← Précédente
                  </button>
                  <span className="text-white text-xs font-bold self-center">
                    {activeVideoIndex + 1} / {videos.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeVideoIndex === videos.length - 1}
                    onClick={() => setActiveVideoIndex((prev) => (prev !== null ? Math.min(videos.length - 1, prev + 1) : 0))}
                    className="px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-bold backdrop-blur-md disabled:opacity-30"
                  >
                    Suivante →
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
