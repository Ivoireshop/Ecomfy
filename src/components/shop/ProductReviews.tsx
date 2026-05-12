import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface ProductReviewsProps {
  shopId: string;
  productId: string;
  primaryColor?: string;
  isPreview?: boolean;
}

export function ProductReviews({ shopId, productId, primaryColor = "#111827", isPreview = false }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_reviews")
      .select("id, reviewer_name, rating, comment, created_at")
      .eq("shop_id", shopId)
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);
    setReviews((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [shopId, productId]);

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const submit = async () => {
    if (isPreview) {
      toast({ title: "Mode aperçu", description: "Impossible d'envoyer un avis depuis l'aperçu." });
      return;
    }
    if (!name.trim() || !comment.trim()) {
      toast({ title: "Champs requis", description: "Nom et commentaire obligatoires", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("product_reviews").insert({
      shop_id: shopId,
      product_id: productId,
      reviewer_name: name.trim(),
      reviewer_email: email.trim() || null,
      rating,
      comment: comment.trim(),
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Merci !", description: "Votre avis a été envoyé. Il sera publié après modération." });
    setName(""); setEmail(""); setComment(""); setRating(5);
    setShowForm(false);
  };

  return (
    <section className="border-t bg-white">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Avis clients</h2>
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={`h-5 w-5 ${i <= Math.round(avg) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
            ))}
            <span className="text-sm text-gray-600 ml-2">
              {reviews.length > 0 ? `${avg.toFixed(1)} · ${reviews.length} avis` : "Aucun avis"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : reviews.length > 0 ? (
          <div className="space-y-3 mb-6">
            {reviews.map(r => (
              <div key={r.id} className="border rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{r.reviewer_name}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.comment}</p>
                <p className="text-[11px] text-gray-400 mt-2">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center mb-6">Soyez le premier à laisser un avis sur ce produit.</p>
        )}

        {!showForm ? (
          <div className="text-center">
            <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2">
              <MessageSquarePlus className="h-4 w-4" /> Laisser un avis
            </Button>
          </div>
        ) : (
          <div className="border rounded-xl p-4 sm:p-5 bg-white shadow-sm space-y-3">
            <h3 className="font-semibold">Votre avis</h3>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} type="button" onClick={() => setRating(i)} className="p-1">
                  <Star className={`h-6 w-6 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
            <Input placeholder="Votre nom *" value={name} onChange={(e) => setName(e.target.value)} />
            <Input type="email" placeholder="Email (facultatif)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Textarea placeholder="Partagez votre expérience…" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>Annuler</Button>
              <Button onClick={submit} disabled={submitting} style={{ backgroundColor: primaryColor }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Envoyer
              </Button>
            </div>
            <p className="text-[11px] text-gray-400 text-center">Votre avis sera publié après validation par le vendeur.</p>
          </div>
        )}
      </div>
    </section>
  );
}