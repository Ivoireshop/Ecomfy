import { useState, useEffect, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage, IText, FabricObject, Shadow } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Trash2, Sparkles, Zap, Tag } from "lucide-react";
import { toast } from "sonner";

interface ImageTextEditorProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedImageBlob: Blob) => void;
}

const FONTS = [
  "Arial",
  "Helvetica",
  "Poppins",
  "Playfair Display",
  "Montserrat",
  "Lora",
  "Raleway",
  "Roboto",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Courier New",
  "Impact",
  "Trebuchet MS",
  "Comic Sans MS",
];

interface TextTemplate {
  id: string;
  name: string;
  category: "titre" | "slogan" | "prix";
  text: string;
  style: {
    fontSize: number;
    fontFamily: string;
    fill: string;
    fontWeight: "normal" | "bold";
    fontStyle: "normal" | "italic";
    textAlign: "left" | "center" | "right";
    underline?: boolean;
  };
  icon: typeof Sparkles | typeof Zap | typeof Tag;
}

const TEXT_TEMPLATES: TextTemplate[] = [
  // Titres accrocheurs
  {
    id: "titre-impact",
    name: "Titre Impact",
    category: "titre",
    text: "VOTRE TITRE ICI",
    style: {
      fontSize: 60,
      fontFamily: "Impact",
      fill: "#FFFFFF",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
    },
    icon: Sparkles,
  },
  {
    id: "titre-elegant",
    name: "Titre Élégant",
    category: "titre",
    text: "Votre Titre Élégant",
    style: {
      fontSize: 48,
      fontFamily: "Playfair Display",
      fill: "#2C3E50",
      fontWeight: "bold",
      fontStyle: "italic",
      textAlign: "center",
    },
    icon: Sparkles,
  },
  {
    id: "titre-moderne",
    name: "Titre Moderne",
    category: "titre",
    text: "Titre Moderne et Pro",
    style: {
      fontSize: 52,
      fontFamily: "Montserrat",
      fill: "#1A1A1A",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "left",
    },
    icon: Sparkles,
  },
  {
    id: "titre-dynamique",
    name: "Titre Dynamique",
    category: "titre",
    text: "DÉCOUVREZ MAINTENANT",
    style: {
      fontSize: 56,
      fontFamily: "Raleway",
      fill: "#E74C3C",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
    },
    icon: Sparkles,
  },
  
  // Slogans
  {
    id: "slogan-court",
    name: "Slogan Court",
    category: "slogan",
    text: "La différence qui compte",
    style: {
      fontSize: 28,
      fontFamily: "Lora",
      fill: "#34495E",
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "center",
    },
    icon: Zap,
  },
  {
    id: "slogan-pro",
    name: "Slogan Professionnel",
    category: "slogan",
    text: "Qualité garantie • Service premium",
    style: {
      fontSize: 24,
      fontFamily: "Poppins",
      fill: "#2C3E50",
      fontWeight: "normal",
      fontStyle: "normal",
      textAlign: "center",
    },
    icon: Zap,
  },
  {
    id: "slogan-impact",
    name: "Slogan à Impact",
    category: "slogan",
    text: "FAITES LA DIFFÉRENCE",
    style: {
      fontSize: 32,
      fontFamily: "Roboto",
      fill: "#27AE60",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
    },
    icon: Zap,
  },
  {
    id: "slogan-elegant",
    name: "Slogan Élégant",
    category: "slogan",
    text: "L'excellence à votre portée",
    style: {
      fontSize: 26,
      fontFamily: "Playfair Display",
      fill: "#8E44AD",
      fontWeight: "normal",
      fontStyle: "italic",
      textAlign: "center",
    },
    icon: Zap,
  },
  
  // Prix promotionnels
  {
    id: "prix-promo-gros",
    name: "Prix Promo XL",
    category: "prix",
    text: "-50%",
    style: {
      fontSize: 80,
      fontFamily: "Impact",
      fill: "#E74C3C",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
    },
    icon: Tag,
  },
  {
    id: "prix-montant",
    name: "Prix Montant",
    category: "prix",
    text: "15 000 FCFA",
    style: {
      fontSize: 48,
      fontFamily: "Montserrat",
      fill: "#27AE60",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
    },
    icon: Tag,
  },
  {
    id: "prix-avant-apres",
    name: "Prix Barré",
    category: "prix",
    text: "25 000 FCFA",
    style: {
      fontSize: 36,
      fontFamily: "Roboto",
      fill: "#95A5A6",
      fontWeight: "normal",
      fontStyle: "normal",
      textAlign: "center",
      underline: true,
    },
    icon: Tag,
  },
  {
    id: "prix-nouveau",
    name: "Nouveau Prix",
    category: "prix",
    text: "SEULEMENT 12 500 FCFA",
    style: {
      fontSize: 42,
      fontFamily: "Raleway",
      fill: "#E67E22",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
    },
    icon: Tag,
  },
  {
    id: "prix-gratuit",
    name: "Offre Gratuite",
    category: "prix",
    text: "GRATUIT",
    style: {
      fontSize: 64,
      fontFamily: "Impact",
      fill: "#16A085",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
    },
    icon: Tag,
  },
];

