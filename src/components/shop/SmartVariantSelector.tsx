// src/components/shop/SmartVariantSelector.tsx
// Smart Horizontal Variant & Sub-Option Picker for Ecomfy Product Pages.
// Automatically parses grouped options like "Blanc (S, M, L, XL, 2XL, 3XL)" or "M-XL-XXL-XXXL" or "S, M, L, XL, 2XL"
// into compact, horizontal, high-converting clickable pills.

import React from "react";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

interface SmartVariantGroup {
  name: string;
  options: string[];
}

interface SmartVariantSelectorProps {
  variants: SmartVariantGroup[];
  selectedVariants: Record<string, string>;
  onChange: (variantKey: string, value: string) => void;
  primaryColor?: string;
  className?: string;
  /** Met la première option en avant tant que le client n'a rien choisi (défaut). À désactiver pour exiger un choix explicite. */
  preselect?: boolean;
}

interface ParsedOptionItem {
  raw: string;
  mainLabel: string;
  subOptions: string[];
}

// Jetons de taille (S, XL, 2XL, 40…) : seuls ceux-ci peuvent s'écrire « M-XL-XXL » ou « S/M/L ». Un trait d'union
// ou une barre dans « Noir-Mat », « T-shirt » ou « iPhone 13/14 » appartient au libellé et ne doit pas le couper.
const SIZE_TOKEN = /^(?:x{1,3}[sl]|[2-5]x[sl]|[sml]|xl|xs|\d{1,3})$/i;

