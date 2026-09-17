import React, { useState, useEffect } from "react";
import { DeviceType, HomepageConfig, HomepageSection, SectionType } from "./types";
import { HOMEPAGE_TEMPLATES } from "./templates";
import { HomepageRenderer } from "./HomepageRenderer";
import { SectionControls } from "./SectionControls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Monitor,
  Smartphone,
  Tablet,
  Save,
  X,
  Plus,
  LayoutTemplate,
  Check,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Trash2,
  Settings2,
  Loader2,
  Eye,
  Globe,
  Copy,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HomepageBuilderProps {
  shop: any;
  setShop: (shop: any) => void;
  products: any[];
  onClose?: () => void;
}

const SECTION_OPTIONS: { type: SectionType; label: string; icon: string }[] = [
  { type: "hero", label: "Bannière Principale (Hero)", icon: "🎯" },
  { type: "single_product_checkout", label: "Produit Spotlight & Commande Directe", icon: "⚡" },
  { type: "featured_products", label: "Produits Vedettes", icon: "🌟" },
  { type: "products_grid", label: "Grille de Produits", icon: "🛍️" },
  { type: "categories", label: "Grille de Catégories", icon: "🏷️" },
  { type: "features", label: "Engagements & Bénéfices", icon: "✨" },
  { type: "text_image", label: "Texte + Image (Storytelling)", icon: "🖼️" },
  { type: "video", label: "Présentation Vidéo", icon: "🎥" },
  { type: "video_shorts", label: "Vidéos Shorts 9:16 (Reels)", icon: "📱" },
  { type: "testimonials", label: "Témoignages & Avis Clients", icon: "⭐" },
  { type: "audio_testimonials", label: "Témoignages Vocaux (Audios)", icon: "🎙️" },
  { type: "banner_cta", label: "Bandeau Promo / Vente Flash", icon: "🔥" },
  { type: "faq", label: "Foire Aux Questions (FAQ)", icon: "❓" },
  { type: "contact_form", label: "Formulaire de Contact", icon: "✉️" },
  { type: "footer_custom", label: "Pied de Page Personnalisé", icon: "🔻" },
];

