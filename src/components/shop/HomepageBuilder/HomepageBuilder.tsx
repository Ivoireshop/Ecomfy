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
  { type: "hero", label: "Bannière Principal (Hero)", icon: "🎯" },
  { type: "products_grid", label: "Grille de Produits", icon: "🛍️" },
  { type: "categories", label: "Grille de Catégories", icon: "🏷️" },
  { type: "features", label: "Engagements & Bénéfices", icon: "✨" },
  { type: "text_image", label: "Texte + Image (Storytelling)", icon: "🖼️" },
  { type: "testimonials", label: "Témoignages Clients", icon: "⭐" },
  { type: "banner_cta", label: "Bandeau Promo / Vente Flash", icon: "🔥" },
  { type: "faq", label: "Foire Aux Questions (FAQ)", icon: "❓" },
  { type: "footer_custom", label: "Pied de Page Personnalisé", icon: "🔻" },
];

export const HomepageBuilder: React.FC<HomepageBuilderProps> = ({
  shop,
  setShop,
  products = [],
  onClose,
}) => {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Initialize homepage config from shop.theme_config.homepage
  const [config, setConfig] = useState<HomepageConfig>(() => {
    const existing = shop?.theme_config?.homepage;
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedThemeConfig = {
        ...(shop.theme_config || {}),
        homepage: {
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
        title: "Page d'accueil sauvegardée ✓",
        description: "Les modifications sont enregistrées pour votre boutique.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erreur de sauvegarde",
        description: err.message || "Impossible d'enregistrer les modifications.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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
            <Monitor className="w-3.5 h-3.5 mr-1" /> Desktop
          </Button>
          <Button
            variant={device === "tablet" ? "default" : "ghost"}
            size="sm"
            className={`h-7 px-3 text-xs rounded-lg ${
              device === "tablet" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500"
            }`}
            onClick={() => setDevice("tablet")}
          >
            <Tablet className="w-3.5 h-3.5 mr-1" /> Tablette
          </Button>
          <Button
            variant={device === "mobile" ? "default" : "ghost"}
            size="sm"
            className={`h-7 px-3 text-xs rounded-lg ${
              device === "mobile" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500"
            }`}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="w-3.5 h-3.5 mr-1" /> Mobile
          </Button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={onClose}>
              <X className="w-4 h-4 mr-1" /> Fermer
            </Button>
          )}
          <Button
            size="sm"
            className="h-9 px-4 rounded-xl bg-[#0E7C66] hover:bg-[#0E7C66]/90 text-white font-semibold shadow-sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer la page
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Section Manager */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-space font-bold text-sm text-slate-900">
              Sections de la page ({config.sections.length})
            </span>
          </div>

          {/* Section List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {config.sections.map((sec, index) => {
              const isSelected = sec.id === selectedSectionId;
              const secDef = SECTION_OPTIONS.find((o) => o.type === sec.type);

              return (
                <div
                  key={sec.id}
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "border-[#0E7C66] bg-[#0E7C66]/5 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  } ${!sec.enabled ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base">{secDef?.icon || "🧩"}</span>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-slate-900 block truncate">
                        {sec.settings?.title || secDef?.label || sec.type}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {sec.type.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => handleMoveSection(index, "up")}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      disabled={index === config.sections.length - 1}
                      onClick={() => handleMoveSection(index, "down")}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Section Selector */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2">
            <span className="text-xs font-semibold text-slate-500 block px-1">
              + Ajouter une section
            </span>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto p-1">
              {SECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleAddSection(opt.type)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white rounded-lg border border-slate-200 hover:border-[#0E7C66] hover:text-[#0E7C66] transition-colors text-left"
                >
                  <span className="text-sm">{opt.icon}</span>
                  <span className="flex-1 truncate">{opt.label}</span>
                  <Plus className="w-3.5 h-3.5 shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Live Canvas Preview */}
        <main className="flex-1 bg-slate-200/70 p-4 md:p-8 overflow-y-auto flex items-start justify-center">
          <div
            className="transition-all duration-300 mx-auto shadow-2xl rounded-2xl overflow-hidden bg-white border border-slate-300"
            style={{
              width:
                device === "desktop"
                  ? "100%"
                  : device === "tablet"
                  ? "768px"
                  : "375px",
              maxWidth: device === "desktop" ? "1280px" : undefined,
              minHeight: "750px",
            }}
          >
            <HomepageRenderer
              config={config}
              shop={shop}
              products={products}
              primaryColor={shop?.primary_color || "#0E7C66"}
            />
          </div>
        </main>

        {/* Right Settings Panel for Selected Section */}
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
    case "products_grid":
      return {
        title: "Nos Produits",
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
    case "testimonials":
      return {
        title: "Avis Clients",
        items: [
          { id: "1", author_name: "Mariam S.", rating: 5, content: "Superbe expérience d'achat !" },
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
    case "footer_custom":
      return {
        show_social_links: true,
        show_payment_badges: true,
      };
    default:
      return {};
  }
}
