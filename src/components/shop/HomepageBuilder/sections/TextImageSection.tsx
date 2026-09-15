import React from "react";
import { TextImageSectionSettings } from "../types";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface TextImageSectionProps {
  settings: TextImageSectionSettings;
  primaryColor?: string;
  onAction?: (type: "products" | "custom", customUrl?: string) => void;
}

export const TextImageSection: React.FC<TextImageSectionProps> = ({
  settings,
  primaryColor = "#0E7C66",
  onAction,
}) => {
  const isLeft = settings.image_position === "left";

  return (
    <section
      className="py-12 md:py-20 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: settings.bg_color || "transparent" }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
        <div className={`space-y-4 ${isLeft ? "md:order-2" : "md:order-1"}`}>
          {settings.subtitle && (
            <span
              className="text-xs sm:text-sm font-semibold uppercase tracking-wider block"
              style={{ color: primaryColor }}
            >
              {settings.subtitle}
            </span>
          )}
          {settings.title && (
            <h2 className="font-space font-bold text-2xl sm:text-4xl text-slate-900 leading-tight">
              {settings.title}
            </h2>
          )}
          {settings.description && (
            <p className="font-inter text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
              {settings.description}
            </p>
          )}

          {settings.button_text && (
            <div className="pt-2">
              <Button
                size="lg"
                className="h-11 px-6 rounded-xl font-semibold text-sm shadow-md"
                style={{ backgroundColor: primaryColor, color: "#FFFFFF" }}
                onClick={() =>
                  onAction?.(
                    settings.button_link_type || "products",
                    settings.button_custom_url
                  )
                }
              >
                {settings.button_text}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>

        <div className={`relative ${isLeft ? "md:order-1" : "md:order-2"}`}>
          <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-slate-100 bg-slate-100">
            {settings.image_url ? (
              <img
                src={settings.image_url}
                alt={settings.title || "Visuel"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
                Image illustrative
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
