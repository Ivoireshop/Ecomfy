import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cacheInvalidate } from "@/lib/shopCache";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Plus, Check, Paintbrush, Smartphone, Monitor, Trash2, X, ArrowLeft, Loader2 } from "lucide-react";
import { SHOP_THEME_LIST } from "@/lib/shopThemes/registry";
import { ShopThemeRenderer } from "@/lib/shopThemes/ShopThemeRenderer";
import classicDesktopPreview from "@/assets/themes/classic-shop.jpg";
import classicMobilePreview from "@/assets/themes/classic-shop-mobile.jpg";

type ThemeConfig = Record<string, unknown>;
type ShopLike = { theme_config?: ThemeConfig | null; [key: string]: unknown };
const asSlugList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

interface ShopThemesManagerProps {
  shop: any;
  setShop: (update: (prev: ShopLike | null) => ShopLike | null) => void;
  products: any[];
  onCustomize?: () => void;
  onOpenVisualEditor?: () => void;
}

export default function ShopThemesManager({ shop, setShop, products, onCustomize, onOpenVisualEditor }: ShopThemesManagerProps) {
  const themeConfig = shop?.theme_config || {};
  const activeSlug: string | null = themeConfig.active_theme_slug || null;
  const installed: string[] = Array.isArray(themeConfig.installed_themes) ? themeConfig.installed_themes : [];

  const [saving, setSaving] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [previewMobile, setPreviewMobile] = useState(false);

  const activeMeta = useMemo(
    () => SHOP_THEME_LIST.find((t) => t.slug === activeSlug) || null,
    [activeSlug]
  );

  const currentDesktopPreview = activeMeta?.preview || classicDesktopPreview;
  const currentMobilePreview = activeMeta?.slug === null || !activeMeta
    ? classicMobilePreview
    : (activeMeta.preview || classicMobilePreview);

  // Les écritures passent l'une après l'autre : deux clics rapprochés (installer A puis B) ne doivent pas
  // partir du même état de départ, sinon la seconde efface la première.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const slugRef = useRef<string | undefined>(shop?.slug);
  slugRef.current = shop?.slug;

  // `change` reçoit la configuration lue en base à l'instant de l'écriture (et non celle affichée à l'écran,
  // qui peut être périmée ou contenir des réglages non enregistrés) et renvoie les clés à modifier.
  // Seules ces clés sont écrites : les réglages en cours d'édition ailleurs ne sont pas enregistrés en douce.
  const updateThemeConfig = (change: (current: ThemeConfig) => ThemeConfig): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      try {
        const { data: row, error: readError } = await supabase
          .from("shops")
          .select("theme_config")
          .eq("id", shop.id)
          .maybeSingle();
        if (readError) throw readError;
        if (!row) throw new Error("Boutique introuvable ou accès refusé.");
        const stored = row.theme_config && typeof row.theme_config === "object" && !Array.isArray(row.theme_config)
          ? (row.theme_config as ThemeConfig)
          : {};
        const patch = change(stored);
        const { data: written, error } = await supabase
          .from("shops")
          .update({ theme_config: { ...stored, ...patch } as Json })
          .eq("id", shop.id)
          .select("id");
        if (error) throw error;
        // Une règle d'accès qui refuse l'écriture ne renvoie pas d'erreur : aucune ligne n'est modifiée.
        if (!written || written.length === 0) throw new Error("Le changement n'a pas été enregistré. Vérifiez que votre boutique n'est pas restreinte, puis réessayez.");
        // On applique le même changement à l'écran en gardant les réglages non enregistrés.
        setShop((prev) => (prev ? { ...prev, theme_config: { ...(prev.theme_config || {}), ...patch } } : prev));
        // L'accueil public est lu par lien (`slug`), l'aperçu du tableau de bord par identifiant (`id`).
        if (slugRef.current) cacheInvalidate(`shop:slug:${slugRef.current}`);
        cacheInvalidate(`shop:id:${shop.id}`);
        return true;
      } catch (e) {
        toast({ title: "Erreur", description: (e instanceof Error && e.message) || "Le changement de thème n'a pas pu être enregistré.", variant: "destructive" });
        return false;
      }
    };
    const result = queueRef.current.then(run, run);
    queueRef.current = result;
    return result;
  };

  const installTheme = async (slug: string) => {
    setSaving(slug);
    const ok = await updateThemeConfig((cur) => {
      const list = asSlugList(cur.installed_themes);
      return { installed_themes: list.includes(slug) ? list : [...list, slug] };
    });
    setSaving(null);
    if (ok) toast({ title: "Thème installé", description: "Vous pouvez maintenant l'activer." });
  };

  const activateTheme = async (slug: string) => {
    if (!confirm("Ce thème va modifier la présentation visuelle de votre boutique, mais vos produits, images, commandes et informations ne seront pas supprimés. Voulez-vous continuer ?")) return;
    setSaving(slug);
    const ok = await updateThemeConfig((cur) => {
      const list = asSlugList(cur.installed_themes);
      return { active_theme_slug: slug, installed_themes: list.includes(slug) ? list : [...list, slug] };
    });
    setSaving(null);
    if (ok) toast({ title: "Thème activé", description: "Le nouveau design est en ligne." });
  };

  const resetToClassic = async () => {
    setSaving("__classic__");
    const ok = await updateThemeConfig(() => ({ active_theme_slug: null }));
    setSaving(null);
    if (ok) toast({ title: "Thème classique restauré" });
  };

  const uninstall = async (slug: string) => {
    setSaving(slug);
    const ok = await updateThemeConfig((cur) => {
      const list = asSlugList(cur.installed_themes);
      const patch: ThemeConfig = { installed_themes: list.filter((s) => s !== slug) };
      if (cur.active_theme_slug === slug) patch.active_theme_slug = null;
      return patch;
    });
    setSaving(null);
    if (ok) toast({ title: "Thème supprimé" });
  };

  const installedMetas = SHOP_THEME_LIST.filter((t) => installed.includes(t.slug));

  // Le « Constructeur Dynamique » n'est pas un thème prêt à l'emploi : il n'a de contenu qu'une fois la mise en page
  // enregistrée dans l'Éditeur Visuel (qui l'active lui-même). On ne le propose donc pas dans le catalogue gratuit.
  const catalogue = SHOP_THEME_LIST.filter((t) => t.slug !== "dynamic-builder");

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Thèmes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisissez un thème professionnel pour rendre votre boutique plus belle et plus vendeuse. Vous pouvez revenir au thème classique à tout moment.
        </p>
      </div>

      {/* CURRENT THEME */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Thème actuel</h2>
        <div className="rounded-xl border bg-card p-5 md:p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xl font-bold">{activeMeta ? activeMeta.name : "Classique (par défaut)"}</div>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Activé</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {activeMeta
                  ? activeMeta.description
                  : "Vous utilisez actuellement le design classique Ecomfy. Installez un nouveau thème pour transformer l'apparence de votre boutique."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {activeMeta && (
                  <Button size="sm" variant="default" onClick={() => setPreviewSlug(activeMeta.slug)}>
                    <Eye className="h-4 w-4 mr-1.5" /> Prévisualiser
                  </Button>
                )}
                {onCustomize && (
                  <Button size="sm" variant="outline" onClick={onCustomize}>
                    <Paintbrush className="h-4 w-4 mr-1.5" /> Paramètres
                  </Button>
                )}
                <Button 
                  size="sm" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white" 
                  onClick={() => {
                    import("@/lib/premium").then(({ isPremiumShop }) => {
                      if (!isPremiumShop(shop)) {
                        import("@/hooks/use-toast").then(({ toast }) => {
                          toast({ title: "Premium", description: "L'éditeur visuel nécessite un compte Premium.", variant: "destructive" });
                        });
                        return;
                      }
                      if (onOpenVisualEditor) onOpenVisualEditor();
                    });
                  }}
                >
                  <Paintbrush className="h-4 w-4 mr-1.5" /> Éditeur Visuel (Pro)
                </Button>
                {activeMeta && (
                  <Button size="sm" variant="ghost" onClick={resetToClassic} disabled={saving === "__classic__"}>
                    {saving === "__classic__" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArrowLeft className="h-4 w-4 mr-1.5" />}
                    Revenir au classique
                  </Button>
                )}
              </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => { setPreviewMobile(false); setPreviewSlug(activeMeta?.slug || "classic-shop"); }}
                className="relative flex-1 md:flex-none md:w-56 aspect-[16/10] rounded-lg border overflow-hidden bg-muted group"
                aria-label="Aperçu ordinateur du thème actuel"
              >
                <img
                  src={currentDesktopPreview}
                  alt="Aperçu ordinateur du thème actuel"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                  <Monitor className="h-3 w-3" /> Ordinateur
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setPreviewMobile(true); setPreviewSlug(activeMeta?.slug || "classic-shop"); }}
                className="relative w-24 md:w-28 aspect-[9/16] rounded-lg border overflow-hidden bg-muted group"
                aria-label="Aperçu mobile du thème actuel"
              >
                <img
                  src={currentMobilePreview}
                  alt="Aperçu mobile du thème actuel"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                  <Smartphone className="h-3 w-3" /> Mobile
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALLED */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Mes thèmes installés</h2>
        {installedMetas.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <div className="font-medium">Aucun thème installé pour le moment</div>
            <p className="text-sm text-muted-foreground mt-1">
              Parcourez les thèmes disponibles ci-dessous et installez celui qui correspond à votre boutique.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {installedMetas.map((t) => (
              <ThemeCard
                key={t.slug}
                meta={t}
                active={activeSlug === t.slug}
                installed
                saving={saving === t.slug}
                onPreview={() => setPreviewSlug(t.slug)}
                onActivate={() => activateTheme(t.slug)}
                onUninstall={() => uninstall(t.slug)}
                onCustomize={onCustomize}
              />
            ))}
          </div>
        )}
      </section>

      {/* AVAILABLE */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Tous les thèmes gratuits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalogue.map((t) => (
            <ThemeCard
              key={t.slug}
              meta={t}
              active={activeSlug === t.slug}
              installed={installed.includes(t.slug)}
              saving={saving === t.slug}
              onPreview={() => setPreviewSlug(t.slug)}
              onInstall={() => installTheme(t.slug)}
              onActivate={() => activateTheme(t.slug)}
            />
          ))}
        </div>
      </section>

      {/* PREVIEW DIALOG */}
      <Dialog open={!!previewSlug} onOpenChange={(o) => !o && setPreviewSlug(null)}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between gap-2 space-y-0">
            <DialogTitle className="text-base">
              Aperçu · {SHOP_THEME_LIST.find((t) => t.slug === previewSlug)?.name}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant={previewMobile ? "ghost" : "secondary"} onClick={() => setPreviewMobile(false)}>
                <Monitor className="h-4 w-4 mr-1" /> Ordinateur
              </Button>
              <Button size="sm" variant={previewMobile ? "secondary" : "ghost"} onClick={() => setPreviewMobile(true)}>
                <Smartphone className="h-4 w-4 mr-1" /> Mobile
              </Button>
              {previewSlug && !installed.includes(previewSlug) && (
                <Button size="sm" disabled={saving === previewSlug} onClick={() => { installTheme(previewSlug); }}>
                  {saving === previewSlug ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Installer
                </Button>
              )}
              {previewSlug && installed.includes(previewSlug) && activeSlug !== previewSlug && (
                <Button size="sm" disabled={saving === previewSlug} onClick={() => { activateTheme(previewSlug); }}>
                  {saving === previewSlug ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Activer
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => setPreviewSlug(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          {/* Aperçu : les liens de la boutique ne doivent pas faire quitter le tableau de bord. */}
          <div
            className="flex-1 overflow-auto bg-muted/40"
            onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) e.preventDefault(); }}
          >
            {previewSlug && (
              <div className={previewMobile ? "mx-auto my-4 w-[390px] max-w-full rounded-[2rem] overflow-hidden shadow-xl bg-white border-8 border-neutral-900" : ""}>
                <ShopThemeRenderer
                  themeSlug={previewSlug}
                  shop={shop}
                  products={products}
                  customSettings={themeConfig.custom_settings}
                  embedded
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThemeCard({
  meta, active, installed, saving, onPreview, onInstall, onActivate, onUninstall, onCustomize,
}: {
  meta: { slug: string; name: string; description: string; category: string; preview?: string };
  active?: boolean;
  installed?: boolean;
  saving?: boolean;
  onPreview: () => void;
  onInstall?: () => void;
  onActivate?: () => void;
  onUninstall?: () => void;
  onCustomize?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={onPreview}
        className="aspect-[16/10] bg-gradient-to-br from-muted via-background to-muted relative overflow-hidden group"
      >
        {meta.preview ? (
          <img
            src={meta.preview}
            alt={`Aperçu du thème ${meta.name}`}
            loading="lazy"
            width={800}
            height={512}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
            {meta.name}
          </div>
        )}
        {active && (
          <Badge className="absolute top-2 left-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow">
            <Check className="h-3 w-3 mr-1" /> Actif
          </Badge>
        )}
        {!active && !installed && (
          <Badge variant="secondary" className="absolute top-2 left-2 shadow">Nouveau</Badge>
        )}
      </button>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold">{meta.name}</div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{meta.category}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">par Ecomfy</div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex-1">{meta.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-1" /> Prévisualiser
          </Button>
          {active ? (
            onCustomize ? (
              <Button size="sm" onClick={onCustomize}>
                <Paintbrush className="h-4 w-4 mr-1" /> Personnaliser
              </Button>
            ) : (
              <Button size="sm" disabled><Check className="h-4 w-4 mr-1" /> Actif</Button>
            )
          ) : installed ? (
            <Button size="sm" onClick={onActivate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Activer
            </Button>
          ) : (
            <Button size="sm" onClick={onInstall} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Installer
            </Button>
          )}
        </div>
        {installed && !active && onUninstall && (
          <button onClick={onUninstall} className="text-xs text-muted-foreground hover:text-destructive mt-2 inline-flex items-center gap-1 self-start">
            <Trash2 className="h-3 w-3" /> Désinstaller
          </button>
        )}
      </div>
    </div>
  );
}