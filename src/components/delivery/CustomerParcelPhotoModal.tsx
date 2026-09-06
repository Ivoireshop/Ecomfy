import React, { useState } from "react";
import { Camera, Upload, CheckCircle2, PackageCheck, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { deliveryService } from "@/lib/deliveryService";

interface CustomerParcelPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatchId: string;
  onPhotoUploaded?: (photoUrl: string) => void;
}

export default function CustomerParcelPhotoModal({
  isOpen,
  onClose,
  dispatchId,
  onPhotoUploaded
}: CustomerParcelPhotoModalProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `parcel_${dispatchId}_${Date.now()}.${fileExt}`;
      const filePath = `parcel-photos/${fileName}`;

      const { data, error } = await supabase.storage
        .from('shop-assets')
        .upload(filePath, file);

      if (error) {
        // Data URL preview fallback
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result as string);
          setUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(filePath);

      setPhotoPreview(publicUrlData.publicUrl);
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur de chargement", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!photoPreview) {
      toast({ variant: "destructive", title: "Photo requise", description: "Veuillez prendre ou sélectionner une photo du colis." });
      return;
    }

    setUploading(true);
    try {
      await deliveryService.updateParcelPhoto(dispatchId, photoPreview);
      toast({
        title: "Photo de colis transmise !",
        description: "La photo est maintenant accessible au livreur pour référence visuelle.",
      });

      if (onPhotoUploaded) onPhotoUploaded(photoPreview);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" /> Photo Preuve du Colis
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Prenez ou sélectionnez une photo claire du colis pour le livreur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950">
            {photoPreview ? (
              <div className="space-y-2 text-center">
                <img src={photoPreview} alt="Aperçu colis" className="w-48 h-48 object-cover rounded-lg border border-emerald-500/40 mx-auto" />
                <span className="text-xs text-emerald-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Photo prêtre à être envoyée
                </span>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <Camera className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Prendre une photo du colis</p>
                <p className="text-[11px] text-slate-500">Formats supportés : JPG, PNG</p>
              </div>
            )}

            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="mt-4 bg-slate-900 border-slate-800 text-xs text-slate-300 cursor-pointer"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-slate-800 pt-3">
          <Button variant="outline" onClick={onClose} size="sm" className="border-slate-800 text-slate-400">
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={uploading || !photoPreview}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
          >
            {uploading ? "Envoi..." : "Transmettre au Livreur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
