import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageCount, pageNumbers } from "@/lib/pagination";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  /** « dark » sur les écrans à fond sombre forcé, que le thème ne connaît pas. */
  tone?: "default" | "dark";
}

/** Barre « 26–50 sur 312 » et numéros de page. Rien n'est affiché tant que tout tient sur une page. */
export function ListPagination({ page, pageSize, total, onPageChange, disabled, className, tone = "default" }: Props) {
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const dark = tone === "dark";
  const idle = dark ? "text-slate-300 hover:bg-slate-800 hover:text-white" : "";
  const current = dark ? "border-emerald-500/60 bg-emerald-500/15 text-white hover:bg-emerald-500/25 hover:text-white" : "";
  const muted = dark ? "text-slate-400" : "text-muted-foreground";

  return (
    // La marge droite évite le bouton d'aide flottant en bas d'écran.
    <nav aria-label="Pagination" className={cn("flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 sm:pr-16", className)}>
      <p className={cn("text-xs", muted)} aria-live="polite">
        {first.toLocaleString("fr-FR")}–{last.toLocaleString("fr-FR")} sur {total.toLocaleString("fr-FR")}
      </p>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className={cn("h-8 w-8", idle)} aria-label="Page précédente"
          disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageNumbers(page, pages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} aria-hidden className={cn("px-1 text-xs", muted)}>…</span>
          ) : (
            <Button key={n} type="button" size="sm" variant={n === page ? "outline" : "ghost"}
              className={cn("h-8 min-w-8 px-2 text-xs", n === page ? current : idle)}
              aria-current={n === page ? "page" : undefined}
              aria-label={`Page ${n}`} disabled={disabled} onClick={() => onPageChange(n)}>
              {n}
            </Button>
          ),
        )}
        <Button type="button" variant="ghost" size="icon" className={cn("h-8 w-8", idle)} aria-label="Page suivante"
          disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
