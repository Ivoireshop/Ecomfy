import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Store, ArrowRight, ArrowLeft, Check, Palette, ShoppingBag, Zap, Globe } from "lucide-react";

const THEMES = [
  { id: "modern", name: "Moderne", description: "Design épuré et contemporain", colors: ["#0f172a", "#3b82f6", "#f8fafc"], icon: "✨" },
  { id: "elegant", name: "Élégant", description: "Style luxueux et raffiné", colors: ["#1c1917", "#d4a574", "#faf7f2"], icon: "💎" },
  { id: "vibrant", name: "Vibrant", description: "Couleurs vives et énergiques", colors: ["#7c3aed", "#f59e0b", "#fef3c7"], icon: "🎨" },
  { id: "nature", name: "Nature", description: "Tons naturels et organiques", colors: ["#14532d", "#22c55e", "#f0fdf4"], icon: "🌿" },
  { id: "minimal", name: "Minimal", description: "Simplicité et espace blanc", colors: ["#000000", "#6b7280", "#ffffff"], icon: "◻️" },
  { id: "afro", name: "Afro-Chic", description: "Inspiré de la culture africaine", colors: ["#92400e", "#f59e0b", "#fef3c7"], icon: "🌍" },
];

const CATEGORIES = [
  { id: "mode", name: "Mode & Vêtements", icon: "👗" },
  { id: "tech", name: "Tech & Électronique", icon: "📱" },
  { id: "beaute", name: "Beauté & Cosmétiques", icon: "💄" },
  { id: "food", name: "Alimentation", icon: "🍽️" },
  { id: "art", name: "Art & Artisanat", icon: "🎨" },
  { id: "digital", name: "Produits Digitaux", icon: "💻" },
  { id: "sport", name: "Sport & Fitness", icon: "⚽" },
  { id: "other", name: "Autre", icon: "📦" },
];

