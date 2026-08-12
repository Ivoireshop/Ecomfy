import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, Tablet, Save, X, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DeviceType, EditorBlock, EditorLayout, BlockType } from "./types";
import { BlockRenderer } from "./BlockRenderer";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { supabase } from "@/integrations/supabase/client";

interface DragDropEditorProps {
  shop: any;
  setShop: (shop: any) => void;
  onClose: () => void;
}

const AVAILABLE_BLOCKS: { type: BlockType; label: string }[] = [
  { type: "header", label: "En-tête (Header)" },
  { type: "hero", label: "Section Hero" },
  { type: "features", label: "Caractéristiques" },
  { type: "product_grid", label: "Grille de Produits" },
  { type: "text_image", label: "Texte + Image" },
];

export function DragDropEditor({ shop, setShop, onClose }: DragDropEditorProps) {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Load existing layout if present
    if (shop?.theme_config?.layout?.blocks) {
      setBlocks(shop.theme_config.layout.blocks);
    } else {
      // Default basic layout if empty
      setBlocks([
        { id: crypto.randomUUID(), type: "header", settings: {} },
        { id: crypto.randomUUID(), type: "hero", settings: {} },
        { id: crypto.randomUUID(), type: "product_grid", settings: {} }
      ]);
    }
  }, [shop]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addBlock = (type: BlockType) => {
    const newBlock: EditorBlock = {
      id: crypto.randomUUID(),
      type,
      settings: {}
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...(shop.theme_config || {}),
        active_theme_slug: 'dynamic-builder',
        layout: { blocks }
      };

      const { error } = await supabase
        .from('shops')
        .update({ theme_config: updatedConfig })
        .eq('id', shop.id);

      if (error) throw error;
      
      setShop({ ...shop, theme_config: updatedConfig });
      toast({ title: "Mise à jour réussie", description: "Le layout a été sauvegardé avec succès." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Navbar */}
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0 bg-card">
        <div className="font-semibold flex items-center gap-2">
          <span>Éditeur Visuel (Beta)</span>
        </div>
        
        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
          <Button 
            variant={device === "desktop" ? "default" : "ghost"} 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button 
            variant={device === "tablet" ? "default" : "ghost"} 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setDevice("tablet")}
          >
            <Tablet className="h-4 w-4" />
          </Button>
          <Button 
            variant={device === "mobile" ? "default" : "ghost"} 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            <X className="h-4 w-4 mr-1" /> Fermer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" /> {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-muted/20 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b font-medium text-sm">Ajouter une section</div>
          <div className="p-4 space-y-2">
            {AVAILABLE_BLOCKS.map(block => (
              <div 
                key={block.type}
                className="p-3 border rounded-lg bg-card hover:border-primary cursor-pointer flex items-center justify-between group transition-colors"
                onClick={() => addBlock(block.type)}
              >
                <span className="text-sm font-medium">{block.label}</span>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 bg-muted/40 p-4 md:p-8 overflow-y-auto flex items-start justify-center">
          <div 
            className="transition-all duration-300 mx-auto"
            style={{
              width: device === "desktop" ? "100%" : device === "tablet" ? "768px" : "375px",
              maxWidth: "1200px"
            }}
          >
            <div className="bg-white min-h-[600px] border shadow-sm rounded-lg overflow-hidden">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={blocks.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="p-4 min-h-[400px]">
                    {blocks.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                        <Monitor className="h-12 w-12 mb-4 opacity-20" />
                        <p>Aucune section. Ajoutez-en depuis le menu de gauche.</p>
                      </div>
                    ) : (
                      blocks.map(block => (
                        <BlockRenderer key={block.id} block={block} onRemove={removeBlock} />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