export const HomepageBuilder: React.FC<HomepageBuilderProps> = ({
  shop,
  setShop,
  products = [],
  onClose,
}) => {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  // Initialize homepage config from shop.theme_config.homepage_draft or homepage
  const [config, setConfig] = useState<HomepageConfig>(() => {
    const draft = shop?.theme_config?.homepage_draft;
    const published = shop?.theme_config?.homepage;
    const existing = draft || published;
    if (existing && Array.isArray(existing.sections)) {
      return existing;
    }
    // Default to Classic Template
    return (HOMEPAGE_TEMPLATES[0].config as HomepageConfig) || {
      enabled: true,
      template_slug: "classic",
      global_styles: {},
      sections: [],
    };
  });

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Select first section by default
  useEffect(() => {
    if (!selectedSectionId && config.sections.length > 0) {
      setSelectedSectionId(config.sections[0].id);
    }
  }, [config.sections]);

  const handleAddSection = (type: SectionType) => {
    const newSection: HomepageSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      enabled: true,
      settings: getDefaultSettingsForType(type),
    };
    setConfig((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setSelectedSectionId(newSection.id);
    toast({ title: "Section ajoutée ✓", description: "Personnalisez ses options dans le panneau." });
  };

  const handleDuplicateSection = (id: string) => {
    const target = config.sections.find((s) => s.id === id);
    if (!target) return;
    const dup: HomepageSection = {
      ...JSON.parse(JSON.stringify(target)),
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const index = config.sections.findIndex((s) => s.id === id);
    const newSections = [...config.sections];
    newSections.splice(index + 1, 0, dup);
    setConfig((prev) => ({ ...prev, sections: newSections }));
    setSelectedSectionId(dup.id);
    toast({ title: "Section dupliquée ✓" });
  };

  const handleUpdateSection = (updated: HomepageSection) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === updated.id ? updated : s)),
    }));
  };

  const handleDeleteSection = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
    }));
    if (selectedSectionId === id) {
      setSelectedSectionId(null);
    }
  };

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const newSections = [...config.sections];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newSections.length) return;
    const temp = newSections[index];
    newSections[index] = newSections[targetIdx];
    newSections[targetIdx] = temp;
    setConfig((prev) => ({ ...prev, sections: newSections }));
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = HOMEPAGE_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl || !tpl.config) return;
    const newConfig = {
      enabled: true,
      template_slug: tpl.id,
      global_styles: tpl.config.global_styles || {},
      sections: JSON.parse(JSON.stringify(tpl.config.sections || [])),
    };
    setConfig(newConfig);
    setTemplateDialogOpen(false);
    toast({
      title: "Modèle appliqué ✓",
      description: `Le modèle "${tpl.name}" est actif. Vous pouvez le personnaliser.`,
    });
  };

  // Save Draft (Brouillon) — Does NOT touch published live site
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const updatedThemeConfig = {
        ...(shop.theme_config || {}),
        homepage_draft: {
          ...config,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from("shops")
        .update({ theme_config: updatedThemeConfig })
        .eq("id", shop.id);

      if (error) throw error;

      setShop({ ...shop, theme_config: updatedThemeConfig });
      toast({
        title: "Brouillon enregistré ✓",
        description: "Les modifications sont conservées en brouillon sans affecter la version en ligne.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erreur de sauvegarde brouillon",
        description: err.message || "Impossible d'enregistrer le brouillon.",
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Explicit Publish — Copies homepage_draft to homepage (published live site)
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const publishedConfig = {
        ...config,
        enabled: true,
        is_published: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updatedThemeConfig = {
        ...(shop.theme_config || {}),
        homepage_draft: publishedConfig,
        homepage: publishedConfig,
      };

      const { error } = await supabase
        .from("shops")
        .update({ theme_config: updatedThemeConfig })
        .eq("id", shop.id);

      if (error) throw error;

      setShop({ ...shop, theme_config: updatedThemeConfig });
      setPublishConfirmOpen(false);
      toast({
        title: "Boutique publiée avec succès ! 🚀",
        description: "La nouvelle page d'accueil est désormais visible par vos clients.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erreur lors de la publication",
        description: err.message || "Impossible de publier la page d'accueil.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpenPreview = () => {
    const previewUrl = `/shop-preview/${shop.id}?preview=draft`;
    window.open(previewUrl, "_blank");
  };

  const selectedSection = config.sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-100 overflow-hidden font-inter">
      {/* Top Navbar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-space font-bold text-base text-slate-900">
            <LayoutTemplate className="w-5 h-5 text-[#0E7C66]" />
            <span>Éditeur de Page d'accueil</span>
          </div>

          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-lg border-slate-200 hover:border-[#0E7C66]">
                <Sparkles className="w-3.5 h-3.5 text-[#0E7C66]" />
                Modèles de page
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="font-space font-bold text-xl text-slate-900">
                  Choisir un modèle de page d'accueil
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {HOMEPAGE_TEMPLATES.map((tpl) => (
                  <Card
                    key={tpl.id}
                    className="p-5 border-2 hover:border-[#0E7C66] cursor-pointer transition-all flex flex-col justify-between bg-white shadow-sm"
                    onClick={() => handleApplyTemplate(tpl.id)}
                  >
                    <div className="space-y-3">
                      <div className="text-3xl">{tpl.icon_label}</div>
                      <h4 className="font-bold text-sm text-slate-900">{tpl.name}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-4 bg-[#0E7C66] hover:bg-[#0E7C66]/90 text-white text-xs font-semibold rounded-xl"
                    >
                      Appliquer ce modèle
                    </Button>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <Button
            variant={device === "desktop" ? "default" : "ghost"}
            size="sm"
            className={`h-7 px-3 text-xs rounded-lg ${
              device === "desktop" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500"
            }`}
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="w-3.5 h-3.5 mr-1" />
            PC
          </Button>
          <Button
            variant={device === "tablet" ? "default" : "ghost"}
            size="sm"
            className={`h-7 px-3 text-xs rounded-lg ${
              device === "tablet" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500"
            }`}
            onClick={() => setDevice("tablet")}
          >
            <Tablet className="w-3.5 h-3.5 mr-1" />
            Tablette
          </Button>
          <Button
            variant={device === "mobile" ? "default" : "ghost"}
            size="sm"
            className={`h-7 px-3 text-xs rounded-lg ${
              device === "mobile" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500"
            }`}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="w-3.5 h-3.5 mr-1" />
            Mobile
          </Button>
        </div>

        {/* Actions Bar (Save Draft, Live Preview, Explicit Publish) */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPreview}
            className="h-9 gap-1.5 text-xs font-semibold rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            Aperçu Direct
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSavingDraft}
            className="h-9 gap-1.5 text-xs font-semibold rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            {isSavingDraft ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
            ) : (
              <Save className="w-3.5 h-3.5 text-slate-600" />
            )}
            Enregistrer Brouillon
          </Button>

          <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-9 gap-1.5 text-xs font-bold rounded-xl bg-[#0E7C66] hover:bg-[#0E7C66]/90 text-white shadow-sm"
              >
                <Globe className="w-3.5 h-3.5" />
                Publier la boutique
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-space font-bold text-lg text-slate-900">
                  Publier la nouvelle page d'accueil ?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2 text-sm text-slate-600">
                <p>
                  Cette action va rendre visibles immédiatement vos modifications sur la vitrine publique de votre boutique.
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  ⚡ La version publique actuelle sera mise à jour avec vos nouvelles sections et paramètres.
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setPublishConfirmOpen(false)} className="rounded-xl">
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="bg-[#0E7C66] hover:bg-[#0E7C66]/90 text-white font-bold rounded-xl gap-1.5"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Publication...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4" />
                        Confirmer & Publier
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-400 hover:text-slate-600"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Section List & Section Adder */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
              Sections de la Page ({config.sections.length})
            </span>
          </div>

          <div className="p-3 flex-1 space-y-2 overflow-y-auto">
            {config.sections.map((section, idx) => {
              const option = SECTION_OPTIONS.find((o) => o.type === section.type);
              const isSelected = selectedSectionId === section.id;
              return (
                <div
                  key={section.id}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? "border-[#0E7C66] bg-[#0E7C66]/5 shadow-sm"
                      : "border-slate-200/80 hover:border-slate-300 bg-white"
                  }`}
                  onClick={() => setSelectedSectionId(section.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{option?.icon || "📄"}</span>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-xs text-slate-800 truncate">
                        {option?.label || section.type}
                      </h4>
                      <span className="text-[10px] text-slate-400 block">
                        {section.enabled ? "Visible" : "Masquée"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-slate-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSection(idx, "up");
                      }}
                      title="Monter"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-slate-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSection(idx, "down");
                      }}
                      title="Descendre"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-indigo-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateSection(section.id);
                      }}
                      title="Dupliquer"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-rose-400 hover:text-rose-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(section.id);
                      }}
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Add Section Picker */}
            <div className="pt-4 space-y-2">
              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400 block px-1">
                + Ajouter une section
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {SECTION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.type}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs font-medium text-slate-700 hover:bg-[#0E7C66]/10 hover:text-[#0E7C66] rounded-xl h-9 gap-2"
                    onClick={() => handleAddSection(opt.type)}
                  >
                    <span>{opt.icon}</span>
                    <span className="truncate">{opt.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center Frame: Live Responsive Canvas */}
        <main className="flex-1 bg-slate-200/70 p-4 md:p-8 flex items-center justify-center overflow-auto relative">
          <div
            className={`bg-white shadow-2xl transition-all duration-300 rounded-2xl overflow-y-auto border border-slate-300/80 ${
              device === "mobile"
                ? "w-[375px] h-[720px]"
                : device === "tablet"
                ? "w-[768px] h-[850px]"
                : "w-full max-w-5xl h-full"
            }`}
          >
            <HomepageRenderer
              config={config}
              shop={shop}
              products={products}
              primaryColor={shop?.primary_color || "#0E7C66"}
            />
          </div>
        </main>

        {/* Right Sidebar: Section Settings Panel */}
        {selectedSection && (
          <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Settings2 className="w-4 h-4 text-[#0E7C66]" />
                <span>Paramètres de la section</span>
              </div>
            </div>

            <SectionControls
              section={selectedSection}
              onChange={handleUpdateSection}
              onDelete={() => handleDeleteSection(selectedSection.id)}
              categories={categories}
              products={products}
              shopId={shop?.id}
            />
          </aside>
        )}
      </div>
    </div>
  );
};

function getDefaultSettingsForType(type: SectionType): any {
  switch (type) {
    case "hero":
      return {
        title: "Titre de la Bannière",
        subtitle: "Sous-titre attractif pour capter vos acheteurs",
        badge: "🔥 Offre Limitée",
        bg_type: "gradient",
        bg_gradient: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        text_color: "#FFFFFF",
        primary_button_text: "Acheter maintenant",
        primary_button_link_type: "products",
        content_alignment: "center",
        height: "medium",
      };
    case "single_product_checkout":
      return {
        title: "Offre Spéciale — Commander en 1 Clic",
        subtitle: "Produit Vedette avec Livraison Rapide & Paiement à la Livraison",
        badge: "-30% AUJOURD'HUI SEULEMENT",
        button_text: "Valider ma commande maintenant",
      };
    case "featured_products":
      return {
        title: "Nos Produits Vedettes",
        subtitle: "Sélection exclusive des meilleures ventes",
        badge_text: "Top Ventes",
        show_badge: true,
        button_text: "Commander",
        columns_desktop: 3,
      };
    case "products_grid":
      return {
        title: "Notre Catalogue de Produits",
        selection_rule: "all",
        limit: 8,
        columns_desktop: 4,
        columns_mobile: 2,
        button_text: "Commander",
        button_action: "checkout",
        show_compare_price: true,
        show_stock_badge: true,
      };
    case "features":
      return {
        title: "Nos Avantages",
        items: [
          { id: "1", icon_name: "truck", title: "Livraison Rapide", description: "Envoi sous 24h/48h" },
          { id: "2", icon_name: "shield", title: "Paiement Sécurisé", description: "Paiement à la livraison" },
        ],
      };
    case "text_image":
      return {
        title: "Notre Histoire & Engagement",
        description: "Découvrez des produits conçus avec passion et rigueur.",
        image_position: "right",
        button_text: "En savoir plus",
      };
    case "video":
      return {
        title: "Présentation de notre boutique en vidéo",
        description: "Regardez notre vidéo pour découvrir nos produits en action.",
        video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        button_text: "Découvrir la collection",
      };
    case "video_shorts":
      return {
        title: "Nos Produits en Démo (Vidéos Shorts)",
        subtitle: "Découvrez nos produits en action avec nos vidéos format Reels (30s max)",
        items: [
          {
            id: "1",
            title: "Démonstration produit en direct",
            video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          },
        ],
      };
    case "testimonials":
      return {
        title: "Ce que nos clients disent de nous",
        items: [
          { id: "1", author_name: "Mariam S.", rating: 5, content: "Superbe expérience d'achat ! Produits de très bonne qualité." },
        ],
      };
    case "audio_testimonials":
      return {
        title: "Ce que disent nos clients (Note Vocale)",
        subtitle: "Écoutez les retours d'expérience audio de nos clients satisfaits",
        items: [
          {
            id: "1",
            client_name: "Awa K.",
            client_location: "Abidjan, CI",
            audio_url: "",
            duration: "0:45",
            comment: "J'ai reçu ma commande en 24h à Cocody, qualité incroyable !",
          },
        ],
      };
    case "banner_cta":
      return {
        title: "Offre Spéciale — Temps Limité",
        button_text: "J'en profite",
        button_action: "checkout",
        show_countdown: true,
      };
    case "faq":
      return {
        title: "Foire Aux Questions",
        items: [
          { id: "1", question: "Comment passer commande ?", answer: "Sélectionnez votre produit et validez avec votre numéro de téléphone." },
        ],
      };
    case "contact_form":
      return {
        title: "Contactez-nous",
        subtitle: "Une question sur une commande ? Écrivez-nous directement.",
        show_phone: true,
        show_email: true,
        button_text: "Envoyer le message",
      };
    case "footer_custom":
      return {
        show_social_links: true,
        show_payment_badges: true,
      };
    default:
      return {};
  }
}
