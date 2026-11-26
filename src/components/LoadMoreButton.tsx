import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  hasMore: boolean;
  loading: boolean;
  /** Vrai quand la dernière tentative a échoué. */
  failed?: boolean;
  onClick: () => void;
}

export function LoadMoreButton({ hasMore, loading, failed, onClick }: Props) {
  if (!hasMore) return null;
  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      {failed && <p role="alert" className="text-xs text-destructive">La suite n'a pas pu être chargée.</p>}
      <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={loading} className="gap-2">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {failed ? "Réessayer" : "Charger plus"}
      </Button>
    </div>
  );
}
