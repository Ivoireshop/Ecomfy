import React from "react";
import { Button } from "@/components/ui/button";
import { HeroSectionSettings } from "../types";
import { ArrowRight, ShoppingCart, Sparkles } from "lucide-react";

interface HeroSectionProps {
  settings: HeroSectionSettings;
  primaryColor?: string;
  onAction?: (actionType: "checkout" | "products" | "custom", customUrl?: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  settings,
  primaryColor = "#0E7C66",
  onAction,
}) => {
  const alignClass =
    settings.content_alignment === "left"
      ? "text-left items-start"
      : settings.content_alignment === "right"
      ? "text-right items-end"
      : "text-center items-center";

  const heightClass =
    settings.height === "compact"
      ? "py-12 md:py-16 min-h-[300px]"
      : settings.height === "full"
      ? "py-20 md:py-32 min-h-[550px]"
      : "py-16 md:py-24 min-h-[420px]";

  const backgroundStyle: React.CSSProperties = {
    backgroundColor: settings.bg_color || (settings.bg_type === "color" ? "#0F172A" : undefined),
    backgroundImage:
      settings.bg_type === "gradient"
        ? settings.bg_gradient || "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)"
        : settings.bg_type === "image" && settings.bg_image_url
        ? `url(${settings.bg_image_url})`
        : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  const textColor = settings.text_color || "#FFFFFF";

  return (
    <section
      className={`relative overflow-hidden flex flex-col justify-center px-4 sm:px-6 lg:px-8 ${heightClass}`}
      style={backgroundStyle}
    >
      {/* Dark overlay for image background */}
      {settings.bg_type === "image" && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: (settings.overlay_opacity ?? 50) / 100 }}
        />
      )}

      <div className={`relative z-10 max-w-4xl mx-auto flex flex-col ${alignClass} space-y-4 md:space-y-6`}>
        {settings.badge && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold backdrop-blur-md bg-white/10 border border-white/20 shadow-sm"
            style={{ color: textColor }}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{settings.badge}</span>
          </div>
        )}

        {settings.title && (
          <h1
            className="font-space font-bold text-2xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight"
            style={{ color: textColor }}
          >
            {settings.title}
          </h1>
        )}

        {settings.subtitle && (
          <p
            className="font-inter font-medium text-sm sm:text-lg md:text-xl opacity-90 max-w-2xl"
            style={{ color: textColor }}
          >
            {settings.subtitle}
          </p>
        )}

        {settings.description && (
          <p
            className="font-inter text-xs sm:text-sm opacity-80 max-w-xl line-clamp-3"
            style={{ color: textColor }}
          >
            {settings.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2 sm:pt-4">
          {settings.primary_button_text && (
            <Button
              size="lg"
              className="h-11 sm:h-13 px-6 sm:px-8 text-sm sm:text-base font-semibold rounded-xl shadow-lg transition-transform hover:scale-105"
              style={{
                backgroundColor: settings.primary_button_bg || primaryColor,
                color: "#FFFFFF",
              }}
              onClick={() =>
                onAction?.(
                  settings.primary_button_link_type,
                  settings.primary_button_custom_url
                )
              }
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {settings.primary_button_text}
            </Button>
          )}

          {settings.secondary_button_text && (
            <Button
              size="lg"
              variant="outline"
              className="h-11 sm:h-13 px-6 sm:px-8 text-sm sm:text-base font-semibold rounded-xl backdrop-blur-sm bg-white/10 hover:bg-white/20 border-white/30 text-white"
              onClick={() =>
                onAction?.(
                  settings.secondary_button_link_type || "products",
                  settings.secondary_button_custom_url
                )
              }
            >
              {settings.secondary_button_text}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
