import React from "react";
import { CategoriesSectionSettings } from "../types";
import { Tag } from "lucide-react";

interface CategoriesSectionProps {
  settings: CategoriesSectionSettings;
  onSelectCategory?: (categoryName: string) => void;
}

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  settings,
  onSelectCategory,
}) => {
  if (!settings.categories || settings.categories.length === 0) return null;

  return (
    <section className="py-10 md:py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {(settings.title || settings.subtitle) && (
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-1">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {settings.categories.map((cat) => (
          <div
            key={cat.id}
            onClick={() => onSelectCategory?.(cat.name)}
            className="group relative bg-slate-900 rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 flex items-end p-4"
          >
            {cat.image_url ? (
              <img
                src={cat.image_url}
                alt={cat.name}
                className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center opacity-80">
                <Tag className="w-8 h-8 text-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="relative z-10 text-white">
              <h3 className="font-bold text-sm sm:text-base group-hover:text-amber-400 transition-colors">
                {cat.name}
              </h3>
              {cat.item_count_label && (
                <span className="text-[11px] text-slate-300 font-medium block">
                  {cat.item_count_label}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
