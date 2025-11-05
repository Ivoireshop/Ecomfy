import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles, Phone, MessageCircle, Palette } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const themes = [
  { value: "professional", label: "Professionnel", description: "Sobre et corporate", colors: { primary: "#2563eb", secondary: "#7c3aed" } },
  { value: "creative", label: "Créatif", description: "Audacieux et artistique", colors: { primary: "#f97316", secondary: "#ec4899" } },
  { value: "modern", label: "Moderne", description: "Épuré et minimaliste", colors: { primary: "#06b6d4", secondary: "#8b5cf6" } },
  { value: "elegant", label: "Élégant", description: "Raffiné et luxueux", colors: { primary: "#0f172a", secondary: "#64748b" } },
  { value: "vibrant", label: "Vibrant", description: "Coloré et énergique", colors: { primary: "#10b981", secondary: "#f59e0b" } },
];

const showcaseSchema = z.object({
  businessDescription: z.string().min(20, "La description doit contenir au moins 20 caractères"),
  ownerName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  whatsappNumber: z.string().min(8, "Numéro WhatsApp invalide"),
  phoneNumber: z.string().min(8, "Numéro de téléphone invalide"),
  subdomain: z.string().min(3, "Le sous-domaine doit contenir au moins 3 caractères").regex(/^[a-z0-9-]+$/, "Uniquement lettres minuscules, chiffres et tirets"),
  theme: z.string().optional(),
});

type ShowcaseFormData = z.infer<typeof showcaseSchema>;

