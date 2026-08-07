import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, MessageSquarePlus, CheckCircle2, Send, Shield } from "lucide-react";
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
    // Read from the safe public view so visitors never see reviewer_email.
    const { data } = await (supabase as any)
      .from("product_reviews_public")
      .select("id, reviewer_name, rating, comment, created_at")
      .eq("shop_id", shopId)
      .eq("product_id", productId)
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
    <section className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">Avis de nos clients</h2>
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={`h-6 w-6 sm:h-7 sm:w-7 ${i <= Math.round(avg) ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`} />
              ))}
            </div>
            <span className="text-base font-medium text-gray-500">
              {reviews.length > 0 ? `${avg.toFixed(1)} sur 5 basés sur ${reviews.length} avis` : "Aucun avis pour le moment"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4 mb-10">
            {reviews.map(r => (
              <div key={r.id} className="border border-gray-100 rounded-2xl p-5 sm:p-6 bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="font-bold text-gray-900 flex items-center gap-2">
                      {r.reviewer_name}
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className={`h-4 w-4 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "fill-gray-100 text-gray-100"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">{r.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-base text-gray-500 text-center mb-10 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">Soyez le premier à partager votre expérience avec ce produit !</p>
        )}

        {!showForm ? (
          <div className="text-center">
            <Button size="lg" onClick={() => setShowForm(true)} className="gap-2 rounded-full font-bold shadow-md hover:shadow-lg transition-all" style={{ backgroundColor: primaryColor, color: "white" }}>
              <MessageSquarePlus className="h-5 w-5" /> Rédiger un avis
            </Button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-2xl p-6 sm:p-8 bg-white shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-gray-900 border-b pb-3">Partagez votre expérience</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Votre note</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button key={i} type="button" onClick={() => setRating(i)} className="p-1 hover:scale-110 transition-transform focus:outline-none">
                      <Star className={`h-8 w-8 ${i <= rating ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "fill-gray-100 text-gray-200"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Nom complet <span className="text-red-500">*</span></label>
                  <Input className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white" placeholder="Ex: Jean Dupont" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Adresse email <span className="text-gray-400 font-normal">(Facultatif)</span></label>
                  <Input type="email" className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white" placeholder="Ex: jean@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Votre commentaire <span className="text-red-500">*</span></label>
                <Textarea className="rounded-xl bg-gray-50 border-gray-200 focus:bg-white resize-none" placeholder="Qu'avez-vous pensé de ce produit ?" value={comment} onChange={(e) => setComment(e.target.value)} rows={5} />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
                <Button variant="outline" size="lg" className="rounded-xl font-bold w-full sm:w-auto" onClick={() => setShowForm(false)} disabled={submitting}>Annuler</Button>
                <Button size="lg" className="rounded-xl font-bold shadow-md text-white w-full sm:w-auto" onClick={submit} disabled={submitting} style={{ backgroundColor: primaryColor }}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Publier l'avis
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5 mt-2">
                <Shield className="h-3 w-3" /> Votre avis sera modéré avant publication pour éviter les spams.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}