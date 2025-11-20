import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, BookOpen, Clock, CheckCircle2, Play, LogOut } from "lucide-react";

interface CourseAccess {
  id: string;
  course_id: string;
  access_granted_at: string;
  course: {
    title: string;
    description: string;
    image_url: string | null;
    currency: string;
  };
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseAccess[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth?redirect=/student");
      return;
    }

    setUser(user);
    loadCourses();
  };

  const loadCourses = async () => {
    try {
      const { data: accessData, error: accessError } = await supabase
        .from("student_access")
        .select(`
          *,
          course:courses(title, description, image_url, currency)
        `)
        .eq("is_active", true);

      if (accessError) throw accessError;
      setCourses(accessData || []);

      // Calculate progress for each course
      if (accessData && accessData.length > 0) {
        const courseIds = accessData.map(a => a.course_id);
        const { data: progressData } = await supabase
          .from("student_progress")
          .select("course_id, is_completed")
          .in("course_id", courseIds);

        const progressMap: Record<string, number> = {};
        courseIds.forEach(courseId => {
          const courseProgress = progressData?.filter(p => p.course_id === courseId) || [];
          const completedCount = courseProgress.filter(p => p.is_completed).length;
          const totalCount = courseProgress.length;
          progressMap[courseId] = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        });
        setProgress(progressMap);
      }
    } catch (error: any) {
      toast.error("Erreur lors du chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Mon Espace Étudiant</h1>
            {user && <p className="text-sm text-muted-foreground">{user.email}</p>}
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Mes Formations</h2>
            <p className="text-muted-foreground">
              Continuez votre apprentissage où vous vous étiez arrêté
            </p>
          </div>

          {courses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Aucune formation disponible</h3>
                <p className="text-muted-foreground mb-4">
                  Vous n'avez pas encore accès à des formations
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((access) => (
                <Card key={access.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {access.course.image_url && (
                    <img
                      src={access.course.image_url}
                      alt={access.course.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{access.course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {access.course.description}
                    </p>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progression</span>
                        <span className="font-medium">{progress[access.course_id] || 0}%</span>
                      </div>
                      <Progress value={progress[access.course_id] || 0} />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Accès depuis {new Date(access.access_granted_at).toLocaleDateString()}
                      </div>
                      {progress[access.course_id] === 100 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Terminé
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => navigate(`/student/course/${access.course_id}`)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {progress[access.course_id] > 0 ? "Continuer" : "Commencer"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
