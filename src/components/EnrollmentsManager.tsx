import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Users, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Enrollment {
  id: string;
  course_id: string;
  student_name: string;
  student_email: string;
  student_phone: string | null;
  payment_status: string;
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
  const [sending, setSending] = useState(false);

  // Form state
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  useEffect(() => {
    loadData();
  }, [showcaseSiteId]);

  const loadData = async () => {
    try {
      const [coursesRes, enrollmentsRes] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, price, currency")
          .eq("showcase_site_id", showcaseSiteId),
        supabase
          .from("enrollments")
          .select("*")
          .eq("showcase_site_id", showcaseSiteId)
          .order("created_at", { ascending: false }),
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;

      setCourses(coursesRes.data || []);
      setEnrollments(enrollmentsRes.data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCourse = async () => {
    if (!studentName.trim() || !studentEmail.trim() || !selectedCourseId) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setSending(true);
    try {
      // Create enrollment as paid directly
      const { data: enrollment, error: insertError } = await supabase
        .from("enrollments")
        .insert({
          showcase_site_id: showcaseSiteId,
          course_id: selectedCourseId,
          student_name: studentName.trim(),
          student_email: studentEmail.trim(),
          payment_status: "paid",
          validated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create student account and send credentials email
      const { error: createError } = await supabase.functions.invoke(
        "create-student-account",
        {
          body: {
            enrollmentId: enrollment.id,
            courseId: selectedCourseId,
            studentEmail: studentEmail.trim(),
            studentName: studentName.trim(),
          },
        }
      );

      if (createError) {
        console.error("Error creating student account:", createError);
        toast.error("Inscription créée mais erreur lors de l'envoi du mail");
      } else {
        toast.success("Formation envoyée avec succès ! L'étudiant recevra ses identifiants par email.");
      }

      // Reset form
      setStudentName("");
      setStudentEmail("");
      setSelectedCourseId("");
      loadData();
    } catch (error: any) {
      toast.error("Erreur lors de l'envoi");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const getCourseTitle = (courseId: string) => {
    return courses.find((c) => c.id === courseId)?.title || "Formation inconnue";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Send Course Form */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Envoyer une formation
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Entrez le nom et l'email de l'étudiant. Il recevra automatiquement ses identifiants par email.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student-name">Nom de l'étudiant</Label>
              <Input
                id="student-name"
                placeholder="Ex: Jean Dupont"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-email">Email de l'étudiant</Label>
              <Input
                id="student-email"
                type="email"
                placeholder="ex: jean@email.com"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Formation</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une formation" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="mt-4 w-full md:w-auto"
            onClick={handleSendCourse}
            disabled={sending || !studentName.trim() || !studentEmail.trim() || !selectedCourseId}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Envoyer la formation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{enrollments.length}</div>
              <div className="text-sm text-muted-foreground">Total étudiants</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">
                {enrollments.filter((e) => e.payment_status === "paid").length}
              </div>
              <div className="text-sm text-muted-foreground">Accès accordés</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold">
                {enrollments.filter((e) => e.payment_status === "pending").length}
              </div>
              <div className="text-sm text-muted-foreground">En attente</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Historique des envois</h3>
        {enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucun envoi effectué pour le moment
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => (
              <Card key={enrollment.id}>
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium">{enrollment.student_name}</div>
                    <div className="text-sm text-muted-foreground">{enrollment.student_email}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {getCourseTitle(enrollment.course_id)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={enrollment.payment_status === "paid" ? "default" : "secondary"}>
                      {enrollment.payment_status === "paid" ? "Accès envoyé" : "En attente"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(enrollment.created_at), "dd MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
