import { useState, useEffect, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage, IText, FabricObject } from "fabric";
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
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [textContent, setTextContent] = useState("");
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [textColor, setTextColor] = useState("#000000");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: "#ffffff",
    });

    // Load the image
    FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" }).then((img) => {
      if (!img) return;
      
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

    const text = new IText("Double-cliquez pour éditer", {
      left: 100,
      top: 100,
      fontSize: 24,
      fill: "#000000",
      fontFamily: "Arial",
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    toast.success("Texte ajouté - Double-cliquez pour éditer");
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Éditeur de Texte - Style Canva</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <div className="border rounded-lg overflow-hidden bg-muted">
              <canvas ref={canvasRef} />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              💡 Double-cliquez sur un texte pour l'éditer directement sur l'image
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Enregistrer les modifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
