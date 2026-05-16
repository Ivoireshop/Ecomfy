import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, ExternalLink } from "lucide-react";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>("");
  const enrollmentId = searchParams.get("enrollment_id");
  const paymentRef = searchParams.get("ref");

  useEffect(() => {
    // Filet de sécurité : si on revient de GeniusPay avec une référence,
    // on vérifie le statut côté serveur et on crédite si nécessaire.
    if (paymentRef) {
      verifyPayment(paymentRef).finally(() => {
        if (!enrollmentId) setLoading(false);
      });
    } else if (enrollmentId) {
      loadEnrollmentDetails();
    } else {
      setLoading(false);
    }
  }, [enrollmentId, paymentRef]);

  const verifyPayment = async (reference: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference },
      });
      if (error) {
        console.warn("verify-payment error:", error);
        return;
      }
      if (data?.applied) {
        toast.success("Paiement confirmé et compte mis à jour !");
      }
      if (data?.shop_id) {
        navigate(`/shop-editor/${data.shop_id}`, { replace: true });
      }
    } catch (e) {
      console.warn("verify-payment failed:", e);
    }
  };

  const loadEnrollmentDetails = async () => {
    try {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("course_id, student_email")
        .eq("id", enrollmentId)
        .single();

      if (enrollmentError) throw enrollmentError;

      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("title, whatsapp_group_link")
        .eq("id", enrollment.course_id)
        .single();

      if (courseError) throw courseError;

      setCourseName(course.title);
      setWhatsappLink(course.whatsapp_group_link);
    } catch (error) {
      console.error("Error loading details:", error);
      toast.error("Erreur lors du chargement des détails");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-3xl">Paiement confirmé avec succès !</CardTitle>
          <p className="text-muted-foreground mt-2">
            {courseName ? `Merci pour votre inscription à "${courseName}"` : "Merci, votre paiement a été traité."}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-6 rounded-lg space-y-4">
            <h3 className="font-semibold text-lg">Étapes suivantes :</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Vérifiez votre email pour les détails de connexion</li>
              <li>Un compte utilisateur a été créé automatiquement</li>
              <li>Vous recevrez vos identifiants par email sous peu</li>
              <li>Rejoignez le groupe WhatsApp d'accompagnement ci-dessous</li>
            </ol>
          </div>

          {whatsappLink && (
            <div className="border-2 border-green-500 rounded-lg p-6 space-y-4 bg-green-50">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-green-800">
                    Rejoignez notre groupe d'accompagnement
                  </h3>
                  <p className="text-sm text-green-700">
                    Cliquez ci-dessous pour accéder au groupe WhatsApp
                  </p>
                </div>
              </div>
              
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
                asChild
              >
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Rejoindre le groupe WhatsApp maintenant
                </a>
              </Button>
              
              <p className="text-xs text-green-700 text-center">
                Ce lien vous permet de rejoindre directement le groupe d'accompagnement de votre formation
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/auth?mode=login")}
            >
              Se connecter
            </Button>
            <Button
              className="flex-1"
              onClick={() => navigate("/")}
            >
              Retour à l'accueil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}