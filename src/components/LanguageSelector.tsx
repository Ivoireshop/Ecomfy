import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { SUPPORTED_LANGUAGES, type SupportedLang } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Props {
  variant?: "ghost" | "outline";
  showLabel?: boolean;
}

export function LanguageSelector({ variant = "ghost", showLabel = false }: Props) {
  const { i18n, t } = useTranslation();
  const { user, isReady } = useAuthReady();

  // Hydrate from profile once user is ready
  useEffect(() => {
    if (!isReady || !user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("id", user.id)
        .maybeSingle();
      const lng = (data as any)?.preferred_language as string | null;
      if (lng && lng !== i18n.language) i18n.changeLanguage(lng);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, user?.id]);

  const handleChange = async (code: SupportedLang) => {
    await i18n.changeLanguage(code);
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ preferred_language: code } as any)
        .eq("id", user.id);
    }
  };

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={showLabel ? "default" : "icon"} aria-label={t("common.language")}>
          <Globe className="h-4 w-4" />
          {showLabel && <span className="ml-2">{current.flag} {current.label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className={lang.code === i18n.language ? "font-semibold" : ""}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}