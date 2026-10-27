import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, BookOpen, CheckCircle2, Play, Award,
  GraduationCap, Lock, ShoppingCart
} from "lucide-react";

interface StudentCourse {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  duration: string | null;
  level: string | null;
  category: string | null;
  image_url: string | null;
}

interface CourseAccess {
  id: string;
  course_id: string;
  access_expires_at: string | null;
  course: StudentCourse;
}

const COURSE_COLUMNS = "id, title, description, price, currency, duration, level, category, image_url";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [accesses, setAccesses] = useState<CourseAccess[]>([]);
  const [catalogue, setCatalogue] = useState<StudentCourse[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [certificateCount, setCertificateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth?redirect=/student");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const fullName = profileData?.full_name || user.user_metadata?.full_name;
      setFirstName(fullName ? String(fullName).split(" ")[0] : null);

      // Formations auxquelles l'étudiant a accès (actif et non expiré)
      const { data: accessData, error: accessError } = await supabase
        .from("student_access")
        .select(`id, course_id, access_expires_at, course:courses(${COURSE_COLUMNS})`)
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (accessError) throw accessError;

      const now = new Date();
      const activeAccesses = ((accessData || []) as unknown as CourseAccess[]).filter(
        (a) => a.course && (!a.access_expires_at || new Date(a.access_expires_at) > now)
      );
      setAccesses(activeAccesses);

      const ownedIds = activeAccesses.map((a) => a.course_id);

      if (ownedIds.length > 0) {
        setProgress(await computeProgress(user.id, ownedIds));
      }

      const { count } = await supabase
        .from("course_certificates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setCertificateCount(count || 0);

      // Autres formations publiées, achetables à l'unité
      const { data: publishedData } = await supabase
        .from("courses")
        .select(COURSE_COLUMNS)
        .eq("is_published", true)
        .eq("category", "formation")
        .order("created_at", { ascending: false })
        .limit(12);

      setCatalogue(((publishedData || []) as StudentCourse[]).filter((c) => !ownedIds.includes(c.id)));
    } catch (error) {
      console.error("Error loading student dashboard:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  // Même règle que la page du cours et que le certificat : contenus obligatoires des modules publiés
  const computeProgress = async (userId: string, courseIds: string[]) => {
    const result: Record<string, number> = {};
    courseIds.forEach((id) => { result[id] = 0; });

    const { data: modules } = await supabase
      .from("course_modules")
      .select("id, course_id")
      .in("course_id", courseIds)
      .eq("is_published", true);

    if (!modules || modules.length === 0) return result;

    const courseByModule = new Map(modules.map((m) => [m.id, m.course_id]));

    const { data: contents } = await supabase
      .from("module_contents")
      .select("id, module_id, is_mandatory")
      .in("module_id", modules.map((m) => m.id));

    const { data: progressRows } = await supabase
      .from("student_progress")
      .select("content_id, is_completed")
      .eq("user_id", userId)
      .in("course_id", courseIds);

    const completed = new Set(
      (progressRows || []).filter((p) => p.is_completed && p.content_id).map((p) => p.content_id)
    );

    const totals: Record<string, { total: number; done: number }> = {};
    (contents || [])
      .filter((c) => c.is_mandatory !== false)
      .forEach((c) => {
        const courseId = courseByModule.get(c.module_id);
        if (!courseId) return;
        totals[courseId] = totals[courseId] || { total: 0, done: 0 };
        totals[courseId].total += 1;
        if (completed.has(c.id)) totals[courseId].done += 1;
      });

    Object.entries(totals).forEach(([courseId, { total, done }]) => {
      result[courseId] = total > 0 ? Math.round((done / total) * 100) : 0;
    });

    return result;
  };

  const completedCount = accesses.filter((a) => progress[a.course_id] === 100).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] flex flex-col items-center justify-center space-y-4 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-[#0E7C66]" />
        <p className="text-xs font-bold font-inter text-slate-400">Chargement de votre Espace Étudiant Ecomfy...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white">

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-space font-extrabold text-base md:text-xl text-white">Espace Étudiant Ecomfy</h1>
              <p className="text-xs text-slate-400 hidden sm:block">Vos formations, votre progression et vos certificats.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/student/certificates")}
              className="rounded-full border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs font-bold gap-1.5"
            >
              <Award className="h-4 w-4 text-emerald-400" />
              <span className="hidden sm:inline">Mes Certificats</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/academy")}
              className="rounded-full text-slate-400 hover:text-white text-xs font-bold"
            >
              Tutoriels gratuits
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* Welcome banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-space font-extrabold text-white">
              {firstName ? `Bienvenue, ${firstName}` : "Bienvenue dans votre Espace d'Apprentissage"} 👋
            </h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {accesses.length > 0
                ? "Reprenez vos formations là où vous vous êtes arrêté et décrochez vos certificats."
                : "Vous n'avez pas encore de formation débloquée. Inscrivez-vous à une formation ci-dessous ou suivez les tutoriels gratuits de l'Académie."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center min-w-[120px]">
              <div className="text-2xl font-space font-extrabold text-white">{accesses.length}</div>
              <div className="text-[10px] text-slate-400">Formations Débloquées</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center min-w-[120px]">
              <div className="text-2xl font-space font-extrabold text-amber-400">{certificateCount}</div>
              <div className="text-[10px] text-slate-400">Certificats Obtenus</div>
            </div>
          </div>
        </div>

        {/* Mes formations */}
        <div className="space-y-4">
          <h3 className="text-xl font-space font-bold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#0E7C66]" />
            <span>Mes Formations ({accesses.length})</span>
            {completedCount > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">
                {completedCount} terminée{completedCount > 1 ? "s" : ""}
              </Badge>
            )}
          </h3>

          {accesses.length === 0 ? (
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-8 text-center space-y-4">
              <Lock className="h-12 w-12 text-slate-500 mx-auto" />
              <h4 className="text-lg font-bold text-white">Aucune formation débloquée</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Une fois votre paiement validé par le formateur, vos formations apparaissent ici.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accesses.map(({ id, course_id, course }) => {
                const prog = progress[course_id] || 0;
                return (
                  <Card key={id} className="bg-slate-900/90 border-slate-800 rounded-3xl overflow-hidden shadow-xl hover:border-slate-700 transition-all flex flex-col group">
                    <div className="relative aspect-video overflow-hidden bg-slate-950">
                      {course.image_url ? (
                        <img
                          src={course.image_url}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85 group-hover:opacity-100"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-12 w-12 text-slate-700" />
                        </div>
                      )}
                      {prog === 100 && (
                        <Badge className="absolute top-3 left-3 bg-emerald-600 text-white border-0 text-[10px] font-bold gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Terminée
                        </Badge>
                      )}
                      {course.duration && (
                        <Badge className="absolute top-3 right-3 bg-slate-950/80 text-white border-0 text-[10px]">
                          {course.duration}
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        {course.category && (
                          <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px]">
                            {course.category}
                          </Badge>
                        )}
                        <h4 className="font-space font-bold text-base text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                          {course.title}
                        </h4>
                        {course.description && (
                          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                            {course.description}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3 pt-2 border-t border-slate-800/80">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Progression</span>
                            <span className="font-bold text-white">{prog}%</span>
                          </div>
                          <Progress value={prog} className="h-2 bg-slate-950" />
                        </div>

                        <Button
                          onClick={() => navigate(`/student/course/${course_id}`)}
                          className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 py-2.5 shadow-lg"
                        >
                          <Play className="h-4 w-4" />
                          <span>{prog > 0 ? "Continuer la Formation" : "Commencer la Formation"}</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Formations disponibles à l'achat */}
        {catalogue.length > 0 && (
          <div className="space-y-4 pt-4">
            <div>
              <h3 className="text-xl font-space font-bold text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-amber-400" />
                <span>Autres formations disponibles ({catalogue.length})</span>
              </h3>
              <p className="text-xs text-slate-400">Inscrivez-vous à l'unité pour débloquer l'accès.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalogue.map((c) => (
                <Card key={c.id} className="bg-slate-900/60 border-slate-800/80 rounded-3xl overflow-hidden shadow-xl flex flex-col">
                  <div className="relative aspect-video overflow-hidden bg-slate-950">
                    {c.image_url && (
                      <img
                        src={c.image_url}
                        alt={c.title}
                        className="w-full h-full object-cover opacity-40 grayscale"
                      />
                    )}
                    <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-slate-900/90 border border-slate-700 text-amber-400 flex items-center justify-center shadow-2xl">
                        <Lock className="h-6 w-6" />
                      </div>
                    </div>
                    <Badge className="absolute top-3 left-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                      {c.price > 0 ? `${c.price.toLocaleString("fr-FR")} ${c.currency}` : "Gratuite"}
                    </Badge>
                  </div>

                  <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      {c.category && (
                        <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px]">
                          {c.category}
                        </Badge>
                      )}
                      <h4 className="font-space font-bold text-base text-white line-clamp-2">
                        {c.title}
                      </h4>
                      {c.description && (
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                          {c.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <Button
                        onClick={() => navigate(`/enroll/${c.id}`)}
                        className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 py-2.5 shadow-lg"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        <span>S'inscrire à la formation</span>
                      </Button>
                    </div>
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