export const ImageTextEditor = ({ imageUrl, isOpen, onClose, onSave }: ImageTextEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [textContent, setTextContent] = useState("");
  const [fontSize, setFontSize] = useState(64);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;

    // Responsive sizing: fit canvas to wrapper width (mobile-first).
    const wrap = canvasWrapRef.current;
    const wrapW = wrap?.clientWidth || Math.min(window.innerWidth - 32, 800);
    const targetW = Math.max(280, Math.min(wrapW, 1024));
    const targetH = Math.round(targetW * 0.75); // 4:3 default until image loads

    const canvas = new FabricCanvas(canvasRef.current, {
      width: targetW,
      height: targetH,
      backgroundColor: "#ffffff",
    });

    // Larger control handles for touch.
    FabricObject.prototype.cornerSize = 28;
    FabricObject.prototype.touchCornerSize = 44;
    FabricObject.prototype.cornerStyle = "circle";
    FabricObject.prototype.cornerColor = "#ffffff";
    FabricObject.prototype.cornerStrokeColor = "#111827";
    FabricObject.prototype.transparentCorners = false;
    FabricObject.prototype.borderColor = "#111827";
    FabricObject.prototype.borderScaleFactor = 2;

    // Load the image
    FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" }).then((img) => {
      if (!img) return;

      // Resize canvas to image aspect ratio.
      const iw = img.width || 1;
      const ih = img.height || 1;
      const newH = Math.round(targetW * (ih / iw));
      canvas.setDimensions({ width: targetW, height: newH });
      const scale = targetW / iw;

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
    });

    // Handle object selection
    canvas.on("selection:created", (e) => {
      const obj = e.selected?.[0];
      if (obj && obj instanceof IText) {
        setSelectedObject(obj);
        updateTextControls(obj);
      }
    });

    canvas.on("selection:updated", (e) => {
      const obj = e.selected?.[0];
      if (obj && obj instanceof IText) {
        setSelectedObject(obj);
        updateTextControls(obj);
      }
    });

    canvas.on("selection:cleared", () => {
      setSelectedObject(null);
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [imageUrl, isOpen]);

  const updateTextControls = (textObj: IText) => {
    setTextContent(textObj.text || "");
    setFontSize(textObj.fontSize || 24);
    setFontFamily(textObj.fontFamily || "Arial");
    setTextColor(textObj.fill?.toString() || "#000000");
    setIsBold(textObj.fontWeight === "bold");
    setIsItalic(textObj.fontStyle === "italic");
    setIsUnderline(textObj.underline || false);
  };

  const addText = () => {
    if (!fabricCanvas) return;

    const h = fabricCanvas.height || 600;
    const w = fabricCanvas.width || 800;
    // Default = ~8% of image height, bold, white with shadow for legibility.
    const defaultSize = Math.max(32, Math.round(h * 0.08));
    const text = new IText("VOTRE TEXTE", {
      left: w / 2,
      top: h / 2,
      originX: "center",
      originY: "center",
      fontSize: defaultSize,
      fill: "#FFFFFF",
      fontFamily: "Montserrat",
      fontWeight: "bold",
      textAlign: "center",
      shadow: new Shadow({ color: "rgba(0,0,0,0.6)", blur: 6, offsetX: 0, offsetY: 2 }),
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    setFontSize(defaultSize);
    setTextColor("#FFFFFF");
    setIsBold(true);
    toast.success("Texte ajouté — double-cliquez pour le modifier");
  };

  const addTemplateText = (template: TextTemplate) => {
    if (!fabricCanvas) return;

    const text = new IText(template.text, {
      left: fabricCanvas.width! / 2 - 100,
      top: fabricCanvas.height! / 2 - 50,
      fontSize: template.style.fontSize,
      fill: template.style.fill,
      fontFamily: template.style.fontFamily,
      fontWeight: template.style.fontWeight,
      fontStyle: template.style.fontStyle,
      textAlign: template.style.textAlign,
      underline: template.style.underline || false,
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    toast.success(`Template "${template.name}" ajouté`);
  };

  const updateSelectedText = () => {
    if (!selectedObject || !(selectedObject instanceof IText)) return;

    selectedObject.set({
      text: textContent,
      fontSize,
      fontFamily,
      fill: textColor,
      fontWeight: isBold ? "bold" : "normal",
      fontStyle: isItalic ? "italic" : "normal",
      underline: isUnderline,
    });

    fabricCanvas?.renderAll();
  };

  const setTextAlign = (align: "left" | "center" | "right") => {
    if (!selectedObject || !(selectedObject instanceof IText)) return;
    selectedObject.set({ textAlign: align });
    fabricCanvas?.renderAll();
  };

  const deleteSelected = () => {
    if (!selectedObject || !fabricCanvas) return;
    fabricCanvas.remove(selectedObject);
    setSelectedObject(null);
    fabricCanvas.renderAll();
  };

  const handleSave = async () => {
    if (!fabricCanvas) return;

    try {
      const dataUrl = fabricCanvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1,
      });

      const blob = await (await fetch(dataUrl)).blob();
      onSave(blob);
      toast.success("Image modifiée enregistrée");
      onClose();
    } catch (error) {
      console.error("Error saving image:", error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  useEffect(() => {
    if (selectedObject) {
      updateSelectedText();
    }
  }, [textContent, fontSize, fontFamily, textColor, isBold, isItalic, isUnderline]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[100vw] sm:w-auto h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6 rounded-none sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Éditeur de texte sur image</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 pb-24 sm:pb-0">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <div ref={canvasWrapRef} className="border rounded-lg overflow-hidden bg-muted flex justify-center">
              <canvas ref={canvasRef} className="max-w-full h-auto touch-none" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Double-cliquez sur un texte pour le modifier. Glissez les coins pour redimensionner.
            </p>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Button onClick={addText} className="w-full" size="lg">
                <Type className="w-4 h-4 mr-2" />
                Ajouter du Texte
              </Button>
              
              <details className="border rounded-lg p-3 bg-card">
                <summary className="cursor-pointer font-semibold text-sm flex items-center">
                  <Sparkles className="w-4 h-4 mr-2 text-primary" />
                  Templates Professionnels
                </summary>
                <ScrollArea className="h-64 mt-3">
                  <div className="space-y-4">
                    {/* Titres */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Titres Accrocheurs
                      </p>
                      <div className="space-y-1">
                        {TEXT_TEMPLATES.filter(t => t.category === "titre").map(template => (
                          <Button
                            key={template.id}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={() => addTemplateText(template)}
                          >
                            <template.icon className="w-3 h-3 mr-2" />
                            {template.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Slogans */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center">
                        <Zap className="w-3 h-3 mr-1" />
                        Slogans
                      </p>
                      <div className="space-y-1">
                        {TEXT_TEMPLATES.filter(t => t.category === "slogan").map(template => (
                          <Button
                            key={template.id}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={() => addTemplateText(template)}
                          >
                            <template.icon className="w-3 h-3 mr-2" />
                            {template.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Prix */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center">
                        <Tag className="w-3 h-3 mr-1" />
                        Prix Promotionnels
                      </p>
                      <div className="space-y-1">
                        {TEXT_TEMPLATES.filter(t => t.category === "prix").map(template => (
                          <Button
                            key={template.id}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={() => addTemplateText(template)}
                          >
                            <template.icon className="w-3 h-3 mr-2" />
                            {template.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </details>
            </div>

            {selectedObject && (
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">Texte</TabsTrigger>
                  <TabsTrigger value="style">Style</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-4">
                  <div>
                    <Label>Contenu du texte</Label>
                    <Input
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Votre texte..."
                    />
                  </div>

                  <div>
                    <Label>Taille: {fontSize}px</Label>
                    <Slider
                      value={[fontSize]}
                      onValueChange={(v) => setFontSize(v[0])}
                      min={10}
                      max={120}
                      step={1}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Police</Label>
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONTS.map((font) => (
                          <SelectItem key={font} value={font}>
                            <span style={{ fontFamily: font }}>{font}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Couleur</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="style" className="space-y-4">
                  <div>
                    <Label>Format du texte</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant={isBold ? "default" : "outline"}
                        size="icon"
                        onClick={() => setIsBold(!isBold)}
                      >
                        <Bold className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={isItalic ? "default" : "outline"}
                        size="icon"
                        onClick={() => setIsItalic(!isItalic)}
                      >
                        <Italic className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={isUnderline ? "default" : "outline"}
                        size="icon"
                        onClick={() => setIsUnderline(!isUnderline)}
                      >
                        <Underline className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Alignement</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setTextAlign("left")}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setTextAlign("center")}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setTextAlign("right")}
                      >
                        <AlignRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    onClick={deleteSelected}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer le texte
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {!selectedObject && (
              <div className="text-center text-muted-foreground text-sm p-4 border rounded-lg">
                Cliquez sur "Ajouter du Texte" ou sélectionnez un texte existant pour l'éditer
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-3 sm:static sm:border-0 sm:p-0 flex-row gap-2 [padding-bottom:max(env(safe-area-inset-bottom),0.75rem)]">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-initial h-11">
            Annuler
          </Button>
          <Button onClick={handleSave} className="flex-1 sm:flex-initial h-11">
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
