import React, { useState, useRef } from "react";
import { AudioTestimonialsSectionSettings } from "../types";
import { Play, Pause, Mic, Volume2, CheckCircle2, User } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AudioTestimonialsSectionProps {
  settings: AudioTestimonialsSectionSettings;
  primaryColor?: string;
}

export const AudioTestimonialsSection: React.FC<AudioTestimonialsSectionProps> = ({
  settings,
  primaryColor = "#0E7C66",
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const items = settings.items || [];
  if (items.length === 0) return null;

  const togglePlay = (id: string) => {
    const el = audioRefs.current[id];
    if (!el) return;

    if (el.paused) {
      Object.entries(audioRefs.current).forEach(([aId, aEl]) => {
        if (aId !== id && aEl) aEl.pause();
      });
      el.play().catch(console.warn);
      setPlayingId(id);
    } else {
      el.pause();
      setPlayingId(null);
    }
  };

  return (
    <section className="py-12 md:py-16 px-4 md:px-8 border-y border-slate-200 bg-slate-50" style={{ backgroundColor: settings.bg_color || undefined }}>
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto" style={{ color: primaryColor }}>
            <Mic className="w-5 h-5" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 font-space">
            {settings.title || "Témoignages Audio de nos Clients"}
          </h2>
          {settings.subtitle && (
            <p className="text-slate-600 text-xs md:text-sm">
              {settings.subtitle}
            </p>
          )}
        </div>

        {/* Audio Testimonials Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {items.map((item) => {
            const isPlaying = playingId === item.id;

            return (
              <Card
                key={item.id}
                className="p-5 rounded-2xl bg-white border-slate-200/80 shadow-sm hover:shadow-md transition-all flex items-center gap-4"
              >
                {/* Client Avatar */}
                <div className="relative shrink-0">
                  {item.author_avatar ? (
                    <img
                      src={item.author_avatar}
                      alt={item.author_name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center font-bold text-lg">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Audio Info & Player Controls */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm truncate">{item.author_name}</h4>
                      {item.author_role && (
                        <p className="text-[11px] text-slate-400 font-medium truncate">{item.author_role}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Vocal Vérifié
                    </span>
                  </div>

                  {/* Audio Wave Bar Player */}
                  <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200/70">
                    <button
                      onClick={() => togglePlay(item.id)}
                      className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                    </button>

                    {/* Fake Waveform visualizer */}
                    <div className="flex-1 flex items-center gap-0.5 h-6">
                      {[40, 75, 55, 90, 60, 30, 85, 100, 45, 65, 80, 50, 95, 35, 70, 85, 60, 40].map((h, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            isPlaying ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>

                    <audio
                      ref={(el) => (audioRefs.current[item.id] = el)}
                      src={item.audio_url}
                      onEnded={() => setPlayingId(null)}
                      preload="metadata"
                      className="hidden"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
