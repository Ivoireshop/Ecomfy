import React from "react";
import { TestimonialsSectionSettings } from "../types";
import { Star, Quote } from "lucide-react";
import { Card } from "@/components/ui/card";

interface TestimonialsSectionProps {
  settings: TestimonialsSectionSettings;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({ settings }) => {
  if (!settings.items || settings.items.length === 0) return null;

  return (
    <section
      className="py-12 md:py-18 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: settings.bg_color || "#F8FAFC" }}
    >
      <div className="max-w-7xl mx-auto">
        {(settings.title || settings.subtitle) && (
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            {settings.title && (
              <h2 className="font-space font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                {settings.title}
              </h2>
            )}
            {settings.subtitle && (
              <p className="font-inter text-slate-500 text-sm">{settings.subtitle}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settings.items.map((item) => (
            <Card
              key={item.id}
              className="p-6 rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between bg-white"
            >
              <Quote className="w-8 h-8 text-slate-200 absolute top-4 right-4" />
              <div className="space-y-3 relative z-10">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: item.rating || 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="font-inter text-slate-700 text-sm leading-relaxed italic">
                  "{item.content}"
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center gap-3 mt-4">
                {item.author_avatar ? (
                  <img
                    src={item.author_avatar}
                    alt={item.author_name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#0E7C66]/10 text-[#0E7C66] font-bold text-sm flex items-center justify-center shrink-0">
                    {item.author_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">{item.author_name}</h4>
                  {item.author_role && (
                    <span className="text-xs text-slate-500 block">{item.author_role}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
