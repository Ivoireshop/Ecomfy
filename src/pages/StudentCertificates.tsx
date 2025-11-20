import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Award, Download, ExternalLink } from "lucide-react";

interface Certificate {
  id: string;
  course_title: string;
  student_name: string;
  completion_date: string;
  certificate_url: string;
  certificate_number: string;
}

interface CourseAccess {
  id: string;
  course_id: string;
  access_granted_at: string;
  course: {
    id: string;
    title: string;
    short_description: string | null;
    image_url: string | null;
  };
}

export default function StudentCertificates() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [courses, setCourses] = useState<CourseAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Load certificates
      const { data: certsData, error: certsError } = await supabase
        .from("course_certificates")
        .select("*")
        .eq("user_id", user.id)
        .order("completion_date", { ascending: false });

      if (certsError) throw certsError;
      setCertificates(certsData || []);

      // Load courses with access
      const { data: accessData, error: accessError } = await supabase
        .from("student_access")
        .select(`
          id,
          course_id,
          access_granted_at,
          course:courses(id, title, short_description, image_url)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (accessError) throw accessError;
      setCourses(accessData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement");
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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8" />
            Mes Certificats
          </h1>
          <p className="text-muted-foreground mt-2">
            Retrouvez tous vos certificats de formation
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {certificates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Aucun certificat pour le moment</h3>
              <p className="text-muted-foreground mb-6">
                Complétez vos formations pour obtenir vos certificats
              </p>
              <Button onClick={() => navigate("/student")}>
                Voir mes formations
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert) => (
              <Card key={cert.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                  <div className="flex items-center justify-between">
                    <Award className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    <Badge variant="secondary">{cert.certificate_number}</Badge>
                  </div>
                  <CardTitle className="mt-4 line-clamp-2">{cert.course_title}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Nom:</span>
                      <span className="font-medium">{cert.student_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Obtenu le:</span>
                      <span className="font-medium">
                        {new Date(cert.completion_date).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => window.open(cert.certificate_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Voir
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => window.open(cert.certificate_url, "_blank")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {courses.length > 0 && certificates.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Formations en cours</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses
                .filter((course) => !certificates.find((cert) => cert.course_title === course.course.title))
                .map((course) => (
                  <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/student/course/${course.course_id}`)}>
                    {course.course.image_url ? (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={course.course.image_url}
                          alt={course.course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900" />
                    )}
                    <CardHeader>
                      <CardTitle className="line-clamp-2">{course.course.title}</CardTitle>
                      {course.course.short_description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {course.course.short_description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline">En cours</Badge>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
