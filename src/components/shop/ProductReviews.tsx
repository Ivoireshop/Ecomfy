import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, MessageSquarePlus, CheckCircle2, Send, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ProductThemeSettings, isDarkColor } from "@/lib/productAppearance";

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
  themeConfig?: any;
  themeSettings?: ProductThemeSettings | null;
}

export function ProductReviews({
  shopId,
  productId,
  primaryColor = "#111827",
  isPreview = false,
  themeConfig,
  themeSettings,
}: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  if (themeConfig?.reviews_enabled === false || themeSettings?.custom_css_settings?.reviews_enabled === false) {
    return null;
  }

  // Determine dynamic colors with intelligent fallbacks
  const sectionBg =
    themeConfig?.reviews_section_bg ||
    themeConfig?.reviews_bg_color ||
    themeSettings?.section_bg_color ||
    "#F9FAFB";

  const cardBg =
    themeConfig?.reviews_card_bg ||
    themeConfig?.reviews_card_bg_color ||
    themeSettings?.card_bg_color ||
    "#FFFFFF";

  const textColor =
    themeConfig?.reviews_text_color ||
    themeSettings?.text_color ||
    (isDarkColor(sectionBg) ? "#F3F4F6" : "#1F2937");

  const titleColor =
    themeConfig?.reviews_title_color ||
    themeSettings?.title_color ||
    (isDarkColor(sectionBg) ? "#FFFFFF" : "#0F172A");

  const borderColor =
    themeConfig?.reviews_border_color ||
    themeSettings?.border_color ||
    (isDarkColor(sectionBg) ? "rgba(255, 255, 255, 0.12)" : "#E5E7EB");

  const inputBg =
    isDarkColor(cardBg) ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.02)";

  const btnBg = themeSettings?.button_color || primaryColor || "#0E7C66";
  const btnFg = themeSettings?.button_text_color || "#FFFFFF";

  const load = async () => {
    setLoading(true);
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

  useEffect(() => {
    load();
  }, [shopId, productId]);

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const submit = async () => {
    if (isPreview) {
      toast({
        title: "Mode aperçu",
        description: "Impossible d'envoyer un avis depuis l'aperçu.",
      });
      return;
    }
    if (!name.trim() || !comment.trim()) {
      toast({
        title: "Champs requis",
        description: "Nom et commentaire obligatoires",
        variant: "destructive",
      });
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
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Merci !",
      description: "Votre avis a été envoyé. Il sera publié après modération.",
    });
    setName("");
    setEmail("");
    setComment("");
    setRating(5);
    setShowForm(false);
  };

  return (
    <section
      className="border-t transition-colors duration-300"
      style={{
        backgroundColor: sectionBg,
        borderColor: borderColor,
        color: textColor,
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2
            className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight"
            style={{ color: titleColor }}
          >
            Avis de nos clients
          </h2>
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-6 w-6 sm:h-7 sm:w-7 ${
                    i <= Math.round(avg)
                      ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                      : "fill-gray-300/40 text-gray-300/60"
                  }`}
                />
              ))}
            </div>
            <span
              className="text-base font-medium opacity-80"
              style={{ color: textColor }}
            >
              {reviews.length > 0
                ? `${avg.toFixed(1)} sur 5 basés sur ${reviews.length} avis`
                : "Aucun avis pour le moment"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin opacity-50" />
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4 mb-10">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all border"
                style={{
                  backgroundColor: cardBg,
                  borderColor: borderColor,
                  color: textColor,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span
                      className="font-bold flex items-center gap-2"
                      style={{ color: titleColor }}
                    >
                      {r.reviewer_name}
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </span>
                    <p className="text-xs opacity-60 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString("fr-FR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i <= r.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-gray-300/30 text-gray-300/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="leading-relaxed opacity-90">{r.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p
            className="text-base text-center mb-10 p-8 rounded-2xl border shadow-xs"
            style={{
              backgroundColor: cardBg,
              borderColor: borderColor,
              color: textColor,
            }}
          >
            Soyez le premier à partager votre expérience avec ce produit !
          </p>
        )}

        {!showForm ? (
          <div className="text-center">
            <Button
              size="lg"
              onClick={() => setShowForm(true)}
              className="gap-2 rounded-full font-bold shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: btnBg, color: btnFg }}
            >
              <MessageSquarePlus className="h-5 w-5" /> Rédiger un avis
            </Button>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 sm:p-8 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 border"
            style={{
              backgroundColor: cardBg,
              borderColor: borderColor,
              color: textColor,
            }}
          >
            <h3
              className="text-xl font-bold border-b pb-3"
              style={{ color: titleColor, borderColor: borderColor }}
            >
              Partagez votre expérience
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: titleColor }}>
                  Votre note
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(i)}
                      className="p-1 hover:scale-110 transition-transform focus:outline-none"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          i <= rating
                            ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                            : "fill-gray-300/30 text-gray-300/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold block" style={{ color: titleColor }}>
                    Nom complet <span className="text-red-500">*</span>
                  </label>
                  <Input
                    className="h-12 rounded-xl border focus:ring-1"
                    style={{ backgroundColor: inputBg, borderColor: borderColor, color: textColor }}
                    placeholder="Ex: Jean Dupont"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold block" style={{ color: titleColor }}>
                    Adresse email <span className="opacity-60 font-normal">(Facultatif)</span>
                  </label>
                  <Input
                    type="email"
                    className="h-12 rounded-xl border focus:ring-1"
                    style={{ backgroundColor: inputBg, borderColor: borderColor, color: textColor }}
                    placeholder="Ex: jean@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold block" style={{ color: titleColor }}>
                  Votre commentaire <span className="text-red-500">*</span>
                </label>
                <Textarea
                  className="rounded-xl border resize-none focus:ring-1"
                  style={{ backgroundColor: inputBg, borderColor: borderColor, color: textColor }}
                  placeholder="Qu'avez-vous pensé de ce produit ?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl font-bold w-full sm:w-auto"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  style={{ borderColor: borderColor }}
                >
                  Annuler
                </Button>
                <Button
                  size="lg"
                  className="rounded-xl font-bold shadow-md w-full sm:w-auto"
                  onClick={submit}
                  disabled={submitting}
                  style={{ backgroundColor: btnBg, color: btnFg }}
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Publier l'avis
                </Button>
              </div>
              <p className="text-xs opacity-60 text-center flex items-center justify-center gap-1.5 mt-2">
                <Shield className="h-3 w-3" /> Votre avis sera modéré avant publication pour éviter les spams.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}