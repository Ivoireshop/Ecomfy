import React from "react";
import { FeaturesSectionSettings } from "../types";
import { Truck, ShieldCheck, PhoneCall, Award, Zap, Star, Clock, RefreshCw } from "lucide-react";

interface FeaturesSectionProps {
  settings: FeaturesSectionSettings;
  primaryColor?: string;
}

const ICON_MAP = {
  truck: Truck,
  shield: ShieldCheck,
  phone: PhoneCall,
  award: Award,
  zap: Zap,
  star: Star,
  clock: Clock,
  refresh: RefreshCw,
};

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({
  settings,
  primaryColor = "#0E7C66",
}) => {
  if (!settings.items || settings.items.length === 0) return null;

  return (
    <section
      className="py-10 md:py-14 px-4 sm:px-6 lg:px-8 border-y border-slate-100"
      style={{ backgroundColor: settings.bg_color || "#F8FAFC" }}
    >
      <div className="max-w-7xl mx-auto">
        {settings.title && (
          <h2 className="font-space font-bold text-xl sm:text-2xl text-center text-slate-900 mb-8">
            {settings.title}
          </h2>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {settings.items.map((item) => {
            const IconComp = ICON_MAP[item.icon_name] || Truck;
            return (
              <div
                key={item.id}
                className="flex items-start gap-4 p-4 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:shadow-md"
                style={{ backgroundColor: settings.card_bg || "#FFFFFF" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  <IconComp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-slate-900 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
