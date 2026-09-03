// src/components/shop/SmartVariantSelector.tsx
// Smart Horizontal Variant & Sub-Option Picker for Ecomfy Product Pages.
// Automatically parses grouped options like "Blanc (S, M, L, XL, 2XL, 3XL)" or "S, M, L, XL, 2XL"
// into compact, horizontal, high-converting clickable pills.

import React, { useMemo } from "react";
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
}

interface ParsedOptionItem {
  raw: string;
  mainLabel: string;
  subOptions: string[];
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

  // Check if options have format "Main (sub1, sub2, sub3)" or "Main: sub1, sub2"
  const bracketRegex = /^([^(:]+)\s*[\(:]([^)]+)[\)]?$/;
  let matchesBracketCount = 0;
  const parsedItems: ParsedOptionItem[] = [];

  for (const opt of options) {
    const trimmed = (opt || "").trim();
    const match = trimmed.match(bracketRegex);
    if (match) {
      matchesBracketCount++;
      const mainLabel = match[1].trim();
      const rawSub = match[2].trim();
      const subOptions = rawSub
        .split(/[,;\/\s-]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      parsedItems.push({ raw: trimmed, mainLabel, subOptions });
    } else {
      parsedItems.push({ raw: trimmed, mainLabel: trimmed, subOptions: [] });
    }
  }

  // If at least one option matches the bracket sub-option pattern
  if (matchesBracketCount > 0) {
    return { isSubVariantGroup: true, isSplitList: false, parsedItems, standaloneList: [] };
  }

  // Check if a single option string is actually a horizontal list like "S, M, L, XL, 2XL, 3XL" or "S / M / L / XL"
  if (options.length === 1 && typeof options[0] === "string") {
    const singleStr = options[0].trim();
    if (singleStr.includes(",") || singleStr.includes("/") || (singleStr.includes("-") && !singleStr.includes(" "))) {
      const splitValues = singleStr
        .split(/[,;\/]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (splitValues.length > 1) {
        return { isSubVariantGroup: false, isSplitList: true, parsedItems: [], standaloneList: splitValues };
      }
    }
  }

  // Standard flat option list
  return { isSubVariantGroup: false, isSplitList: false, parsedItems: [], standaloneList: options.map(o => o.trim()).filter(Boolean) };
}

export const SmartVariantSelector: React.FC<SmartVariantSelectorProps> = ({
  variants,
  selectedVariants,
  onChange,
  primaryColor = "#2563eb",
  className = "space-y-4",
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
          const selectedMainRaw = selectedVariants[groupName + "_main"] || parsedItems[0]?.mainLabel || "";
          const activeItem = parsedItems.find((p) => p.mainLabel === selectedMainRaw) || parsedItems[0];
          const selectedSub = selectedVariants[groupName + "_sub"] || activeItem?.subOptions[0] || "";

          return (
            <div key={groupIdx} className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-gray-50/80 border border-gray-200/80">
              {/* Level 1: Main Option Selection (e.g. Couleur) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <span>{groupName}</span>
                    {selectedMainRaw && (
                      <span className="font-semibold text-gray-600 font-mono">: {selectedMainRaw}</span>
                    )}
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2">
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
                            onChange(groupName, `${item.mainLabel} — Taille: ${firstSub}`);
                          } else {
                            onChange(groupName, item.mainLabel);
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 ${
                          isActive
                            ? "shadow-sm scale-[1.02] border-2 text-white"
                            : "bg-white border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-100/60"
                        }`}
                        style={isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                      >
                        {isActive && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        <span>{item.mainLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Level 2: Sub-Option / Size Selection (e.g. Taille) */}
              {activeItem && activeItem.subOptions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-gray-200/60">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-1.5">
                      <span>Taille disponible pour {activeItem.mainLabel}</span>
                      {selectedSub && (
                        <span className="font-bold text-emerald-600 font-mono">: {selectedSub}</span>
                      )}
                    </Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeItem.subOptions.map((sub, sIdx) => {
                      const isSubActive = selectedSub === sub;
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => {
                            onChange(groupName + "_sub", sub);
                            onChange(groupName, `${activeItem.mainLabel} — Taille: ${sub}`);
                          }}
                          className={`min-w-[42px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1 ${
                            isSubActive
                              ? "shadow-md scale-105 border-2 text-white"
                              : "bg-white border border-gray-300 text-gray-800 hover:border-gray-400 hover:bg-gray-100"
                          }`}
                          style={isSubActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                        >
                          {isSubActive && <Check className="w-3 h-3 text-white stroke-[3]" />}
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

        // CASE 2: Single line split (e.g. "S, M, L, XL, 2XL, 3XL")
        if (isSplitList) {
          const selectedVal = selectedVariants[groupName] || standaloneList[0] || "";
          return (
            <div key={groupIdx} className="space-y-2 p-3.5 rounded-2xl bg-gray-50/80 border border-gray-200/80">
              <Label className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <span>{groupName}</span>
                {selectedVal && <span className="font-bold text-emerald-600 font-mono">: {selectedVal}</span>}
              </Label>
              <div className="flex flex-wrap gap-2">
                {standaloneList.map((optVal, optIdx) => {
                  const isActive = selectedVal === optVal;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => onChange(groupName, optVal)}
                      className={`min-w-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                        isActive
                          ? "shadow-md scale-105 border-2 text-white"
                          : "bg-white border border-gray-300 text-gray-800 hover:border-gray-400 hover:bg-gray-100"
                      }`}
                      style={isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                    >
                      {isActive && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      <span>{optVal}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        // CASE 3: Standard flat options list
        const selectedVal = selectedVariants[groupName] || standaloneList[0] || "";
        return (
          <div key={groupIdx} className="space-y-2">
            <Label className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span>{groupName}</span>
              {selectedVal && <span className="font-bold text-gray-600 font-mono">: {selectedVal}</span>}
            </Label>
            <div className="flex flex-wrap gap-2">
              {standaloneList.map((optVal, optIdx) => {
                const isActive = selectedVal === optVal;
                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => onChange(groupName, optVal)}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 ${
                      isActive
                        ? "shadow-sm scale-[1.02] border-2 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-100/60"
                    }`}
                    style={isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                  >
                    {isActive && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
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