function splitRange(value: string): string[] {
  const parts = value.split(/[/|-]+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 && parts.every((p) => SIZE_TOKEN.test(p)) ? parts : [value.trim()];
}

function splitSubOptions(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(splitRange);
}

export function parseVariantOptions(options: string[]): {
  isSubVariantGroup: boolean;
  isSplitList: boolean;
  parsedItems: ParsedOptionItem[];
  standaloneList: string[];
} {
  if (!Array.isArray(options) || options.length === 0) {
    return { isSubVariantGroup: false, isSplitList: false, parsedItems: [], standaloneList: [] };
  }

  // 1. Check if options have format "Main (sub1, sub2, sub3)" or "Main: sub1, sub2"
  const bracketRegex = /^([^(:]+)\s*[(:]([^)]+)[)]?$/;
  let matchesBracketCount = 0;
  const parsedItems: ParsedOptionItem[] = [];

  for (const opt of options) {
    const trimmed = (opt || "").trim();
    const match = trimmed.match(bracketRegex);
    if (match) {
      matchesBracketCount++;
      const mainLabel = match[1].trim();
      const subOptions = splitSubOptions(match[2].trim());
      parsedItems.push({ raw: trimmed, mainLabel, subOptions });
    } else {
      parsedItems.push({ raw: trimmed, mainLabel: trimmed, subOptions: [] });
    }
  }

  // If at least one option matches the bracket sub-option pattern
  if (matchesBracketCount > 0) {
    return { isSubVariantGroup: true, isSplitList: false, parsedItems, standaloneList: [] };
  }

  // 2. Check string delimiter splitting (e.g. "M-XL-XXL-XXXL" or "M - XL - XXL - XXXL" or "S, M, L, XL")
  const allSplitItems: string[] = [];
  let containsDelimiters = false;

  for (const opt of options) {
    const trimmed = (opt || "").trim();
    if (!trimmed) continue;
    const parts = splitSubOptions(trimmed);
    if (parts.length > 1) {
      containsDelimiters = true;
      allSplitItems.push(...parts);
    } else {
      allSplitItems.push(trimmed);
    }
  }

  if (containsDelimiters && allSplitItems.length > 0) {
    return { isSubVariantGroup: false, isSplitList: true, parsedItems: [], standaloneList: allSplitItems };
  }

  // 3. Standard flat option list
  return { isSubVariantGroup: false, isSplitList: false, parsedItems: [], standaloneList: options.map(o => o.trim()).filter(Boolean) };
}

// Valeur enregistrée pour un choix « Couleur + taille » : « Blanc — S ». Le libellé « Taille » n'est plus imposé :
// le sous-niveau peut être un volume, une pointure, un modèle…
const combinedLabel = (main: string, sub: string) => `${main} — ${sub}`;

/**
 * Sélection correspondant à ce que le sélecteur met en avant par défaut (première option de chaque groupe).
 * Sans elle, le client voyait « S » coché alors que la commande partait sans taille : l'état n'était jamais enregistré.
 */
export function getDefaultVariantSelection(variants: SmartVariantGroup[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(variants)) return out;
  for (const group of variants) {
    const name = (group?.name || "").trim();
    if (!name || !Array.isArray(group.options) || group.options.length === 0) continue;
    const parsed = parseVariantOptions(group.options);
    if (parsed.isSubVariantGroup) {
      const first = parsed.parsedItems[0];
      if (!first) continue;
      out[name + "_main"] = first.mainLabel;
      const sub = first.subOptions[0];
      if (sub) {
        out[name + "_sub"] = sub;
        out[name] = combinedLabel(first.mainLabel, sub);
      } else {
        out[name] = first.mainLabel;
      }
    } else if (parsed.standaloneList[0]) {
      out[name] = parsed.standaloneList[0];
    }
  }
  return out;
}

export const SmartVariantSelector: React.FC<SmartVariantSelectorProps> = ({
  variants,
  selectedVariants,
  onChange,
  primaryColor = "#2563eb",
  className = "space-y-4",
  preselect = true,
}) => {
  if (!Array.isArray(variants) || variants.length === 0) return null;

  return (
    <div className={className}>
      {variants.map((group, groupIdx) => {
        if (!group?.name || !Array.isArray(group?.options) || group.options.length === 0) {
          return null;
        }

        const groupName = group.name.trim();
        const { isSubVariantGroup, isSplitList, parsedItems, standaloneList } = parseVariantOptions(group.options);

        // CASE 1: Multi-level sub-variants (e.g. Couleur = Blanc, Taille = S, M, L, XL, 2XL)
        if (isSubVariantGroup) {
          const selectedMainRaw = selectedVariants[groupName + "_main"] || (preselect ? parsedItems[0]?.mainLabel : "") || "";
          const activeItem = parsedItems.find((p) => p.mainLabel === selectedMainRaw) || (preselect ? parsedItems[0] : undefined);
          const selectedSub = selectedVariants[groupName + "_sub"] || (preselect ? activeItem?.subOptions[0] : "") || "";

          return (
            <div key={groupIdx} className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-gray-50/80 border border-gray-200/80">
              {/* Level 1: Main Option Selection (e.g. Couleur) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <span>{groupName}</span>
                    {selectedMainRaw && (
                      <span className="font-bold text-gray-600 font-mono">: {selectedMainRaw}</span>
                    )}
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {parsedItems.map((item, idx) => {
                    const isActive = selectedMainRaw === item.mainLabel;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onChange(groupName + "_main", item.mainLabel);
                          const firstSub = item.subOptions[0] || "";
                          if (firstSub) {
                            onChange(groupName + "_sub", firstSub);
                            onChange(groupName, combinedLabel(item.mainLabel, firstSub));
                          } else {
                            onChange(groupName, item.mainLabel);
                          }
                        }}
                        className={`px-4 h-10 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 shadow-sm active:scale-95 ${
                          isActive
                            ? "shadow-md scale-[1.03] border-2 text-white font-extrabold"
                            : "bg-white border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-100/60"
                        }`}
                        style={isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        {isActive && <Check className="w-4 h-4 text-white stroke-[3]" />}
                        <span>{item.mainLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Level 2: Sub-Option / Size Selection (e.g. Taille) */}
              {activeItem && activeItem.subOptions.length > 0 && (
                <div className="space-y-1.5 pt-2.5 border-t border-gray-200/60">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-1.5">
                      <span>Choix pour {activeItem.mainLabel}</span>
                      {selectedSub && (
                        <span className="font-extrabold text-emerald-600 font-mono">: {selectedSub}</span>
                      )}
                    </Label>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {activeItem.subOptions.map((sub, sIdx) => {
                      const isSubActive = selectedSub === sub;
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => {
                            onChange(groupName + "_sub", sub);
                            onChange(groupName, combinedLabel(activeItem.mainLabel, sub));
                          }}
                          className={`min-w-[48px] h-10 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                            isSubActive
                              ? "shadow-md scale-105 border-2 text-white font-extrabold"
                              : "bg-white border border-gray-300 text-gray-800 hover:border-gray-400 hover:bg-gray-100"
                          }`}
                          style={isSubActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                        >
                          {isSubActive && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          <span>{sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // CASE 2: Single line split (e.g. "M-XL-XXL-XXXL" or "S, M, L, XL, 2XL, 3XL")
        if (isSplitList) {
          const selectedVal = selectedVariants[groupName] || (preselect ? standaloneList[0] : "") || "";
          return (
            <div key={groupIdx} className="space-y-2 p-3.5 rounded-2xl bg-gray-50/80 border border-gray-200/80">
              <Label className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
                <span>{groupName}</span>
                {selectedVal && <span className="font-extrabold text-emerald-600 font-mono">: {selectedVal}</span>}
              </Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {standaloneList.map((optVal, optIdx) => {
                  const isActive = selectedVal === optVal;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => onChange(groupName, optVal)}
                      className={`min-w-[48px] h-10 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                        isActive
                          ? "shadow-md scale-[1.03] border-2 text-white font-extrabold"
                          : "bg-white border border-gray-300 text-gray-800 hover:border-gray-400 hover:bg-gray-100"
                      }`}
                      style={isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                    >
                      {isActive && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      <span>{optVal}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        // CASE 3: Standard flat options list
        const selectedVal = selectedVariants[groupName] || (preselect ? standaloneList[0] : "") || "";
        return (
          <div key={groupIdx} className="space-y-2 p-3.5 rounded-2xl bg-gray-50/80 border border-gray-200/80">
            <Label className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
              <span>{groupName}</span>
              {selectedVal && <span className="font-extrabold text-emerald-600 font-mono">: {selectedVal}</span>}
            </Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {standaloneList.map((optVal, optIdx) => {
                const isActive = selectedVal === optVal;
                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => onChange(groupName, optVal)}
                    className={`min-w-[48px] h-10 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                      isActive
                        ? "shadow-md scale-[1.03] border-2 text-white font-extrabold"
                        : "bg-white border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-100/60"
                    }`}
                    style={isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                  >
                    {isActive && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    <span>{optVal}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
