import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Video, Palette, Undo, Redo, ChevronDown,
  Minus, Code, Smile, Table, Image as ImageIcon,
} from "lucide-react";

const FONT_SIZES = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48"];
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
  const [showFontSize, setShowFontSize] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
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

  const startResize = (e: React.MouseEvent, dir: "right" | "left") => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImg) return;
    const img = selectedImg;
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const ratio = img.naturalWidth && img.naturalHeight
      ? img.naturalHeight / img.naturalWidth
      : img.getBoundingClientRect().height / startW;
    const containerW = editorRef.current
      ? editorRef.current.clientWidth - 24 // padding p-3 = 12px each side
      : startW;
    const onMove = (ev: MouseEvent) => {
      const delta = dir === "right" ? ev.clientX - startX : startX - ev.clientX;
      const newW = Math.min(containerW, Math.max(40, startW + delta));
      img.style.width = newW + "px";
      img.style.height = newW * ratio + "px";
      img.style.maxWidth = "100%";
      updateRect(img);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  const closeAll = useCallback(() => {
    setShowFontSize(false); setShowTextColor(false); setShowBgColor(false); setShowEmoji(false);
  }, []);

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
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
          exec("insertHTML", `<img src="${reader.result}" style="max-width:100%;height:auto;margin:8px 0;border-radius:8px;" />`);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

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
  const insertSpecialChar = () => {
    const c = prompt("Caractère spécial (ex: Ω, ©, ™, €)");
    if (c) exec("insertText", c);
  };
  const toggleCodeView = () => {
    if (!editorRef.current) return;
    const isCode = editorRef.current.getAttribute("data-code-view") === "true";
    if (isCode) { editorRef.current.innerHTML = editorRef.current.innerText; editorRef.current.setAttribute("data-code-view", "false"); }
    else { editorRef.current.innerText = editorRef.current.innerHTML; editorRef.current.setAttribute("data-code-view", "true"); }
    onChange(editorRef.current.innerHTML);
  };

  return (
    <div ref={wrapperRef} className="border rounded-lg overflow-hidden bg-background relative">
      {/* Row 1 */}
      <div className="bg-muted/30 border-b px-2 py-1.5 flex flex-wrap items-center gap-0.5">
        <TBtn icon={<div className="h-3.5 w-3.5 border border-current rounded-sm" />} onClick={() => {}} title="Plein écran" />
        <TDiv />
        <TBtn icon={<Bold className="h-3.5 w-3.5" />} onClick={() => exec("bold")} title="Gras" />
        <TBtn icon={<Italic className="h-3.5 w-3.5" />} onClick={() => exec("italic")} title="Italique" />
        <TBtn icon={<Underline className="h-3.5 w-3.5" />} onClick={() => exec("underline")} title="Souligné" />
        <TBtn icon={<Strikethrough className="h-3.5 w-3.5" />} onClick={() => exec("strikethrough")} title="Barré" />
        <TDiv />
        <div className="relative">
          <TBtn icon={<span className="text-[10px] font-bold">12</span>} onClick={() => { closeAll(); setShowFontSize(s => !s); }} title="Taille" hasDropdown />
          {showFontSize && (
            <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-1 min-w-[80px] max-h-[200px] overflow-y-auto">
              {FONT_SIZES.map(size => (
                <button key={size} className="block w-full text-left px-3 py-1 text-sm hover:bg-muted rounded"
                  onMouseDown={(e) => { e.preventDefault(); exec("fontSize", "7"); const el = editorRef.current?.querySelector('font[size="7"]'); if (el) (el as HTMLElement).style.fontSize = size + "px"; setShowFontSize(false); }}>
                  {size}px
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
        <TBtn icon={<ListOrdered className="h-3.5 w-3.5" />} onClick={() => exec("insertOrderedList")} title="Liste numérotée" hasDropdown />
        <TBtn icon={<List className="h-3.5 w-3.5" />} onClick={() => exec("insertUnorderedList")} title="Liste à puces" hasDropdown />
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
        <TBtn icon={<span className="text-[11px] font-serif">Ω</span>} onClick={insertSpecialChar} title="Caractères spéciaux" />
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

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="p-3 text-sm focus:outline-none [&>*]:mb-2"
        style={{ minHeight, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        onInput={handleInput}
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

function TBtn({ icon, onClick, title, hasDropdown }: { icon: React.ReactNode; onClick: () => void; title: string; hasDropdown?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="h-7 min-w-[28px] px-0.5 flex items-center justify-center rounded hover:bg-muted transition-colors text-foreground/70 hover:text-foreground"
    >
      {icon}
      {hasDropdown && <ChevronDown className="h-2 w-2 ml-0.5 opacity-50" />}
    </button>
  );
}

function TDiv() { return <div className="w-px h-5 bg-border mx-1" />; }