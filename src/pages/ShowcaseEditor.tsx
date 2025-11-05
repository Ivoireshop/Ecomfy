import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Loader2, Save, Phone, MessageCircle, Palette, Upload, X, ArrowLeft } from "lucide-react";
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
  theme: z.string(),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  aboutTitle: z.string().optional(),
  aboutDescription: z.string().optional(),
  ctaTitle: z.string().optional(),
  ctaDescription: z.string().optional(),
  formationTitle: z.string().optional(),
  formationDescription: z.string().optional(),
  formationPrice: z.string().optional(),
});

type ShowcaseFormData = z.infer<typeof showcaseSchema>;

export default function ShowcaseEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [aboutImageFile, setAboutImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [aboutImagePreview, setAboutImagePreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [existingHeroUrl, setExistingHeroUrl] = useState<string | null>(null);
  const [existingAboutUrl, setExistingAboutUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ShowcaseFormData>({
    resolver: zodResolver(showcaseSchema),
  });

  const selectedTheme = watch("theme");

  useEffect(() => {
    loadSite();
  }, [id]);

  const loadSite = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("showcase_sites")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        toast.error("Site non trouvé");
        navigate("/showcase-manager");
        return;
      }

      // Load data into form
      reset({
        businessDescription: data.business_description || "",
        ownerName: data.owner_name || "",
        whatsappNumber: data.whatsapp_number || "",
        phoneNumber: data.phone_number || "",
        theme: data.theme || "professional",
        heroTitle: data.hero_title || "",
        heroSubtitle: data.hero_subtitle || "",
        aboutTitle: data.about_title || "",
        aboutDescription: data.about_description || "",
        ctaTitle: data.cta_title || "",
        ctaDescription: data.cta_description || "",
        formationTitle: data.formation_title || "",
        formationDescription: data.formation_description || "",
        formationPrice: data.formation_price || "",
      });

      // Set existing images
      setExistingLogoUrl(data.logo_url);
      setExistingHeroUrl(data.hero_image_url);
      setExistingAboutUrl(data.about_image_url);
      setLogoPreview(data.logo_url);
      setHeroImagePreview(data.hero_image_url);
      setAboutImagePreview(data.about_image_url);

    } catch (error) {
      console.error("Error loading site:", error);
      toast.error("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (file: File | null, setFile: (file: File | null) => void, setPreview: (preview: string | null) => void) => {
    setFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File, userId: string, type: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${type}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('showcase-images')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from('showcase-images')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const onSubmit = async (data: ShowcaseFormData) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté");
        navigate("/auth");
        return;
      }

      // Upload new images if provided
      let logoUrl = existingLogoUrl;
      let heroImageUrl = existingHeroUrl;
      let aboutImageUrl = existingAboutUrl;

      if (logoFile) {
        const newLogoUrl = await uploadImage(logoFile, user.id, 'logo');
        if (newLogoUrl) logoUrl = newLogoUrl;
      }
      if (heroImageFile) {
        const newHeroUrl = await uploadImage(heroImageFile, user.id, 'hero');
        if (newHeroUrl) heroImageUrl = newHeroUrl;
      }
      if (aboutImageFile) {
        const newAboutUrl = await uploadImage(aboutImageFile, user.id, 'about');
        if (newAboutUrl) aboutImageUrl = newAboutUrl;
      }

      // Determine theme colors
      const themeColors = themes.find(t => t.value === data.theme)?.colors;

      // Update the showcase site
      const { error: updateError } = await supabase
        .from("showcase_sites")
        .update({
          business_description: data.businessDescription,
          owner_name: data.ownerName,
          whatsapp_number: data.whatsappNumber,
          phone_number: data.phoneNumber,
          hero_title: data.heroTitle,
          hero_subtitle: data.heroSubtitle,
          about_title: data.aboutTitle,
          about_description: data.aboutDescription,
          cta_title: data.ctaTitle,
          cta_description: data.ctaDescription,
          formation_title: data.formationTitle,
          formation_description: data.formationDescription,
          formation_price: data.formationPrice,
          theme: data.theme,
          primary_color: themeColors?.primary,
          secondary_color: themeColors?.secondary,
          logo_url: logoUrl,
          hero_image_url: heroImageUrl,
          about_image_url: aboutImageUrl,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Update error:", updateError);
        toast.error("Erreur lors de la mise à jour");
        return;
      }

      toast.success("Site mis à jour avec succès !");
      navigate("/showcase-manager");
    } catch (error) {
      console.error("Error updating showcase site:", error);
      toast.error("Une erreur est survenue");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/showcase-manager")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Modifier votre site vitrine</h1>
          <p className="text-muted-foreground text-lg">
            Mettez à jour le contenu et les images de votre site
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Content Section */}
          <Card>
            <CardHeader>
              <CardTitle>Contenu du site</CardTitle>
              <CardDescription>
                Modifiez les textes affichés sur votre site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="heroTitle">Titre principal</Label>
                <Input
                  id="heroTitle"
                  {...register("heroTitle")}
                  placeholder="Ex: Votre succès commence ici"
                />
              </div>

              <div>
                <Label htmlFor="heroSubtitle">Sous-titre</Label>
                <Textarea
                  id="heroSubtitle"
                  {...register("heroSubtitle")}
                  placeholder="Ex: Des formations de qualité pour développer vos compétences"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="aboutTitle">Titre de la section À propos</Label>
                <Input
                  id="aboutTitle"
                  {...register("aboutTitle")}
                  placeholder="Ex: À propos de nous"
                />
              </div>

              <div>
                <Label htmlFor="aboutDescription">Description</Label>
                <Textarea
                  id="aboutDescription"
                  {...register("aboutDescription")}
                  placeholder="Décrivez votre activité en détail..."
                  rows={6}
                />
              </div>

              <div>
                <Label htmlFor="ctaTitle">Titre de l'appel à l'action</Label>
                <Input
                  id="ctaTitle"
                  {...register("ctaTitle")}
                  placeholder="Ex: Prêt à commencer ?"
                />
              </div>

              <div>
                <Label htmlFor="ctaDescription">Description de l'appel à l'action</Label>
                <Textarea
                  id="ctaDescription"
                  {...register("ctaDescription")}
                  placeholder="Ex: Contactez-nous dès aujourd'hui pour discuter de vos besoins"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Formation Section */}
          <Card>
            <CardHeader>
              <CardTitle>Formation (optionnel)</CardTitle>
              <CardDescription>
                Si vous vendez une formation, remplissez ces champs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="formationTitle">Titre de la formation</Label>
                <Input
                  id="formationTitle"
                  {...register("formationTitle")}
                  placeholder="Ex: Formation Marketing Digital"
                />
              </div>

              <div>
                <Label htmlFor="formationDescription">Description de la formation</Label>
                <Textarea
                  id="formationDescription"
                  {...register("formationDescription")}
                  placeholder="Décrivez le contenu de votre formation..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="formationPrice">Prix</Label>
                <Input
                  id="formationPrice"
                  {...register("formationPrice")}
                  placeholder="Ex: 50 000 FCFA"
                />
              </div>
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

          {/* Images Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Images personnalisées
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-start gap-4">
                  {logoPreview && (
                    <div className="relative">
                      <img src={logoPreview} alt="Logo preview" className="w-24 h-24 object-cover rounded-lg border" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(existingLogoUrl);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleImageChange(file, setLogoFile, setLogoPreview);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Hero Image */}
              <div className="space-y-2">
                <Label>Image Hero / Bannière</Label>
                <div className="flex items-start gap-4">
                  {heroImagePreview && (
                    <div className="relative">
                      <img src={heroImagePreview} alt="Hero preview" className="w-32 h-20 object-cover rounded-lg border" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => {
                          setHeroImageFile(null);
                          setHeroImagePreview(existingHeroUrl);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleImageChange(file, setHeroImageFile, setHeroImagePreview);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* About Image */}
              <div className="space-y-2">
                <Label>Image À propos</Label>
                <div className="flex items-start gap-4">
                  {aboutImagePreview && (
                    <div className="relative">
                      <img src={aboutImagePreview} alt="About preview" className="w-32 h-20 object-cover rounded-lg border" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => {
                          setAboutImageFile(null);
                          setAboutImagePreview(existingAboutUrl);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleImageChange(file, setAboutImageFile, setAboutImagePreview);
                      }}
                    />
                  </div>
                </div>
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
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/showcase-manager")}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              size="lg" 
              className="flex-1" 
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Sauvegarder les modifications
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
