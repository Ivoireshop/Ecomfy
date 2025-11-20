import { supabase } from "@/integrations/supabase/client";

interface MoveToTrashParams {
  showcaseId: string;
  itemType: 'feature' | 'formation' | 'testimonial' | 'gallery_image' | 'biography_image' | 'logo' | 'hero_image' | 'about_image';
  itemData: any;
  storagePath?: string;
}

/**
 * Move an item to trash instead of deleting it permanently
 * Items will be automatically deleted after 30 days
 */
export const moveToTrash = async ({
  showcaseId,
  itemType,
  itemData,
  storagePath
}: MoveToTrashParams): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Non authentifié");
    }

    const { error } = await supabase
      .from("showcase_trash")
      .insert({
        showcase_site_id: showcaseId,
        user_id: user.id,
        item_type: itemType,
        item_data: itemData,
        storage_path: storagePath || null,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error moving to trash:", error);
    return false;
  }
};

/**
 * Extract storage path from image URL
 */
export const extractStoragePath = (imageUrl: string): string | null => {
  try {
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/showcase-images/');
    if (pathParts.length > 1) {
      return pathParts[1].split('?')[0]; // Remove query params
    }
    return null;
  } catch (error) {
    console.error("Error extracting storage path:", error);
    return null;
  }
};
