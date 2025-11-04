import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Star, Loader2, MessageSquare } from "lucide-react";

const Feedback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userFeedback, setUserFeedback] = useState<any[]>([]);

  useEffect(() => {
    loadUserFeedback();
  }, []);

  const loadUserFeedback = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserFeedback(data || []);
    } catch (error) {
      console.error("Erreur chargement feedback:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({
        title: "Note requise",
        description: "Veuillez sélectionner une note avant de soumettre",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Merci !",
        description: "Votre avis a été enregistré avec succès",
      });

      setRating(0);
      setComment("");
      loadUserFeedback();
    } catch (error) {
      console.error("Erreur soumission feedback:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer votre avis",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente";
      case "reviewed":
        return "Examiné";
      case "published":
        return "Publié";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Donnez-nous votre avis</h1>
            <p className="text-lg text-muted-foreground">
              Votre feedback nous aide à améliorer VisualPro
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Nouveau commentaire
              </CardTitle>
              <CardDescription>
                Partagez votre expérience avec VisualPro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>Votre note *</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-10 w-10 ${
                            star <= (hoveredRating || rating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Vous avez sélectionné {rating} étoile{rating > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">
                    Votre commentaire (optionnel)
                  </Label>
                  <Textarea
                    id="comment"
                    placeholder="Qu'avez-vous aimé ? Que pouvons-nous améliorer ?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={5}
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isLoading || rating === 0}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      "Envoyer mon avis"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/generator")}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {userFeedback.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vos avis précédents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userFeedback.map((feedback) => (
                    <div
                      key={feedback.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-5 w-5 ${
                                star <= feedback.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {getStatusLabel(feedback.status)}
                        </span>
                      </div>
                      {feedback.comment && (
                        <p className="text-sm text-muted-foreground">
                          {feedback.comment}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(feedback.created_at).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feedback;
