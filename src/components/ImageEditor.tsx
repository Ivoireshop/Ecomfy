import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricText, FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X, Type, Trash2, Download } from "lucide-react";

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (editedImageUrl: string) => void;
  productName: string;
}

export const ImageEditor = ({ imageUrl, onClose, onSave, productName }: ImageEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [textContent, setTextContent] = useState("");
  const [fontSize, setFontSize] = useState(40);
  const [textColor, setTextColor] = useState("#000000");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [underline, setUnderline] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1200,
      height: 628,
      backgroundColor: "#ffffff",
    });

    // Charger l'image générée
    FabricImage.fromURL(imageUrl, {
      crossOrigin: "anonymous",
    }).then((img) => {
      const scale = Math.min(
        canvas.width! / (img.width || 1),
        canvas.height! / (img.height || 1)
      );
      img.scale(scale);
      img.set({
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });
      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.renderAll();
    }).catch((error) => {
      console.error("Error loading image:", error);
      toast.error("Erreur lors du chargement de l'image");
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [imageUrl]);

  const handleAddText = () => {
    if (!fabricCanvas || !textContent.trim()) {
      toast.error("Veuillez entrer un texte");
      return;
    }

    const text = new FabricText(textContent, {
      left: 100,
      top: 100,
      fontSize: fontSize,
      fill: textColor,
      fontFamily: fontFamily,
      underline: underline,
      editable: true,
      lockScalingFlip: true,
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    setTextContent("");
    toast.success("Texte ajouté ! Double-cliquez dessus pour l'éditer");
  };

  const handleUpdateSelectedText = () => {
    if (!fabricCanvas) return;

    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject instanceof FabricText) {
      activeObject.set({
        fontSize: fontSize,
        fill: textColor,
        fontFamily: fontFamily,
        underline: underline,
      });
      fabricCanvas.renderAll();
      toast.success("Texte mis à jour !");
    } else {
      toast.error("Veuillez sélectionner un texte à modifier");
    }
  };

  const handleDeleteSelected = () => {
    if (!fabricCanvas) return;

    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      fabricCanvas.remove(activeObject);
      fabricCanvas.renderAll();
      toast.success("Élément supprimé");
    } else {
      toast.error("Aucun élément sélectionné");
    }
  };

  const handleSave = () => {
    if (!fabricCanvas) return;

    const dataURL = fabricCanvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });

    onSave(dataURL);
    toast.success("Image modifiée avec succès !");
  };

  const handleDownload = () => {
    if (!fabricCanvas) return;

    const dataURL = fabricCanvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });

    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `${productName.replace(/\s+/g, "-")}-edited.png`;
    link.click();
    toast.success("Image téléchargée !");
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Éditeur d'image</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Panneau d'outils */}
            <div className="lg:col-span-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="textContent">Ajouter du texte</Label>
                <Input
                  id="textContent"
                  placeholder="Tapez votre texte..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddText()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontSize">Taille du texte</Label>
                <Input
                  id="fontSize"
                  type="number"
                  min="10"
                  max="200"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="textColor">Couleur du texte</Label>
                <Input
                  id="textColor"
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontFamily">Police d'écriture</Label>
                <select
                  id="fontFamily"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Impact">Impact</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="underline"
                  checked={underline}
                  onChange={(e) => setUnderline(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="underline">Souligner le texte</Label>
              </div>

              <Button onClick={handleAddText} className="w-full">
                <Type className="mr-2 h-4 w-4" />
                Ajouter un nouveau texte
              </Button>

              <Button onClick={handleUpdateSelectedText} variant="secondary" className="w-full">
                <Type className="mr-2 h-4 w-4" />
                Modifier le texte sélectionné
              </Button>

              <Button onClick={handleDeleteSelected} variant="destructive" className="w-full">
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer la sélection
              </Button>

              <div className="pt-4 border-t space-y-2">
                <Button onClick={handleSave} className="w-full">
                  Enregistrer les modifications
                </Button>
                <Button onClick={handleDownload} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            </div>

            {/* Canvas */}
            <div className="lg:col-span-3">
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <canvas ref={canvasRef} className="max-w-full" />
              </div>
              <div className="text-sm text-muted-foreground mt-2 space-y-1">
                <p>💡 <strong>Cliquez</strong> sur un texte pour le sélectionner et le déplacer</p>
                <p>✏️ <strong>Double-cliquez</strong> sur un texte pour l'éditer directement</p>
                <p>🎨 <strong>Sélectionnez</strong> un texte et modifiez les paramètres à gauche, puis cliquez sur "Modifier le texte sélectionné"</p>
                <p>🗑️ <strong>Sélectionnez</strong> un élément et cliquez sur "Supprimer" pour l'effacer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
