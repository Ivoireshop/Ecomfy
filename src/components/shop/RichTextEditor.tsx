import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Video, Palette, Undo, Redo, ChevronDown,
  Minus, Code, Smile, Table, Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { prepareImageForUpload } from "@/lib/imageCompress";

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
const EMOJIS = [
  "😀","😂","😍","🥰","😎","🤩","🔥","✅","⭐","💯","🎉","💪",
  "❤️","💚","💙","💛","🧡","💜","🖤","🤍","👍","👏","🙏","💰",
  "🛒","📦","🎁","✨","⚡","🏷️","📣","🚀","💎","🌟","👑","🔔",
];
const SYMBOLS = [
  "•","◦","▪","▫","■","□","●","○","★","☆","✓","✔","✗","✘","→","←","↑","↓","↔","⇒","⇐","⇑","⇓",
  "©","®","™","§","¶","†","‡","°","№","℃","℉","µ",
  "±","×","÷","≠","≈","≤","≥","∞","∑","∏","√","∫","∂","∆","Ω","π","α","β","γ","θ","λ","φ","ψ",
  "€","$","£","¥","¢","₣","₹","₽","₩","₺",
  "«","»","“","”","‘","’","–","—","…","·","¿","¡",
  "①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩",
];

interface RichTextEditorProps {
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, minHeight = 160 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const selectionSnapshotRef = useRef<{ range: Range; capturedAt: number } | null>(null);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSymbol, setShowSymbol] = useState(false);
  const [activeFontSize, setActiveFontSize] = useState("16");
  const [activeFmt, setActiveFmt] = useState<{ b: boolean; i: boolean; u: boolean; s: boolean; ol: boolean; ul: boolean }>({ b: false, i: false, u: false, s: false, ol: false, ul: false });
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgRect, setImgRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const updateRect = useCallback((img: HTMLImageElement | null) => {
    if (!img || !wrapperRef.current) { setImgRect(null); return; }
    const er = wrapperRef.current.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    setImgRect({ left: ir.left - er.left, top: ir.top - er.top, width: ir.width, height: ir.height });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t && t.tagName === "IMG" && editorRef.current?.contains(t)) {
        const img = t as HTMLImageElement;
        setSelectedImg(img);
        updateRect(img);
      } else if (!t?.closest?.("[data-img-handle]")) {
        setSelectedImg(null);
        setImgRect(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [updateRect]);

  useEffect(() => {
    if (!selectedImg) return;
    const onUpd = () => updateRect(selectedImg);
    window.addEventListener("resize", onUpd);
    window.addEventListener("scroll", onUpd, true);
    return () => {
      window.removeEventListener("resize", onUpd);
      window.removeEventListener("scroll", onUpd, true);
    };
  }, [selectedImg, updateRect]);

  const startResize = (e: React.MouseEvent | React.TouchEvent, dir: "right" | "left") => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImg) return;
    const img = selectedImg;
    const isTouch = "touches" in e;
    const startX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const startW = img.getBoundingClientRect().width;
    const ratio = img.naturalWidth && img.naturalHeight
      ? img.naturalHeight / img.naturalWidth
      : img.getBoundingClientRect().height / startW;
    const containerW = editorRef.current
      ? editorRef.current.clientWidth - 24 // padding p-3 = 12px each side
      : startW;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const cx = "touches" in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const delta = dir === "right" ? cx - startX : startX - cx;
      const newW = Math.min(containerW, Math.max(40, startW + delta));
      img.style.width = newW + "px";
      img.style.height = newW * ratio + "px";
      img.style.maxWidth = "100%";
      updateRect(img);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
  };

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  const closeAll = useCallback(() => {
    setShowFontSize(false); setShowTextColor(false); setShowBgColor(false); setShowEmoji(false); setShowSymbol(false);
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

  const getElementFromNode = useCallback((node: Node | null) => {
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  }, []);

  const readFontSizeFromRange = useCallback((range: Range | null) => {
    if (!range || !editorRef.current) return "16";
    let el = getElementFromNode(range.startContainer);
    while (el && el !== editorRef.current) {
      const raw = el.style.fontSize || window.getComputedStyle(el).fontSize;
      const px = Number.parseInt(raw, 10);
      if (Number.isFinite(px)) return String(px);
      el = el.parentElement;
    }
    return "16";
  }, [getElementFromNode]);

  const refreshActive = useCallback(() => {
    try {
      setActiveFmt({
        b: document.queryCommandState("bold"),
        i: document.queryCommandState("italic"),
        u: document.queryCommandState("underline"),
        s: document.queryCommandState("strikeThrough"),
        ol: document.queryCommandState("insertOrderedList"),
        ul: document.queryCommandState("insertUnorderedList"),
      });
      setActiveFontSize(readFontSizeFromRange(getCurrentEditorRange()));
    } catch {}
  }, [getCurrentEditorRange, readFontSizeFromRange]);

  const saveSelection = useCallback(() => {
    const range = getCurrentEditorRange();
    if (!range) return;
    selectionSnapshotRef.current = { range: range.cloneRange(), capturedAt: Date.now() };
    setActiveFontSize(readFontSizeFromRange(range));
  }, [getCurrentEditorRange, readFontSizeFromRange]);

  const cleanFontSizing = useCallback((root: DocumentFragment | HTMLElement) => {
    root.querySelectorAll<HTMLElement>("font,[style]").forEach((el) => {
      el.removeAttribute("size");
      el.style.fontSize = "";
      if (!el.getAttribute("style")) el.removeAttribute("style");
    });
  }, []);

  const getRangeForToolbarAction = useCallback(() => {
    const liveRange = getCurrentEditorRange();
    if (liveRange) return liveRange.cloneRange();
    const snapshot = selectionSnapshotRef.current;
    if (!snapshot || Date.now() - snapshot.capturedAt > 30000) return null;
    return isRangeInsideEditor(snapshot.range) ? snapshot.range.cloneRange() : null;
  }, [getCurrentEditorRange, isRangeInsideEditor]);

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
    selectionSnapshotRef.current = { range: range.cloneRange(), capturedAt: Date.now() };
    setActiveFontSize(size);
    onChange(editorRef.current.innerHTML);
    refreshActive();
  }, [cleanFontSizing, getRangeForToolbarAction, onChange, refreshActive]);

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    refreshActive();
  }, [onChange]);

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (sel && sel.anchorNode && editorRef.current?.contains(sel.anchorNode)) {
        saveSelection();
        refreshActive();
      }
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [refreshActive, saveSelection]);

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  // Upload to Supabase Storage instead of embedding base64 in HTML.
  // Base64 inflated descriptions to MB-sized blobs that broke product pages.
  const uploadEditorImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const prepared = await prepareImageForUpload(file);
      if (!prepared.ok) {
        toast({ title: "Image refusée", description: prepared.reason, variant: "destructive" });
        return null;
      }
      if (prepared.wasCompressed) {
        toast({ title: "Image optimisée", description: "Compressée automatiquement." });
      }
      file = prepared.file;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Connexion requise", variant: "destructive" });
        return null;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/rich-text/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("shop-images").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) {
        toast({ title: "Échec du téléversement", description: error.message, variant: "destructive" });
        return null;
      }
      const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Téléversement impossible", variant: "destructive" });
      return null;
    }
  }, []);

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const tId = toast({ title: "Téléversement de l'image…" }).id;
      const url = await uploadEditorImage(file);
      if (url) exec("insertHTML", `<img src="${url}" style="max-width:100%;height:auto;margin:8px 0;border-radius:8px;" loading="lazy" />`);
    };
    input.click();
  };

  // Intercept paste of images (clipboard screenshots) — same root cause.
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file" && it.type.startsWith("image/")) {
        e.preventDefault();
        const file = it.getAsFile();
        if (!file) return;
        toast({ title: "Téléversement de l'image collée…" });
        const url = await uploadEditorImage(file);
        if (url) exec("insertHTML", `<img src="${url}" style="max-width:100%;height:auto;margin:8px 0;border-radius:8px;" loading="lazy" />`);
        return;
      }
    }
    // Also strip any data:image base64 from pasted HTML (rare but possible).
    const html = e.clipboardData?.getData("text/html");
    if (html && /src=["']data:image/i.test(html)) {
      e.preventDefault();
      const cleaned = html.replace(/<img[^>]*src=["']data:image[^"']*["'][^>]*\/?>(\s*<\/img>)?/gi, "");
      exec("insertHTML", cleaned);
    }
  }, [uploadEditorImage, exec]);

  const insertVideo = () => {
    const url = prompt("URL de la vidéo (YouTube, Vimeo...)");
    if (!url) return;
    let embedUrl = url;
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (yt) embedUrl = `https://www.youtube.com/embed/${yt[1]}`;
    exec("insertHTML", `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:8px 0;border-radius:8px;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div>`);
  };

  const insertLink = () => {
    const url = prompt("URL du lien");
    if (url) exec("createLink", url);
  };
  const insertHR = () => exec("insertHTML", '<hr style="border:none;border-top:1px solid #ddd;margin:12px 0;" />');
  const insertTable = () => {
    exec("insertHTML", `<table style="width:100%;border-collapse:collapse;margin:8px 0;"><tbody><tr><td style="border:1px solid #ddd;padding:6px;">Cell</td><td style="border:1px solid #ddd;padding:6px;">Cell</td></tr><tr><td style="border:1px solid #ddd;padding:6px;">Cell</td><td style="border:1px solid #ddd;padding:6px;">Cell</td></tr></tbody></table>`);
  };
  const toggleCodeView = () => {
    if (!editorRef.current) return;
    const isCode = editorRef.current.getAttribute("data-code-view") === "true";
    if (isCode) { editorRef.current.innerHTML = editorRef.current.innerText; editorRef.current.setAttribute("data-code-view", "false"); }
    else { editorRef.current.innerText = editorRef.current.innerHTML; editorRef.current.setAttribute("data-code-view", "true"); }
    onChange(editorRef.current.innerHTML);
  };

  return (
    <div ref={wrapperRef} className="border rounded-lg bg-background relative flex flex-col" style={{ maxHeight: "70vh" }}>
      {/* Toolbar sticky */}
      <div className="sticky top-0 z-30 bg-background rounded-t-lg">
      {/* Row 1 */}
      <div className="bg-muted/30 border-b px-2 py-1.5 flex flex-wrap items-center gap-0.5">
        <TBtn icon={<div className="h-3.5 w-3.5 border border-current rounded-sm" />} onClick={() => {}} title="Plein écran" />
        <TDiv />
        <TBtn icon={<Bold className="h-3.5 w-3.5" />} onClick={() => exec("bold")} title="Gras" active={activeFmt.b} />
        <TBtn icon={<Italic className="h-3.5 w-3.5" />} onClick={() => exec("italic")} title="Italique" active={activeFmt.i} />
        <TBtn icon={<Underline className="h-3.5 w-3.5" />} onClick={() => exec("underline")} title="Souligné" active={activeFmt.u} />
        <TBtn icon={<Strikethrough className="h-3.5 w-3.5" />} onClick={() => exec("strikethrough")} title="Barré" active={activeFmt.s} />
        <TDiv />
        <div className="relative">
          <TBtn icon={<span className="text-[10px] font-bold">{activeFontSize}</span>} onClick={() => { closeAll(); setShowFontSize(s => !s); }} title="Taille du texte" hasDropdown />
          {showFontSize && (
            <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-1 min-w-[168px] max-h-[240px] overflow-y-auto">
              {FONT_SIZE_PRESETS.map(({ size, label, hint }) => (
                <button key={size} className={`w-full text-left px-3 py-2 rounded-md transition-colors ${activeFontSize === size ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    applyFontSize(size);
                    setShowFontSize(false);
                  }}>
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
        <div className="relative">
          <TBtn icon={<div className="flex flex-col items-center"><span className="text-[10px] font-bold leading-none">A</span><div className="w-3 h-0.5 bg-red-500 rounded-full mt-0.5" /></div>} onClick={() => { closeAll(); setShowTextColor(s => !s); }} title="Couleur du texte" hasDropdown />
          {showTextColor && (
            <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[180px]">
              <div className="grid grid-cols-6 gap-1">
                {COLORS.map(color => (
                  <button key={color} className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: color }}
                    onMouseDown={(e) => { e.preventDefault(); exec("foreColor", color); setShowTextColor(false); }} />
                ))}
              </div>
              <input type="color" className="w-full h-7 mt-2 cursor-pointer rounded" onChange={(e) => { exec("foreColor", e.target.value); setShowTextColor(false); }} />
            </div>
          )}
        </div>
        <div className="relative">
          <TBtn icon={<div className="flex flex-col items-center"><span className="text-[10px] font-bold leading-none">A</span><div className="w-3 h-1 bg-yellow-400 rounded-sm mt-0.5" /></div>} onClick={() => { closeAll(); setShowBgColor(s => !s); }} title="Surligneur" hasDropdown />
          {showBgColor && (
            <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[180px]">
              <div className="grid grid-cols-6 gap-1">
                {COLORS.map(color => (
                  <button key={color} className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: color }}
                    onMouseDown={(e) => { e.preventDefault(); exec("hiliteColor", color); setShowBgColor(false); }} />
                ))}
              </div>
              <input type="color" className="w-full h-7 mt-2 cursor-pointer rounded" onChange={(e) => { exec("hiliteColor", e.target.value); setShowBgColor(false); }} />
            </div>
          )}
        </div>
        <TBtn icon={<Palette className="h-3.5 w-3.5" />} onClick={() => exec("removeFormat")} title="Supprimer le formatage" />
        <TDiv />
        <TBtn icon={<span className="text-[10px] font-bold">¶</span>} onClick={() => exec("formatBlock", "<p>")} title="Paragraphe" hasDropdown />
        <TBtn icon={<AlignLeft className="h-3.5 w-3.5" />} onClick={() => exec("justifyLeft")} title="Aligner à gauche" hasDropdown />
        <TDiv />
        <TBtn icon={<ListOrdered className="h-3.5 w-3.5" />} onClick={() => exec("insertOrderedList")} title="Liste numérotée" active={activeFmt.ol} />
        <TBtn icon={<List className="h-3.5 w-3.5" />} onClick={() => exec("insertUnorderedList")} title="Liste à puces" active={activeFmt.ul} />
        <TDiv />
        <TBtn icon={<AlignCenter className="h-3.5 w-3.5" />} onClick={() => exec("justifyCenter")} title="Centrer" />
        <TBtn icon={<AlignRight className="h-3.5 w-3.5" />} onClick={() => exec("justifyRight")} title="Aligner à droite" />
        <TBtn icon={<AlignJustify className="h-3.5 w-3.5" />} onClick={() => exec("justifyFull")} title="Justifier" />
        <TDiv />
        <TBtn icon={<LinkIcon className="h-3.5 w-3.5" />} onClick={insertLink} title="Lien" />
        <TBtn icon={<Table className="h-3.5 w-3.5" />} onClick={insertTable} title="Tableau" />
        <div className="relative">
          <TBtn icon={<Smile className="h-3.5 w-3.5" />} onClick={() => { closeAll(); setShowEmoji(s => !s); }} title="Émojis" />
          {showEmoji && (
            <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[260px]">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map(emoji => (
                  <button key={emoji} className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded text-lg"
                    onMouseDown={(e) => { e.preventDefault(); exec("insertText", emoji); setShowEmoji(false); }}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <TBtn icon={<span className="text-[11px] font-serif">Ω</span>} onClick={() => { closeAll(); setShowSymbol(s => !s); }} title="Symboles & caractères spéciaux" />
          {showSymbol && (
            <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 w-[280px] max-h-[260px] overflow-y-auto">
              <div className="grid grid-cols-8 gap-1">
                {SYMBOLS.map((sym, idx) => (
                  <button key={sym + idx} className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded text-base"
                    onMouseDown={(e) => { e.preventDefault(); exec("insertText", sym); setShowSymbol(false); }}>
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2 */}
      <div className="bg-muted/30 border-b px-2 py-1.5 flex flex-wrap items-center gap-0.5">
        <TBtn icon={<Minus className="h-3.5 w-3.5" />} onClick={insertHR} title="Ligne horizontale" />
        <TBtn icon={<Code className="h-3.5 w-3.5" />} onClick={toggleCodeView} title="Code source" />
        <TBtn icon={<Undo className="h-3.5 w-3.5" />} onClick={() => exec("undo")} title="Annuler" />
        <TBtn icon={<Redo className="h-3.5 w-3.5" />} onClick={() => exec("redo")} title="Rétablir" />
        <TDiv />
        <TBtn icon={<ImageIcon className="h-3.5 w-3.5" />} onClick={insertImage} title="Image" />
        <TBtn icon={<Video className="h-3.5 w-3.5" />} onClick={insertVideo} title="Vidéo" />
      </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="p-3 text-sm focus:outline-none overflow-y-auto flex-1 [&>*]:mb-2"
        style={{ minHeight, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        onInput={handleInput}
        onPaste={handlePaste}
        data-code-view="false"
      />
      {selectedImg && imgRect && (
        <div
          data-img-handle
          className="pointer-events-none absolute z-20"
          style={{ left: imgRect.left, top: imgRect.top, width: imgRect.width, height: imgRect.height }}
        >
          <div className="absolute inset-0 ring-2 ring-primary rounded-sm" />
          <div
            data-img-handle
            onMouseDown={(e) => startResize(e, "left")}
            className="pointer-events-auto absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-primary rounded-sm cursor-ew-resize shadow"
            title="Réduire / agrandir"
          />
          <div
            data-img-handle
            onMouseDown={(e) => startResize(e, "right")}
            className="pointer-events-auto absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-primary rounded-sm cursor-ew-resize shadow"
            title="Réduire / agrandir"
          />
        </div>
      )}
    </div>
  );
}

function TBtn({ icon, onClick, title, hasDropdown, active }: { icon: React.ReactNode; onClick: () => void; title: string; hasDropdown?: boolean; active?: boolean }) {
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

function TDiv() { return <div className="w-px h-5 bg-border mx-1" />; }