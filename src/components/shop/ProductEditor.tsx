import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Plus, X, Upload, Image as ImageIcon, DollarSign,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Video, Type, Palette, Undo, Redo,
  ChevronDown, Eye, Layers, Package, Settings, Search as SearchIcon, ShoppingCart, BarChart3,
  Minus, Code, Smile, Table, ExternalLink, Store, MapPin, Tag, Loader2
} from "lucide-react";

const CATEGORIES = [
  "Mode & Vêtements", "Électronique", "Beauté & Soins", "Maison & Déco",
  "Alimentation", "Sport", "Accessoires", "Digital", "Autre"
];

const FONT_SIZES = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48"];

const COLORS = [
  "#000000", "#333333", "#666666", "#999999", "#CCCCCC", "#FFFFFF",
  "#FF0000", "#FF6600", "#FFCC00", "#00CC00", "#0066FF", "#9933FF",
  "#FF3399", "#FF9966", "#FFFF00", "#66FF66", "#66CCFF", "#CC99FF",
];

const PRODUCT_TYPES = ["Physique", "Digital", "Service", "Abonnement"];
const PRODUCT_LOCATIONS = ["Entrepôt principal", "Stock fournisseur", "Dropshipping", "Sur commande"];

const EMOJIS = [
  "😀","😂","😍","🥰","😎","🤩","🔥","✅","⭐","💯","🎉","💪",
  "❤️","💚","💙","💛","🧡","💜","🖤","🤍","👍","👏","🙏","💰",
  "🛒","📦","🎁","✨","⚡","🏷️","📣","🚀","💎","🌟","👑","🔔",
  "⚠️","🆕","🔝","♻️","🌿","🍃","💊","🧴","🧪","💄","👗","👟",
];

