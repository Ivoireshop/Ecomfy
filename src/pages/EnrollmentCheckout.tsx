import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, CreditCard } from "lucide-react";
import { useEffect } from "react";

interface Course {
  id: string;
  title: string;
  price: number;
  currency: string;
  showcase_site_id: string;
}

interface PaymentLink {
  id: string;
  provider: string;
  payment_url: string;
}

export default function EnrollmentCheckout() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [enrollmentForm, setEnrollmentForm] = useState({
    student_name: "",
    student_email: "",
    student_phone: "",
    payment_method: "",
    transaction_reference: "",
  });

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  const loadCourse = async () => {
    try {
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      const { data: linksData, error: linksError } = await supabase
        .from("payment_links")
        .select("*")
        .eq("course_id", courseId)
        .eq("is_active", true);

      if (linksError) throw linksError;
      setPaymentLinks(linksData || []);
    } catch (error) {
      console.error("Error loading course:", error);
      toast.error("Erreur lors du chargement de la formation");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile) return null;

    setUploading(true);
    try {
      const fileExt = proofFile.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `payment-proofs/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from("showcase-images")
        .upload(filePath, proofFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("showcase-images")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading proof:", error);
      toast.error("Erreur lors du téléchargement de la preuve");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;

    setSubmitting(true);

    try {
      let proofUrl = null;
      if (proofFile) {
        proofUrl = await uploadProof();
        if (!proofUrl) {
          setSubmitting(false);
          return;
        }
      }

      const { error } = await supabase.from("enrollments").insert([
        {
          course_id: course.id,
          showcase_site_id: course.showcase_site_id,
          student_name: enrollmentForm.student_name,
          student_email: enrollmentForm.student_email,
          student_phone: enrollmentForm.student_phone,
          payment_method: enrollmentForm.payment_method,
          transaction_reference: enrollmentForm.transaction_reference,
          amount_paid: course.price,
          payment_proof_url: proofUrl,
          payment_status: "pending",
        },
      ]);

      if (error) throw error;

      toast.success(
        "Inscription enregistrée ! Votre paiement sera validé sous 24h."
      );
      
      setTimeout(() => {
        navigate("/auth?mode=login");
      }, 2000);
    } catch (error) {
      console.error("Error submitting enrollment:", error);
      toast.error("Erreur lors de l'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  const getProviderLabel = (provider: string) => {
    const labels: Record<string, string> = {
      mtn: "MTN Mobile Money",
      orange: "Orange Money",
      wave: "Wave",
      stripe: "Stripe",
      paypal: "PayPal",
    };
    return labels[provider] || provider;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Formation non trouvée</p>
            <Button onClick={() => navigate(-1)} className="mt-4">
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Inscription - {course.title}</CardTitle>
            <p className="text-muted-foreground">
              Prix: {course.price.toLocaleString()} {course.currency}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {paymentLinks.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Options de paiement direct:</h3>
                <div className="grid gap-3">
                  {paymentLinks.map((link) => (
                    <Button
                      key={link.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.open(link.payment_url, "_blank")}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Payer avec {getProviderLabel(link.provider)}
                    </Button>
                  ))}
                </div>
                <div className="text-center text-sm text-muted-foreground my-4">
                  ou effectuez votre paiement puis complétez le formulaire ci-dessous
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student_name">Nom complet *</Label>
                <Input
                  id="student_name"
                  required
                  value={enrollmentForm.student_name}
                  onChange={(e) =>
                    setEnrollmentForm({ ...enrollmentForm, student_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="student_email">Email *</Label>
                <Input
                  id="student_email"
                  type="email"
                  required
                  value={enrollmentForm.student_email}
                  onChange={(e) =>
                    setEnrollmentForm({ ...enrollmentForm, student_email: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="student_phone">Téléphone</Label>
                <Input
                  id="student_phone"
                  type="tel"
                  value={enrollmentForm.student_phone}
                  onChange={(e) =>
                    setEnrollmentForm({ ...enrollmentForm, student_phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Méthode de paiement *</Label>
                <Input
                  id="payment_method"
                  required
                  placeholder="Ex: MTN Mobile Money, Orange Money..."
                  value={enrollmentForm.payment_method}
                  onChange={(e) =>
                    setEnrollmentForm({ ...enrollmentForm, payment_method: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction_reference">Référence de transaction</Label>
                <Input
                  id="transaction_reference"
                  placeholder="Numéro de transaction"
                  value={enrollmentForm.transaction_reference}
                  onChange={(e) =>
                    setEnrollmentForm({
                      ...enrollmentForm,
                      transaction_reference: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proof">Preuve de paiement (capture d'écran)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="proof"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Téléchargez une capture d'écran de votre confirmation de paiement
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Confirmer l'inscription"
                )}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Après validation de votre paiement (sous 24h), un compte utilisateur sera
                automatiquement créé avec cet email. Vous recevrez vos identifiants par email
                pour accéder à votre espace étudiant et suivre la formation.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
