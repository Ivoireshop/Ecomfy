import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Play, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ModuleContent {
  id: string;
  title: string;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
  duration_minutes: number | null;
}

interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  is_preview: boolean;
  module_contents: ModuleContent[];
}

interface CoursePreviewViewerProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onEnroll: () => void;
  primaryColor?: string;
}

export function CoursePreviewViewer({
  courseId,
  open,
  onClose,
  onEnroll,
  primaryColor = "#2563eb",
}: CoursePreviewViewerProps) {
  const [previewModules, setPreviewModules] = useState<CourseModule[]>([]);
  const [selectedContent, setSelectedContent] = useState<ModuleContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadPreview();
    }
  }, [open, courseId]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("course_modules")
        .select(`
          id,
          title,
          description,
          is_preview,
          module_contents (
            id,
            title,
            content_type,
            content_url,
            content_text,
            duration_minutes
          )
        `)
        .eq("course_id", courseId)
        .eq("is_preview", true)
        .eq("is_published", true)
        .order("module_order", { ascending: true });

      if (error) throw error;
      setPreviewModules(data || []);

      // Auto-select first content if available
      if (data && data.length > 0 && data[0].module_contents?.length > 0) {
        setSelectedContent(data[0].module_contents[0]);
      }
    } catch (error) {
      console.error("Error loading preview:", error);
    } finally {
      setLoading(false);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Play className="h-4 w-4" />;
      case "text":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" style={{ color: primaryColor }} />
            Aperçu gratuit de la formation
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : previewModules.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun aperçu disponible pour cette formation
            </p>
            <Button onClick={onEnroll} className="mt-4" style={{ backgroundColor: primaryColor }}>
              S'inscrire maintenant
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden">
            <div className="md:col-span-1 overflow-y-auto border rounded-lg p-4 space-y-2">
              <div className="mb-4">
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Contenu gratuit
                </Badge>
              </div>
              {previewModules.map((module) => (
                <div key={module.id} className="space-y-2">
                  <h4 className="font-semibold text-sm">{module.title}</h4>
                  {module.module_contents?.map((content: ModuleContent) => (
                    <button
                      key={content.id}
                      onClick={() => setSelectedContent(content)}
                      className={`w-full text-left p-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                        selectedContent?.id === content.id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {getContentIcon(content.content_type)}
                      <span className="flex-1">{content.title}</span>
                      {content.duration_minutes && (
                        <span className="text-xs text-muted-foreground">
                          {content.duration_minutes}min
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
              <div className="pt-4 border-t mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Lock className="h-4 w-4" />
                  <span>Contenus verrouillés disponibles après inscription</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 overflow-y-auto">
              {selectedContent ? (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{selectedContent.title}</h3>
                      {selectedContent.duration_minutes && (
                        <p className="text-sm text-muted-foreground">
                          Durée: {selectedContent.duration_minutes} minutes
                        </p>
                      )}
                    </div>

                    {selectedContent.content_type === "video" && selectedContent.content_url ? (
                      <div className="aspect-video rounded-lg overflow-hidden bg-black">
                        <video
                          src={selectedContent.content_url}
                          controls
                          className="w-full h-full"
                        >
                          Votre navigateur ne supporte pas la lecture de vidéos.
                        </video>
                      </div>
                    ) : selectedContent.content_type === "text" && selectedContent.content_text ? (
                      <div className="prose max-w-none">
                        <div
                          className="whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: selectedContent.content_text }}
                        />
                      </div>
                    ) : selectedContent.content_url ? (
                      <div className="text-center py-8">
                        <a
                          href={selectedContent.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Ouvrir le contenu
                        </a>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Aucun contenu disponible</p>
                    )}

                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-4">
                        Vous aimez cet aperçu ? Inscrivez-vous pour accéder à l'ensemble de la formation !
                      </p>
                      <Button
                        onClick={onEnroll}
                        className="w-full"
                        size="lg"
                        style={{ backgroundColor: primaryColor }}
                      >
                        S'inscrire à la formation complète
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Sélectionnez un contenu pour le visualiser
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