interface ProductImage {
  id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

interface ProductData {
  name: string;
  description: string;
  short_description: string;
  price: number;
  compare_at_price: number;
  category: string;
  stock_quantity: number;
  is_digital: boolean;
  is_published: boolean;
  is_featured: boolean;
  sku: string;
  weight: number;
}

interface ProductEditorProps {
  initialData?: ProductData;
  existingImages?: ProductImage[];
  isEditing: boolean;
  onSave: (data: ProductData, newImages: File[]) => void;
  onCancel: () => void;
  onUploadImage?: (file: File) => void;
  onDeleteImage?: (imageId: string) => void;
  saving?: boolean;
  shopSlug?: string;
  shopActivated?: boolean;
  shopPublished?: boolean;
}

export function ProductEditor({
  initialData, existingImages = [], isEditing, onSave, onCancel, onUploadImage, onDeleteImage, saving,
  shopSlug, shopActivated, shopPublished
}: ProductEditorProps) {
  const [product, setProduct] = useState<ProductData>(initialData || {
    name: "", description: "", short_description: "", price: 0, compare_at_price: 0,
    category: "Autre", stock_quantity: 10, is_digital: false, is_published: true,
    sku: "", weight: 0, is_featured: false,
  });
  const [newImages, setNewImages] = useState<File[]>([]);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [productType, setProductType] = useState("Physique");
  const [productLocation, setProductLocation] = useState("Entrepôt principal");
  const [costPrice, setCostPrice] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInitialized = useRef(false);
  const { toast } = useToast();

  // AI image generation
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleGenerateAiImage = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast({ title: "Décrivez votre visuel", description: "Saisissez une description du produit.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-image", {
        body: { prompt: `Photo produit professionnelle, fond neutre, éclairage studio. ${prompt}`, mode: "simple" },
      });
      if (error) throw error;
      const imageUrl: string | undefined = data?.imageUrl || data?.image_url;
      if (!imageUrl) throw new Error("Aucune image reçue");
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "png").split(";")[0];
      const file = new File([blob], `ai-${Date.now()}.${ext}`, { type: blob.type || "image/png" });
      setNewImages((prev) => [...prev, file]);
      toast({ title: "✓ Image ajoutée", description: "Pensez à enregistrer le produit." });
      setAiOpen(false);
      setAiPrompt("");
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Génération impossible", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  // Initialize editor content only once
  useEffect(() => {
    if (editorRef.current && !editorInitialized.current && product.description) {
      editorRef.current.innerHTML = product.description;
      editorInitialized.current = true;
    }
  }, [product.description]);

  const closeAllDropdowns = useCallback(() => {
    setShowFontSize(false);
    setShowTextColor(false);
    setShowBgColor(false);
    setShowEmoji(false);
  }, []);

  const execCmd = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  // Image resize/align controls
  const [selectedEditorImage, setSelectedEditorImage] = useState<HTMLImageElement | null>(null);
  const [imageToolbar, setImageToolbar] = useState<{ top: number; left: number } | null>(null);

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      setSelectedEditorImage(img);
      img.style.outline = "2px solid #3b82f6";
      img.style.outlineOffset = "2px";
      const rect = img.getBoundingClientRect();
      const editorRect = editorRef.current?.getBoundingClientRect();
      if (editorRect) {
        setImageToolbar({ top: rect.top - editorRect.top - 44, left: rect.left - editorRect.left });
      }
    } else {
      if (selectedEditorImage) {
        selectedEditorImage.style.outline = "none";
        selectedEditorImage.style.outlineOffset = "0";
      }
      setSelectedEditorImage(null);
      setImageToolbar(null);
    }
  }, [selectedEditorImage]);

  const resizeImage = (size: string) => {
    if (!selectedEditorImage) return;
    selectedEditorImage.style.maxWidth = size;
    selectedEditorImage.style.width = size;
    selectedEditorImage.style.height = "auto";
    handleEditorInput();
  };

  const alignImage = (align: string) => {
    if (!selectedEditorImage) return;
    const wrapper = selectedEditorImage.parentElement;
    if (align === "center") {
      selectedEditorImage.style.display = "block";
      selectedEditorImage.style.marginLeft = "auto";
      selectedEditorImage.style.marginRight = "auto";
      selectedEditorImage.style.float = "none";
    } else if (align === "left") {
      selectedEditorImage.style.float = "left";
      selectedEditorImage.style.marginRight = "12px";
      selectedEditorImage.style.marginLeft = "0";
      selectedEditorImage.style.display = "inline";
    } else if (align === "right") {
      selectedEditorImage.style.float = "right";
      selectedEditorImage.style.marginLeft = "12px";
      selectedEditorImage.style.marginRight = "0";
      selectedEditorImage.style.display = "inline";
    }
    handleEditorInput();
  };

  const deleteEditorImage = () => {
    if (!selectedEditorImage) return;
    selectedEditorImage.remove();
    setSelectedEditorImage(null);
    setImageToolbar(null);
    handleEditorInput();
  };

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          execCmd("insertHTML", `<img src="${reader.result}" style="max-width:100%;height:auto;margin:12px 0;border-radius:8px;cursor:pointer;" />`);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const insertVideo = () => {
    const url = prompt("Entrez l'URL de la vidéo (YouTube, Vimeo...)");
    if (url) {
      let embedUrl = url;
      const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
      const html = `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:12px 0;border-radius:8px;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div>`;
      execCmd("insertHTML", html);
    }
  };

  const insertLink = () => {
    const url = prompt("URL du lien");
    if (url) execCmd("createLink", url);
  };

  const insertHR = () => {
    execCmd("insertHTML", '<hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />');
  };

  const insertTable = () => {
    const html = `<table style="width:100%;border-collapse:collapse;margin:12px 0;"><tbody>
      <tr><td style="border:1px solid #ddd;padding:8px;">Cell 1</td><td style="border:1px solid #ddd;padding:8px;">Cell 2</td><td style="border:1px solid #ddd;padding:8px;">Cell 3</td></tr>
      <tr><td style="border:1px solid #ddd;padding:8px;">Cell 4</td><td style="border:1px solid #ddd;padding:8px;">Cell 5</td><td style="border:1px solid #ddd;padding:8px;">Cell 6</td></tr>
    </tbody></table>`;
    execCmd("insertHTML", html);
  };

  const insertEmoji = (emoji: string) => {
    execCmd("insertText", emoji);
    setShowEmoji(false);
  };

  const toggleCodeView = () => {
    if (!editorRef.current) return;
    const isCode = editorRef.current.getAttribute("data-code-view") === "true";
    if (isCode) {
      editorRef.current.innerHTML = editorRef.current.innerText;
      editorRef.current.setAttribute("data-code-view", "false");
    } else {
      editorRef.current.innerText = editorRef.current.innerHTML;
      editorRef.current.setAttribute("data-code-view", "true");
    }
  };

  const insertSpecialChar = () => {
    const char = prompt("Entrez un caractère spécial (ex: Ω, ©, ™, €, £, ¥)");
    if (char) execCmd("insertText", char);
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setProduct(prev => ({ ...prev, description: editorRef.current!.innerHTML }));
    }
  };

  // Handle Enter key properly - ensure default browser behavior works
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Let default contentEditable behavior handle Enter (insert <div> or <br>)
      // Don't preventDefault - this is the fix for the spacing issue
      e.stopPropagation();
    }
  };

  const allImages = [
    ...existingImages.map(img => ({ type: "existing" as const, ...img })),
    ...newImages.map((file, i) => ({ type: "new" as const, id: `new-${i}`, image_url: URL.createObjectURL(file), file })),
  ];

  const shopUrl = shopSlug ? `/shop/${shopSlug}` : null;
  const canViewInShop = shopActivated && shopPublished && shopUrl;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-card border-b">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-bold text-base md:text-lg">
              {isEditing ? "Modifier le produit" : "Créer un produit"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-pink-500 hover:bg-pink-600 text-white"
              onClick={() => onSave(product, newImages)}
              disabled={!product.name || product.price <= 0 || saving}
            >
              {saving ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isEditing ? "Enregistrer" : "Ajouter le produit"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col lg:flex-row gap-0">
        {/* Main Editor */}
        <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
          {/* Product URL */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">https://votreboutique.shop/produit/{product.name ? product.name.toLowerCase().replace(/\s+/g, "-") : "..."}</span>
          </div>

          {/* Short Description */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Courte description du produit</Label>
            <Input
              value={product.short_description}
              onChange={(e) => setProduct({ ...product, short_description: e.target.value })}
              placeholder="Résumé court du produit"
              className="h-10"
            />
          </div>

          {/* Rich Text Editor */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Description complète</Label>
            <div className="border rounded-lg overflow-hidden">
              {/* Toolbar Row 1 */}
              <div className="bg-muted/30 border-b px-2 py-1.5 flex flex-wrap items-center gap-0.5">
                {/* Fullscreen placeholder */}
                <ToolbarButton icon={<div className="h-3.5 w-3.5 border border-current rounded-sm" />} onClick={() => {}} title="Plein écran" />
                <ToolbarDivider />

                {/* Text formatting */}
                <ToolbarButton icon={<Bold className="h-3.5 w-3.5" />} onClick={() => execCmd("bold")} title="Gras" />
                <ToolbarButton icon={<Italic className="h-3.5 w-3.5" />} onClick={() => execCmd("italic")} title="Italique" />
                <ToolbarButton icon={<Underline className="h-3.5 w-3.5" />} onClick={() => execCmd("underline")} title="Souligné" />
                <ToolbarButton icon={<Strikethrough className="h-3.5 w-3.5" />} onClick={() => execCmd("strikethrough")} title="Barré" />
                <ToolbarDivider />

                {/* Font size */}
                <div className="relative">
                  <ToolbarButton icon={<span className="text-[10px] font-bold">12</span>} onClick={() => { closeAllDropdowns(); setShowFontSize(!showFontSize); }} title="Taille du texte" hasDropdown />
                  {showFontSize && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-1 min-w-[80px] max-h-[200px] overflow-y-auto">
                      {FONT_SIZES.map(size => (
                        <button key={size} className="block w-full text-left px-3 py-1 text-sm hover:bg-muted rounded"
                          onClick={() => { execCmd("fontSize", "7"); const el = editorRef.current?.querySelector('font[size="7"]'); if (el) (el as HTMLElement).style.fontSize = size + "px"; setShowFontSize(false); }}>
                          {size}px
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Text color */}
                <div className="relative">
                  <ToolbarButton icon={<div className="flex flex-col items-center"><span className="text-[10px] font-bold leading-none">A</span><div className="w-3 h-0.5 bg-red-500 rounded-full mt-0.5" /></div>} onClick={() => { closeAllDropdowns(); setShowTextColor(!showTextColor); }} title="Couleur du texte" hasDropdown />
                  {showTextColor && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[180px]">
                      <div className="grid grid-cols-6 gap-1">
                        {COLORS.map(color => (
                          <button key={color} className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => { execCmd("foreColor", color); setShowTextColor(false); }} />
                        ))}
                      </div>
                      <input type="color" className="w-full h-7 mt-2 cursor-pointer rounded" onChange={(e) => { execCmd("foreColor", e.target.value); setShowTextColor(false); }} />
                    </div>
                  )}
                </div>

                {/* Background color / highlighter */}
                <div className="relative">
                  <ToolbarButton icon={<div className="flex flex-col items-center"><span className="text-[10px] font-bold leading-none">A</span><div className="w-3 h-1 bg-yellow-400 rounded-sm mt-0.5" /></div>} onClick={() => { closeAllDropdowns(); setShowBgColor(!showBgColor); }} title="Surligneur" hasDropdown />
                  {showBgColor && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[180px]">
                      <div className="grid grid-cols-6 gap-1">
                        {COLORS.map(color => (
                          <button key={color} className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => { execCmd("hiliteColor", color); setShowBgColor(false); }} />
                        ))}
                      </div>
                      <input type="color" className="w-full h-7 mt-2 cursor-pointer rounded" onChange={(e) => { execCmd("hiliteColor", e.target.value); setShowBgColor(false); }} />
                    </div>
                  )}
                </div>

                {/* Eraser - remove formatting */}
                <ToolbarButton icon={<Palette className="h-3.5 w-3.5" />} onClick={() => execCmd("removeFormat")} title="Supprimer le formatage" />
                <ToolbarDivider />

                {/* Paragraph / Heading */}
                <ToolbarButton icon={<span className="text-[10px] font-bold">¶</span>} onClick={() => execCmd("formatBlock", "<p>")} title="Paragraphe" hasDropdown />

                {/* Alignment */}
                <ToolbarButton icon={<AlignLeft className="h-3.5 w-3.5" />} onClick={() => execCmd("justifyLeft")} title="Aligner à gauche" hasDropdown />
                <ToolbarDivider />

                {/* Lists */}
                <ToolbarButton icon={<ListOrdered className="h-3.5 w-3.5" />} onClick={() => execCmd("insertOrderedList")} title="Liste numérotée" hasDropdown />
                <ToolbarButton icon={<List className="h-3.5 w-3.5" />} onClick={() => execCmd("insertUnorderedList")} title="Liste à puces" hasDropdown />
                <ToolbarDivider />

                {/* Alignment group */}
                <ToolbarButton icon={<AlignCenter className="h-3.5 w-3.5" />} onClick={() => execCmd("justifyCenter")} title="Centrer" />
                <ToolbarButton icon={<AlignRight className="h-3.5 w-3.5" />} onClick={() => execCmd("justifyRight")} title="Aligner à droite" />
                <ToolbarButton icon={<AlignJustify className="h-3.5 w-3.5" />} onClick={() => execCmd("justifyFull")} title="Justifier" />
                <ToolbarDivider />

                {/* Link, Table, Emoji, Special char */}
                <ToolbarButton icon={<LinkIcon className="h-3.5 w-3.5" />} onClick={insertLink} title="Insérer un lien" />
                <ToolbarButton icon={<Table className="h-3.5 w-3.5" />} onClick={insertTable} title="Insérer un tableau" />
                <div className="relative">
                  <ToolbarButton icon={<Smile className="h-3.5 w-3.5" />} onClick={() => { closeAllDropdowns(); setShowEmoji(!showEmoji); }} title="Émojis" />
                  {showEmoji && (
                    <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[260px]">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJIS.map(emoji => (
                          <button key={emoji} className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded text-lg"
                            onClick={() => insertEmoji(emoji)}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <ToolbarButton icon={<span className="text-[11px] font-serif">Ω</span>} onClick={insertSpecialChar} title="Caractères spéciaux" />
              </div>

              {/* Toolbar Row 2 */}
              <div className="bg-muted/30 border-b px-2 py-1.5 flex flex-wrap items-center gap-0.5">
                {/* Horizontal rule */}
                <ToolbarButton icon={<Minus className="h-3.5 w-3.5" />} onClick={insertHR} title="Ligne horizontale" />
                {/* Code view */}
                <ToolbarButton icon={<Code className="h-3.5 w-3.5" />} onClick={toggleCodeView} title="Code source" />
                {/* Undo / Redo */}
                <ToolbarButton icon={<Undo className="h-3.5 w-3.5" />} onClick={() => execCmd("undo")} title="Annuler" />
                <ToolbarButton icon={<Redo className="h-3.5 w-3.5" />} onClick={() => execCmd("redo")} title="Rétablir" />
                <ToolbarDivider />
                {/* Image & Video */}
                <ToolbarButton icon={<ImageIcon className="h-3.5 w-3.5" />} onClick={insertImage} title="Insérer une image" />
                <ToolbarButton icon={<Video className="h-3.5 w-3.5" />} onClick={insertVideo} title="Insérer une vidéo" />
              </div>

              {/* Editor Area */}
              <div className="relative">
                {/* Image Toolbar */}
                {selectedEditorImage && imageToolbar && (
                  <div 
                    className="absolute z-50 flex items-center gap-1 bg-popover border rounded-lg shadow-lg p-1.5"
                    style={{ top: Math.max(0, imageToolbar.top), left: imageToolbar.left }}
                  >
                    <button onClick={() => resizeImage("25%")} className="px-2 py-1 text-xs rounded hover:bg-muted" title="25%">25%</button>
                    <button onClick={() => resizeImage("50%")} className="px-2 py-1 text-xs rounded hover:bg-muted" title="50%">50%</button>
                    <button onClick={() => resizeImage("75%")} className="px-2 py-1 text-xs rounded hover:bg-muted" title="75%">75%</button>
                    <button onClick={() => resizeImage("100%")} className="px-2 py-1 text-xs rounded hover:bg-muted" title="100%">100%</button>
                    <div className="w-px h-5 bg-border mx-0.5" />
                    <button onClick={() => alignImage("left")} className="p-1 rounded hover:bg-muted" title="Gauche"><AlignLeft className="h-3.5 w-3.5" /></button>
                    <button onClick={() => alignImage("center")} className="p-1 rounded hover:bg-muted" title="Centre"><AlignCenter className="h-3.5 w-3.5" /></button>
                    <button onClick={() => alignImage("right")} className="p-1 rounded hover:bg-muted" title="Droite"><AlignRight className="h-3.5 w-3.5" /></button>
                    <div className="w-px h-5 bg-border mx-0.5" />
                    <button onClick={deleteEditorImage} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Supprimer"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <div
                  ref={editorRef}
                  contentEditable
                  className="min-h-[350px] p-4 text-sm focus:outline-none [&>*]:mb-2"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  onInput={handleEditorInput}
                  onKeyDown={handleEditorKeyDown}
                  onClick={handleEditorClick}
                  suppressContentEditableWarning
                  data-code-view="false"
                />
              </div>
            </div>
          </div>

          {/* Tarification */}
          <CollapsibleSection title="Tarification" icon={<DollarSign className="h-4 w-4" />} defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Prix</Label>
                <Input type="number" value={product.price || ""} onChange={(e) => setProduct({ ...product, price: Number(e.target.value) })} placeholder="0" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Comparer au prix</Label>
                <Input type="number" value={product.compare_at_price || ""} onChange={(e) => setProduct({ ...product, compare_at_price: Number(e.target.value) })} placeholder="0" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Prix de revient</Label>
                <Input type="number" value={costPrice || ""} onChange={(e) => setCostPrice(Number(e.target.value))} placeholder="0" className="h-10" />
              </div>
            </div>
            {product.compare_at_price > 0 && product.price > 0 && product.compare_at_price > product.price && (
              <p className="text-xs text-green-600 mt-2">-{Math.round((1 - product.price / product.compare_at_price) * 100)}% de réduction</p>
            )}
            {costPrice > 0 && product.price > 0 && (
              <p className="text-xs text-blue-600 mt-1">Marge : {Math.round(((product.price - costPrice) / product.price) * 100)}% ({product.price - costPrice} bénéfice)</p>
            )}
          </CollapsibleSection>

          {/* Images */}
          <CollapsibleSection title="Images" icon={<ImageIcon className="h-4 w-4" />} defaultOpen>
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                <div className="text-blue-600 text-xs">ℹ️ Recommandation : utilisez une même taille/résolution de qualité. Le produit sera affiché avec la taille de 800x800</div>
              </div>
              {allImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {allImages.map((img) => (
                    <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => {
                          if (img.type === "existing" && onDeleteImage) onDeleteImage(img.id);
                          else setNewImages(prev => prev.filter((_, i) => `new-${i}` !== img.id));
                        }}
                        className="absolute top-1 right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="cursor-pointer block">
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) setNewImages(prev => [...prev, ...Array.from(e.target.files!)]); }} />
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Glissez & déposez ou cliquez pour télécharger</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP · Taille recommandée 800x800</p>
                </div>
              </label>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setAiOpen(true)}
              >
                <ImageIcon className="h-4 w-4" />
                Générer un visuel produit (IA)
              </Button>
            </div>
          </CollapsibleSection>

          {/* Variantes */}
          <CollapsibleSection title="Variantes" icon={<Layers className="h-4 w-4" />}>
            <div className="text-center py-6 text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Ajoutez des variantes (taille, couleur, etc.)</p>
              <p className="text-xs mt-1">Fonctionnalité bientôt disponible</p>
            </div>
          </CollapsibleSection>

          {/* Produits connexes */}
          <CollapsibleSection title="Produits connexes" icon={<Package className="h-4 w-4" />}>
            <div className="text-center py-6 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Associez des produits complémentaires</p>
              <p className="text-xs mt-1">Fonctionnalité bientôt disponible</p>
            </div>
          </CollapsibleSection>

          {/* Checkout */}
          <CollapsibleSection title="Checkout" icon={<ShoppingCart className="h-4 w-4" />}>
            <div className="text-center py-6 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Personnalisez le tunnel de paiement</p>
              <p className="text-xs mt-1">Fonctionnalité bientôt disponible</p>
            </div>
          </CollapsibleSection>

          {/* Options avancées */}
          <CollapsibleSection title="Options avancées" icon={<Settings className="h-4 w-4" />}>
            <div className="space-y-4">
              {/* Toggles */}
              {[
                { label: "Recocher", desc: "Permettre aux clients de recommander ce produit", key: "is_featured" as const },
                { label: "Déballer", desc: "Permettre le déballage vidéo du produit", key: "is_digital" as const },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                  <Switch checked={product[item.key] as boolean} onCheckedChange={(v) => setProduct({ ...product, [item.key]: v })} />
                </div>
              ))}

              {/* Product type */}
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Type de produit</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Product location */}
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Emplacement du produit</Label>
                <Select value={productLocation} onValueChange={setProductLocation}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Compte Arribo */}
              <div className="space-y-1.5">
                <Label className="text-sm">Compte Arribo</Label>
                <Input placeholder="Identifiant Arribo (optionnel)" className="h-10" />
                <p className="text-xs text-muted-foreground">Connectez votre compte Arribo pour la livraison automatique</p>
              </div>

              {/* More toggles */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Produit vedette</p>
                  <p className="text-xs text-muted-foreground">Mis en avant sur la page d'accueil</p>
                </div>
                <Switch checked={product.is_featured} onCheckedChange={(v) => setProduct({ ...product, is_featured: v })} />
              </div>
            </div>
          </CollapsibleSection>

          {/* SEO */}
          <CollapsibleSection title="SEO" icon={<BarChart3 className="h-4 w-4" />}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Meta titre</Label>
                  <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Titre pour les moteurs de recherche" className="h-10" />
                  <p className="text-xs text-muted-foreground">{seoTitle.length}/70 caractères recommandés</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">URL slug</Label>
                  <Input value={product.name ? product.name.toLowerCase().replace(/\s+/g, "-") : ""} disabled className="h-10 bg-muted/30" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Description meta</Label>
                <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Description pour les résultats de recherche" rows={2} />
                <p className="text-xs text-muted-foreground">{seoDescription.length}/160 caractères recommandés</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Mots-clés</Label>
                <Input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} placeholder="mot-clé1, mot-clé2, ..." className="h-10" />
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-[240px] border-t lg:border-t-0 lg:border-l bg-muted/10 p-5 space-y-6">
          {/* Visibility */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Visibilité</h4>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <Switch checked={product.is_published} onCheckedChange={(v) => setProduct({ ...product, is_published: v })} />
              <span>{product.is_published ? "Visible en ligne" : "Brouillon"}</span>
            </label>
          </div>

          {/* Storage */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Détails de stockage</h4>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">SKU</Label>
                <Input value={product.sku} onChange={(e) => setProduct({ ...product, sku: e.target.value })} placeholder="SKU" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Poids (g)</Label>
                <Input type="number" value={product.weight || ""} onChange={(e) => setProduct({ ...product, weight: Number(e.target.value) })} placeholder="0" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Inventaire</h4>
            <Input type="number" value={product.stock_quantity} onChange={(e) => setProduct({ ...product, stock_quantity: Number(e.target.value) })} className="h-9 text-sm" />
            <p className="text-xs text-muted-foreground mt-1">Suivre la quantité</p>
          </div>

          {/* Category */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Catégorie</h4>
            <Select value={product.category} onValueChange={(v) => setProduct({ ...product, category: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Nom du produit</h4>
            <Input value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} placeholder="Nom du produit" className="h-9 text-sm" />
          </div>

          {/* Vendeur */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Vendeur</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">V</div>
              <span>Propriétaire</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="sticky bottom-0 z-20 bg-card border-t px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {isEditing ? "Les modifications seront sauvegardées automatiquement" : "Remplissez les informations du produit"}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {canViewInShop && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(shopUrl!, "_blank")}>
                <Store className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Voir en magasin</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              const previewSlug = product.name ? product.name.toLowerCase().replace(/\s+/g, "-") : "";
              if (shopSlug) window.open(`/shop/${shopSlug}?preview_product=${previewSlug}`, "_blank");
            }}>
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Prévisualiser</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onSave(product, newImages)}
              disabled={!product.name || product.price <= 0 || saving}
            >
              <Save className="h-3.5 w-3.5" />
              {isEditing ? "Enregistrer" : "Ajouter le produit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Toolbar Helpers ────────────────────────────────────── */
function ToolbarButton({ icon, onClick, title, hasDropdown }: { icon: React.ReactNode; onClick: () => void; title: string; hasDropdown?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="h-7 min-w-[28px] px-0.5 flex items-center justify-center rounded hover:bg-muted transition-colors text-foreground/70 hover:text-foreground"
    >
      {icon}
      {hasDropdown && <ChevronDown className="h-2 w-2 ml-0.5 opacity-50" />}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between py-3 border-b hover:bg-muted/20 transition-colors px-1">
          <span className="flex items-center gap-2 font-semibold text-sm">{icon}{title}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
