import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Loader2, Check, X, Trash2, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Review {
  id: string;
  product_id: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export function ReviewsModeration({ shopId, onPendingCountChange }: { shopId: string; onPendingCountChange?: (count: number) => void }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Avant : une erreur de chargement affichait « Aucun avis dans cette catégorie » comme si la boutique n'en avait pas.
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    const [revsRes, prodsRes] = await Promise.all([
      supabase.from("product_reviews").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name").eq("shop_id", shopId),
    ]);
    if (revsRes.error) {
      setReviews([]);
      setLoadError(true);
      setLoading(false);
      return;
    }
    setReviews((revsRes.data as any) || []);
    const map: Record<string, string> = {};
    (prodsRes.data || []).forEach((p: any) => { map[p.id] = p.name; });
    setProducts(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [shopId]);

  // Les nouveaux avis arrivent pendant que l'onglet est ouvert : relecture au retour sur la page.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [shopId]);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    if (busyId) return;
    setBusyId(id);
    // .select() : sans lui, une mise à jour qui ne touche aucune ligne (avis déjà supprimé, droits) passait pour réussie.
    const { data, error } = await supabase.from("product_reviews").update({ status }).eq("id", id).select("id");
    setBusyId(null);
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    if (!data || data.length === 0) {
      toast({ title: "Avis introuvable", description: "Il a peut-être été supprimé. La liste est rechargée.", variant: "destructive" });
      load();
      return;
    }
    toast({ title: status === "approved" ? "Avis approuvé" : "Avis rejeté" });
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
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
      load();
      return;
    }
    setReviews(prev => prev.filter(r => r.id !== id));
    toast({ title: "Avis supprimé" });
  };

  const filtered = reviews.filter(r => r.status === tab);
  const counts = {
    pending: reviews.filter(r => r.status === "pending").length,
    approved: reviews.filter(r => r.status === "approved").length,
    rejected: reviews.filter(r => r.status === "rejected").length,
  };
  useEffect(() => {
    if (!loading && !loadError) onPendingCountChange?.(counts.pending);
  }, [counts.pending, loading, loadError]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6" /> Avis clients</h2>
        <p className="text-sm text-muted-foreground">Approuvez ou rejetez les avis avant qu'ils n'apparaissent sur vos fiches produit.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">En attente {counts.pending > 0 && <Badge variant="secondary" className="ml-2">{counts.pending}</Badge>}</TabsTrigger>
          <TabsTrigger value="approved">Approuvés <Badge variant="secondary" className="ml-2">{counts.approved}</Badge></TabsTrigger>
          <TabsTrigger value="rejected">Rejetés <Badge variant="secondary" className="ml-2">{counts.rejected}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading && reviews.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : loadError ? (
            <div className="text-center py-10 text-sm border rounded-xl space-y-3">
              <p className="text-destructive">Impossible de charger les avis.</p>
              <Button size="sm" variant="outline" onClick={load} className="gap-1"><RefreshCw className="h-4 w-4" /> Réessayer</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border rounded-xl">Aucun avis dans cette catégorie.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => (
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
                        {r.product_id && products[r.product_id] && (
                          <Badge variant="outline" className="text-xs">{products[r.product_id]}</Badge>
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
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}