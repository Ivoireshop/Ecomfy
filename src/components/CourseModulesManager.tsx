import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit, ChevronDown, ChevronUp, Video, FileText, File } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Module {
  id: string;
  title: string;
  description: string | null;
  module_order: number;
  duration_minutes: number | null;
  is_published: boolean;
  is_preview: boolean;
}

interface Content {
  id: string;
  module_id: string;
  title: string;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
  content_order: number;
  duration_minutes: number | null;
  is_mandatory: boolean;
}

interface CourseModulesManagerProps {
  courseId: string;
}

export function CourseModulesManager({ courseId }: CourseModulesManagerProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [contents, setContents] = useState<Record<string, Content[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const [moduleForm, setModuleForm] = useState({
    title: "",
    description: "",
    duration_minutes: null as number | null,
    is_published: false,
    is_preview: false,
  });

  const [contentForm, setContentForm] = useState({
    title: "",
    content_type: "video",
    content_url: "",
    content_text: "",
    duration_minutes: null as number | null,
    is_mandatory: true,
  });

  useEffect(() => {
    loadModules();
  }, [courseId]);

  const loadModules = async () => {
    try {
      const { data: modulesData, error: modulesError } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", courseId)
        .order("module_order");

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      // Load contents for all modules
      if (modulesData && modulesData.length > 0) {
        const { data: contentsData, error: contentsError } = await supabase
          .from("module_contents")
          .select("*")
          .in("module_id", modulesData.map(m => m.id))
          .order("content_order");

        if (contentsError) throw contentsError;

        // Group contents by module_id
        const groupedContents = (contentsData || []).reduce((acc, content) => {
          if (!acc[content.module_id]) acc[content.module_id] = [];
          acc[content.module_id].push(content);
          return acc;
        }, {} as Record<string, Content[]>);

        setContents(groupedContents);
      }
    } catch (error: any) {
      toast.error("Erreur lors du chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const moduleData = {
        ...moduleForm,
        course_id: courseId,
        module_order: editingModule?.module_order || modules.length,
      };

      if (editingModule) {
        const { error } = await supabase
          .from("course_modules")
          .update(moduleData)
          .eq("id", editingModule.id);

        if (error) throw error;
        toast.success("Module mis à jour");
      } else {
        const { error } = await supabase
          .from("course_modules")
          .insert([moduleData]);

        if (error) throw error;
        toast.success("Module créé");
      }

      setModuleForm({ title: "", description: "", duration_minutes: null, is_published: false, is_preview: false });
      setEditingModule(null);
      loadModules();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    }
  };

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedModuleId) {
      toast.error("Sélectionnez un module");
      return;
    }

    try {
      const contentData = {
        ...contentForm,
        module_id: selectedModuleId,
        content_order: editingContent?.content_order || (contents[selectedModuleId]?.length || 0),
      };

      if (editingContent) {
        const { error } = await supabase
          .from("module_contents")
          .update(contentData)
          .eq("id", editingContent.id);

        if (error) throw error;
        toast.success("Contenu mis à jour");
      } else {
        const { error } = await supabase
          .from("module_contents")
          .insert([contentData]);

        if (error) throw error;
        toast.success("Contenu ajouté");
      }

      setContentForm({
        title: "",
        content_type: "video",
        content_url: "",
        content_text: "",
        duration_minutes: null,
        is_mandatory: true,
      });
      setEditingContent(null);
      setSelectedModuleId(null);
      loadModules();
    } catch (error: any) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Supprimer ce module et tout son contenu ?")) return;

    try {
      const { error } = await supabase.from("course_modules").delete().eq("id", id);
      if (error) throw error;
      toast.success("Module supprimé");
      loadModules();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  const handleDeleteContent = async (id: string) => {
    if (!confirm("Supprimer ce contenu ?")) return;

    try {
      const { error } = await supabase.from("module_contents").delete().eq("id", id);
      if (error) throw error;
      toast.success("Contenu supprimé");
      loadModules();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
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

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Form */}
        <Card>
          <CardHeader>
            <CardTitle>{editingModule ? "Modifier le module" : "Nouveau module"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleModuleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Titre du module *</Label>
                <Input
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Durée (minutes)</Label>
                <Input
                  type="number"
                  value={moduleForm.duration_minutes || ""}
                  onChange={(e) =>
                    setModuleForm({
                      ...moduleForm,
                      duration_minutes: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={moduleForm.is_published}
                  onCheckedChange={(checked) =>
                    setModuleForm({ ...moduleForm, is_published: checked })
                  }
                />
                <Label>Publié</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={moduleForm.is_preview}
                  onCheckedChange={(checked) =>
                    setModuleForm({ ...moduleForm, is_preview: checked })
                  }
                />
                <Label>Aperçu gratuit (visible sans inscription)</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit">{editingModule ? "Mettre à jour" : "Créer"}</Button>
                {editingModule && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingModule(null);
                      setModuleForm({
                        title: "",
                        description: "",
                        duration_minutes: null,
                        is_published: false,
                        is_preview: false,
                      });
                    }}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Content Form */}
        <Card>
          <CardHeader>
            <CardTitle>{editingContent ? "Modifier le contenu" : "Nouveau contenu"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleContentSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Module *</Label>
                <Select
                  value={selectedModuleId || ""}
                  onValueChange={setSelectedModuleId}
                  disabled={editingContent !== null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Titre *</Label>
                <Input
                  value={contentForm.title}
                  onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Type de contenu *</Label>
                <Select
                  value={contentForm.content_type}
                  onValueChange={(value) => setContentForm({ ...contentForm, content_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vidéo (YouTube/Vimeo)</SelectItem>
                    <SelectItem value="pdf">Document PDF</SelectItem>
                    <SelectItem value="text">Texte/Article</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {contentForm.content_type !== "text" && (
                <div className="space-y-2">
                  <Label>URL *</Label>
                  <Input
                    type="url"
                    placeholder={
                      contentForm.content_type === "video"
                        ? "https://youtube.com/watch?v=..."
                        : "https://..."
                    }
                    value={contentForm.content_url}
                    onChange={(e) => setContentForm({ ...contentForm, content_url: e.target.value })}
                    required
                  />
                </div>
              )}

              {contentForm.content_type === "text" && (
                <div className="space-y-2">
                  <Label>Contenu texte *</Label>
                  <Textarea
                    value={contentForm.content_text}
                    onChange={(e) => setContentForm({ ...contentForm, content_text: e.target.value })}
                    rows={6}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Durée (minutes)</Label>
                <Input
                  type="number"
                  value={contentForm.duration_minutes || ""}
                  onChange={(e) =>
                    setContentForm({
                      ...contentForm,
                      duration_minutes: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={contentForm.is_mandatory}
                  onCheckedChange={(checked) =>
                    setContentForm({ ...contentForm, is_mandatory: checked })
                  }
                />
                <Label>Obligatoire</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit">{editingContent ? "Mettre à jour" : "Ajouter"}</Button>
                {editingContent && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingContent(null);
                      setContentForm({
                        title: "",
                        content_type: "video",
                        content_url: "",
                        content_text: "",
                        duration_minutes: null,
                        is_mandatory: true,
                      });
                    }}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Modules List */}
      <Card>
        <CardHeader>
          <CardTitle>Modules et contenus</CardTitle>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun module créé
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {modules.map((module) => (
                <AccordionItem key={module.id} value={module.id}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{module.title}</span>
                        {!module.is_published && (
                          <span className="text-xs text-muted-foreground">(Brouillon)</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {contents[module.id]?.length || 0} contenu(s)
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="flex gap-2 mb-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingModule(module);
                          setModuleForm({
                            title: module.title,
                            description: module.description || "",
                            duration_minutes: module.duration_minutes,
                            is_published: module.is_published,
                            is_preview: module.is_preview,
                          });
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteModule(module.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedModuleId(module.id);
                          setEditingContent(null);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter contenu
                      </Button>
                    </div>

                    {contents[module.id]?.length > 0 && (
                      <div className="space-y-2">
                        {contents[module.id].map((content) => (
                          <div
                            key={content.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              {getContentIcon(content.content_type)}
                              <span>{content.title}</span>
                              {content.duration_minutes && (
                                <span className="text-xs text-muted-foreground">
                                  ({content.duration_minutes} min)
                                </span>
                              )}
                              {content.is_mandatory && (
                                <span className="text-xs text-primary">Obligatoire</span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingContent(content);
                                  setSelectedModuleId(content.module_id);
                                  setContentForm({
                                    title: content.title,
                                    content_type: content.content_type,
                                    content_url: content.content_url || "",
                                    content_text: content.content_text || "",
                                    duration_minutes: content.duration_minutes,
                                    is_mandatory: content.is_mandatory,
                                  });
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteContent(content.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
