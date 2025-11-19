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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Phone, MessageCircle, Palette, Upload, X, Eye, Edit, Sparkles, Copy, CheckCircle2, ExternalLink, Globe, Clock, History } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShowcasePreview } from "@/components/ShowcasePreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showcaseTemplates, templateCategories } from "@/lib/showcaseTemplates";
import { FeaturesEditorWithImages } from "@/components/FeaturesEditorWithImages";
import { FormationsEditor } from "@/components/FormationsEditor";
import { TestimonialsEditor } from "@/components/TestimonialsEditor";
import { AIImageGenerator } from "@/components/AIImageGenerator";
import { SEOEditor } from "@/components/SEOEditor";
import { AnalyticsViewer } from "@/components/AnalyticsViewer";
import { GalleryManager } from "@/components/GalleryManager";
import { VideoGalleryManager } from "@/components/VideoGalleryManager";
import { ContactSubmissionsViewer } from "@/components/ContactSubmissionsViewer";
import { ShowcaseVersionHistory } from "@/components/ShowcaseVersionHistory";
import { VideoUploader } from "@/components/VideoUploader";
import { TemplatePreviewDialog } from "@/components/TemplatePreviewDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const themes = [
  { value: "professional", label: "Professionnel", description: "Sobre et corporate", colors: { primary: "#2563eb", secondary: "#7c3aed" } },
  { value: "creative", label: "Créatif", description: "Audacieux et artistique", colors: { primary: "#f97316", secondary: "#ec4899" } },
  { value: "modern", label: "Moderne", description: "Épuré et minimaliste", colors: { primary: "#06b6d4", secondary: "#8b5cf6" } },
  { value: "elegant", label: "Élégant", description: "Raffiné et luxueux", colors: { primary: "#0f172a", secondary: "#64748b" } },
  { value: "vibrant", label: "Vibrant", description: "Coloré et énergique", colors: { primary: "#10b981", secondary: "#f59e0b" } },
];

const fonts = [
  { value: "poppins", label: "Poppins", description: "Moderne et lisible", family: "'Poppins', sans-serif" },
  { value: "playfair", label: "Playfair Display", description: "Élégant et raffiné", family: "'Playfair Display', serif" },
  { value: "montserrat", label: "Montserrat", description: "Géométrique et propre", family: "'Montserrat', sans-serif" },
  { value: "lora", label: "Lora", description: "Classique et sophistiqué", family: "'Lora', serif" },
  { value: "raleway", label: "Raleway", description: "Minimaliste et élégant", family: "'Raleway', sans-serif" },
  { value: "roboto", label: "Roboto", description: "Polyvalent et moderne", family: "'Roboto', sans-serif" },
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
  textColor: z.string().optional(),
  aboutLayout: z.string().optional(),
  galleryTextPosition: z.string().optional(),
  fontFamily: z.string().optional(),
  themeMode: z.string().optional(),
  heroVideoUrl: z.string().optional(),
  aboutVideoUrl: z.string().optional(),
});

type ShowcaseFormData = z.infer<typeof showcaseSchema>;

