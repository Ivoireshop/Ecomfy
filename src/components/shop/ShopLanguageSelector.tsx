import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SHOP_LANGUAGES, getLangFlag, getLangLabel } from "@/lib/shopLanguages";

interface Props {
  value: string;
  onChange: (lang: string) => void;
  enabled?: string[];
  size?: "sm" | "default";
}

export function ShopLanguageSelector({ value, onChange, enabled, size = "sm" }: Props) {
  const options = enabled?.length
    ? SHOP_LANGUAGES.filter((l) => enabled.includes(l.code))
    : SHOP_LANGUAGES;
  if (options.length <= 1) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size} className="gap-1.5">
          <Globe className="h-4 w-4" />
          <span className="text-sm">{getLangFlag(value)} {getLangLabel(value)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => onChange(l.code)}
            className={l.code === value ? "font-semibold" : ""}
          >
            <span className="mr-2">{l.flag}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}