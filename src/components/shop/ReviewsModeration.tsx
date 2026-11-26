import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Loader2, Check, X, Trash2, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ListPagination } from "@/components/ListPagination";
import { usePagedList } from "@/hooks/usePagedList";
import { readPage } from "@/lib/pagination";

type Status = "pending" | "approved" | "rejected";

interface Review {
  id: string;
  product_id: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  comment: string;
  status: Status;
  created_at: string;
  productName?: string;
}

const STATUSES: Status[] = ["pending", "approved", "rejected"];
const REVIEWS_PAGE_SIZE = 20;

export function ReviewsModeration({ shopId, onPendingCountChange }: { shopId: string; onPendingCountChange?: (count: number) => void }) {
  const [tab, setTab] = useState<Status>("pending");
  const [counts, setCounts] = useState<Record<Status, number> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { rows: reviews, total, page, pageSize, setPage, loading, error: loadError, reload } = usePagedList<Review>({
    filterKey: `${shopId}|${tab}`,
    pageSize: REVIEWS_PAGE_SIZE,
    fetchPage: async ({ page, pageSize }) => {
      const result = await readPage<Review>(page, pageSize, (from, to) =>
        supabase.from("product_reviews").select("*", { count: "exact" })
          .eq("shop_id", shopId).eq("status", tab)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(from, to));
      // Seuls les noms des produits de la page sont lus.
      const ids = [...new Set(result.rows.map((r) => r.product_id).filter((id): id is string => !!id))];
      if (ids.length === 0) return result;
      const { data } = await supabase.from("products").select("id, name").in("id", ids);
      const names = new Map((data || []).map((p) => [p.id, p.name]));
      return { ...result, rows: result.rows.map((r) => ({ ...r, productName: names.get(r.product_id ?? "") })) };
    },
  });

  // Les totaux des trois onglets viennent de la base : la page affichée n'en contient qu'une partie.
  const countRequest = useRef(0);
  const loadCounts = useCallback(async () => {
    const request = ++countRequest.current;
    const results = await Promise.all(STATUSES.map((status) =>
      supabase.from("product_reviews").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("status", status)));
    if (request !== countRequest.current) return;
    if (results.some((r) => r.error)) {
      setCounts(null);
      return;
    }
    setCounts({ pending: results[0].count ?? 0, approved: results[1].count ?? 0, rejected: results[2].count ?? 0 });
  }, [shopId]);

  const refresh = useCallback(() => {
    reload();
    loadCounts();
  }, [reload, loadCounts]);

  useEffect(() => {
    setCounts(null);
    loadCounts();
  }, [loadCounts]);

  // Les nouveaux avis arrivent pendant que l'onglet est ouvert : relecture au retour sur la page.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const pendingCount = counts?.pending;
  useEffect(() => {
    if (pendingCount !== undefined) onPendingCountChange?.(pendingCount);
  }, [pendingCount, onPendingCountChange]);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    if (busyId) return;
    setBusyId(id);
    // .select() : sans lui, une mise à jour qui ne touche aucune ligne (avis déjà supprimé, droits) passait pour réussie.
    const { data, error } = await supabase.from("product_reviews").update({ status }).eq("id", id).select("id");
    setBusyId(null);
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    if (!data || data.length === 0) {
      toast({ title: "Avis introuvable", description: "Il a peut-être été supprimé. La liste est rechargée.", variant: "destructive" });
      refresh();
      return;
    }
    toast({ title: status === "approved" ? "Avis approuvé" : "Avis rejeté" });
    refresh();
  };

  const remove = async (id: string) => {
    if (busyId) return;
    if (!confirm("Supprimer cet avis définitivement ?")) return;
    setBusyId(id);
    const { data, error } = await supabase.from("product_reviews").delete().eq("id", id).select("id");
    setBusyId(null);
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    if (!data || data.length === 0) {
      toast({ title: "Avis introuvable", description: "Il a peut-être déjà été supprimé. La liste est rechargée.", variant: "destructive" });
      refresh();
      return;
    }
    toast({ title: "Avis supprimé" });
    refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6" /> Avis clients</h2>
        <p className="text-sm text-muted-foreground">Approuvez ou rejetez les avis avant qu'ils n'apparaissent sur vos fiches produit.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">En attente {!!counts?.pending && <Badge variant="secondary" className="ml-2">{counts.pending}</Badge>}</TabsTrigger>
          <TabsTrigger value="approved">Approuvés {counts && <Badge variant="secondary" className="ml-2">{counts.approved}</Badge>}</TabsTrigger>
          <TabsTrigger value="rejected">Rejetés {counts && <Badge variant="secondary" className="ml-2">{counts.rejected}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : loadError ? (
            // Une erreur de chargement ne doit pas se lire comme « aucun avis ».
            <div className="text-center py-10 text-sm border rounded-xl space-y-3">
              <p className="text-destructive">Impossible de charger les avis.</p>
              <Button size="sm" variant="outline" onClick={refresh} className="gap-1"><RefreshCw className="h-4 w-4" /> Réessayer</Button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border rounded-xl">Aucun avis dans cette catégorie.</div>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="border rounded-xl p-4 bg-card">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.reviewer_name}</span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                          ))}
                        </div>
                        {r.productName && (
                          <Badge variant="outline" className="text-xs">{r.productName}</Badge>
                        )}
                      </div>
                      {r.reviewer_email && <p className="text-xs text-muted-foreground mt-0.5">{r.reviewer_email}</p>}
                      <p className="text-sm mt-2 whitespace-pre-wrap break-words">{r.comment}</p>
                      <p className="text-[11px] text-muted-foreground mt-2">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {r.status !== "approved" && (
                        <Button size="sm" variant="default" disabled={busyId === r.id} onClick={() => updateStatus(r.id, "approved")} className="gap-1">
                          <Check className="h-4 w-4" /> Approuver
                        </Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => updateStatus(r.id, "rejected")} className="gap-1">
                          <X className="h-4 w-4" /> Rejeter
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => remove(r.id)} className="text-destructive" aria-label="Supprimer l'avis">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <ListPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
