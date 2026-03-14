import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Store } from "lucide-react";

const ShopBuilder = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"choice" | "manual" | "ai">("choice");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    businessDescription: "",
    whatsappNumber: "",
    phoneNumber: "",
    email: "",
    city: "",
    country: "Côte d'Ivoire",
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
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
      // Check slug uniqueness
      const { data: existing } = await supabase.from("shops").select("id").eq("slug", slug) as any;
      if (existing && existing.length > 0) {
        slug = slug + "-" + Math.random().toString(36).substring(2, 6);
      }

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
        primary_color: aiContent?.primary_color || "#2563eb",
        secondary_color: aiContent?.secondary_color || "#7c3aed",
        theme: aiContent?.theme || "modern",
      };

      const { data, error } = await supabase.from("shops").insert(shopData).select().single() as any;

      if (error) throw error;

      toast({ title: "Boutique créée !", description: "Vous pouvez maintenant ajouter vos produits." });
      navigate(`/shop-editor/${data.id}`);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateWithAI = async () => {
    if (!formData.businessName || !formData.businessDescription) {
      toast({ title: "Erreur", description: "Remplissez le nom et la description", variant: "destructive" });
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-shop-content", {
        body: {
          businessDescription: formData.businessDescription,
          businessName: formData.businessName,
        },
      });

      if (error) throw error;

      await createShop(data);
    } catch (error: any) {
      toast({ title: "Erreur IA", description: "Création manuelle en cours...", variant: "destructive" });
      await createShop();
    } finally {
      setAiLoading(false);
    }
  };

  if (step === "choice") {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Créer une boutique</h1>
          <p className="text-center text-muted-foreground mb-8">
            Choisissez comment vous souhaitez créer votre boutique e-commerce
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              className="p-8 cursor-pointer hover:shadow-lg transition-all hover:border-primary text-center"
              onClick={() => setStep("ai")}
            >
              <Sparkles className="h-16 w-16 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Création avec l'IA</h2>
              <p className="text-muted-foreground">
                Décrivez votre activité et l'IA créera votre boutique automatiquement avec un contenu optimisé.
              </p>
            </Card>

            <Card
              className="p-8 cursor-pointer hover:shadow-lg transition-all hover:border-primary text-center"
              onClick={() => setStep("manual")}
            >
              <Store className="h-16 w-16 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Création manuelle</h2>
              <p className="text-muted-foreground">
                Configurez vous-même chaque détail de votre boutique selon vos préférences.
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          {step === "ai" ? "Création IA de votre boutique" : "Créer votre boutique"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {step === "ai"
            ? "Décrivez votre activité et l'IA s'occupe du reste"
            : "Remplissez les informations de votre boutique"}
        </p>

        <Card className="p-6 space-y-6">
          <div className="space-y-2">
            <Label>Nom de la boutique *</Label>
            <Input
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              placeholder="Ex: Ma Boutique Mode"
            />
          </div>

          <div className="space-y-2">
            <Label>Description de votre activité *</Label>
            <Textarea
              value={formData.businessDescription}
              onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
              placeholder={
                step === "ai"
                  ? "Décrivez en détail ce que vous vendez, votre cible, vos avantages..."
                  : "Décrivez votre boutique"
              }
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Numéro WhatsApp *</Label>
              <Input
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                placeholder="+225 07 XX XX XX XX"
              />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+225 07 XX XX XX XX"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@maboutique.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Abidjan"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setStep("choice")}>
              Retour
            </Button>
            {step === "ai" ? (
              <Button onClick={generateWithAI} disabled={aiLoading || !formData.businessName || !formData.businessDescription} className="flex-1 gap-2">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiLoading ? "Création en cours..." : "Générer avec l'IA"}
              </Button>
            ) : (
              <Button onClick={() => createShop()} disabled={loading || !formData.businessName} className="flex-1 gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                {loading ? "Création..." : "Créer la boutique"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ShopBuilder;
