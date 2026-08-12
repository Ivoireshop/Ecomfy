import { EditorBlock } from "./types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlockRendererProps {
  block: EditorBlock;
  onRemove: (id: string) => void;
}

export function BlockRenderer({ block, onRemove }: BlockRendererProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "hero":
        return <div className="p-8 bg-blue-50 text-center rounded-lg border-2 border-dashed border-blue-200">Composant Hero</div>;
      case "header":
        return <div className="p-4 bg-gray-50 border-b flex justify-between rounded-lg border-2 border-dashed border-gray-200"><span>Logo</span><nav>Menu</nav></div>;
      case "product_grid":
        return <div className="p-8 bg-green-50 text-center rounded-lg border-2 border-dashed border-green-200">Grille de Produits (3 colonnes)</div>;
      case "features":
        return <div className="p-8 bg-purple-50 text-center rounded-lg border-2 border-dashed border-purple-200">Bandeau Caractéristiques (Livraison, Paiement)</div>;
      case "text_image":
        return <div className="p-8 bg-yellow-50 text-center rounded-lg border-2 border-dashed border-yellow-200">Bloc Texte + Image</div>;
      default:
        return <div>Composant inconnu</div>;
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group mb-4">
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 bg-white rounded shadow-sm border z-10"
      >
        <GripVertical className="h-4 w-4 text-gray-500" />
      </div>
      
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 z-10">
        <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => onRemove(block.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="pl-10 relative">
        {renderBlockContent()}
      </div>
    </div>
  );
}