export default function ShowcaseEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [aboutImageFile, setAboutImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [aboutImagePreview, setAboutImagePreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [existingHeroUrl, setExistingHeroUrl] = useState<string | null>(null);
  const [existingAboutUrl, setExistingAboutUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [features, setFeatures] = useState<Array<{ title: string; description: string; image_url?: string }>>([]);
  const [formations, setFormations] = useState<Array<{ title: string; description: string; price: string; image_url?: string }>>([]);
  const [formationsTextAlign, setFormationsTextAlign] = useState<string>("center");
  const [testimonials, setTestimonials] = useState<Array<{ id?: string; full_name: string; testimonial_text: string; result_image_url?: string; display_order: number }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [subdomain, setSubdomain] = useState<string>("");
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  
  // SEO states
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [ogImageUrl, setOgImageUrl] = useState("");

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
  const formValues = watch();

  // Get theme colors for preview
  const themeColors = themes.find(t => t.value === selectedTheme)?.colors;

  const filteredTemplates = selectedCategory === "Tous" 
    ? showcaseTemplates 
    : showcaseTemplates.filter(t => t.category === selectedCategory);

  const applyTemplate = (templateId: string) => {
    const template = showcaseTemplates.find(t => t.id === templateId);
    if (!template) return;

    // Apply template content to form
    setValue("heroTitle", template.content.heroTitle);
    setValue("heroSubtitle", template.content.heroSubtitle);
    setValue("aboutTitle", template.content.aboutTitle);
    setValue("aboutDescription", template.content.aboutDescription);
    setValue("ctaTitle", template.content.ctaTitle);
    setValue("ctaDescription", template.content.ctaDescription);
    setValue("formationTitle", template.content.formationTitle || "");
    setValue("formationDescription", template.content.formationDescription || "");
    setValue("formationPrice", template.content.formationPrice || "");
    setValue("theme", template.theme);

    // Update features
    setFeatures(template.content.features);

    setTemplateDialogOpen(false);
    toast.success(`Template "${template.name}" appliqué avec succès !`);
  };

  useEffect(() => {
    loadSite();
  }, [id]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!id || isLoading) return;

    const autoSaveInterval = setInterval(() => {
      autoSave();
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [id, isLoading, formValues, features, formations, testimonials, seoTitle, seoDescription, seoKeywords, ogImageUrl, formationsTextAlign]);

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
        textColor: data.text_color || "#000000",
        aboutLayout: data.about_layout || "side-by-side",
        galleryTextPosition: data.gallery_text_position || "below",
        fontFamily: data.font_family || "poppins",
        themeMode: data.theme_mode || "light",
        heroVideoUrl: (data as any).hero_video_url || "",
        aboutVideoUrl: (data as any).about_video_url || "",
      });

      // Set existing images
      setExistingLogoUrl(data.logo_url);
      setExistingHeroUrl(data.hero_image_url);
      setExistingAboutUrl(data.about_image_url);
      setLogoPreview(data.logo_url);
      setHeroImagePreview(data.hero_image_url);
      setAboutImagePreview(data.about_image_url);
      
      // Set business name and features
      setBusinessName(data.business_name || "");
      setFeatures((data.features as any) || []);
      setFormations((data.formations as any) || []);
      setFormationsTextAlign(data.formations_text_align || "center");
      setIsPublished(data.is_published || false);
      setSubdomain(data.subdomain || "");
      
      // Set SEO data
      setSeoTitle(data.seo_title || "");
      setSeoDescription(data.seo_description || "");
      setSeoKeywords((data.seo_keywords as string[]) || []);
      setOgImageUrl(data.og_image_url || "");

      // Load testimonials
      const { data: testimonialsData } = await supabase
        .from("showcase_testimonials")
        .select("*")
        .eq("showcase_site_id", id)
        .order("display_order", { ascending: true });
      
      if (testimonialsData) {
        setTestimonials(testimonialsData);
      }

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

  const getPublicUrl = () => {
    return `${window.location.origin}/showcase/${subdomain}`;
  };

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(getPublicUrl());
    setCopiedUrl(true);
    toast.success("Lien du site copié!");
    
    setTimeout(() => {
      setCopiedUrl(false);
    }, 2000);
  };

  const onSubmit = async (data: ShowcaseFormData) => {
    await saveShowcase(data, false);
  };

  const onSubmitAndPublish = async (data: ShowcaseFormData) => {
    await saveShowcase(data, true);
  };

  const autoSave = async () => {
    if (isAutoSaving || isSaving) return;
    
    setIsAutoSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get current form values
      const currentValues = formValues;
      
      // Determine theme colors
      const themeColors = themes.find(t => t.value === currentValues.theme)?.colors;

      // Upload new images if provided (but don't block auto-save for this)
      let logoUrl = existingLogoUrl;
      let heroImageUrl = existingHeroUrl;
      let aboutImageUrl = existingAboutUrl;

      if (logoFile) {
        const newLogoUrl = await uploadImage(logoFile, user.id, 'logo');
        if (newLogoUrl) {
          logoUrl = newLogoUrl;
          setExistingLogoUrl(newLogoUrl);
          setLogoFile(null); // Clear file after upload
        }
      }
      if (heroImageFile) {
        const newHeroUrl = await uploadImage(heroImageFile, user.id, 'hero');
        if (newHeroUrl) {
          heroImageUrl = newHeroUrl;
          setExistingHeroUrl(newHeroUrl);
          setHeroImageFile(null);
        }
      }
      if (aboutImageFile) {
        const newAboutUrl = await uploadImage(aboutImageFile, user.id, 'about');
        if (newAboutUrl) {
          aboutImageUrl = newAboutUrl;
          setExistingAboutUrl(newAboutUrl);
          setAboutImageFile(null);
        }
      }

      // Update the showcase site (silently)
      const updateData: any = {
        business_description: currentValues.businessDescription,
        owner_name: currentValues.ownerName,
        whatsapp_number: currentValues.whatsappNumber,
        phone_number: currentValues.phoneNumber,
        hero_title: currentValues.heroTitle,
        hero_subtitle: currentValues.heroSubtitle,
        about_title: currentValues.aboutTitle,
        about_description: currentValues.aboutDescription,
        cta_title: currentValues.ctaTitle,
        cta_description: currentValues.ctaDescription,
        formation_title: currentValues.formationTitle,
        formation_description: currentValues.formationDescription,
        formation_price: currentValues.formationPrice,
        theme: currentValues.theme,
        primary_color: themeColors?.primary,
        secondary_color: themeColors?.secondary,
        text_color: currentValues.textColor,
        about_layout: currentValues.aboutLayout,
        gallery_text_position: currentValues.galleryTextPosition,
        font_family: currentValues.fontFamily,
        theme_mode: currentValues.themeMode,
        logo_url: logoUrl,
        hero_image_url: heroImageUrl,
        about_image_url: aboutImageUrl,
        features: features,
        formations: formations,
        formations_text_align: formationsTextAlign,
        seo_title: seoTitle,
        seo_description: seoDescription,
        seo_keywords: seoKeywords,
        og_image_url: ogImageUrl,
      };

      const { error: updateError } = await supabase
        .from("showcase_sites")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        console.error("Auto-save error:", updateError);
        return;
      }

      // Save testimonials
      await supabase
        .from("showcase_testimonials")
        .delete()
        .eq("showcase_site_id", id);

      if (testimonials.length > 0) {
        const testimonialsToInsert = testimonials.map((t, index) => ({
          showcase_site_id: id,
          full_name: t.full_name,
          testimonial_text: t.testimonial_text,
          result_image_url: t.result_image_url || null,
          display_order: index,
        }));

        await supabase
          .from("showcase_testimonials")
          .insert(testimonialsToInsert);
      }

      setLastAutoSave(new Date());
    } catch (error) {
      console.error("Error during auto-save:", error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const createVersion = async (userId: string) => {
    try {
      // Get the current showcase site data
      const { data: currentSite } = await supabase
        .from("showcase_sites")
        .select("*")
        .eq("id", id)
        .single();

      if (!currentSite) return;

      // Get current testimonials
      const { data: currentTestimonials } = await supabase
        .from("showcase_testimonials")
        .select("*")
        .eq("showcase_site_id", id)
        .order("display_order");

      // Get the last version number
      const { data: lastVersion } = await supabase
        .from("showcase_versions")
        .select("version_number")
        .eq("showcase_site_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersionNumber = (lastVersion?.version_number || 0) + 1;

      // Create the version snapshot
      await supabase
        .from("showcase_versions")
        .insert({
          showcase_site_id: id,
          version_number: nextVersionNumber,
          created_by: userId,
          business_name: currentSite.business_name,
          business_description: currentSite.business_description,
          owner_name: currentSite.owner_name,
          owner_photo_url: currentSite.owner_photo_url,
          whatsapp_number: currentSite.whatsapp_number,
          phone_number: currentSite.phone_number,
          hero_title: currentSite.hero_title,
          hero_subtitle: currentSite.hero_subtitle,
          about_title: currentSite.about_title,
          about_description: currentSite.about_description,
          cta_title: currentSite.cta_title,
          cta_description: currentSite.cta_description,
          formation_title: currentSite.formation_title,
          formation_description: currentSite.formation_description,
          formation_price: currentSite.formation_price,
          formation_image_url: currentSite.formation_image_url,
          theme: currentSite.theme,
          primary_color: currentSite.primary_color,
          secondary_color: currentSite.secondary_color,
          text_color: currentSite.text_color,
          logo_url: currentSite.logo_url,
          hero_image_url: currentSite.hero_image_url,
          about_image_url: currentSite.about_image_url,
          features: currentSite.features,
          formations: currentSite.formations,
          formations_text_align: currentSite.formations_text_align,
          about_layout: currentSite.about_layout,
          gallery_text_position: currentSite.gallery_text_position,
          font_family: currentSite.font_family,
          theme_mode: currentSite.theme_mode,
          seo_title: currentSite.seo_title,
          seo_description: currentSite.seo_description,
          seo_keywords: currentSite.seo_keywords,
          og_image_url: currentSite.og_image_url,
          og_type: currentSite.og_type,
          twitter_card: currentSite.twitter_card,
          testimonials: currentTestimonials || [],
        });
    } catch (error) {
      console.error("Error creating version:", error);
      // Don't block the save if version creation fails
    }
  };

  const saveShowcase = async (data: ShowcaseFormData, shouldPublish: boolean = false) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté");
        navigate("/auth");
        return;
      }

      // Create a version snapshot before making changes
      await createVersion(user.id);

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
      const updateData: any = {
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
        text_color: data.textColor,
        about_layout: data.aboutLayout,
        gallery_text_position: data.galleryTextPosition,
        font_family: data.fontFamily,
        theme_mode: data.themeMode,
        logo_url: logoUrl,
        hero_image_url: heroImageUrl,
        about_image_url: aboutImageUrl,
        features: features,
        formations: formations,
        formations_text_align: formationsTextAlign,
        seo_title: seoTitle,
        seo_description: seoDescription,
        seo_keywords: seoKeywords,
        og_image_url: ogImageUrl,
      };

      // Add is_published if we're publishing
      if (shouldPublish) {
        updateData.is_published = true;
      }

      const { error: updateError } = await supabase
        .from("showcase_sites")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        console.error("Update error:", updateError);
        toast.error("Erreur lors de la mise à jour");
        return;
      }

      // Save testimonials separately
      // First, delete existing testimonials
      await supabase
        .from("showcase_testimonials")
        .delete()
        .eq("showcase_site_id", id);

      // Then insert new testimonials
      if (testimonials.length > 0) {
        const testimonialsToInsert = testimonials.map((t, index) => ({
          showcase_site_id: id,
          full_name: t.full_name,
          testimonial_text: t.testimonial_text,
          result_image_url: t.result_image_url || null,
          display_order: index,
        }));

        const { error: testimonialsError } = await supabase
          .from("showcase_testimonials")
          .insert(testimonialsToInsert);

        if (testimonialsError) {
          console.error("Error saving testimonials:", testimonialsError);
          toast.error("Erreur lors de la sauvegarde des témoignages");
        }
      }

      if (shouldPublish) {
        toast.success("Site sauvegardé et publié avec succès ! 🎉");
        setIsPublished(true);
      } else {
        toast.success("Site mis à jour avec succès !");
      }
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          {/* Auto-save indicator */}
          <div className="flex items-center gap-2">
            {isAutoSaving ? (
              <Badge variant="secondary" className="gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Sauvegarde automatique...
              </Badge>
            ) : lastAutoSave ? (
              <Badge variant="outline" className="gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Dernière sauvegarde: {lastAutoSave.toLocaleTimeString()}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Modifier votre site vitrine</h1>
          <p className="text-muted-foreground text-lg">
            Éditez et prévisualisez vos modifications en temps réel
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            💾 Sauvegarde automatique toutes les 30 secondes
          </p>
        </div>

        {/* Templates Dialog */}
        <div className="mb-6 flex justify-center">
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg" className="gap-2">
                <Sparkles className="h-5 w-5" />
                Utiliser un template prédéfini
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="text-2xl">Templates Prédéfinis</DialogTitle>
                <DialogDescription>
                  Choisissez un template et personnalisez-le selon vos besoins
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Category Filter */}
                <div className="flex gap-2 flex-wrap">
                  {templateCategories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>

                {/* Templates Grid */}
                <ScrollArea className="h-[500px] pr-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {filteredTemplates.map((template) => (
                      <Card 
                        key={template.id} 
                        className="hover:border-primary transition-colors"
                      >
                        <CardHeader>
                          <div className="flex items-start gap-4">
                            <img 
                              src={template.previewImage} 
                              alt={template.name}
                              className="w-24 h-18 object-cover rounded-lg cursor-pointer"
                              onClick={() => setPreviewTemplate(template.id)}
                            />
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-2 mb-1">
                                {template.name}
                              </CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                          <CardDescription className="text-sm mt-3">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Titre:</span>
                              <p className="text-muted-foreground line-clamp-1">
                                {template.content.heroTitle}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium">Thème:</span>
                              <span className="text-muted-foreground ml-2">
                                {themes.find(t => t.value === template.theme)?.label}
                              </span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button 
                                variant="outline"
                                size="sm" 
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewTemplate(template.id);
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Prévisualiser
                              </Button>
                              <Button 
                                size="sm" 
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyTemplate(template.id);
                                }}
                              >
                                <Sparkles className="mr-2 h-4 w-4" />
                                Appliquer
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Template Preview Dialog */}
        <TemplatePreviewDialog
          templateId={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onApply={(templateId) => {
            applyTemplate(templateId);
            setPreviewTemplate(null);
            setTemplateDialogOpen(false);
          }}
        />

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full max-w-4xl mx-auto grid-cols-8 mb-6">
            <TabsTrigger value="edit" className="gap-2">
              <Edit className="h-4 w-4" />
              Édition
            </TabsTrigger>
            <TabsTrigger value="galleries" className="gap-2">
              <Upload className="h-4 w-4" />
              Galeries
            </TabsTrigger>
            <TabsTrigger value="testimonials" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Témoignages
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Avancé
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <Eye className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Prévisualisation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit">
            <div className="max-w-3xl mx-auto">
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

          {/* Features Editor with Images */}
          <FeaturesEditorWithImages 
            features={features}
            onChange={setFeatures}
          />

          {/* Formations Editor */}
          <FormationsEditor
            formations={formations}
            textAlign={formationsTextAlign}
            onChange={setFormations}
            onTextAlignChange={setFormationsTextAlign}
          />

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

          {/* Advanced Styling Options */}
          <Card>
            <CardHeader>
              <CardTitle>Options de personnalisation avancées</CardTitle>
              <CardDescription>
                Personnalisez l'apparence et la disposition de votre site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="textColor">Couleur du texte principal</Label>
                <div className="flex gap-2 items-center mt-2">
                  <Input
                    id="textColor"
                    type="color"
                    {...register("textColor")}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    {...register("textColor")}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Couleur utilisée pour les titres et textes importants
                </p>
              </div>

              <div>
                <Label htmlFor="aboutLayout">Disposition de la section "À propos"</Label>
                <RadioGroup
                  value={watch("aboutLayout") || "side-by-side"}
                  onValueChange={(value) => setValue("aboutLayout", value)}
                  className="grid grid-cols-2 gap-4 mt-2"
                >
                  <div>
                    <RadioGroupItem value="side-by-side" id="side-by-side" className="peer sr-only" />
                    <Label
                      htmlFor="side-by-side"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <div className="text-sm font-medium">Côte à côte</div>
                      <div className="text-xs text-muted-foreground mt-1 text-center">Image et texte côte à côte</div>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="stacked" id="stacked" className="peer sr-only" />
                    <Label
                      htmlFor="stacked"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <div className="text-sm font-medium">Empilé</div>
                      <div className="text-xs text-muted-foreground mt-1 text-center">Image en haut, texte en bas</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="galleryTextPosition">Position du texte dans les galeries</Label>
                <RadioGroup
                  value={watch("galleryTextPosition") || "below"}
                  onValueChange={(value) => setValue("galleryTextPosition", value)}
                  className="grid grid-cols-3 gap-3 mt-2"
                >
                  <div>
                    <RadioGroupItem value="below" id="below" className="peer sr-only" />
                    <Label
                      htmlFor="below"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <div className="text-sm font-medium text-center">En dessous</div>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="beside" id="beside" className="peer sr-only" />
                    <Label
                      htmlFor="beside"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <div className="text-sm font-medium text-center">À côté</div>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="overlay" id="overlay" className="peer sr-only" />
                    <Label
                      htmlFor="overlay"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <div className="text-sm font-medium text-center">Superposé</div>
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground mt-2">
                  Choisissez comment afficher les légendes dans vos galeries d'images
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Font Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Police de caractères</CardTitle>
              <CardDescription>
                Choisissez la police qui correspond à votre identité visuelle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={watch("fontFamily") || "poppins"}
                onValueChange={(value) => setValue("fontFamily", value)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {fonts.map((font) => (
                  <div key={font.value}>
                    <RadioGroupItem
                      value={font.value}
                      id={font.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={font.value}
                      className="flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                      style={{ fontFamily: font.family }}
                    >
                      <span className="font-semibold text-lg mb-1">{font.label}</span>
                      <span className="text-sm text-muted-foreground">{font.description}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Theme Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Mode d'affichage</CardTitle>
              <CardDescription>
                Choisissez entre le mode clair ou sombre pour votre site
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={watch("themeMode") || "light"}
                onValueChange={(value) => setValue("themeMode", value)}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="light" id="light" className="peer sr-only" />
                  <Label
                    htmlFor="light"
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-lg bg-white border-2 mb-3 flex items-center justify-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded"></div>
                    </div>
                    <div className="text-base font-medium">Mode Clair</div>
                    <div className="text-xs text-muted-foreground mt-1 text-center">Fond blanc, texte sombre</div>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                  <Label
                    htmlFor="dark"
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-lg bg-gray-900 border-2 mb-3 flex items-center justify-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded"></div>
                    </div>
                    <div className="text-base font-medium">Mode Sombre</div>
                    <div className="text-xs text-muted-foreground mt-1 text-center">Fond sombre, texte clair</div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

                <div className="space-y-3">
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
                          Sauvegarder
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {isPublished && (
                    <Card className="border-primary/50 bg-primary/5 mb-4">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Site Publié
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Votre site est en ligne. Partagez le lien ci-dessous avec vos clients !
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              value={getPublicUrl()}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={copyPublicUrl}
                            >
                              {copiedUrl ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => window.open(getPublicUrl(), "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!isPublished && (
                    <Button
                      type="button"
                      size="lg"
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      disabled={isSaving}
                      onClick={handleSubmit(onSubmitAndPublish)}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Publication...
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          Sauvegarder et Publier le site
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="galleries">
            <div className="max-w-6xl mx-auto space-y-6">
              {id && <GalleryManager showcaseId={id} />}
              
              {id && <VideoGalleryManager showcaseId={id} />}
              
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <VideoUploader
                  showcaseSiteId={id || ""}
                  currentVideoUrl={formValues.heroVideoUrl}
                  videoType="hero"
                  onVideoUploaded={(url) => setValue("heroVideoUrl", url)}
                  onVideoRemoved={() => setValue("heroVideoUrl", null)}
                />
                <VideoUploader
                  showcaseSiteId={id || ""}
                  currentVideoUrl={formValues.aboutVideoUrl}
                  videoType="about"
                  onVideoUploaded={(url) => setValue("aboutVideoUrl", url)}
                  onVideoRemoved={() => setValue("aboutVideoUrl", null)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="testimonials">
            <div className="max-w-4xl mx-auto">
              {id && (
                <TestimonialsEditor
                  showcaseSiteId={id}
                  testimonials={testimonials}
                  onTestimonialsChange={setTestimonials}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced">
            <div className="max-w-3xl mx-auto space-y-6">
              <AIImageGenerator 
                onImageGenerated={(imageUrl, imageType) => {
                  if (imageType === "logo") {
                    setLogoPreview(imageUrl);
                    setExistingLogoUrl(imageUrl);
                  } else if (imageType === "hero") {
                    setHeroImagePreview(imageUrl);
                    setExistingHeroUrl(imageUrl);
                  } else if (imageType === "about") {
                    setAboutImagePreview(imageUrl);
                    setExistingAboutUrl(imageUrl);
                  }
                }}
              />
              
              <SEOEditor
                seoTitle={seoTitle}
                seoDescription={seoDescription}
                seoKeywords={seoKeywords}
                ogImageUrl={ogImageUrl}
                onSEOChange={(field, value) => {
                  if (field === "seoTitle") setSeoTitle(value);
                  else if (field === "seoDescription") setSeoDescription(value);
                  else if (field === "seoKeywords") setSeoKeywords(value);
                  else if (field === "ogImageUrl") setOgImageUrl(value);
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="max-w-6xl mx-auto">
              {id && (
                <ShowcaseVersionHistory
                  showcaseSiteId={id}
                  onRestore={() => {
                    // Reload the page to show restored data
                    window.location.reload();
                  }}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="contacts">
            <div className="max-w-6xl mx-auto">
              {id && <ContactSubmissionsViewer showcaseId={id} />}
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="max-w-6xl mx-auto">
              {id && <AnalyticsViewer showcaseId={id} />}
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <ShowcasePreview
              data={{
                heroTitle: formValues.heroTitle,
                heroSubtitle: formValues.heroSubtitle,
                aboutTitle: formValues.aboutTitle,
                aboutDescription: formValues.aboutDescription,
                ctaTitle: formValues.ctaTitle,
                ctaDescription: formValues.ctaDescription,
                formationTitle: formValues.formationTitle,
                formationDescription: formValues.formationDescription,
                formationPrice: formValues.formationPrice,
                businessName: businessName,
                ownerName: formValues.ownerName,
                theme: selectedTheme,
                primaryColor: themeColors?.primary,
                secondaryColor: themeColors?.secondary,
                logoPreview: logoPreview,
                heroImagePreview: heroImagePreview,
                aboutImagePreview: aboutImagePreview,
                features: features,
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
