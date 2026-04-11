import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { Loader2, Save, Phone, MessageCircle, Palette, Upload, X, Eye, Edit, Sparkles, Copy, CheckCircle2, ExternalLink, Globe, Clock, History, Trash2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShowcasePreview } from "@/components/ShowcasePreview";
import { DevicePreview } from "@/components/DevicePreview";
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
import { BookingsViewer } from "@/components/BookingsViewer";
import { ShowcaseVersionHistory } from "@/components/ShowcaseVersionHistory";
import { VideoUploader } from "@/components/VideoUploader";
import { TemplatePreviewDialog } from "@/components/TemplatePreviewDialog";
import { BiographyEditor } from "@/components/BiographyEditor";
import { BookingCalendar } from "@/components/BookingCalendar";
import { CalendarIcon, GraduationCap, CreditCard, Users, BookOpen } from "lucide-react";
import { CoursesManager } from "@/components/CoursesManager";
import { PaymentLinksManager } from "@/components/PaymentLinksManager";
import { EnrollmentsManager } from "@/components/EnrollmentsManager";
import { CourseModulesManager } from "@/components/CourseModulesManager";
import { ModulesTabContent } from "@/components/ModulesTabContent";
import { BlogManager } from "@/components/BlogManager";
import { TrashManager } from "@/components/TrashManager";
import { DnsConfigurationAssistant } from "@/components/DnsConfigurationAssistant";
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
  footerColor: z.string().optional(),
  customDomain: z.string().optional(),
});

type ShowcaseFormData = z.infer<typeof showcaseSchema>;

