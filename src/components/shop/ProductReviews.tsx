import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, MessageSquarePlus, Send, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ProductThemeSettings, isDarkColor } from "@/lib/productAppearance";

const PAGE_SIZE = 20;
const NAME_MAX = 80;
const COMMENT_MAX = 2000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState(""); // piège à robots : un humain ne le voit pas et ne le remplit pas
  const [reloadKey, setReloadKey] = useState(0);

  // Les hooks passent avant tout retour anticipé : changer un réglage d'apparence pendant que la section
  // est montée faisait varier le nombre de hooks (« Rendered fewer hooks than expected »).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      const [list, stats] = await Promise.all([
        (supabase as any)
          .from("product_reviews_public")
          .select("id, reviewer_name, rating, comment, created_at", { count: "exact" })
          .eq("shop_id", shopId)
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(0, PAGE_SIZE - 1),
        (supabase as any).rpc("get_product_review_stats", { p_shop_id: shopId, p_product_id: productId }),
      ]);
      if (cancelled) return;
      if (list.error) {
        setReviews([]);
        setTotal(0);
        setAverage(0);
        setLoadError(true);
        setLoading(false);
        return;
      }
      const rows: Review[] = list.data || [];
      const st = Array.isArray(stats.data) ? stats.data[0] : stats.data;
      setReviews(rows);
      setTotal(list.count ?? rows.length);
      // Moyenne sur TOUS les avis approuvés (serveur) ; à défaut, sur ceux qui sont chargés.
      setAverage(
        !stats.error && st
          ? Number(st.average_rating) || 0
          : rows.length ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : 0,
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shopId, productId, reloadKey]);

  if (
    themeConfig?.reviews_section_enabled === false ||
    themeSettings?.custom_css_settings?.reviews_section_enabled === false
  ) {
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

  const loadMore = async () => {
    setLoadingMore(true);
    const { data, error } = await (supabase as any)
      .from("product_reviews_public")
      .select("id, reviewer_name, rating, comment, created_at")
      .eq("shop_id", shopId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(reviews.length, reviews.length + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger plus d'avis. Réessayez.", variant: "destructive" });
      return;
    }
    setReviews((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...((data as Review[]) || []).filter((r) => !seen.has(r.id))];
    });
  };

  const submit = async () => {
    if (submitting) return;
    if (isPreview) {
      toast({
        title: "Mode aperçu",
        description: "Impossible d'envoyer un avis depuis l'aperçu.",
      });
      return;
    }
    const cleanName = name.trim();
    const cleanComment = comment.trim();
    const cleanEmail = email.trim();
    if (!cleanName || !cleanComment) {
      toast({
        title: "Champs requis",
        description: "Nom et commentaire obligatoires",
        variant: "destructive",
      });
      return;
    }
    if (cleanEmail && (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail))) {
      toast({ title: "Email invalide", description: "Vérifiez votre adresse email ou laissez le champ vide.", variant: "destructive" });
      return;
    }
    const done = () => {
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
    if (website.trim()) { done(); return; } // robot : succès apparent, rien n'est enregistré

    setSubmitting(true);
    const { error } = await supabase.from("product_reviews").insert({
      shop_id: shopId,
      product_id: productId,
      reviewer_name: cleanName,
      reviewer_email: cleanEmail || null,
      rating,
      comment: cleanComment,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      // Les contrôles du serveur (code 22023) ont un message lisible ; le reste est technique.
      toast({
        title: "Erreur",
        description: error.code === "22023" ? error.message : "Impossible d'envoyer votre avis pour le moment. Réessayez dans un instant.",
        variant: "destructive",
      });
      return;
    }
    done();
  };

  return (
    <section
      id="avis-clients"
      className="border-t transition-colors duration-300 scroll-mt-4"
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
                    i <= Math.round(average)
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
              {total > 0
                ? `${average.toFixed(1)} sur 5 basés sur ${total} avis`
                : loadError ? "Avis momentanément indisponibles" : "Aucun avis pour le moment"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin opacity-50" />
          </div>
        ) : loadError ? (
          <div
            className="text-base text-center mb-10 p-8 rounded-2xl border shadow-xs space-y-3"
            style={{ backgroundColor: cardBg, borderColor: borderColor, color: textColor }}
          >
            <p>Impossible de charger les avis pour le moment.</p>
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)} style={{ borderColor: borderColor }}>
              Réessayer
            </Button>
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
                <p className="leading-relaxed opacity-90 whitespace-pre-wrap break-words">{r.comment}</p>
              </div>
            ))}
            {reviews.length < total && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-full font-semibold"
                  style={{ borderColor: borderColor, color: textColor }}
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Voir plus d'avis ({total - reviews.length})
                </Button>
              </div>
            )}
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
            className="relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 border"
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
                      aria-label={`${i} étoile${i > 1 ? "s" : ""} sur 5`}
                      aria-pressed={i === rating}
                      className="p-1 hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 rounded"
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
                    maxLength={NAME_MAX}
                    autoComplete="name"
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
                    maxLength={254}
                    autoComplete="email"
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
                  maxLength={COMMENT_MAX}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                />
                <p className="text-xs opacity-60 text-right">{comment.length}/{COMMENT_MAX}</p>
              </div>

              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />

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
                  Envoyer mon avis
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