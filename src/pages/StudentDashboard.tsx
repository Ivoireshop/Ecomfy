import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, BookOpen, Clock, CheckCircle2, Play, LogOut, Award, GraduationCap, Trophy } from "lucide-react";

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
  const [profile, setProfile] = useState<any>(null);

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

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    
    setProfile(profileData);
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

  const completedCourses = courses.filter(c => progress[c.course_id] === 100).length;
  const inProgressCourses = courses.filter(c => (progress[c.course_id] || 0) > 0 && progress[c.course_id] < 100).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  Bonjour, {profile?.full_name?.split(" ")[0] || "Étudiant"} 👋
                </h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/student/certificates")}>
                <Award className="h-4 w-4 mr-2" />
                Mes Certificats
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{courses.length}</div>
                <div className="text-sm text-muted-foreground">Formations</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Play className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{inProgressCourses}</div>
                <div className="text-sm text-muted-foreground">En cours</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{completedCourses}</div>
                <div className="text-sm text-muted-foreground">Terminées</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Courses */}
        <div>
          <h2 className="text-xl font-bold mb-6">Mes Formations</h2>

          {courses.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                <h3 className="text-xl font-semibold mb-2">Aucune formation disponible</h3>
                <p className="text-muted-foreground">
                  Vous n'avez pas encore accès à des formations. Contactez votre formateur.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((access) => {
                const courseProgress = progress[access.course_id] || 0;
                const isCompleted = courseProgress === 100;

                return (
                  <Card
                    key={access.id}
                    className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => navigate(`/student/course/${access.course_id}`)}
                  >
                    <div className="relative">
                      {access.course.image_url ? (
                        <img
                          src={access.course.image_url}
                          alt={access.course.title}
                          className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-44 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <BookOpen className="h-12 w-12 text-primary/50" />
                        </div>
                      )}
                      {isCompleted && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-green-500 text-white">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Terminé
                          </Badge>
                        </div>
                      )}
                      {!isCompleted && courseProgress > 0 && (
                        <div className="absolute top-3 right-3">
                          <Badge variant="secondary">
                            En cours
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-5 space-y-4">
                      <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
                        {access.course.title}
                      </h3>

                      {access.course.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {access.course.description}
                        </p>
                      )}

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progression</span>
                          <span className="font-semibold">{courseProgress}%</span>
                        </div>
                        <Progress value={courseProgress} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Depuis {new Date(access.access_granted_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>

                      <Button className="w-full" variant={isCompleted ? "outline" : "default"}>
                        <Play className="h-4 w-4 mr-2" />
                        {isCompleted ? "Revoir" : courseProgress > 0 ? "Continuer" : "Commencer"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