export default function ShowcaseEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") || "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [aboutImagePreview, setAboutImagePreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isUploadingAbout, setIsUploadingAbout] = useState(false);
  const [businessName, setBusinessName] = useState<string>("");
  const [features, setFeatures] = useState<Array<{ title: string; description: string; image_url?: string; benefits?: string[] }>>([]);
  const [formations, setFormations] = useState<Array<{ title: string; description: string; price: string; image_url?: string }>>([]);
  const [formationsTextAlign, setFormationsTextAlign] = useState<string>("center");
  const [testimonials, setTestimonials] = useState<Array<{ id?: string; full_name: string; testimonial_text: string; result_image_url?: string; display_order: number }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [subdomain, setSubdomain] = useState<string>("");
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string>("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState<string>("#7c3aed");
  const [backgroundColor, setBackgroundColor] = useState<string>("#ffffff");
  const [baseFontSize, setBaseFontSize] = useState<number>(16);
  const [heroTitleSize, setHeroTitleSize] = useState<number>(48);
  const [heroTitleColor, setHeroTitleColor] = useState<string>("#000000");
  const [biographyTitle, setBiographyTitle] = useState<string>("Biographie");
  const [biographyContent, setBiographyContent] = useState<string>("");
  const [biographyImageUrl, setBiographyImageUrl] = useState<string>("");
  const [biographyImagePosition, setBiographyImagePosition] = useState<string>("left");
  const [professionalExperience, setProfessionalExperience] = useState<any[]>([]);
  
  // Stats customization
  const [statsYearsExperience, setStatsYearsExperience] = useState<number>(5);
  const [statsSatisfiedClients, setStatsSatisfiedClients] = useState<number>(100);
  const [statsProjectsCompleted, setStatsProjectsCompleted] = useState<number>(50);
  const [statsShowSection, setStatsShowSection] = useState<boolean>(true);
  
  // Color customization
  const [navigationTextColor, setNavigationTextColor] = useState<string>("#ffffff");
  const [navigationBgColor, setNavigationBgColor] = useState<string>("rgba(0,0,0,0.8)");
  const [priceTextColor, setPriceTextColor] = useState<string>("#ffffff");
  const [priceBgColor, setPriceBgColor] = useState<string>("#2563eb");
  const [statsTextColor, setStatsTextColor] = useState<string>("#ffffff");
  const [statsBgColor, setStatsBgColor] = useState<string>("rgba(0,0,0,0.7)");
  
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

  // Auto-save every 30 seconds (but not after manual deletions)
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
        footerColor: (data as any).footer_color || "#1a1a1a",
        customDomain: data.custom_domain || "",
      });

      // Set existing images
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
      
      // Set custom colors and sizes
      setPrimaryColor(data.primary_color || "#2563eb");
      setSecondaryColor(data.secondary_color || "#7c3aed");
      setBackgroundColor((data as any).background_color || "#ffffff");
      setHeroTitleSize((data as any).hero_title_size || 48);
      setHeroTitleColor((data as any).hero_title_color || "#000000");
      setBiographyTitle(data.biography_title || "Biographie");
      setBiographyContent(data.biography_content || "");
      setBiographyImageUrl((data as any).biography_image_url || "");
      setBiographyImagePosition((data as any).biography_image_position || "left");
      setProfessionalExperience((data.professional_experience as any[]) || []);
      
      // Set stats and color customization
      setStatsYearsExperience((data as any).stats_years_experience || 5);
      setStatsSatisfiedClients((data as any).stats_satisfied_clients || 100);
      setStatsProjectsCompleted((data as any).stats_projects_completed || 50);
      setStatsShowSection((data as any).stats_show_section !== false);
      setNavigationTextColor((data as any).navigation_text_color || "#ffffff");
      setNavigationBgColor((data as any).navigation_bg_color || "rgba(0,0,0,0.8)");
      setPriceTextColor((data as any).price_text_color || "#ffffff");
      setPriceBgColor((data as any).price_bg_color || "#2563eb");
      setStatsTextColor((data as any).stats_text_color || "#ffffff");
      setStatsBgColor((data as any).stats_bg_color || "rgba(0,0,0,0.7)");

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

  const deleteOldImage = async (oldUrl: string | null) => {
    if (!oldUrl) return;
    
    try {
      // Extract file path from URL
      const url = new URL(oldUrl);
      const pathParts = url.pathname.split('/showcase-images/');
      if (pathParts.length > 1) {
        const filePath = pathParts[1];
        await supabase.storage
          .from('showcase-images')
          .remove([filePath]);
      }
    } catch (error) {
      console.error('Error deleting old image:', error);
    }
  };

  const uploadImage = async (file: File, userId: string, type: string, oldUrl: string | null = null): Promise<string | null> => {
    try {
      // Delete old image first
      await deleteOldImage(oldUrl);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${type}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('showcase-images')
        .upload(fileName, file, {
          cacheControl: '0',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from('showcase-images')
        .getPublicUrl(fileName);

      // Add cache-busting parameter
      return `${data.publicUrl}?v=${Date.now()}`;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const removeLogo = async () => {
    if (!confirm("Supprimer le logo ? Cette action est irréversible.")) {
      return;
    }

    try {
      if (logoPreview) {
        await deleteOldImage(logoPreview);
      }
      
      setLogoPreview(null);
      await supabase
        .from("showcase_sites")
        .update({ logo_url: null })
        .eq("id", id);
      
      toast.success("Logo supprimé définitivement");
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleLogoChange = async (file: File | null) => {
    if (!file) return;
    
    setIsUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      toast.info("Upload du logo en cours...");
      const newLogoUrl = await uploadImage(file, user.id, 'logo', logoPreview);
      
      if (newLogoUrl) {
        setLogoPreview(newLogoUrl);
        
        // Save immediately to database
        await supabase
          .from("showcase_sites")
          .update({ logo_url: newLogoUrl })
          .eq("id", id);
          
        toast.success("Logo sauvegardé avec succès!");
      } else {
        toast.error("Erreur lors de l'upload du logo");
      }
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Erreur lors de l'upload du logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const removeHeroImage = async () => {
    if (!confirm("Supprimer l'image hero ? Cette action est irréversible.")) {
      return;
    }

    try {
      if (heroImagePreview) {
        await deleteOldImage(heroImagePreview);
      }
      
      setHeroImagePreview(null);
      await supabase
        .from("showcase_sites")
        .update({ hero_image_url: null })
        .eq("id", id);
      
      toast.success("Image hero supprimée définitivement");
    } catch (error) {
      console.error("Error removing hero image:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleHeroImageChange = async (file: File | null) => {
    if (!file) return;
    
    setIsUploadingHero(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      toast.info("Upload de l'image hero en cours...");
      const newHeroUrl = await uploadImage(file, user.id, 'hero', heroImagePreview);
      
      if (newHeroUrl) {
        setHeroImagePreview(newHeroUrl);
        
        // Save immediately to database
        await supabase
          .from("showcase_sites")
          .update({ hero_image_url: newHeroUrl })
          .eq("id", id);
          
        toast.success("Image hero sauvegardée avec succès!");
      } else {
        toast.error("Erreur lors de l'upload de l'image");
      }
    } catch (error) {
      console.error("Error uploading hero image:", error);
      toast.error("Erreur lors de l'upload de l'image");
    } finally {
      setIsUploadingHero(false);
    }
  };

  const removeAboutImage = async () => {
    if (!confirm("Supprimer l'image à propos ? Cette action est irréversible.")) {
      return;
    }

    try {
      if (aboutImagePreview) {
        await deleteOldImage(aboutImagePreview);
      }
      
      setAboutImagePreview(null);
      await supabase
        .from("showcase_sites")
        .update({ about_image_url: null })
        .eq("id", id);
      
      toast.success("Image à propos supprimée définitivement");
    } catch (error) {
      console.error("Error removing about image:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleAboutImageChange = async (file: File | null) => {
    if (!file) return;
    
    setIsUploadingAbout(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      toast.info("Upload de l'image à propos en cours...");
      const newAboutUrl = await uploadImage(file, user.id, 'about', aboutImagePreview);
      
      if (newAboutUrl) {
        setAboutImagePreview(newAboutUrl);
        
        // Save immediately to database
        await supabase
          .from("showcase_sites")
          .update({ about_image_url: newAboutUrl })
          .eq("id", id);
          
        toast.success("Image à propos sauvegardée avec succès!");
      } else {
        toast.error("Erreur lors de l'upload de l'image");
      }
    } catch (error) {
      console.error("Error uploading about image:", error);
      toast.error("Erreur lors de l'upload de l'image");
    } finally {
      setIsUploadingAbout(false);
    }
  };

  const removeBiographyImage = async () => {
    if (!confirm("Supprimer l'image de biographie ? Cette action est irréversible.")) {
      return;
    }

    try {
      if (biographyImageUrl) {
        await deleteOldImage(biographyImageUrl);
      }
      
      setBiographyImageUrl("");
      await supabase
        .from("showcase_sites")
        .update({ biography_image_url: null })
        .eq("id", id);
      
      toast.success("Image de biographie supprimée définitivement");
    } catch (error) {
      console.error("Error removing biography image:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleBiographyImageUpload = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      toast.info("Upload de l'image en cours...");
      const imageUrl = await uploadImage(file, user.id, "biography", biographyImageUrl);
      
      if (imageUrl) {
        setBiographyImageUrl(imageUrl);
        
        // Save immediately to database
        await supabase
          .from("showcase_sites")
          .update({ biography_image_url: imageUrl })
          .eq("id", id);
          
        toast.success("Image de biographie sauvegardée avec succès!");
      } else {
        toast.error("Erreur lors de l'upload de l'image");
      }
    } catch (error) {
      console.error("Error uploading biography image:", error);
      toast.error("Erreur lors de l'upload de l'image");
    }
  };

  const getPublicUrl = () => {
    return `https://visuelpro.cloud/showcase/${subdomain}`;
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

  const saveFeaturesAndFormationsToDatabase = async () => {
    if (!id) return;
    
    try {
      await supabase
        .from("showcase_sites")
        .update({
          features: features,
          formations: formations,
          formations_text_align: formationsTextAlign,
        })
        .eq("id", id);
    } catch (error) {
      console.error("Error saving features/formations:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
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

      // Images are now uploaded immediately when selected, so we just use the current preview URLs
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
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        background_color: backgroundColor,
        text_color: currentValues.textColor,
        footer_color: currentValues.footerColor,
        about_layout: currentValues.aboutLayout,
        gallery_text_position: currentValues.galleryTextPosition,
        font_family: currentValues.fontFamily,
        theme_mode: currentValues.themeMode,
        logo_url: logoPreview,
        hero_image_url: heroImagePreview,
        about_image_url: aboutImagePreview,
        features: features,
        formations: formations,
        formations_text_align: formationsTextAlign,
        seo_title: seoTitle,
        seo_description: seoDescription,
        seo_keywords: seoKeywords,
        og_image_url: ogImageUrl,
        hero_title_size: heroTitleSize,
        hero_title_color: heroTitleColor,
        biography_title: biographyTitle,
        biography_content: biographyContent,
        biography_image_url: biographyImageUrl,
        biography_image_position: biographyImagePosition,
        professional_experience: professionalExperience,
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

      // Images are now uploaded immediately when selected, so we just use the current preview URLs
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
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        background_color: backgroundColor,
        text_color: data.textColor,
        about_layout: data.aboutLayout,
        gallery_text_position: data.galleryTextPosition,
        font_family: data.fontFamily,
        theme_mode: data.themeMode,
        logo_url: logoPreview,
        hero_image_url: heroImagePreview,
        about_image_url: aboutImagePreview,
        features: features,
        formations: formations,
        formations_text_align: formationsTextAlign,
        seo_title: seoTitle,
        seo_description: seoDescription,
        seo_keywords: seoKeywords,
        og_image_url: ogImageUrl,
        hero_title_size: heroTitleSize,
        hero_title_color: heroTitleColor,
        biography_title: biographyTitle,
        biography_content: biographyContent,
        biography_image_url: biographyImageUrl,
        biography_image_position: biographyImagePosition,
        professional_experience: professionalExperience,
        stats_years_experience: statsYearsExperience,
        stats_satisfied_clients: statsSatisfiedClients,
        stats_projects_completed: statsProjectsCompleted,
        stats_show_section: statsShowSection,
        navigation_text_color: navigationTextColor,
        navigation_bg_color: navigationBgColor,
        price_text_color: priceTextColor,
        price_bg_color: priceBgColor,
        stats_text_color: statsTextColor,
        stats_bg_color: statsBgColor,
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto mb-6">
            <TabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="edit" className="gap-2">
                <Edit className="h-4 w-4" />
                Édition
              </TabsTrigger>
              <TabsTrigger value="courses" className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Formations
              </TabsTrigger>
              <TabsTrigger value="payment-links" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Paiements
              </TabsTrigger>
              <TabsTrigger value="enrollments" className="gap-2">
                <Users className="h-4 w-4" />
                Inscriptions
              </TabsTrigger>
              <TabsTrigger value="modules" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Modules
              </TabsTrigger>
              <TabsTrigger value="galleries" className="gap-2">
                <Upload className="h-4 w-4" />
                Galeries
              </TabsTrigger>
              <TabsTrigger value="testimonials" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Témoignages
              </TabsTrigger>
              <TabsTrigger value="biography" className="gap-2">
                <Edit className="h-4 w-4" />
                Biographie
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
              <TabsTrigger value="bookings" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Réservations
              </TabsTrigger>
              <TabsTrigger value="blog" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Blog
              </TabsTrigger>
              <TabsTrigger value="trash" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Corbeille
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
          </div>

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
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground mt-1">Maximum 100 caractères</p>
              </div>

              {/* Hero Title Customization */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="heroTitleSize" className="text-sm">Taille du titre</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <input
                      type="range"
                      id="heroTitleSize"
                      min="24"
                      max="80"
                      step="2"
                      value={heroTitleSize}
                      onChange={(e) => setHeroTitleSize(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm font-medium w-12 text-right">{heroTitleSize}px</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="heroTitleColor" className="text-sm">Couleur du titre</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      id="heroTitleColor"
                      type="color"
                      value={heroTitleColor}
                      onChange={(e) => setHeroTitleColor(e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={heroTitleColor}
                      onChange={(e) => setHeroTitleColor(e.target.value)}
                      placeholder="#000000"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="heroSubtitle">Sous-titre</Label>
                <Textarea
                  id="heroSubtitle"
                  {...register("heroSubtitle")}
                  placeholder="Ex: Des formations de qualité pour développer vos compétences"
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground mt-1">Maximum 200 caractères</p>
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
                  maxLength={800}
                />
                <p className="text-xs text-muted-foreground mt-1">Maximum 800 caractères</p>
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
            showcaseId={id || ""}
            onChange={setFeatures}
            onSaveToDatabase={saveFeaturesAndFormationsToDatabase}
          />

          {/* Formations Editor */}
          <FormationsEditor
            formations={formations}
            textAlign={formationsTextAlign}
            showcaseId={id || ""}
            onChange={setFormations}
            onTextAlignChange={setFormationsTextAlign}
            onSaveToDatabase={saveFeaturesAndFormationsToDatabase}
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
                  maxLength={50}
                />
                {errors.ownerName && (
                  <p className="text-sm text-destructive mt-1">{errors.ownerName.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Maximum 50 caractères</p>
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
                        onClick={removeLogo}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    {isUploadingLogo && (
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Upload en cours...</span>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingLogo}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) handleLogoChange(file);
                        e.target.value = '';
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
                        onClick={removeHeroImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    {isUploadingHero && (
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Upload en cours...</span>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingHero}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) handleHeroImageChange(file);
                        e.target.value = '';
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
                        onClick={removeAboutImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    {isUploadingAbout && (
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Upload en cours...</span>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingAbout}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) handleAboutImageChange(file);
                        e.target.value = '';
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
              
              {/* Custom Color Pickers */}
              <div className="mt-6 space-y-4 pt-6 border-t">
                <h4 className="font-semibold text-sm">Personnalisation des couleurs</h4>
                
                <div>
                  <Label htmlFor="primaryColor">Couleur primaire</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => {
                        setPrimaryColor(e.target.value);
                        const selectedTheme = themes.find(t => t.value === watch("theme"));
                        if (selectedTheme) {
                          selectedTheme.colors.primary = e.target.value;
                        }
                      }}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => {
                        setPrimaryColor(e.target.value);
                        const selectedTheme = themes.find(t => t.value === watch("theme"));
                        if (selectedTheme) {
                          selectedTheme.colors.primary = e.target.value;
                        }
                      }}
                      placeholder="#2563eb"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Couleur principale utilisée pour les boutons et accents
                  </p>
                </div>

                <div>
                  <Label htmlFor="secondaryColor">Couleur secondaire</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => {
                        setSecondaryColor(e.target.value);
                        const selectedTheme = themes.find(t => t.value === watch("theme"));
                        if (selectedTheme) {
                          selectedTheme.colors.secondary = e.target.value;
                        }
                      }}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => {
                        setSecondaryColor(e.target.value);
                        const selectedTheme = themes.find(t => t.value === watch("theme"));
                        if (selectedTheme) {
                          selectedTheme.colors.secondary = e.target.value;
                        }
                      }}
                      placeholder="#7c3aed"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Couleur complémentaire pour les dégradés et variations
                  </p>
                </div>

                <div>
                  <Label htmlFor="backgroundColor">Couleur de fond du site</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      id="backgroundColor"
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="#ffffff"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Couleur d'arrière-plan principale du site vitrine
                  </p>
                </div>

                <div>
                  <Label htmlFor="footerColor">Couleur du pied de page</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      id="footerColor"
                      type="color"
                      {...register("footerColor")}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      {...register("footerColor")}
                      placeholder="#1a1a1a"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Couleur d'arrière-plan du pied de page
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Font Size Control */}
          <Card>
            <CardHeader>
              <CardTitle>Taille de police</CardTitle>
              <CardDescription>
                Ajustez la taille globale du texte sur votre site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="baseFontSize">Taille de base</Label>
                  <span className="text-sm text-muted-foreground">{baseFontSize}px</span>
                </div>
                <input
                  type="range"
                  id="baseFontSize"
                  min="12"
                  max="20"
                  step="1"
                  value={baseFontSize}
                  onChange={(e) => setBaseFontSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Petit (12px)</span>
                  <span>Moyen (16px)</span>
                  <span>Grand (20px)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Cette taille affecte tous les textes du site proportionnellement
                </p>
              </div>
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

          {/* Stats and Colors Customization */}
          <Card>
            <CardHeader>
              <CardTitle>Statistiques et Couleurs</CardTitle>
              <CardDescription>
                Personnalisez les statistiques et les couleurs pour une meilleure visibilité
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Afficher la section statistiques</Label>
                  <input
                    type="checkbox"
                    checked={statsShowSection}
                    onChange={(e) => setStatsShowSection(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300"
                  />
                </div>
                
                {statsShowSection && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="statsYearsExperience">Années d'expérience</Label>
                        <Input
                          id="statsYearsExperience"
                          type="number"
                          value={statsYearsExperience}
                          onChange={(e) => setStatsYearsExperience(Number(e.target.value))}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="statsSatisfiedClients">Clients satisfaits</Label>
                        <Input
                          id="statsSatisfiedClients"
                          type="number"
                          value={statsSatisfiedClients}
                          onChange={(e) => setStatsSatisfiedClients(Number(e.target.value))}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="statsProjectsCompleted">Projets réalisés</Label>
                        <Input
                          id="statsProjectsCompleted"
                          type="number"
                          value={statsProjectsCompleted}
                          onChange={(e) => setStatsProjectsCompleted(Number(e.target.value))}
                          min="0"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                      <div>
                        <Label htmlFor="statsTextColor">Couleur du texte (Stats)</Label>
                        <div className="flex gap-2 items-center mt-2">
                          <Input
                            id="statsTextColor"
                            type="color"
                            value={statsTextColor}
                            onChange={(e) => setStatsTextColor(e.target.value)}
                            className="w-16 h-10"
                          />
                          <Input
                            type="text"
                            value={statsTextColor}
                            onChange={(e) => setStatsTextColor(e.target.value)}
                            placeholder="#ffffff"
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="statsBgColor">Couleur de fond (Stats)</Label>
                        <Input
                          id="statsBgColor"
                          type="text"
                          value={statsBgColor}
                          onChange={(e) => setStatsBgColor(e.target.value)}
                          placeholder="rgba(0,0,0,0.7)"
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Navigation Colors */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Couleurs de navigation</Label>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label htmlFor="navigationTextColor">Texte navigation</Label>
                    <div className="flex gap-2 items-center mt-2">
                      <Input
                        id="navigationTextColor"
                        type="color"
                        value={navigationTextColor}
                        onChange={(e) => setNavigationTextColor(e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        type="text"
                        value={navigationTextColor}
                        onChange={(e) => setNavigationTextColor(e.target.value)}
                        placeholder="#ffffff"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="navigationBgColor">Fond navigation</Label>
                    <Input
                      id="navigationBgColor"
                      type="text"
                      value={navigationBgColor}
                      onChange={(e) => setNavigationBgColor(e.target.value)}
                      placeholder="rgba(0,0,0,0.8)"
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* Price Colors */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Couleurs des prix</Label>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label htmlFor="priceTextColor">Texte prix</Label>
                    <div className="flex gap-2 items-center mt-2">
                      <Input
                        id="priceTextColor"
                        type="color"
                        value={priceTextColor}
                        onChange={(e) => setPriceTextColor(e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        type="text"
                        value={priceTextColor}
                        onChange={(e) => setPriceTextColor(e.target.value)}
                        placeholder="#ffffff"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="priceBgColor">Fond prix</Label>
                    <div className="flex gap-2 items-center mt-2">
                      <Input
                        id="priceBgColor"
                        type="color"
                        value={priceBgColor}
                        onChange={(e) => setPriceBgColor(e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        type="text"
                        value={priceBgColor}
                        onChange={(e) => setPriceBgColor(e.target.value)}
                        placeholder="#2563eb"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
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

          <TabsContent value="courses">
            <div className="max-w-6xl mx-auto">
              {id ? (
                <CoursesManager showcaseSiteId={id} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Sauvegardez votre site vitrine d'abord pour ajouter des formations
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="payment-links">
            <div className="max-w-4xl mx-auto">
              {id ? (
                <PaymentLinksManager showcaseSiteId={id} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Sauvegardez votre site vitrine d'abord pour configurer les paiements
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="enrollments">
            <div className="max-w-6xl mx-auto">
              {id ? (
                <EnrollmentsManager showcaseSiteId={id} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Sauvegardez votre site vitrine d'abord pour voir les inscriptions
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="modules">
            <div className="max-w-6xl mx-auto">
              {id ? (
                <ModulesTabContent showcaseSiteId={id} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Sauvegardez votre site vitrine d'abord
                  </p>
                </div>
              )}
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

          <TabsContent value="biography">
            <div className="max-w-4xl mx-auto">
              <BiographyEditor
                biographyTitle={biographyTitle}
                biographyContent={biographyContent}
                biographyImageUrl={biographyImageUrl}
                biographyImagePosition={biographyImagePosition}
                professionalExperience={professionalExperience}
                onBiographyTitleChange={setBiographyTitle}
                onBiographyContentChange={setBiographyContent}
                onBiographyImageUpload={handleBiographyImageUpload}
                onBiographyImageRemove={removeBiographyImage}
                onBiographyImagePositionChange={setBiographyImagePosition}
                onExperienceChange={setProfessionalExperience}
              />
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="max-w-6xl mx-auto">
              {id ? (
                <BookingCalendar showcaseSiteId={id} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Veuillez d'abord sauvegarder votre site vitrine pour accéder aux réservations
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced">
            <div className="max-w-3xl mx-auto space-y-6">
              <AIImageGenerator 
                onImageGenerated={async (imageUrl, imageType) => {
                  try {
                    // Fetch the image and re-upload it with unique name and cache-busting
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `${imageType}-${Date.now()}.png`, { type: 'image/png' });
                    
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                      toast.error("Non authentifié");
                      return;
                    }

                    // Delete old image before uploading new one
                    if (imageType === "logo" && logoPreview) {
                      await deleteOldImage(logoPreview);
                    } else if (imageType === "hero" && heroImagePreview) {
                      await deleteOldImage(heroImagePreview);
                    } else if (imageType === "about" && aboutImagePreview) {
                      await deleteOldImage(aboutImagePreview);
                    }

                    // Upload new image with unique name
                    const fileName = `${user.id}/${imageType}-${Date.now()}.png`;
                    const { error: uploadError } = await supabase.storage
                      .from('showcase-images')
                      .upload(fileName, file, {
                        cacheControl: '0',
                        upsert: false
                      });

                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage
                      .from('showcase-images')
                      .getPublicUrl(fileName);

                    // Add cache-busting parameter
                    const finalUrl = `${data.publicUrl}?v=${Date.now()}`;

                    // Update state and database immediately
                    if (imageType === "logo") {
                      setLogoPreview(finalUrl);
                      await supabase
                        .from("showcase_sites")
                        .update({ logo_url: finalUrl })
                        .eq("id", id);
                    } else if (imageType === "hero") {
                      setHeroImagePreview(finalUrl);
                      await supabase
                        .from("showcase_sites")
                        .update({ hero_image_url: finalUrl })
                        .eq("id", id);
                    } else if (imageType === "about") {
                      setAboutImagePreview(finalUrl);
                      await supabase
                        .from("showcase_sites")
                        .update({ about_image_url: finalUrl })
                        .eq("id", id);
                    }
                    
                    toast.success(`Image ${imageType} sauvegardée avec succès !`);
                  } catch (error) {
                    console.error("Error applying AI image:", error);
                    toast.error("Erreur lors de l'application de l'image");
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
              
              {/* Domain Management with DNS Assistant */}
              <DnsConfigurationAssistant
                showcaseId={id || ""}
                subdomain={subdomain}
                currentDomain={formValues.customDomain}
                verificationCode={(formValues as any).domain_verification_code}
                domainStatus={(formValues as any).domain_status}
                propagationPercentage={(formValues as any).dns_propagation_percentage}
                sslStatus={(formValues as any).ssl_status}
                onDomainSave={async (domain) => {
                  if (!id) return;
                  const { error } = await supabase
                    .from("showcase_sites")
                    .update({ custom_domain: domain })
                    .eq("id", id);
                  
                  if (error) throw error;
                  await loadSite(); // Reload to get verification code
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

          <TabsContent value="bookings">
            <div className="max-w-6xl mx-auto">
              {id && <BookingsViewer showcaseId={id} />}
            </div>
          </TabsContent>

          <TabsContent value="blog">
            <div className="max-w-6xl mx-auto">
              {id && (
                <BlogManager 
                  showcaseSiteId={id} 
                  ownerName={formValues.ownerName || ""} 
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="trash">
            <div className="max-w-6xl mx-auto">
              {id && <TrashManager showcaseId={id} onRestore={loadSite} />}
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="max-w-6xl mx-auto">
              {id && <AnalyticsViewer showcaseId={id} />}
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold">Prévisualisation Multi-Appareils</h3>
                <p className="text-muted-foreground">
                  Visualisez votre site sur différents appareils avant publication
                </p>
              </div>
              <DevicePreview 
                url={`/showcase/${subdomain}`}
                className="w-full"
              />
              <div className="text-center text-sm text-muted-foreground">
                <p>💡 Astuce : Testez votre site sur différents appareils pour garantir une expérience optimale</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
