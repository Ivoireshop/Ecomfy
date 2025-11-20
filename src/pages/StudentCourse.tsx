import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle2, Clock, FileText, Video, File } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Module {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
}

interface Content {
  id: string;
  module_id: string;
  title: string;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
  duration_minutes: number | null;
  is_mandatory: boolean;
}

interface StudentProgress {
  content_id: string;
  is_completed: boolean;
  notes: string | null;
}

export default function StudentCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [contents, setContents] = useState<Record<string, Content[]>>({});
  const [progress, setProgress] = useState<Record<string, StudentProgress>>({});
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const loadCourse = async () => {
    if (!courseId) return;

    try {
      // Check access
      const { data: accessData, error: accessError } = await supabase
        .from("student_access")
        .select("*, course:courses(*)")
        .eq("course_id", courseId)
        .eq("is_active", true)
        .single();

      if (accessError || !accessData) {
        toast.error("Vous n'avez pas accès à cette formation");
        navigate("/student");
        return;
      }

      setCourse(accessData.course);

      // Load modules
      const { data: modulesData, error: modulesError } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", courseId)
        .eq("is_published", true)
        .order("module_order");

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      // Load contents
      if (modulesData && modulesData.length > 0) {
        const { data: contentsData, error: contentsError } = await supabase
          .from("module_contents")
          .select("*")
          .in("module_id", modulesData.map(m => m.id))
          .order("content_order");

        if (contentsError) throw contentsError;

        const groupedContents = (contentsData || []).reduce((acc, content) => {
          if (!acc[content.module_id]) acc[content.module_id] = [];
          acc[content.module_id].push(content);
          return acc;
        }, {} as Record<string, Content[]>);

        setContents(groupedContents);

        // Load progress
        const { data: progressData } = await supabase
          .from("student_progress")
          .select("*")
          .eq("course_id", courseId);

        const progressMap = (progressData || []).reduce((acc, p) => {
          if (p.content_id) {
            acc[p.content_id] = {
              content_id: p.content_id,
              is_completed: p.is_completed,
              notes: p.notes,
            };
          }
          return acc;
        }, {} as Record<string, StudentProgress>);

        setProgress(progressMap);
      }
    } catch (error: any) {
      toast.error("Erreur lors du chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleContentCompletion = async (content: Content) => {
    const isCompleted = progress[content.id]?.is_completed || false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData = {
        user_id: user.id,
        course_id: courseId!,
        module_id: content.module_id,
        content_id: content.id,
        is_completed: !isCompleted,
        completed_at: !isCompleted ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from("student_progress")
        .upsert(progressData, { onConflict: "user_id,content_id" });

      if (error) throw error;

      setProgress({
        ...progress,
        [content.id]: {
          ...progress[content.id],
          content_id: content.id,
          is_completed: !isCompleted,
        },
      });

      toast.success(!isCompleted ? "Marqué comme terminé" : "Marqué comme non terminé");
    } catch (error: any) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    }
  };

  const saveNotes = async () => {
    if (!selectedContent) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("student_progress")
        .upsert({
          user_id: user.id,
          course_id: courseId!,
          module_id: selectedContent.module_id,
          content_id: selectedContent.id,
          notes: notes,
          is_completed: progress[selectedContent.id]?.is_completed || false,
        }, { onConflict: "user_id,content_id" });

      if (error) throw error;

      setProgress({
        ...progress,
        [selectedContent.id]: {
          ...progress[selectedContent.id],
          content_id: selectedContent.id,
          notes: notes,
        },
      });

      toast.success("Notes sauvegardées");
    } catch (error: any) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4" />;
      case "pdf": return <File className="h-4 w-4" />;
      case "text": return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const calculateModuleProgress = (moduleId: string) => {
    const moduleContents = contents[moduleId] || [];
    if (moduleContents.length === 0) return 0;
    
    const completedCount = moduleContents.filter(c => progress[c.id]?.is_completed).length;
    return Math.round((completedCount / moduleContents.length) * 100);
  };

  const calculateOverallProgress = () => {
    const allContents = Object.values(contents).flat();
    if (allContents.length === 0) return 0;
    
    const completedCount = allContents.filter(c => progress[c.id]?.is_completed).length;
    return Math.round((completedCount / allContents.length) * 100);
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
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/student")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Course Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">{course?.title}</CardTitle>
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progression globale</span>
                    <span className="font-medium">{calculateOverallProgress()}%</span>
                  </div>
                  <Progress value={calculateOverallProgress()} />
                </div>
              </CardHeader>
            </Card>

            {selectedContent ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{selectedContent.title}</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedContent(null)}
                    >
                      Fermer
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedContent.content_type === "video" && selectedContent.content_url && (
                    <div className="aspect-video">
                      <iframe
                        src={selectedContent.content_url.replace("watch?v=", "embed/")}
                        className="w-full h-full rounded-lg"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {selectedContent.content_type === "pdf" && selectedContent.content_url && (
                    <div>
                      <Button asChild className="w-full">
                        <a href={selectedContent.content_url} target="_blank" rel="noopener noreferrer">
                          <File className="h-4 w-4 mr-2" />
                          Ouvrir le PDF
                        </a>
                      </Button>
                    </div>
                  )}

                  {selectedContent.content_type === "text" && selectedContent.content_text && (
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-wrap">{selectedContent.content_text}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mes notes</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Prenez des notes ici..."
                      rows={4}
                    />
                    <Button size="sm" onClick={saveNotes}>
                      Sauvegarder les notes
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t">
                    <Checkbox
                      checked={progress[selectedContent.id]?.is_completed || false}
                      onCheckedChange={() => toggleContentCompletion(selectedContent)}
                    />
                    <label className="text-sm font-medium">
                      Marquer comme terminé
                    </label>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Sélectionnez un contenu dans la liste pour commencer
                </CardContent>
              </Card>
            )}
          </div>

          {/* Modules Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  {modules.map((module) => (
                    <AccordionItem key={module.id} value={module.id}>
                      <AccordionTrigger>
                        <div className="flex items-center justify-between w-full pr-4">
                          <span className="text-sm font-medium">{module.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {calculateModuleProgress(module.id)}%
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {contents[module.id]?.map((content) => (
                            <button
                              key={content.id}
                              onClick={() => {
                                setSelectedContent(content);
                                setNotes(progress[content.id]?.notes || "");
                              }}
                              className={`w-full flex items-center gap-2 p-2 text-left text-sm rounded-lg hover:bg-accent transition-colors ${
                                selectedContent?.id === content.id ? "bg-accent" : ""
                              }`}
                            >
                              {getContentIcon(content.content_type)}
                              <span className="flex-1">{content.title}</span>
                              {progress[content.id]?.is_completed && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
