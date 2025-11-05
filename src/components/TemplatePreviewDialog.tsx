import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { showcaseTemplates } from "@/lib/showcaseTemplates";

interface TemplatePreviewDialogProps {
  templateId: string | null;
  onClose: () => void;
  onApply: (templateId: string) => void;
}

export function TemplatePreviewDialog({ templateId, onClose, onApply }: TemplatePreviewDialogProps) {
  if (!templateId) return null;
  
  const template = showcaseTemplates.find(t => t.id === templateId);
  if (!template) return null;

  return (
    <Dialog open={!!templateId} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{template.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-6">
            {/* Preview Image */}
            <div className="rounded-lg overflow-hidden border">
              <img 
                src={template.previewImage} 
                alt={template.name}
                className="w-full object-contain"
              />
            </div>

            {/* Template Details */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Contenu inclus</h3>
                  <div className="space-y-2 text-sm">
                    <div className="p-3 bg-muted rounded-lg">
                      <span className="font-medium">Titre Hero:</span>
                      <p className="text-muted-foreground mt-1">{template.content.heroTitle}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <span className="font-medium">Sous-titre:</span>
                      <p className="text-muted-foreground mt-1">{template.content.heroSubtitle}</p>
                    </div>
                    {template.content.aboutDescription && (
                      <div className="p-3 bg-muted rounded-lg">
                        <span className="font-medium">Description:</span>
                        <p className="text-muted-foreground mt-1 line-clamp-3">{template.content.aboutDescription}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Services inclus</h3>
                  <div className="space-y-2 text-sm">
                    {template.content.features.map((feature, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg">
                        <span className="font-medium">{feature.title}</span>
                        <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{feature.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {template.content.formationTitle && (
                  <div>
                    <h3 className="font-semibold mb-2">Formation</h3>
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <span className="font-medium">{template.content.formationTitle}</span>
                      {template.content.formationPrice && (
                        <p className="text-primary font-bold mt-1">{template.content.formationPrice}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t bg-muted/20">
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            <Button onClick={() => {
              onApply(template.id);
              onClose();
            }}>
              <Sparkles className="mr-2 h-4 w-4" />
              Appliquer ce template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
