import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, History, RotateCcw, Trash2, Calendar, User, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ShowcaseVersion {
  id: string;
  version_number: number;
  version_name: string | null;
  created_at: string;
  business_name: string;
  hero_title: string | null;
  theme: string;
}

interface ShowcaseVersionHistoryProps {
  showcaseSiteId: string;
  onRestore: (versionId: string) => void;
}

export function ShowcaseVersionHistory({ showcaseSiteId, onRestore }: ShowcaseVersionHistoryProps) {
  const [versions, setVersions] = useState<ShowcaseVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [editingVersionName, setEditingVersionName] = useState<string | null>(null);
  const [newVersionName, setNewVersionName] = useState("");

  useEffect(() => {
    loadVersions();
  }, [showcaseSiteId]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("showcase_versions")
        .select("id, version_number, version_name, created_at, business_name, hero_title, theme")
        .eq("showcase_site_id", showcaseSiteId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error("Error loading versions:", error);
      toast.error("Erreur lors du chargement des versions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setIsRestoring(true);
    try {
      // Get the full version data
      const { data: versionData, error: fetchError } = await supabase
        .from("showcase_versions")
        .select("*")
        .eq("id", versionId)
        .single();

      if (fetchError || !versionData) {
        throw new Error("Version non trouvée");
      }

      // Get testimonials from the version
      const testimonials = (versionData.testimonials as any[]) || [];

      // Update the showcase site with version data
      const { error: updateError } = await supabase
        .from("showcase_sites")
        .update({
          business_name: versionData.business_name,
          business_description: versionData.business_description,
          owner_name: versionData.owner_name,
          owner_photo_url: versionData.owner_photo_url,
          whatsapp_number: versionData.whatsapp_number,
          phone_number: versionData.phone_number,
          hero_title: versionData.hero_title,
          hero_subtitle: versionData.hero_subtitle,
          about_title: versionData.about_title,
          about_description: versionData.about_description,
          cta_title: versionData.cta_title,
          cta_description: versionData.cta_description,
          formation_title: versionData.formation_title,
          formation_description: versionData.formation_description,
          formation_price: versionData.formation_price,
          formation_image_url: versionData.formation_image_url,
          theme: versionData.theme,
          primary_color: versionData.primary_color,
          secondary_color: versionData.secondary_color,
          text_color: versionData.text_color,
          logo_url: versionData.logo_url,
          hero_image_url: versionData.hero_image_url,
          about_image_url: versionData.about_image_url,
          features: versionData.features,
          formations: versionData.formations,
          formations_text_align: versionData.formations_text_align,
          about_layout: versionData.about_layout,
          gallery_text_position: versionData.gallery_text_position,
          font_family: versionData.font_family,
          theme_mode: versionData.theme_mode,
          seo_title: versionData.seo_title,
          seo_description: versionData.seo_description,
          seo_keywords: versionData.seo_keywords,
          og_image_url: versionData.og_image_url,
          og_type: versionData.og_type,
          twitter_card: versionData.twitter_card,
        })
        .eq("id", showcaseSiteId);

      if (updateError) throw updateError;

      // Restore testimonials
      await supabase
        .from("showcase_testimonials")
        .delete()
        .eq("showcase_site_id", showcaseSiteId);

      if (Array.isArray(testimonials) && testimonials.length > 0) {
        const { error: testimonialsError } = await supabase
          .from("showcase_testimonials")
          .insert(testimonials.map((t: any) => ({
            showcase_site_id: showcaseSiteId,
            full_name: t.full_name,
            testimonial_text: t.testimonial_text,
            result_image_url: t.result_image_url,
            display_order: t.display_order,
          })));

        if (testimonialsError) throw testimonialsError;
      }

      toast.success("Version restaurée avec succès !");
      onRestore(versionId);
    } catch (error) {
      console.error("Error restoring version:", error);
      toast.error("Erreur lors de la restauration");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from("showcase_versions")
        .delete()
        .eq("id", versionId);

      if (error) throw error;

      toast.success("Version supprimée");
      loadVersions();
    } catch (error) {
      console.error("Error deleting version:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleUpdateVersionName = async (versionId: string) => {
    if (!newVersionName.trim()) {
      setEditingVersionName(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("showcase_versions")
        .update({ version_name: newVersionName })
        .eq("id", versionId);

      if (error) throw error;

      toast.success("Nom de version mis à jour");
      setEditingVersionName(null);
      setNewVersionName("");
      loadVersions();
    } catch (error) {
      console.error("Error updating version name:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historique des Versions
        </CardTitle>
        <CardDescription>
          Consultez et restaurez les versions précédentes de votre site
        </CardDescription>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune version sauvegardée</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les versions seront créées automatiquement lors des sauvegardes
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {versions.map((version, index) => (
                <Card key={version.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={index === 0 ? "default" : "secondary"}>
                            Version {version.version_number}
                          </Badge>
                          {index === 0 && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
                              Actuelle
                            </Badge>
                          )}
                        </div>

                        {editingVersionName === version.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={newVersionName}
                              onChange={(e) => setNewVersionName(e.target.value)}
                              placeholder="Nom de la version (optionnel)"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateVersionName(version.id);
                                if (e.key === "Escape") {
                                  setEditingVersionName(null);
                                  setNewVersionName("");
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleUpdateVersionName(version.id)}
                            >
                              OK
                            </Button>
                          </div>
                        ) : (
                          <h3
                            className="font-semibold text-lg cursor-pointer hover:text-primary"
                            onClick={() => {
                              setEditingVersionName(version.id);
                              setNewVersionName(version.version_name || "");
                            }}
                          >
                            {version.version_name || "Sans nom"}
                          </h3>
                        )}

                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {formatDate(version.created_at)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{version.theme}</Badge>
                            {version.hero_title && (
                              <span className="truncate max-w-[300px]">
                                {version.hero_title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {index !== 0 && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isRestoring}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Restaurer
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cela remplacera le contenu actuel de votre site par cette version.
                                    L'état actuel sera sauvegardé comme nouvelle version.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRestore(version.id)}>
                                    Restaurer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer cette version ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible. La version sera définitivement supprimée.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteVersion(version.id)}>
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}