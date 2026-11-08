import * as React from "react";
import { Button as BaseButton, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Bouton ConnectUs : le Button du projet, avec des états de survol cohérents.
 *
 * Le thème passe `outline` et `ghost` en fond vert + texte blanc au survol, et fait « sauter » chaque bouton
 * (translation + icône agrandie). Sur les couleurs propres à ConnectUs cela donnait du blanc sur fond clair
 * (icônes invisibles) ou un bouton vert qui virait au noir. Ici :
 *  - le texte garde sa couleur au survol (sauf si le bouton prévoit déjà la sienne) ;
 *  - `ghost` / `outline` sans fond de survol propre prennent un gris clair ;
 *  - un bouton plein sans survol propre s'assombrit au lieu de retomber sur la couleur primaire ;
 *  - pas de saut ni de zoom d'icône.
 */
const TEXT_COLOR = /(?:^|\s)(text-(?:white|black|(?:slate|rose|emerald|teal|amber|red|purple|blue|indigo|sky)-\d{2,3}|\[#[0-9a-fA-F]{3,8}\]))(?=\s|$)/g;
const SOLID_HOVER: Record<string, string> = {
  "bg-[#0E7C66]": "hover:bg-[#0A6352]",
  "bg-slate-900": "hover:bg-slate-800",
  "bg-emerald-700": "hover:bg-emerald-800",
  "bg-rose-600": "hover:bg-rose-700",
  "bg-white": "hover:bg-emerald-50",
};

function hoverClasses(variant: ButtonProps["variant"], className = ""): string {
  const extra: string[] = ["hover:translate-y-0", "hover:[&_svg]:scale-100"];
  const hasHoverBg = /(?:^|\s)hover:bg-/.test(className);
  const hasHoverText = /(?:^|\s)hover:text-/.test(className);

  if (variant === "ghost" || variant === "outline") {
    if (!hasHoverBg) extra.push(variant === "outline" ? "hover:bg-slate-50" : "hover:bg-slate-100");
    if (!hasHoverText) {
      const colors = [...className.matchAll(TEXT_COLOR)].map((m) => m[1]);
      extra.push(colors.length ? `hover:${colors[colors.length - 1]}` : "hover:text-slate-900");
    }
  } else if (!variant || variant === "default") {
    if (!hasHoverBg) {
      const solid = Object.keys(SOLID_HOVER).find((bg) => className.split(/\s+/).includes(bg));
      if (solid) extra.push(SOLID_HOVER[solid]);
    }
  }
  return extra.join(" ");
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ variant, className, ...props }, ref) => (
  <BaseButton ref={ref} variant={variant} className={cn(hoverClasses(variant, className), className)} {...props} />
));
Button.displayName = "ConnectUsButton";