const ShopBuilder = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [useAI, setUseAI] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    businessName: "",
    businessDescription: "",
    category: "",
    whatsappNumber: "",
    phoneNumber: "",
    email: "",
    city: "",
    country: "Côte d'Ivoire",
    theme: "modern",
    primaryColor: "#3b82f6",
    secondaryColor: "#7c3aed",
  });

  const generateSlug = (name: string) => {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const steps = [
    { title: "Méthode", subtitle: "Comment créer votre boutique" },
    { title: "Identité", subtitle: "Nom et description" },
    { title: "Catégorie", subtitle: "Type de produits" },
    { title: "Thème", subtitle: "Apparence visuelle" },
    { title: "Contact", subtitle: "Coordonnées" },
  ];

  const canProceed = () => {
    switch (step) {
      case 0: return useAI !== null;
      case 1: return formData.businessName.length >= 2 && (useAI ? formData.businessDescription.length >= 10 : true);
      case 2: return formData.category !== "";
      case 3: return formData.theme !== "";
      case 4: return formData.whatsappNumber.length >= 8;
      default: return false;
    }
  };

  const createShop = async (aiContent?: any) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Erreur", description: "Vous devez être connecté", variant: "destructive" });
        return;
      }

      let slug = generateSlug(formData.businessName);
      const { data: existing } = await supabase.from("shops").select("id").eq("slug", slug) as any;
      if (existing && existing.length > 0) {
        slug = slug + "-" + Math.random().toString(36).substring(2, 6);
      }

      const selectedTheme = THEMES.find(t => t.id === formData.theme);
      const shopData: any = {
        user_id: session.user.id,
        business_name: formData.businessName,
        business_description: aiContent?.about_description || formData.businessDescription,
        slug,
        whatsapp_number: formData.whatsappNumber,
        phone_number: formData.phoneNumber,
        email: formData.email,
        city: formData.city,
        country: formData.country,
        primary_color: aiContent?.primary_color || selectedTheme?.colors[1] || formData.primaryColor,
        secondary_color: aiContent?.secondary_color || selectedTheme?.colors[0] || formData.secondaryColor,
        theme: formData.theme,
        is_activated: false,
        is_published: false,
      };

      const { data, error } = await supabase.from("shops").insert(shopData).select().single() as any;
      if (error) throw error;

      toast({ title: "🎉 Boutique créée !", description: "Ajoutez maintenant vos produits." });
      navigate(`/shop-editor/${data.id}`);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (useAI) {
      setAiLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-shop-content", {
          body: { businessDescription: formData.businessDescription, businessName: formData.businessName },
        });
        if (error) throw error;
        await createShop(data);
      } catch {
        toast({ title: "IA indisponible", description: "Création manuelle en cours...", variant: "destructive" });
        await createShop();
      } finally {
        setAiLoading(false);
      }
    } else {
      await createShop();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Progress Bar */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" onClick={() => step === 0 ? navigate("/shop-manager") : setStep(step - 1)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
            <span className="text-sm text-muted-foreground font-medium">
              Étape {step + 1} / {steps.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{steps[step].title}</h1>
          <p className="text-muted-foreground text-lg">{steps[step].subtitle}</p>
        </div>

        {/* Step 0: Method Choice */}
        {step === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card
              className={`p-8 cursor-pointer transition-all duration-300 text-center group ${useAI === true ? 'ring-2 ring-primary border-primary shadow-lg scale-[1.02]' : 'hover:shadow-md hover:border-primary/30'}`}
              onClick={() => setUseAI(true)}
            >
              <div className="h-20 w-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Création IA</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Décrivez votre activité, l'IA génère le contenu, les couleurs et le design de votre boutique
              </p>
              {useAI === true && (
                <div className="mt-4 inline-flex items-center gap-1 text-primary text-sm font-medium">
                  <Check className="h-4 w-4" /> Sélectionné
                </div>
              )}
            </Card>

            <Card
              className={`p-8 cursor-pointer transition-all duration-300 text-center group ${useAI === false ? 'ring-2 ring-primary border-primary shadow-lg scale-[1.02]' : 'hover:shadow-md hover:border-primary/30'}`}
              onClick={() => setUseAI(false)}
            >
              <div className="h-20 w-20 mx-auto rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Store className="h-10 w-10 text-foreground" />
              </div>
              <h2 className="text-xl font-bold mb-2">Création manuelle</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Personnalisez chaque détail vous-même : thème, couleurs, contenu de votre boutique
              </p>
              {useAI === false && (
                <div className="mt-4 inline-flex items-center gap-1 text-primary text-sm font-medium">
                  <Check className="h-4 w-4" /> Sélectionné
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Step 1: Identity */}
        {step === 1 && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Nom de votre boutique</Label>
              <Input
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder="Ex: Élégance Africaine"
                className="h-12 text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">
                {useAI ? "Décrivez votre activité en détail" : "Description (optionnel)"}
              </Label>
              <Textarea
                value={formData.businessDescription}
                onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                placeholder={useAI
                  ? "Nous vendons des vêtements traditionnels africains modernisés pour les femmes élégantes. Notre cible : femmes 25-45 ans, cadres et entrepreneures..."
                  : "Décrivez brièvement votre boutique et vos produits"
                }
                rows={5}
                className="text-base"
              />
              {useAI && (
                <p className="text-xs text-muted-foreground">
                  Plus votre description est détaillée, meilleur sera le résultat IA
                </p>
              )}
            </div>

            {/* Live Preview */}
            {formData.businessName && (
              <Card className="p-4 bg-muted/30 border-dashed">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Aperçu du lien</p>
                <p className="text-sm font-mono">
                  visuelpro.cloud/shop/<span className="text-primary font-semibold">{generateSlug(formData.businessName)}</span>
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Step 2: Category */}
        {step === 2 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {CATEGORIES.map(cat => (
              <Card
                key={cat.id}
                className={`p-5 cursor-pointer transition-all duration-200 text-center ${formData.category === cat.id ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:shadow-sm hover:border-primary/30'}`}
                onClick={() => setFormData({ ...formData, category: cat.id })}
              >
                <span className="text-3xl block mb-3">{cat.icon}</span>
                <p className="text-sm font-semibold">{cat.name}</p>
                {formData.category === cat.id && (
                  <Check className="h-4 w-4 text-primary mx-auto mt-2" />
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Step 3: Theme */}
        {step === 3 && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {THEMES.map(theme => (
                <Card
                  key={theme.id}
                  className={`overflow-hidden cursor-pointer transition-all duration-200 ${formData.theme === theme.id ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-sm hover:border-primary/30'}`}
                  onClick={() => setFormData({ ...formData, theme: theme.id, primaryColor: theme.colors[1], secondaryColor: theme.colors[0] })}
                >
                  {/* Color Preview */}
                  <div className="h-20 flex">
                    {theme.colors.map((color, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{theme.icon} {theme.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{theme.description}</p>
                      </div>
                      {formData.theme === theme.id && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Custom Colors */}
            <Card className="p-5">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Palette className="h-4 w-4" /> Couleurs personnalisées
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Couleur principale</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={formData.primaryColor} onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })} className="h-10 w-10 rounded cursor-pointer border-0" />
                    <Input value={formData.primaryColor} onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })} className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Couleur secondaire</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={formData.secondaryColor} onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })} className="h-10 w-10 rounded cursor-pointer border-0" />
                    <Input value={formData.secondaryColor} onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })} className="font-mono text-sm" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Step 4: Contact */}
        {step === 4 && (
          <div className="max-w-lg mx-auto space-y-5">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Numéro WhatsApp *</Label>
              <Input
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                placeholder="+225 07 XX XX XX XX"
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">Les clients vous contacteront via WhatsApp</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="+225 07 XX XX XX XX" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contact@boutique.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Abidjan" />
              </div>
              <div className="space-y-2">
                <Label>Pays</Label>
                <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
              </div>
            </div>

            {/* Summary Card */}
            <Card className="p-5 bg-primary/5 border-primary/20 mt-8">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Récapitulatif
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Boutique</span>
                  <span className="font-medium">{formData.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Catégorie</span>
                  <span className="font-medium">{CATEGORIES.find(c => c.id === formData.category)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thème</span>
                  <span className="font-medium">{THEMES.find(t => t.id === formData.theme)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Méthode</span>
                  <Badge variant="secondary">{useAI ? "IA" : "Manuelle"}</Badge>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-muted-foreground">Activation</span>
                  <div className="text-right">
                  <span className="font-bold text-primary">Création gratuite</span>
                  <p className="text-[10px] text-muted-foreground">Activation requise par boutique</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-12 max-w-2xl mx-auto">
          <div />
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} size="lg" className="gap-2 min-w-[180px]">
              Continuer <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading || aiLoading || !canProceed()} size="lg" className="gap-2 min-w-[200px]">
              {loading || aiLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {aiLoading ? "L'IA travaille..." : "Création..."}</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Créer ma boutique</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopBuilder;
