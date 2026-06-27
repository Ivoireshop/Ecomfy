import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, RotateCcw, Calendar, Image as ImageIcon, FileText, GraduationCap, MessageSquare, User } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface TrashItem {
  id: string;
  item_type: string;
  item_data: any;
  storage_path: string | null;
  deleted_at: string;
  expires_at: string;
}

interface TrashManagerProps {
  showcaseId: string;
  onRestore?: () => void;
}

const ITEM_TYPE_CONFIG = {
  feature: { label: "Service", icon: FileText, color: "bg-blue-500" },
  formation: { label: "Formation", icon: GraduationCap, color: "bg-purple-500" },
  testimonial: { label: "Témoignage", icon: MessageSquare, color: "bg-green-500" },
  gallery_image: { label: "Image Galerie", icon: ImageIcon, color: "bg-orange-500" },
  biography_image: { label: "Image Biographie", icon: User, color: "bg-pink-500" },
  logo: { label: "Logo", icon: ImageIcon, color: "bg-yellow-500" },
  hero_image: { label: "Image Hero", icon: ImageIcon, color: "bg-red-500" },
  about_image: { label: "Image À Propos", icon: ImageIcon, color: "bg-cyan-500" },
};

export const TrashManager = ({ showcaseId, onRestore }: TrashManagerProps) => {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadTrashItems();
  }, [showcaseId]);

  const loadTrashItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("showcase_trash")
        .select("*")
        .eq("showcase_site_id", showcaseId)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setTrashItems(data || []);
    } catch (error) {
      console.error("Error loading trash:", error);
      toast.error("Erreur lors du chargement de la corbeille");
    } finally {
      setIsLoading(false);
    }
  };

  const restoreItem = async (item: TrashItem) => {
    setIsRestoring(item.id);
    try {
      // Restore storage file if exists
      if (item.storage_path) {
        // Check if file still exists in storage
        const { data: fileExists } = await supabase.storage
          .from('showcase-images')
          .list(item.storage_path.split('/')[0], {
            search: item.storage_path.split('/').pop()
          });

        if (!fileExists || fileExists.length === 0) {
          toast.error("L'image originale n'existe plus dans le stockage");
          return;
        }
      }

      // Restore to original location based on item type
      switch (item.item_type) {
        case 'gallery_image':
          const { error: galleryError } = await supabase
            .from("showcase_galleries")
            .insert({
              showcase_site_id: showcaseId,
              ...item.item_data
            });
          if (galleryError) throw galleryError;
          break;

        case 'testimonial':
          const { error: testimonialError } = await supabase
            .from("showcase_testimonials")
            .insert({
              showcase_site_id: showcaseId,
              ...item.item_data
            });
          if (testimonialError) throw testimonialError;
          break;

        case 'logo':
        case 'hero_image':
        case 'about_image':
        case 'biography_image':
          const columnName = item.item_type === 'logo' ? 'logo_url' 
            : item.item_type === 'hero_image' ? 'hero_image_url'
            : item.item_type === 'about_image' ? 'about_image_url'
            : 'biography_image_url';

          const { error: imageError } = await supabase
            .from("showcase_sites")
            .update({ [columnName]: item.item_data.url } as any)
            .eq("id", showcaseId);
          if (imageError) throw imageError;
          break;

        case 'feature':
        case 'formation':
          // These are stored in JSONB arrays, need to fetch and update
          const { data: siteData, error: fetchError } = await supabase
            .from("showcase_sites")
            .select(item.item_type === 'feature' ? 'features' : 'formations')
            .eq("id", showcaseId)
            .single();

          if (fetchError) throw fetchError;

          const currentItems = (siteData as any)[item.item_type === 'feature' ? 'features' : 'formations'] || [];
          const columnToUpdate = item.item_type === 'feature' ? 'features' : 'formations';
          
          const { error: updateError } = await supabase
            .from("showcase_sites")
            .update({ [columnToUpdate]: [...currentItems, item.item_data] } as any)
            .eq("id", showcaseId);
          
          if (updateError) throw updateError;
          break;
      }

      // Remove from trash
      const { error: deleteError } = await supabase
        .from("showcase_trash")
        .delete()
        .eq("id", item.id);

      if (deleteError) throw deleteError;

      toast.success("Élément restauré avec succès !");
      await loadTrashItems();
      onRestore?.();
    } catch (error) {
      console.error("Error restoring item:", error);
      toast.error("Erreur lors de la restauration");
    } finally {
      setIsRestoring(null);
    }
  };

  const permanentlyDelete = async (itemId: string) => {
    setIsDeleting(itemId);
    try {
      const item = trashItems.find(i => i.id === itemId);
      
      // Delete storage file if exists
      if (item?.storage_path) {
        await supabase.storage
          .from('showcase-images')
          .remove([item.storage_path]);
      }

      // Remove from trash
      const { error } = await supabase
        .from("showcase_trash")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      toast.success("Élément supprimé définitivement");
      await loadTrashItems();
    } catch (error) {
      console.error("Error permanently deleting item:", error);
      toast.error("Erreur lors de la suppression définitive");
    } finally {
      setIsDeleting(null);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const emptyTrash = async () => {
    if (!confirm("Vider toute la corbeille ? Cette action est irréversible.")) {
      return;
    }

    try {
      // Delete all storage files
      for (const item of trashItems) {
        if (item.storage_path) {
          await supabase.storage
            .from('showcase-images')
            .remove([item.storage_path]);
        }
      }

      // Remove all from trash
      const { error } = await supabase
        .from("showcase_trash")
        .delete()
        .eq("showcase_site_id", showcaseId);

      if (error) throw error;

      toast.success("Corbeille vidée avec succès");
      await loadTrashItems();
    } catch (error) {
      console.error("Error emptying trash:", error);
      toast.error("Erreur lors du vidage de la corbeille");
    }
  };

  const getItemPreview = (item: TrashItem) => {
    const config = ITEM_TYPE_CONFIG[item.item_type as keyof typeof ITEM_TYPE_CONFIG];
    const Icon = config?.icon || FileText;

    return (
      <div className="flex items-start gap-4">
        <div className={`${config?.color || 'bg-gray-500'} p-3 rounded-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">{config?.label || item.item_type}</Badge>
            <span className="text-xs text-muted-foreground">
              Expire {formatDistanceToNow(new Date(item.expires_at), { addSuffix: true, locale: fr })}
            </span>
          </div>
          <p className="font-medium truncate">
            {item.item_data.title || item.item_data.full_name || item.item_data.name || "Sans titre"}
          </p>
          {item.item_data.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.item_data.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Supprimé {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true, locale: fr })}
          </p>
        </div>
      </div>
    );
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Corbeille
              </CardTitle>
              <CardDescription>
                Les éléments supprimés sont conservés pendant 30 jours
              </CardDescription>
            </div>
            {trashItems.length > 0 && (
              <Button variant="destructive" onClick={emptyTrash}>
                Vider la corbeille
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {trashItems.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Trash2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">La corbeille est vide</p>
              <p className="text-sm text-muted-foreground mt-1">
                Les éléments supprimés apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {trashItems.map((item) => (
                <Card key={item.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {getItemPreview(item)}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isRestoring === item.id}
                          onClick={() => restoreItem(item)}
                        >
                          {isRestoring === item.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Restauration...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restaurer
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isDeleting === item.id}
                          onClick={() => {
                            setItemToDelete(item.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          {isDeleting === item.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Suppression...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'élément sera définitivement supprimé et ne pourra plus être restauré.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && permanentlyDelete(itemToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
