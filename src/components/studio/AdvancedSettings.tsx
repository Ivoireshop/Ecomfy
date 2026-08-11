import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";

export interface StudioSettings {
  aspectRatio: string;
  style: string;
  videoDuration: string;
}

interface AdvancedSettingsProps {
  mode: "image" | "video";
  settings: StudioSettings;
  onSettingsChange: (settings: StudioSettings) => void;
}

export const AdvancedSettings = ({ mode, settings, onSettingsChange }: AdvancedSettingsProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Settings2 className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Paramètres avancés</h4>
            <p className="text-sm text-muted-foreground">
              Ajustez les options pour votre {mode === "image" ? "image" : "vidéo"}.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="aspect-ratio">Format (Ratio)</Label>
              <Select
                value={settings.aspectRatio}
                onValueChange={(val) => onSettingsChange({ ...settings, aspectRatio: val })}
              >
                <SelectTrigger id="aspect-ratio">
                  <SelectValue placeholder="Choisir un format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1 (Carré - Social Media)</SelectItem>
                  <SelectItem value="9:16">9:16 (Vertical - Stories/Reels)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal - YouTube)</SelectItem>
                  <SelectItem value="4:5">4:5 (Portrait - Instagram)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "image" && (
              <div className="grid gap-2">
                <Label htmlFor="style">Style visuel</Label>
                <Select
                  value={settings.style}
                  onValueChange={(val) => onSettingsChange({ ...settings, style: val })}
                >
                  <SelectTrigger id="style">
                    <SelectValue placeholder="Choisir un style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professionnel / Studio</SelectItem>
                    <SelectItem value="cinematic">Cinématographique</SelectItem>
                    <SelectItem value="minimalist">Minimaliste</SelectItem>
                    <SelectItem value="vibrant">Vibrant & Coloré</SelectItem>
                    <SelectItem value="luxury">Luxe & Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "video" && (
              <div className="grid gap-2">
                <Label htmlFor="duration">Durée de la vidéo</Label>
                <Select
                  value={settings.videoDuration}
                  onValueChange={(val) => onSettingsChange({ ...settings, videoDuration: val })}
                >
                  <SelectTrigger id="duration">
                    <SelectValue placeholder="Choisir une durée" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 secondes</SelectItem>
                    <SelectItem value="10">10 secondes</SelectItem>
                    <SelectItem value="15">15 secondes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