export default function ShowcaseBuilder() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [useAITheme, setUseAITheme] = useState(true);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ShowcaseFormData>({
    resolver: zodResolver(showcaseSchema),
    defaultValues: {
      theme: "professional",
    },
  });

  const subdomain = watch("subdomain");
  const selectedTheme = watch("theme");

  const onSubmit = async (data: ShowcaseFormData) => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté pour créer un site vitrine");
        navigate("/auth");
        return;
      }

      // Call AI edge function to generate content
      toast.info("Génération du contenu par l'IA...", { duration: 3000 });
      
      const { data: aiContent, error: aiError } = await supabase.functions.invoke('generate-showcase-site', {
        body: {
          businessDescription: data.businessDescription,
          ownerName: data.ownerName,
          whatsappNumber: data.whatsappNumber,
          phoneNumber: data.phoneNumber,
        }
      });

      if (aiError) {
        console.error("AI generation error:", aiError);
        toast.error("Erreur lors de la génération du contenu");
        return;
      }

      // Determine theme and colors
      const finalTheme = useAITheme ? aiContent.theme : (data.theme || "professional");
      const themeColors = themes.find(t => t.value === finalTheme)?.colors;
      const finalPrimaryColor = useAITheme ? aiContent.primary_color : themeColors?.primary;
      const finalSecondaryColor = useAITheme ? aiContent.secondary_color : themeColors?.secondary;

      // Create the showcase site with AI-generated content
      const { error: insertError } = await supabase
        .from("showcase_sites")
        .insert({
          user_id: user.id,
          subdomain: data.subdomain,
          business_name: aiContent.hero_title || data.businessDescription.substring(0, 50),
          business_description: aiContent.about_description,
          owner_name: data.ownerName,
          whatsapp_number: data.whatsappNumber,
          phone_number: data.phoneNumber,
          hero_title: aiContent.hero_title,
          hero_subtitle: aiContent.hero_subtitle,
          about_title: aiContent.about_title,
          about_description: aiContent.about_description,
          features: aiContent.features,
          cta_title: aiContent.cta_title,
          cta_description: aiContent.cta_description,
          formation_title: aiContent.formation?.title,
          formation_description: aiContent.formation?.description,
          formation_price: aiContent.formation?.price,
          theme: finalTheme,
          primary_color: finalPrimaryColor,
          secondary_color: finalSecondaryColor,
          is_published: true,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          toast.error("Ce nom de domaine est déjà utilisé");
        } else {
          console.error("Insert error:", insertError);
          toast.error("Erreur lors de la création du site vitrine");
        }
        return;
      }

      toast.success("Site vitrine créé avec succès !");
      navigate(`/showcase/${data.subdomain}`);
    } catch (error) {
      console.error("Error creating showcase site:", error);
      toast.error("Une erreur est survenue");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Générateur IA de Sites Vitrines</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">Créer votre site vitrine professionnel</h1>
          <p className="text-muted-foreground text-lg">
            Décrivez votre entreprise et l'IA génère un site complet de qualité HubSpot
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* AI Generation Input */}
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Description de votre activité
              </CardTitle>
              <CardDescription>
                Décrivez votre entreprise, vos formations, vos services en détail. Plus vous donnez d'informations, 
                plus le site généré sera précis et professionnel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register("businessDescription")}
                placeholder="Exemple: Je suis formateur en marketing digital depuis 10 ans. Je propose des formations complètes sur les réseaux sociaux, le SEO, et la publicité en ligne. Mes formations s'adressent aux entrepreneurs et PME africaines qui veulent développer leur présence digitale..."
                rows={8}
                className="text-base"
              />
              {errors.businessDescription && (
                <p className="text-sm text-destructive mt-2">{errors.businessDescription.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                💡 Incluez: votre expertise, vos services/formations, votre public cible, vos points forts
              </p>
            </CardContent>
          </Card>

          {/* Owner Information */}
          <Card>
            <CardHeader>
              <CardTitle>Vos informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ownerName">Votre nom complet *</Label>
                <Input
                  id="ownerName"
                  {...register("ownerName")}
                  placeholder="Ex: Jean Kouassi"
                />
                {errors.ownerName && (
                  <p className="text-sm text-destructive mt-1">{errors.ownerName.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de contact *</CardTitle>
              <CardDescription>Comment vos clients peuvent vous joindre</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="whatsappNumber">
                  <MessageCircle className="inline w-4 h-4 mr-2" />
                  Numéro WhatsApp *
                </Label>
                <Input
                  id="whatsappNumber"
                  {...register("whatsappNumber")}
                  placeholder="Ex: +225 0123456789"
                />
                {errors.whatsappNumber && (
                  <p className="text-sm text-destructive mt-1">{errors.whatsappNumber.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phoneNumber">
                  <Phone className="inline w-4 h-4 mr-2" />
                  Numéro de téléphone *
                </Label>
                <Input
                  id="phoneNumber"
                  {...register("phoneNumber")}
                  placeholder="Ex: +225 0123456789"
                />
                {errors.phoneNumber && (
                  <p className="text-sm text-destructive mt-1">{errors.phoneNumber.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Theme Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Thème visuel
              </CardTitle>
              <CardDescription>
                Laissez l'IA choisir ou sélectionnez votre thème
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <input
                  type="checkbox"
                  id="useAITheme"
                  checked={useAITheme}
                  onChange={(e) => setUseAITheme(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useAITheme" className="cursor-pointer flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Laisser l'IA suggérer le thème optimal
                </Label>
              </div>

              {!useAITheme && (
                <RadioGroup 
                  value={selectedTheme} 
                  onValueChange={(value) => setValue("theme", value)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                >
                  {themes.map((theme) => (
                    <div key={theme.value} className="relative">
                      <RadioGroupItem
                        value={theme.value}
                        id={theme.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={theme.value}
                        className="flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex gap-1">
                            <div 
                              className="w-6 h-6 rounded-full border-2 border-background" 
                              style={{ backgroundColor: theme.colors.primary }}
                            />
                            <div 
                              className="w-6 h-6 rounded-full border-2 border-background" 
                              style={{ backgroundColor: theme.colors.secondary }}
                            />
                          </div>
                          <span className="font-semibold">{theme.label}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{theme.description}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </CardContent>
          </Card>

          {/* Domain */}
          <Card>
            <CardHeader>
              <CardTitle>Nom de domaine *</CardTitle>
              <CardDescription>
                Votre site sera accessible à l'adresse indiquée
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="subdomain">Sous-domaine</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    {...register("subdomain")}
                    placeholder="monsite"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground whitespace-nowrap">.visualpro.app</span>
                </div>
                {subdomain && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Votre site sera accessible à : <strong>{subdomain}.visualpro.app</strong>
                  </p>
                )}
                {errors.subdomain && (
                  <p className="text-sm text-destructive mt-1">{errors.subdomain.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full" 
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération en cours avec l'IA...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Générer mon site professionnel
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            L'IA va créer automatiquement un site professionnel complet basé sur votre description
          </p>
        </form>
      </div>
    </div>
  );
}