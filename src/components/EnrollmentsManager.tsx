import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Enrollment {
  id: string;
  course_id: string;
  student_name: string;
  student_email: string;
  student_phone: string | null;
  payment_status: string;
  payment_method: string | null;
  payment_proof_url: string | null;
  amount_paid: number | null;
  transaction_reference: string | null;
  validated_at: string | null;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
  price: number;
  currency: string;
}

interface EnrollmentsManagerProps {
  showcaseSiteId: string;
}

export function EnrollmentsManager({ showcaseSiteId }: EnrollmentsManagerProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [showcaseSiteId]);

  const loadData = async () => {
    try {
      // Load courses
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("id, title, price, currency")
        .eq("showcase_site_id", showcaseSiteId);

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Load enrollments
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("*")
        .eq("showcase_site_id", showcaseSiteId)
        .order("created_at", { ascending: false });

      if (enrollmentsError) throw enrollmentsError;
      setEnrollments(enrollmentsData || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getCourseInfo = (courseId: string) => {
    return courses.find((c) => c.id === courseId);
  };

  const handleValidatePayment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("enrollments")
        .update({
          payment_status: "paid",
          validated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Paiement validé avec succès");
      loadData();
    } catch (error: any) {
      toast.error("Erreur lors de la validation");
      console.error(error);
    }
  };

  const handleRejectPayment = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir refuser ce paiement ?")) return;

    try {
      const { error } = await supabase
        .from("enrollments")
        .update({ payment_status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Paiement refusé");
      loadData();
    } catch (error: any) {
      toast.error("Erreur lors du refus");
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      paid: "default",
      cancelled: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "En attente",
      paid: "Payé",
      cancelled: "Annulé",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    if (filter === "all") return true;
    return enrollment.payment_status === filter;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inscriptions & Paiements</h2>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Tous ({enrollments.length})
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            En attente ({enrollments.filter((e) => e.payment_status === "pending").length})
          </Button>
          <Button
            variant={filter === "paid" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("paid")}
          >
            Payés ({enrollments.filter((e) => e.payment_status === "paid").length})
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredEnrollments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucune inscription trouvée
            </CardContent>
          </Card>
        ) : (
          filteredEnrollments.map((enrollment) => {
            const course = getCourseInfo(enrollment.course_id);
            return (
              <Card key={enrollment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle>{course?.title || "Formation inconnue"}</CardTitle>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(enrollment.created_at), "PPP à HH:mm", { locale: fr })}
                      </div>
                    </div>
                    {getStatusBadge(enrollment.payment_status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Étudiant</div>
                      <div>{enrollment.student_name}</div>
                      <div className="text-sm text-muted-foreground">{enrollment.student_email}</div>
                      {enrollment.student_phone && (
                        <div className="text-sm text-muted-foreground">{enrollment.student_phone}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Paiement</div>
                      <div className="font-bold text-lg">
                        {enrollment.amount_paid || course?.price} {course?.currency}
                      </div>
                      {enrollment.payment_method && (
                        <div className="text-sm text-muted-foreground capitalize">
                          via {enrollment.payment_method}
                        </div>
                      )}
                      {enrollment.transaction_reference && (
                        <div className="text-sm text-muted-foreground">
                          Réf: {enrollment.transaction_reference}
                        </div>
                      )}
                    </div>
                  </div>

                  {enrollment.payment_proof_url && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Justificatif de paiement
                      </div>
                      <a
                        href={enrollment.payment_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Voir le justificatif
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}

                  {enrollment.payment_status === "pending" && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        size="sm"
                        onClick={() => handleValidatePayment(enrollment.id)}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Valider le paiement
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectPayment(enrollment.id)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Refuser
                      </Button>
                    </div>
                  )}

                  {enrollment.validated_at && (
                    <div className="text-sm text-muted-foreground">
                      Validé le {format(new Date(enrollment.validated_at), "PPP à HH:mm", { locale: fr })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
