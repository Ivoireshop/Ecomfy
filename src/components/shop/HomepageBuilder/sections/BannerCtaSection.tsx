import React, { useState, useEffect } from "react";
import { BannerCtaSectionSettings } from "../types";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Flame, Clock } from "lucide-react";

interface BannerCtaSectionProps {
  settings: BannerCtaSectionSettings;
  primaryColor?: string;
  onAction?: (actionType: "checkout" | "products") => void;
}

export const BannerCtaSection: React.FC<BannerCtaSectionProps> = ({
  settings,
  primaryColor = "#0E7C66",
  onAction,
}) => {
  const [timeLeft, setTimeLeft] = useState({ h: 23, m: 59, s: 59 });

  useEffect(() => {
    if (!settings.show_countdown) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.s > 0) return { ...prev, s: prev.s - 1 };
        if (prev.m > 0) return { ...prev, m: 59, s: 59 };
        if (prev.h > 0) return { ...prev, h: prev.h - 1, m: 59, s: 59 };
        return { h: 0, m: 0, s: 0 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [settings.show_countdown]);

  const bgColor = settings.bg_color || primaryColor;
  const textColor = settings.text_color || "#FFFFFF";

  return (
    <section
      className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 shadow-inner my-6"
      style={{ backgroundColor: bgColor }}
    >
      <div className="max-w-4xl mx-auto text-center space-y-4 md:space-y-6">
        {settings.badge && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm mx-auto">
            <Flame className="w-4 h-4 text-amber-300 animate-bounce" />
            <span>{settings.badge}</span>
          </div>
        )}

        {settings.title && (
          <h2
            className="font-space font-bold text-2xl sm:text-4xl text-white tracking-tight"
            style={{ color: textColor }}
          >
            {settings.title}
          </h2>
        )}

        {settings.description && (
          <p
            className="font-inter text-sm sm:text-base opacity-90 max-w-xl mx-auto"
            style={{ color: textColor }}
          >
            {settings.description}
          </p>
        )}

        {settings.show_countdown && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/90 mr-2">
              <Clock className="w-4 h-4" />
              <span>Offre expire dans :</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono font-bold text-sm sm:text-base">
              <span className="bg-white/20 backdrop-blur-md text-white px-2.5 py-1.5 rounded-lg border border-white/20">
                {String(timeLeft.h).padStart(2, "0")}h
              </span>
              <span>:</span>
              <span className="bg-white/20 backdrop-blur-md text-white px-2.5 py-1.5 rounded-lg border border-white/20">
                {String(timeLeft.m).padStart(2, "0")}m
              </span>
              <span>:</span>
              <span className="bg-white/20 backdrop-blur-md text-white px-2.5 py-1.5 rounded-lg border border-white/20">
                {String(timeLeft.s).padStart(2, "0")}s
              </span>
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button
            size="lg"
            className="h-12 sm:h-14 px-8 text-base font-bold rounded-2xl bg-white text-slate-900 hover:bg-slate-100 shadow-xl hover:scale-105 transition-all"
            onClick={() => onAction?.(settings.button_action || "checkout")}
          >
            <ShoppingCart className="w-5 h-5 mr-2 text-slate-900" />
            {settings.button_text || "Profiter de l'offre"}
          </Button>
        </div>
      </div>
    </section>
  );
};
