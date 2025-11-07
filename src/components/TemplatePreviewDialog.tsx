import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Phone, MessageCircle } from "lucide-react";
import { showcaseTemplates } from "@/lib/showcaseTemplates";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{template.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
              <Badge variant="secondary" className="mt-2">{template.category}</Badge>
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

        {/* Full Preview with Scroll */}
        <ScrollArea className="h-[calc(95vh-180px)]">
          <div className="px-6 pb-6 space-y-8">
            {/* Hero Section Preview */}
            <div className="border rounded-lg overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
              <div className="p-8 text-center">
                <Badge variant="outline" className="mb-4">Section Hero</Badge>
                <h1 className="text-4xl font-bold mb-4">{template.content.heroTitle}</h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  {template.content.heroSubtitle}
                </p>
              </div>
            </div>

            {/* About Section Preview */}
            <div className="border rounded-lg p-6">
              <Badge variant="outline" className="mb-4">Section À Propos</Badge>
              <h2 className="text-2xl font-bold mb-4">{template.content.aboutTitle}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {template.content.aboutDescription}
              </p>
            </div>

            {/* Features/Services Section Preview */}
            <div className="border rounded-lg p-6">
              <Badge variant="outline" className="mb-4">Services & Fonctionnalités</Badge>
              <div className="grid md:grid-cols-3 gap-4">
                {template.content.features.map((feature, index) => (
                  <div key={index} className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Formation Section Preview (if exists) */}
            {template.content.formationTitle && (
              <div className="border rounded-lg p-6 bg-gradient-to-br from-secondary/10 to-primary/10">
                <Badge variant="outline" className="mb-4">Formation</Badge>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">{template.content.formationTitle}</h2>
                  {template.content.formationDescription && (
                    <p className="text-muted-foreground mb-4">{template.content.formationDescription}</p>
                  )}
                  {template.content.formationPrice && (
                    <div className="text-3xl font-bold text-primary">{template.content.formationPrice}</div>
                  )}
                </div>
              </div>
            )}

            {/* CTA Section Preview */}
            <div className="border rounded-lg p-8 bg-primary/5 text-center">
              <Badge variant="outline" className="mb-4">Appel à l'Action</Badge>
              <h2 className="text-2xl font-bold mb-4">{template.content.ctaTitle}</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                {template.content.ctaDescription}
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="lg" className="gap-2">
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </Button>
                <Button size="lg" variant="outline" className="gap-2">
                  <Phone className="h-5 w-5" />
                  Appeler
                </Button>
              </div>
            </div>

            {/* Theme & Style Info */}
            <div className="border rounded-lg p-6">
              <Badge variant="outline" className="mb-4">Style & Thème</Badge>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Thème</h3>
                  <p className="text-sm text-muted-foreground capitalize">{template.theme}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Catégorie</h3>
                  <p className="text-sm text-muted-foreground">{template.category}</p>
                </div>
              </div>
            </div>

            {/* Footer Preview */}
            <div className="border rounded-lg p-6 bg-muted/30">
              <Badge variant="outline" className="mb-4">Pied de Page</Badge>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  © 2024 - Votre Entreprise • Tous droits réservés
                </p>
                <div className="flex gap-4 justify-center mt-4 text-sm">
                  <span className="text-muted-foreground">Contact</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">Mentions légales</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">CGV</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Actions - Sticky Footer */}
        <div className="px-6 py-4 border-t bg-background sticky bottom-0">
          <div className="flex gap-3 justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Ce template comprend {template.content.features.length} services configurés
            </p>
            <div className="flex gap-3">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
