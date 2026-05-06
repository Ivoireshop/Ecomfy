import { Lock } from "lucide-react";

interface Props {
  primaryColor?: string;
  compact?: boolean;
}

export function PreviewLockedNotice({ primaryColor = "#111827", compact = false }: Props) {
  return (
    <div
      className={`rounded-xl border-2 border-dashed p-4 text-center ${compact ? "" : "sm:p-5"}`}
      style={{ borderColor: primaryColor + "40", backgroundColor: primaryColor + "08" }}
    >
      <div className="flex items-center justify-center gap-2 mb-1">
        <Lock className="h-4 w-4" style={{ color: primaryColor }} />
        <span className="font-semibold text-sm" style={{ color: primaryColor }}>
          Aperçu — boutique non activée
        </span>
      </div>
      <p className="text-xs text-gray-600">
        Le formulaire de commande s'affichera pour vos clients dès l'activation de la boutique (2 $).
      </p>
    </div>
  );
}