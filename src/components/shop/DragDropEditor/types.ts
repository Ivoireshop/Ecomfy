export type DeviceType = "desktop" | "tablet" | "mobile";

export type BlockType = 
  | "hero"
  | "header"
  | "product_grid"
  | "features"
  | "text_image";

export interface EditorBlock {
  id: string; // Unique ID for this block instance
  type: BlockType;
  settings: Record<string, any>;
}

export interface EditorLayout {
  blocks: EditorBlock[];
}
