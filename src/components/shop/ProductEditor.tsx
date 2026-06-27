import { useState, useRef, useCallback, useEffect, type ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ProductLivePreview } from "./ProductLivePreview";
import { ProductGifGenerator } from "./ProductGifGenerator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { prepareImageForUpload, formatSize } from "@/lib/imageCompress";
import {
  DEFAULT_PRODUCT_BLOCKS,
  PRODUCT_SECTION_LABELS,
  normalizeSectionOrder,
  type ProductSectionKey,
  type ProductSectionOrder,
} from "@/lib/productSections";
import {
  ArrowLeft, Save, Plus, X, Upload, Image as ImageIcon, DollarSign,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Video, Type, Palette, Undo, Redo,
  ChevronDown, Eye, Layers, Package, Settings, Search as SearchIcon, ShoppingCart, BarChart3,
  Minus, Code, Smile, Table, ExternalLink, Store, MapPin, Tag, Loader2, Film,
  ArrowUp, ArrowDown, GripVertical, Download
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableSectionRow({ id, idx, label }: { id: string; idx: number; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-muted/30"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-background text-xs font-bold border">
          {idx + 1}
        </span>
        <span className="text-sm font-medium truncate">{label}</span>
      </div>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted touch-none cursor-grab active:cursor-grabbing"
        aria-label="Glisser pour réordonner"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

function SectionLayoutPanel({
  order,
  onChange,
}: {
  order: ProductSectionOrder;
  onChange: (next: ProductSectionOrder) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const setLayout = (layout: "image_left" | "image_right") => onChange({ ...order, layout });
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = order.blocks.indexOf(active.id as ProductSectionKey);
    const newIdx = order.blocks.indexOf(over.id as ProductSectionKey);
    if (oldIdx < 0 || newIdx < 0) return;
    onChange({ ...order, blocks: arrayMove(order.blocks, oldIdx, newIdx) });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Position de l'image (desktop)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={order.layout === "image_left" ? "default" : "outline"}
            size="sm"
            onClick={() => setLayout("image_left")}
            className="h-9"
          >
            Image à gauche
          </Button>
          <Button
            type="button"
            variant={order.layout === "image_right" ? "default" : "outline"}
            size="sm"
            onClick={() => setLayout("image_right")}
            className="h-9"
          >
            Image à droite
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Sur mobile, l'image reste toujours en premier.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Ordre des blocs d'informations</Label>
        <p className="text-xs text-muted-foreground">
          Glissez-déposez chaque bloc avec la poignée pour le repositionner librement.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.blocks} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {order.blocks.map((key, idx) => (
                <SortableSectionRow
                  key={key}
                  id={key}
                  idx={idx}
                  label={PRODUCT_SECTION_LABELS[key]}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

const CATEGORIES = [
  "Mode & Vêtements", "Électronique", "Beauté & Soins", "Maison & Déco",
  "Alimentation", "Sport", "Accessoires", "Digital", "Autre"
];

const FONT_SIZE_PRESETS = [
  { size: "14", label: "Petit", hint: "Détails" },
  { size: "16", label: "Normal", hint: "Lecture mobile" },
  { size: "18", label: "Confort", hint: "Texte important" },
  { size: "20", label: "Grand", hint: "Accroche" },
  { size: "24", label: "Titre", hint: "Section" },
];

const COLORS = [
  "#000000", "#333333", "#666666", "#999999", "#CCCCCC", "#FFFFFF",
  "#FF0000", "#FF6600", "#FFCC00", "#00CC00", "#0066FF", "#9933FF",
  "#FF3399", "#FF9966", "#FFFF00", "#66FF66", "#66CCFF", "#CC99FF",
];

const PRODUCT_TYPES = ["Physique", "Digital", "Service", "Abonnement"];
const PRODUCT_LOCATIONS = ["Entrepôt principal", "Stock fournisseur", "Dropshipping", "Sur commande"];

const toProductSlug = (value: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const makeLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface PendingProductImage {
  id: string;
  file: File;
  previewUrl: string;
}

const EMOJIS = [
  "😀","😂","😍","🥰","😎","🤩","🔥","✅","⭐","💯","🎉","💪",
  "❤️","💚","💙","💛","🧡","💜","🖤","🤍","👍","👏","🙏","💰",
  "🛒","📦","🎁","✨","⚡","🏷️","📣","🚀","💎","🌟","👑","🔔",
  "⚠️","🆕","🔝","♻️","🌿","🍃","💊","🧴","🧪","💄","👗","👟",
];

const SYMBOLS = [
  "•","◦","▪","▫","■","□","●","○","★","☆","✓","✔","✗","✘","→","←","↑","↓","↔","⇒","⇐","⇑","⇓",
  "©","®","™","§","¶","†","‡","°","№","℃","℉","µ",
  "±","×","÷","≠","≈","≤","≥","∞","∑","∏","√","∫","∂","∆","Ω","π","α","β","γ","θ","λ","φ","ψ",
  "€","$","£","¥","¢","₣","₹","₽","₩","₺","«","»","“","”","‘","’","–","—","…","·","¿","¡",
  "①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩",
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
  slug?: string;
  bundle_offers?: BundleOffer[];
  bundle_position?: string;
  variants?: VariantGroup[];
  section_order?: ProductSectionOrder;
}

export interface BundleOffer {
  quantity: number;
  price: number;
  label?: string;
}

export interface VariantGroup {
  name: string;        // ex: "Taille", "Couleur"
  options: string[];   // ex: ["S","M","L"]
}

export const BUNDLE_POSITIONS: { value: string; label: string }[] = [
  { value: "under_image", label: "Sous l'image du produit" },
  { value: "after_price", label: "Sous le prix" },
  { value: "after_countdown", label: "Sous le compte à rebours" },
  { value: "after_description", label: "Après la description" },
  { value: "above_cta", label: "Juste avant le bouton commander" },
];

interface ProductEditorProps {
  initialData?: ProductData;
  existingImages?: ProductImage[];
  isEditing: boolean;
  onSave: (data: ProductData, newImages: File[]) => Promise<boolean | void> | boolean | void;
  onAutoSave?: (data: ProductData) => Promise<boolean | void> | boolean | void;
  onCancel: () => void;
  onUploadImage?: (file: File) => Promise<boolean> | boolean;
  onDeleteImage?: (imageId: string) => void;
  onSetPrimaryImage?: (imageId: string) => void;
  onReorderImages?: (orderedIds: string[]) => void;
  saving?: boolean;
  shopSlug?: string;
  shopActivated?: boolean;
  shopPublished?: boolean;
  productId?: string;
  shop?: { id: string; subscription_plan?: string | null; subscription_active_until?: string | null; gifs_generated_count?: number | null; gifs_period_start?: string | null };
}

export function ProductEditor({
  initialData, existingImages = [], isEditing, onSave, onAutoSave, onCancel, onUploadImage, onDeleteImage, onSetPrimaryImage, onReorderImages, saving,
  shopSlug, shopActivated, shopPublished, productId, shop,
}: ProductEditorProps) {
  const [product, setProduct] = useState<ProductData>(initialData || {
    name: "", description: "", short_description: "", price: 0, compare_at_price: 0,
    category: "Autre", stock_quantity: 10, is_digital: false, is_published: true,
    sku: "", weight: 0, is_featured: false, slug: "",
    bundle_offers: [], bundle_position: "after_countdown",
    variants: [],
    section_order: { layout: "image_left", blocks: [...DEFAULT_PRODUCT_BLOCKS] },
  });
  const [newImages, setNewImages] = useState<PendingProductImage[]>([]);
  const [validatingImages, setValidatingImages] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoSave = useRef(true);
  const [showFontSize, setShowFontSize] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState<string>("16");
  const [showTextColor, setShowTextColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSymbol, setShowSymbol] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);
  const [activeFmt, setActiveFmt] = useState({ bold: false, italic: false, underline: false, strike: false, ordered: false, unordered: false });
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [productType, setProductType] = useState("Physique");
  const [productLocation, setProductLocation] = useState("Entrepôt principal");
  const [costPrice, setCostPrice] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInitialized = useRef(false);
  const pendingImagesRef = useRef<PendingProductImage[]>([]);
  const savedSelection = useRef<{ range: Range; capturedAt: number } | null>(null);
  const { toast } = useToast();

  const addPendingImage = useCallback((file: File): PendingProductImage => ({
    id: makeLocalId(),
    file,
    previewUrl: URL.createObjectURL(file),
  }), []);

  const removePendingImage = useCallback((imageId: string) => {
    setNewImages(prev => {
      const target = prev.find(img => img.id === imageId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(img => img.id !== imageId);
    });
  }, []);

  useEffect(() => {
    pendingImagesRef.current = newImages;
  }, [newImages]);

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  // Protect the user against accidental tab close / reload while images
  // are queued for upload or the autosave is still pending. The browser
  // shows its native "leave this page?" confirmation.
  useEffect(() => {
    const hasPending = newImages.length > 0 || autoSaveState === "pending" || autoSaveState === "saving";
    if (!hasPending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [newImages.length, autoSaveState]);

  // AI image generation
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSourceImage, setAiSourceImage] = useState<string | null>(null);
  const [aiSourceFileName, setAiSourceFileName] = useState<string>("");
  const [gifOpen, setGifOpen] = useState(false);

  const handleAiSourceFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Fichier invalide", description: "Sélectionnez une image.", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Image trop lourde", description: "Maximum 8MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAiSourceImage(reader.result as string);
      setAiSourceFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAiImage = async (alsoDownload = false) => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast({ title: "Décrivez votre visuel", description: "Saisissez une description du produit.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const body = aiSourceImage
        ? {
            mode: "image-edit",
            prompt: `En utilisant l'image du produit fournie comme référence visuelle exacte (forme, couleurs, texture, étiquettes), génère un visuel produit professionnel : ${prompt}. Conserve l'identité du produit à l'identique.`,
            sourceImage: aiSourceImage,
          }
        : {
            mode: "simple",
            prompt: `Photo produit professionnelle, fond neutre, éclairage studio. ${prompt}`,
          };
      const { data, error } = await supabase.functions.invoke("generate-ai-image", { body });
      if (error) throw error;
      const imageUrl: string | undefined = data?.imageUrl || data?.image_url;
      if (!imageUrl) throw new Error("Aucune image reçue");
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "png").split(";")[0];
      const file = new File([blob], `ai-${Date.now()}.${ext}`, { type: blob.type || "image/png" });
      setNewImages((prev) => [...prev, addPendingImage(file)]);
      if (alsoDownload) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast({ title: "✓ Image ajoutée et téléchargée", description: "Pensez à enregistrer le produit." });
      } else {
        toast({ title: "✓ Image ajoutée", description: "Pensez à enregistrer le produit." });
      }
      setAiOpen(false);
      setAiPrompt("");
      setAiSourceImage(null);
      setAiSourceFileName("");
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

  // Auto-save (debounced) — only when editing an existing product and a handler is provided.
  useEffect(() => {
    if (!onAutoSave || !isEditing) return;
    // Skip the very first run (initial state hydration).
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    if (!product.name?.trim() && !product.short_description?.trim()) return;
    setAutoSaveState("pending");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveState("saving");
      try {
        const res = await onAutoSave(product);
        setAutoSaveState(res === false ? "error" : "saved");
      } catch {
        setAutoSaveState("error");
      }
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, onAutoSave, isEditing]);

  // Reset "saved" badge after a few seconds.
  useEffect(() => {
    if (autoSaveState !== "saved") return;
    const t = setTimeout(() => setAutoSaveState("idle"), 2500);
    return () => clearTimeout(t);
  }, [autoSaveState]);

  const closeAllDropdowns = useCallback(() => {
    setShowFontSize(false);
    setShowTextColor(false);
    setShowBgColor(false);
    setShowEmoji(false);
    setShowSymbol(false);
    setShowTablePicker(false);
  }, []);

  const isRangeInsideEditor = useCallback((range: Range | null) => {
    if (!range || !editorRef.current) return false;
    return editorRef.current.contains(range.startContainer) && editorRef.current.contains(range.endContainer);
  }, []);

  const getCurrentEditorRange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return null;
    const range = sel.getRangeAt(0);
    return isRangeInsideEditor(range) ? range : null;
  }, [isRangeInsideEditor]);

  const readFontSizeFromRange = useCallback((range: Range | null) => {
    if (!range || !editorRef.current) return "16";
    const node = range.startContainer;
    let el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
    while (el && el !== editorRef.current) {
      const px = Number.parseInt(el.style.fontSize || window.getComputedStyle(el).fontSize, 10);
      if (Number.isFinite(px)) return String(px);
      el = el.parentElement;
    }
    return "16";
  }, []);

  const refreshActiveFormats = useCallback(() => {
    try {
      setActiveFmt({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strike: document.queryCommandState("strikeThrough"),
        ordered: document.queryCommandState("insertOrderedList"),
        unordered: document.queryCommandState("insertUnorderedList"),
      });
      setCurrentFontSize(readFontSizeFromRange(getCurrentEditorRange()));
    } catch {}
  }, [getCurrentEditorRange, readFontSizeFromRange]);

  const saveSelection = useCallback(() => {
    const range = getCurrentEditorRange();
    if (!range) return;
    savedSelection.current = { range: range.cloneRange(), capturedAt: Date.now() };
    setCurrentFontSize(readFontSizeFromRange(range));
  }, [getCurrentEditorRange, readFontSizeFromRange]);

  const getRangeForToolbarAction = useCallback(() => {
    const liveRange = getCurrentEditorRange();
    if (liveRange) return liveRange.cloneRange();
    const snapshot = savedSelection.current;
    if (!snapshot || Date.now() - snapshot.capturedAt > 30000) return null;
    return isRangeInsideEditor(snapshot.range) ? snapshot.range.cloneRange() : null;
  }, [getCurrentEditorRange, isRangeInsideEditor]);

  const restoreSelection = useCallback(() => {
    editorRef.current?.focus({ preventScroll: true });
    const range = getRangeForToolbarAction();
    if (!range) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [getRangeForToolbarAction]);

  const execCmd = useCallback((command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
    editorRef.current?.focus({ preventScroll: true });
    handleEditorInput();
    refreshActiveFormats();
    saveSelection();
  }, [refreshActiveFormats, restoreSelection, saveSelection]);

  const cleanFontSizing = useCallback((root: DocumentFragment | HTMLElement) => {
    root.querySelectorAll<HTMLElement>("font,[style]").forEach((el) => {
      el.removeAttribute("size");
      el.style.fontSize = "";
      if (!el.getAttribute("style")) el.removeAttribute("style");
    });
  }, []);

  const applyFontSize = useCallback((size: string) => {
    const rangeToApply = getRangeForToolbarAction();
    if (!rangeToApply || !editorRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;

    editorRef.current.focus({ preventScroll: true });
    sel.removeAllRanges();
    sel.addRange(rangeToApply);

    const range = sel.getRangeAt(0);
    const wrapper = document.createElement("span");
    wrapper.style.fontSize = `${size}px`;
    wrapper.setAttribute("data-vp-font-size", size);

    if (range.collapsed) {
      wrapper.appendChild(document.createTextNode("\u200B"));
      range.insertNode(wrapper);
      range.setStart(wrapper.firstChild || wrapper, 1);
      range.collapse(true);
    } else {
      const fragment = range.extractContents();
      cleanFontSizing(fragment);
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);
      range.selectNodeContents(wrapper);
    }

    sel.removeAllRanges();
    sel.addRange(range);
    savedSelection.current = { range: range.cloneRange(), capturedAt: Date.now() };
    setCurrentFontSize(size);
    setProduct(prev => ({ ...prev, description: editorRef.current!.innerHTML }));
    refreshActiveFormats();
  }, [cleanFontSizing, getRangeForToolbarAction, refreshActiveFormats]);

  // Track the font size of the current text selection so the toolbar reflects reality
  useEffect(() => {
    const handler = () => {
      const range = getCurrentEditorRange();
      if (!range) return;
      savedSelection.current = { range: range.cloneRange(), capturedAt: Date.now() };
      setCurrentFontSize(readFontSizeFromRange(range));
      refreshActiveFormats();
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [getCurrentEditorRange, readFontSizeFromRange, refreshActiveFormats]);

  // Image resize/align controls
  const [selectedEditorImage, setSelectedEditorImage] = useState<HTMLImageElement | null>(null);
  const [imageToolbar, setImageToolbar] = useState<{ top: number; left: number } | null>(null);

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    saveSelection();
    refreshActiveFormats();
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
  }, [selectedEditorImage, saveSelection, refreshActiveFormats]);

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

  const uploadDescriptionImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Image non ajoutée",
          description: "Importez une image JPG, PNG, WEBP ou GIF de moins de 2 Mo.",
          variant: "destructive",
        });
        return null;
      }

      const prepared = await prepareImageForUpload(file);
      if (!prepared.ok) {
        toast({ title: "Image non ajoutée", description: prepared.reason, variant: "destructive" });
        return null;
      }

      if (prepared.wasCompressed) {
        toast({
          title: "Image compressée automatiquement",
          description: `Aperçu après compression : ${formatSize(prepared.originalSize)} → ${formatSize(prepared.finalSize)} (sous 2 Mo)`,
        });
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Connexion requise", description: "Reconnectez-vous pour importer l'image.", variant: "destructive" });
        return null;
      }

      const uploadFile = prepared.file;
      const ext = (uploadFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `${user.id}/rich-text/${Date.now()}-${randomId}.${ext}`;
      const { error } = await supabase.storage.from("shop-images").upload(path, uploadFile, {
        cacheControl: "31536000",
        contentType: uploadFile.type || undefined,
        upsert: false,
      });

      if (error) throw error;
      const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
      return data.publicUrl;
    } catch (error: any) {
      toast({
        title: "Image non sauvegardée",
        description: error?.message || "Téléversement impossible. Vérifiez que l'image fait moins de 2 Mo.",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, addPendingImage]);

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        toast({ title: "Téléversement de l'image…" });
        const url = await uploadDescriptionImage(file);
        if (url) {
          execCmd("insertHTML", `<img src="${url}" style="max-width:100%;height:auto;margin:12px 0;border-radius:8px;cursor:pointer;" loading="lazy" />`);
        }
      }
      (e.target as HTMLInputElement).value = "";
    };
    input.click();
  };

  const handleEditorPaste = useCallback(async (e: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      toast({ title: "Téléversement de l'image collée…" });
      const url = await uploadDescriptionImage(file);
      if (url) {
        execCmd("insertHTML", `<img src="${url}" style="max-width:100%;height:auto;margin:12px 0;border-radius:8px;cursor:pointer;" loading="lazy" />`);
      }
      return;
    }

    const html = e.clipboardData?.getData("text/html");
    if (html && /src=["']data:image/i.test(html)) {
      e.preventDefault();
      const cleaned = html.replace(/<img[^>]*src=["']data:image[^"']*["'][^>]*\/?>(\s*<\/img>)?/gi, "");
      toast({
        title: "Image non ajoutée",
        description: "Utilisez le bouton image : Visual Pro compresse puis sauvegarde l'image avant de l'ajouter.",
        variant: "destructive",
      });
      if (cleaned.trim()) execCmd("insertHTML", cleaned);
    }
  }, [execCmd, toast, uploadDescriptionImage]);

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
    const rows = Math.min(12, Math.max(1, tableRows || 1));
    const cols = Math.min(8, Math.max(1, tableCols || 1));
    const cells = Array.from({ length: rows }, (_, row) =>
      `<tr>${Array.from({ length: cols }, (_, col) => `<td style="border:1px solid #ddd;padding:8px;min-width:72px;">Cellule ${row + 1}-${col + 1}</td>`).join("")}</tr>`
    ).join("");
    execCmd("insertHTML", `<table style="width:100%;border-collapse:collapse;margin:12px 0;"><tbody>${cells}</tbody></table><p><br></p>`);
    setShowTablePicker(false);
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

  const insertSpecialChar = (char: string) => {
    execCmd("insertText", char);
    setShowSymbol(false);
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setProduct(prev => ({ ...prev, description: editorRef.current!.innerHTML }));
      saveSelection();
      refreshActiveFormats();
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
    ...existingImages
      .slice()
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map(img => ({ type: "existing" as const, ...img })),
    ...newImages.map((pending, idx) => ({
      type: "new" as const,
      id: pending.id,
      image_url: pending.previewUrl,
      file: pending.file,
      // For a brand-new product, the first pending image is already treated as
      // the future primary image. This gives immediate feedback before the DB
      // row exists; on save, files are uploaded in this same order.
      is_primary: existingImages.length === 0 && idx === 0,
    })),
  ];

  const isGifUrl = (url: string) => /\.gif(\?|$)/i.test(url);
  const isGifItem = (img: typeof allImages[number]) =>
    img.type === "new" ? (img as any).file?.type === "image/gif" || isGifUrl((img as any).file?.name || "") : isGifUrl(img.image_url);

  const handleProductImageFiles = useCallback(async (incoming: FileList | File[] | null) => {
    if (!incoming || incoming.length === 0) return;
    const arr = Array.from(incoming);
    setValidatingImages(true);
    try {
      const accepted: File[] = [];
      const rejected: string[] = [];
      let compressedCount = 0;
      let savedBytes = 0;
      let uploadedCount = 0;

      for (const f of arr) {
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
        if (f.type && !allowed.includes(f.type)) {
          rejected.push(`${f.name} : format non supporté. Importez JPG, PNG, WEBP ou GIF de moins de 2 Mo.`);
          continue;
        }
        try {
          const prepared = await prepareImageForUpload(f);
          if (!prepared.ok) {
            rejected.push(`${f.name} (${prepared.reason})`);
            continue;
          }
          if (prepared.wasCompressed) {
            compressedCount++;
            savedBytes += Math.max(0, prepared.originalSize - prepared.finalSize);
          }
          if (onUploadImage) {
            const uploaded = await onUploadImage(prepared.file);
            if (uploaded === false) {
              rejected.push(`${f.name} (téléversement impossible)`);
              continue;
            }
            uploadedCount++;
          } else {
            accepted.push(prepared.file);
          }
        } catch {
          rejected.push(`${f.name} (lecture impossible)`);
        }
      }

      if (accepted.length > 0) {
        setNewImages(prev => [...prev, ...accepted.map(addPendingImage)]);
      }
      if (accepted.length > 0 || uploadedCount > 0) {
        const totalAdded = accepted.length + uploadedCount;
        toast({
          title: `${totalAdded} image(s) ajoutée(s)`,
          description: uploadedCount > 0
            ? `${uploadedCount} sauvegardée(s) automatiquement.${compressedCount > 0 ? ` ${compressedCount} compressée(s) sous 2 Mo (${formatSize(savedBytes)} économisés).` : ""}`
            : compressedCount > 0
              ? `${compressedCount} compressée(s) sous 2 Mo (${formatSize(savedBytes)} économisés). Pensez à enregistrer.`
              : "Pensez à enregistrer le produit pour les sauvegarder.",
        });
      }
      if (rejected.length > 0) {
        toast({
          title: `${rejected.length} image(s) non ajoutée(s)`,
          description: rejected.slice(0, 3).join(" · "),
          variant: "destructive",
        });
      }
    } finally {
      setValidatingImages(false);
    }
  }, [onUploadImage, toast, addPendingImage]);

  const handleSaveClick = async () => {
    if (localSaving || saving || validatingImages) return;
    setLocalSaving(true);
    try {
      const pendingFiles = newImages.map(img => img.file);
      const result = await onSave(product, pendingFiles);
      if (result !== false && pendingFiles.length > 0) {
        setNewImages(prev => {
          prev.forEach(img => URL.revokeObjectURL(img.previewUrl));
          return [];
        });
      }
    } finally {
      setLocalSaving(false);
    }
  };

  const moveImage = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= allImages.length) return;
    const a = allImages[index];
    const b = allImages[target];
    // Swap within "new" group
    if (a.type === "new" && b.type === "new") {
      const i1 = newImages.findIndex(img => img.id === a.id);
      const i2 = newImages.findIndex(img => img.id === b.id);
      if (i1 < 0 || i2 < 0) return;
      setNewImages(prev => {
        const next = [...prev];
        [next[i1], next[i2]] = [next[i2], next[i1]];
        return next;
      });
      return;
    }
    // Swap within "existing" group
    if (a.type === "existing" && b.type === "existing" && onReorderImages) {
      const ordered = existingImages
        .slice()
        .sort((x, y) => (x.display_order ?? 0) - (y.display_order ?? 0))
        .map(i => i.id);
      const ai = ordered.indexOf(a.id);
      const bi = ordered.indexOf(b.id);
      if (ai === -1 || bi === -1) return;
      [ordered[ai], ordered[bi]] = [ordered[bi], ordered[ai]];
      onReorderImages(ordered);
      return;
    }
    // Cross-group: not supported (would mix saved + unsaved). Toast hint.
    toast({
      title: "Enregistrez d'abord",
      description: "Pour réordonner entre images existantes et nouvelles, enregistrez le produit puis réessayez.",
    });
  };

  const shopUrl = shopSlug ? `/shop/${shopSlug}` : null;
  const canViewInShop = shopActivated && shopPublished && shopUrl;
  const savedProductSlug = initialData?.slug ? toProductSlug(initialData.slug) : "";
  const shareableSlug = toProductSlug(product.slug || product.name);
  const liveProductUrl =
    shopSlug && productId && shopActivated && shopPublished && product.is_published
      ? `/shop/${shopSlug}/product?product=${productId}`
      : null;

  const previewImages = allImages.map((img) => ({ id: img.id, image_url: img.image_url }));

  const PreviewSheet = ({ trigger }: { trigger: React.ReactNode }) => (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-[720px] p-0 flex flex-col h-full">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle>Aperçu live de la fiche produit</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ProductLivePreview
            name={product.name}
            shortDescription={product.short_description}
            description={product.description}
            price={product.price}
            compareAtPrice={product.compare_at_price}
            category={product.category}
            stock={product.stock_quantity}
            images={previewImages}
          />
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-card border-b">
        <div className="flex items-center justify-between gap-2 px-3 md:px-6 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9 shrink-0" aria-label="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-bold text-sm md:text-lg truncate">
                {isEditing ? "Modifier le produit" : "Créer un produit"}
              </h1>
              {isEditing && (
                <p className="text-[11px] leading-none mt-0.5 hidden sm:block">
                  {autoSaveState === "saving" && <span className="text-muted-foreground">Sauvegarde…</span>}
                  {autoSaveState === "pending" && <span className="text-muted-foreground">Modifications non sauvegardées…</span>}
                  {autoSaveState === "saved" && <span className="text-green-600">✓ Sauvegardé automatiquement</span>}
                  {autoSaveState === "error" && <span className="text-destructive">Erreur de sauvegarde auto</span>}
                  {autoSaveState === "idle" && <span className="text-muted-foreground">Sauvegarde automatique activée</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PreviewSheet
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5 h-9 px-2.5">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Aperçu live</span>
                </Button>
              }
            />
            <Button
              size="sm"
              className="gap-1.5 bg-pink-500 hover:bg-pink-600 text-white h-9 px-3"
              onClick={handleSaveClick}
              disabled={(!product.name && !product.short_description) || saving || localSaving || validatingImages}
            >
              {saving || localSaving ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{saving || localSaving ? "…" : isEditing ? "Tout enregistrer" : "Ajouter"}</span>
            </Button>
          </div>
        </div>
        {isEditing && (
          <div className="sm:hidden px-3 pb-1.5 text-[11px]">
            {autoSaveState === "saving" && <span className="text-muted-foreground">Sauvegarde en cours…</span>}
            {autoSaveState === "pending" && <span className="text-muted-foreground">Modifications non sauvegardées…</span>}
            {autoSaveState === "saved" && <span className="text-green-600">✓ Sauvegardé automatiquement</span>}
            {autoSaveState === "error" && <span className="text-destructive">Erreur de sauvegarde auto · utilisez "Tout enregistrer"</span>}
            {autoSaveState === "idle" && <span className="text-muted-foreground">Sauvegarde automatique activée</span>}
          </div>
        )}
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
                <ToolbarButton icon={<Bold className="h-3.5 w-3.5" />} onClick={() => execCmd("bold")} title="Gras" active={activeFmt.bold} />
                <ToolbarButton icon={<Italic className="h-3.5 w-3.5" />} onClick={() => execCmd("italic")} title="Italique" active={activeFmt.italic} />
                <ToolbarButton icon={<Underline className="h-3.5 w-3.5" />} onClick={() => execCmd("underline")} title="Souligné" active={activeFmt.underline} />
                <ToolbarButton icon={<Strikethrough className="h-3.5 w-3.5" />} onClick={() => execCmd("strikethrough")} title="Barré" active={activeFmt.strike} />
                <ToolbarDivider />

                {/* Font size */}
                <div className="relative">
                  <ToolbarButton icon={<span className="text-[10px] font-bold">{currentFontSize}</span>} onClick={() => { closeAllDropdowns(); setShowFontSize(!showFontSize); }} title="Taille du texte" hasDropdown />
                  {showFontSize && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-1 min-w-[168px] max-h-[240px] overflow-y-auto">
                      {FONT_SIZE_PRESETS.map(({ size, label, hint }) => (
                          <button key={size} type="button" className={`w-full text-left px-3 py-2 rounded-md transition-colors ${currentFontSize === size ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                          onPointerDown={(e) => { e.preventDefault(); applyFontSize(size); setShowFontSize(false); }}>
                          <span className="flex items-center justify-between gap-3">
                            <span className="font-medium text-sm">{label}</span>
                            <span className="text-xs text-muted-foreground">{size}px</span>
                          </span>
                          <span className="block text-[11px] text-muted-foreground">{hint}</span>
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
                            onMouseDown={(e) => { e.preventDefault(); execCmd("foreColor", color); setShowTextColor(false); }} />
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
                            onMouseDown={(e) => { e.preventDefault(); execCmd("hiliteColor", color); setShowBgColor(false); }} />
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
                <ToolbarButton icon={<ListOrdered className="h-3.5 w-3.5" />} onClick={() => execCmd("insertOrderedList")} title="Liste numérotée" active={activeFmt.ordered} />
                <ToolbarButton icon={<List className="h-3.5 w-3.5" />} onClick={() => execCmd("insertUnorderedList")} title="Liste à puces" active={activeFmt.unordered} />
                <ToolbarDivider />

                {/* Alignment group */}
                <ToolbarButton icon={<AlignCenter className="h-3.5 w-3.5" />} onClick={() => execCmd("justifyCenter")} title="Centrer" />
                <ToolbarButton icon={<AlignRight className="h-3.5 w-3.5" />} onClick={() => execCmd("justifyRight")} title="Aligner à droite" />
                <ToolbarButton icon={<AlignJustify className="h-3.5 w-3.5" />} onClick={() => execCmd("justifyFull")} title="Justifier" />
                <ToolbarDivider />

                {/* Link, Table, Emoji, Special char */}
                <ToolbarButton icon={<LinkIcon className="h-3.5 w-3.5" />} onClick={insertLink} title="Insérer un lien" />
                <div className="relative">
                  <ToolbarButton icon={<Table className="h-3.5 w-3.5" />} onClick={() => { closeAllDropdowns(); setShowTablePicker(!showTablePicker); }} title="Insérer un tableau" hasDropdown />
                  {showTablePicker && (
                    <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-3 w-[230px] space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Lignes</Label>
                          <Input type="number" min={1} max={12} value={tableRows} onChange={(e) => setTableRows(Number(e.target.value))} className="h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Colonnes</Label>
                          <Input type="number" min={1} max={8} value={tableCols} onChange={(e) => setTableCols(Number(e.target.value))} className="h-8" />
                        </div>
                      </div>
                      <Button type="button" size="sm" className="w-full" onMouseDown={(e) => e.preventDefault()} onClick={insertTable}>Insérer le tableau</Button>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <ToolbarButton icon={<Smile className="h-3.5 w-3.5" />} onClick={() => { closeAllDropdowns(); setShowEmoji(!showEmoji); }} title="Émojis" />
                  {showEmoji && (
                    <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[260px]">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJIS.map(emoji => (
                          <button key={emoji} type="button" className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded text-lg"
                            onMouseDown={(e) => { e.preventDefault(); insertEmoji(emoji); }}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <ToolbarButton icon={<span className="text-[11px] font-serif">Ω</span>} onClick={() => { closeAllDropdowns(); setShowSymbol(!showSymbol); }} title="Symboles & caractères spéciaux" hasDropdown />
                  {showSymbol && (
                    <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[280px] max-h-[260px] overflow-y-auto">
                      <div className="grid grid-cols-8 gap-1">
                        {SYMBOLS.map((symbol, index) => (
                          <button key={`${symbol}-${index}`} type="button" className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded text-base"
                            onMouseDown={(e) => { e.preventDefault(); insertSpecialChar(symbol); }}>
                            {symbol}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                  onPaste={handleEditorPaste}
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
                  {allImages.map((img, idx) => (
                    <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                      {isGifItem(img) && (
                        <span className="absolute top-1 left-1 text-[9px] font-bold tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded shadow">
                          GIF
                        </span>
                      )}
                      {(img.is_primary || idx === 0) && (
                        <span className="absolute top-1 left-1 text-[9px] font-bold tracking-wide bg-green-600 text-white px-1.5 py-0.5 rounded shadow">
                          Principal
                        </span>
                      )}
                      <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                        {idx + 1}
                      </span>
                      <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Déplacer avant"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                          className="h-6 w-6 bg-background/90 text-foreground border rounded flex items-center justify-center shadow disabled:opacity-30 disabled:cursor-not-allowed hover:bg-background"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          title="Déplacer après"
                          onClick={() => moveImage(idx, 1)}
                          disabled={idx === allImages.length - 1}
                          className="h-6 w-6 bg-background/90 text-foreground border rounded flex items-center justify-center shadow disabled:opacity-30 disabled:cursor-not-allowed hover:bg-background"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          title="Télécharger"
                          onClick={async () => {
                            try {
                              const res = await fetch(img.image_url, { mode: "cors" });
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              const ext = (blob.type.split("/")[1] || "png").split(";")[0];
                              a.href = url;
                              a.download = `image-${idx + 1}-${Date.now()}.${ext}`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              setTimeout(() => URL.revokeObjectURL(url), 1000);
                            } catch {
                              const a = document.createElement("a");
                              a.href = img.image_url;
                              a.download = `image-${idx + 1}.png`;
                              a.target = "_blank";
                              a.rel = "noopener";
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                            }
                          }}
                          className="h-6 w-6 bg-background/90 text-foreground border rounded flex items-center justify-center shadow hover:bg-background"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        {img.type === "existing" && onSetPrimaryImage && !img.is_primary && (
                          <button
                            type="button"
                            title="Définir comme image principale"
                            onClick={() => onSetPrimaryImage(img.id)}
                            className="h-6 px-1.5 bg-background/90 text-foreground border rounded text-[10px] font-medium shadow hover:bg-background"
                          >
                            Principal
                          </button>
                        )}
                        {img.type === "new" && existingImages.length === 0 && idx !== 0 && (
                          <button
                            type="button"
                            title="Définir comme image principale"
                            onClick={() => {
                              setNewImages(prev => {
                                const selected = prev.find(p => p.id === img.id);
                                if (!selected) return prev;
                                return [selected, ...prev.filter(p => p.id !== img.id)];
                              });
                            }}
                            className="h-6 px-1.5 bg-background/90 text-foreground border rounded text-[10px] font-medium shadow hover:bg-background"
                          >
                            Principal
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        title="Supprimer"
                        onClick={() => {
                          if (img.type === "existing" && onDeleteImage) {
                            if (confirm("Supprimer cette image définitivement ?")) onDeleteImage(img.id);
                          } else {
                            removePendingImage(img.id);
                          }
                        }}
                        className="absolute top-1 right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label htmlFor="product-images-upload" className="cursor-pointer block">
                <input
                  id="product-images-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/jpg"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    await handleProductImageFiles(e.target.files);
                    // Reset so selecting the same file again still triggers onChange
                    e.target.value = "";
                  }}
                />
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    await handleProductImageFiles(e.dataTransfer.files);
                  }}
                >
                  {validatingImages ? (
                    <Loader2 className="h-8 w-8 mx-auto text-primary mb-2 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  )}
                  <p className="text-sm font-medium">
                    {validatingImages ? "Vérification en cours…" : "Cliquez ou glissez vos images ici"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Visual Pro accepte les images JPG, PNG, WEBP ou GIF de moins de 2 Mo.
                  </p>
                </div>
              </label>
              {allImages.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => document.getElementById("product-images-upload")?.click()}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter d'autres images
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setAiOpen(true)}
              >
                <ImageIcon className="h-4 w-4" />
                Générer un visuel produit (IA)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setGifOpen(true)}
              >
                <Film className="h-4 w-4" />
                Créer un GIF animé du produit
              </Button>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Astuce : importez 2 à 6 photos (différents angles, couleurs ou usages) pour obtenir un GIF qui valorise votre produit.
              </p>
            </div>
          </CollapsibleSection>

          {/* Variantes produit (taille, couleur...) */}
          <CollapsibleSection title="Variantes produit (taille, couleur...)" icon={<Tag className="h-4 w-4" />} defaultOpen>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Permettez au client de choisir une taille, couleur, parfum, etc. Chaque option apparaît sur la fiche produit.
              </p>
              <div className="space-y-3">
                {(product.variants || []).map((group, gIdx) => (
                  <div key={gIdx} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={group.name}
                        placeholder="Nom (ex: Taille, Couleur)"
                        onChange={(e) => {
                          const next = [...(product.variants || [])];
                          next[gIdx] = { ...next[gIdx], name: e.target.value };
                          setProduct({ ...product, variants: next });
                        }}
                        className="h-9 flex-1"
                      />
                      <Button
                        type="button" variant="ghost" size="icon" className="h-9 w-9"
                        onClick={() => {
                          const next = (product.variants || []).filter((_, i) => i !== gIdx);
                          setProduct({ ...product, variants: next });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Options (séparées par une virgule)</Label>
                      <Input
                        value={group.options.join(", ")}
                        placeholder="S, M, L, XL"
                        onChange={(e) => {
                          const next = [...(product.variants || [])];
                          next[gIdx] = {
                            ...next[gIdx],
                            options: e.target.value.split(",").map(o => o.trim()).filter(Boolean),
                          };
                          setProduct({ ...product, variants: next });
                        }}
                        className="h-9"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button" variant="outline" size="sm" className="w-full gap-1.5"
                onClick={() => setProduct({
                  ...product,
                  variants: [...(product.variants || []), { name: "", options: [] }],
                })}
              >
                <Plus className="h-4 w-4" /> Ajouter une variante
              </Button>
            </div>
          </CollapsibleSection>

          {/* Variantes */}
          <CollapsibleSection title="Offres en lot (variantes de prix)" icon={<Layers className="h-4 w-4" />} defaultOpen>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Proposez des remises selon la quantité (ex: 1 = 7 500, 2 = 10 000, 3 = 16 000). Le client choisit son lot directement sur la fiche produit.
              </p>
              <div className="space-y-2">
                {(product.bundle_offers || []).map((offer, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg border bg-muted/20">
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Quantité</Label>
                      <Input
                        type="number" min={1} value={offer.quantity || ""}
                        onChange={(e) => {
                          const next = [...(product.bundle_offers || [])];
                          next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                          setProduct({ ...product, bundle_offers: next });
                        }}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Prix total (FCFA)</Label>
                      <Input
                        type="number" min={0} value={offer.price || ""}
                        onChange={(e) => {
                          const next = [...(product.bundle_offers || [])];
                          next[idx] = { ...next[idx], price: Number(e.target.value) };
                          setProduct({ ...product, bundle_offers: next });
                        }}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Libellé (optionnel)</Label>
                      <Input
                        value={offer.label || ""}
                        placeholder="Pack famille…"
                        onChange={(e) => {
                          const next = [...(product.bundle_offers || [])];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setProduct({ ...product, bundle_offers: next });
                        }}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button" variant="ghost" size="icon" className="h-9 w-9"
                        onClick={() => {
                          const next = (product.bundle_offers || []).filter((_, i) => i !== idx);
                          setProduct({ ...product, bundle_offers: next });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button" variant="outline" size="sm" className="w-full gap-1.5"
                onClick={() => setProduct({
                  ...product,
                  bundle_offers: [...(product.bundle_offers || []), { quantity: (product.bundle_offers?.length || 0) + 1, price: 0, label: "" }],
                })}
              >
                <Plus className="h-4 w-4" /> Ajouter une offre
              </Button>
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-sm">Emplacement sur la fiche produit</Label>
                <Select
                  value={product.bundle_position || "after_countdown"}
                  onValueChange={(v) => setProduct({ ...product, bundle_position: v })}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUNDLE_POSITIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

          {/* Mise en page de la fiche */}
          <CollapsibleSection title="Mise en page de la fiche" icon={<Layers className="h-4 w-4" />}>
            <div className="space-y-3">
              <SectionLayoutPanel
                order={normalizeSectionOrder(product.section_order)}
                onChange={(next) => setProduct({ ...product, section_order: next })}
              />
              <Button
                type="button" variant="outline" size="sm" className="w-full"
                onClick={() => {
                  const current = normalizeSectionOrder(product.section_order);
                  setProduct({
                    ...product,
                    section_order: { layout: current.layout, blocks: [...DEFAULT_PRODUCT_BLOCKS] },
                  });
                }}
              >
                Réinitialiser l'ordre par défaut
              </Button>
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
                  <Input
                    value={product.slug || ""}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        slug: e.target.value
                          .toLowerCase()
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .replace(/[^a-z0-9-]+/g, "-")
                          .replace(/-+/g, "-")
                          .replace(/^-|-$/g, ""),
                      })
                    }
                    placeholder={product.name ? product.name.toLowerCase().replace(/\s+/g, "-") : "mon-produit"}
                    className="h-10"
                  />
                  {shopSlug && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate">
                        visuelpro.cloud/shop/{shopSlug}/p/{shareableSlug || "mon-produit"}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          const url = productId
                            ? `https://visuelpro.cloud/shop/${shopSlug}/product?product=${productId}`
                            : `https://visuelpro.cloud/shop/${shopSlug}/p/${shareableSlug}`;
                          navigator.clipboard.writeText(url);
                          toast({ title: "Lien copié ✓", description: url });
                        }}
                      >
                        Copier
                      </Button>
                    </div>
                  )}
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
      {(canViewInShop || liveProductUrl) && (
        <div className="sticky bottom-0 z-20 bg-card border-t px-3 md:px-6 py-2">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {canViewInShop && (
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={shopUrl} target="_blank" rel="noopener noreferrer">
                  <Store className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Voir en magasin</span>
                </a>
              </Button>
            )}
            {liveProductUrl && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-green-500 text-green-700 hover:bg-green-50"
                asChild
                title="Ouvrir le lien public partageable"
              >
                <a href={liveProductUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Voir en live</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* AI Image Generator Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Générer un visuel produit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Image de votre produit (optionnel)</Label>
              {aiSourceImage ? (
                <div className="relative rounded-md border bg-muted/30 p-2">
                  <img src={aiSourceImage} alt="Référence produit" className="max-h-40 mx-auto rounded" />
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="truncate text-muted-foreground">{aiSourceFileName}</span>
                    <button
                      type="button"
                      onClick={() => { setAiSourceImage(null); setAiSourceFileName(""); }}
                      className="text-destructive hover:underline"
                      disabled={aiLoading}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1 cursor-pointer rounded-md border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors px-3 py-5 text-center">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium">Importer depuis votre ordinateur</span>
                  <span className="text-[10px] text-muted-foreground">L'IA conservera votre produit et créera la mise en scène</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAiSourceFile(e.target.files?.[0])}
                    disabled={aiLoading}
                  />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{aiSourceImage ? "Instructions pour l'IA" : "Décrivez votre produit"}</Label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={aiSourceImage
                ? "Ex: poser le produit sur une table en marbre avec des fleurs, lumière naturelle"
                : "Ex: bouteille de parfum élégante en verre transparent, fond beige minimaliste"}
              rows={4}
              disabled={aiLoading}
            />
            </div>
            <p className="text-xs text-muted-foreground">
              L'image sera ajoutée à la galerie. Pensez à enregistrer le produit ensuite.
            </p>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiLoading}>
              Annuler
            </Button>
            <Button variant="secondary" onClick={() => handleGenerateAiImage(true)} disabled={aiLoading} className="gap-2">
              <Download className="h-4 w-4" /> Générer & télécharger
            </Button>
            <Button onClick={() => handleGenerateAiImage(false)} disabled={aiLoading}>
              {aiLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Génération…</>) : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GIF generator */}
      <ProductGifGenerator
        open={gifOpen}
        onOpenChange={setGifOpen}
        onGenerated={(file) => {
          setNewImages((prev) => [...prev, addPendingImage(file)]);
          toast({
            title: "✓ GIF ajouté",
            description: "Pensez à enregistrer le produit pour le sauvegarder.",
          });
        }}
        shop={shop}
      />
    </div>
  );
}

/* ─── Toolbar Helpers ────────────────────────────────────── */
function ToolbarButton({ icon, onClick, title, hasDropdown, active }: { icon: React.ReactNode; onClick: () => void; title: string; hasDropdown?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`h-7 min-w-[28px] px-0.5 flex items-center justify-center rounded transition-colors ${active ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "text-foreground/70 hover:text-foreground hover:bg-muted"}`}
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
