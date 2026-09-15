import React, { useState } from "react";
import { FaqSectionSettings } from "../types";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqSectionProps {
  settings: FaqSectionSettings;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ settings }) => {
  const [openId, setOpenId] = useState<string | null>(
    settings.items?.[0]?.id || null
  );

  if (!settings.items || settings.items.length === 0) return null;

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {(settings.title || settings.subtitle) && (
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          {settings.title && (
            <h2 className="font-space font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight flex items-center justify-center gap-2">
              <HelpCircle className="w-6 h-6 text-[#0E7C66]" />
              {settings.title}
            </h2>
          )}
          {settings.subtitle && (
            <p className="font-inter text-slate-500 text-sm">{settings.subtitle}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {settings.items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all"
            >
              <button
                type="button"
                className="w-full text-left px-5 py-4 font-semibold text-sm sm:text-base text-slate-900 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                onClick={() => setOpenId(isOpen ? null : item.id)}
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${
                    isOpen ? "rotate-180 text-[#0E7C66]" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-slate-100 pt-3">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
