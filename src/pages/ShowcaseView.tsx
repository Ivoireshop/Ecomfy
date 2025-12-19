import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Loader2, ArrowLeft, Menu } from "lucide-react";
import { Helmet } from "react-helmet";
import { ShowcaseAIChat } from "@/components/ShowcaseAIChat";
import { BookingForm } from "@/components/BookingForm";
import { ShowcaseHome } from "@/components/showcase/ShowcaseHome";
import { ShowcaseServices } from "@/components/showcase/ShowcaseServices";
import { ShowcaseFormations } from "@/components/showcase/ShowcaseFormations";
import { ShowcaseAbout } from "@/components/showcase/ShowcaseAbout";
import { ShowcaseBiography } from "@/components/showcase/ShowcaseBiography";
import { ShowcaseGallery } from "@/components/showcase/ShowcaseGallery";
import { ShowcaseContact } from "@/components/showcase/ShowcaseContact";
import { ShowcaseBlog } from "@/components/showcase/ShowcaseBlog";
import { ShowcaseFooter } from "@/components/showcase/ShowcaseFooter";
import { ShowcaseCoursesPage } from "@/components/showcase/ShowcaseCoursesPage";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface Feature {
  title: string;
  description: string;
  image_url?: string;
  benefits?: string[];
  category?: string;
  price?: number;
  popularity?: number;
}

interface Formation {
  title: string;
  description: string;
  image_url?: string;
  price?: string;
  duration?: string;
  participants?: string;
  benefits?: string[];
}

interface Testimonial {
  id: string;
  full_name: string;
  testimonial_text: string;
  result_image_url?: string;
  display_order: number;
}

interface ShowcaseSite {
  id: string;
  subdomain: string;
  business_name: string;
  business_description: string | null;
  owner_name: string;
  whatsapp_number: string;
  phone_number: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  about_title: string | null;
  about_description: string | null;
  biography_title: string | null;
  biography_content: string | null;
  biography_image_url: string | null;
  professional_experience: any[] | null;
  features: Feature[] | null;
  formations: Formation[] | null;
  formations_text_align: string | null;
  cta_title: string | null;
  cta_description: string | null;
  formation_title: string | null;
  formation_description: string | null;
  formation_price: string | null;
  theme: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  text_color: string | null;
  about_layout: string | null;
  gallery_text_position: string | null;
  font_family: string | null;
  theme_mode: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  about_image_url: string | null;
  hero_video_url: string | null;
  about_video_url: string | null;
  owner_photo_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  og_image_url: string | null;
  hero_title_size: number | null;
  hero_title_color: string | null;
  stats_years_experience: number | null;
  stats_satisfied_clients: number | null;
  stats_projects_completed: number | null;
  stats_show_section: boolean | null;
  navigation_text_color: string | null;
  navigation_bg_color: string | null;
  price_text_color: string | null;
  price_bg_color: string | null;
  stats_text_color: string | null;
  stats_bg_color: string | null;
  // Custom domain fields
  custom_domain: string | null;
  domain_status: string | null;
  ssl_status: string | null;
}

interface GalleryImage {
  id: string;
  image_url: string;
  image_caption: string | null;
  section_type: string;
  section_title: string | null;
}

interface GalleryVideo {
  id: string;
  video_url: string;
  video_caption: string | null;
  section_type: string;
  section_title: string | null;
}

type PageType = 'home' | 'services' | 'formations' | 'courses' | 'about' | 'biography' | 'gallery' | 'contact' | 'booking' | 'blog';

export default function ShowcaseView() {
  const { subdomain, page } = useParams<{ subdomain: string; page?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [site, setSite] = useState<ShowcaseSite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [galleries, setGalleries] = useState<Record<string, GalleryImage[]>>({});
  const [galleryVideos, setGalleryVideos] = useState<GalleryVideo[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const currentPage: PageType = (page as PageType) || 'home';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    
    // Observer pour les animations au scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observer tous les éléments avec la classe scroll-fade-in
    const elements = document.querySelectorAll('.scroll-fade-in');
    elements.forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [currentPage]);

  useEffect(() => {
    loadSite();
  }, [subdomain]);

  useEffect(() => {
    if (!site) return;

    const trackVisit = async () => {
      try {
        let sessionId = sessionStorage.getItem('showcase_session_id');
        if (!sessionId) {
          sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sessionStorage.setItem('showcase_session_id', sessionId);
        }

        const userAgent = navigator.userAgent.toLowerCase();
        const deviceType = /mobile|android|iphone|ipad|tablet/.test(userAgent) ? 'mobile' : 'desktop';
        const browser = userAgent.includes('chrome') ? 'Chrome' : 
                       userAgent.includes('firefox') ? 'Firefox' : 
                       userAgent.includes('safari') ? 'Safari' : 'Other';

        await supabase.from('showcase_analytics').insert({
          showcase_site_id: site.id,
          session_id: sessionId,
          page_path: location.pathname,
          referrer: document.referrer || null,
          device_type: deviceType,
          browser: browser,
          user_agent: navigator.userAgent,
        });
      } catch (error) {
        console.error('Error tracking visit:', error);
      }
    };

    trackVisit();
  }, [site, location]);

  const loadSite = async () => {
    if (!subdomain) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("showcase_sites")
        .select("*")
        .eq("subdomain", subdomain)
        .eq("is_published", true)
        .single();

      if (error) {
        console.error("Error loading site:", error);
      } else {
        console.log('Raw data from Supabase:', data);
        console.log('Raw features:', data.features);
        console.log('Features type:', typeof data.features);
        console.log('Is features array?', Array.isArray(data.features));
        
        // Ensure features is always an array
        let featuresArray: Feature[] = [];
        if (data.features) {
          if (Array.isArray(data.features)) {
            featuresArray = data.features as unknown as Feature[];
            console.log('Features is array, length:', featuresArray.length);
          } else if (typeof data.features === 'object') {
            console.warn('Features is object, not array. Attempting to extract values:', data.features);
            // Try to convert object to array if it's an object
            const values = Object.values(data.features);
            if (values.length > 0 && typeof values[0] === 'object') {
              featuresArray = values as unknown as Feature[];
              console.log('Converted features object to array, length:', featuresArray.length);
            }
          } else {
            console.warn('Features is neither array nor object:', data.features);
          }
        } else {
          console.log('No features in data');
        }
        
        // Ensure formations is always an array
        let formationsArray: Formation[] = [];
        if (data.formations) {
          if (Array.isArray(data.formations)) {
            formationsArray = data.formations as unknown as Formation[];
          } else if (typeof data.formations === 'object') {
            const values = Object.values(data.formations);
            if (values.length > 0 && typeof values[0] === 'object') {
              formationsArray = values as unknown as Formation[];
            }
          }
        }
        
        const siteData = {
          ...data,
          features: featuresArray,
          formations: formationsArray,
          hero_video_url: (data as any).hero_video_url ?? null,
          about_video_url: (data as any).about_video_url ?? null,
        };
        
        // Check if we should redirect to custom domain
        const customDomain = data.custom_domain;
        const domainStatus = data.domain_status;
        const sslStatus = data.ssl_status;
        const currentHost = window.location.host;
        const isOnSubdomain = !currentHost.includes(customDomain || '');
        
        // Redirect to custom domain if:
        // 1. Custom domain is configured
        // 2. Domain status is "active"
        // 3. SSL status is "active"
        // 4. We're not already on the custom domain
        if (customDomain && domainStatus === 'active' && sslStatus === 'active' && isOnSubdomain) {
          const protocol = 'https://';
          const currentPath = page ? `/${page}` : '';
          const redirectUrl = `${protocol}${customDomain}${currentPath}`;
          console.log('Redirecting to custom domain:', redirectUrl);
          window.location.replace(redirectUrl);
          return;
        }
        
        console.log('Final site data:', siteData);
        console.log('Final features array:', featuresArray);
        console.log('Final features count:', featuresArray.length);
        
        setSite(siteData as ShowcaseSite);
        
        const { data: galleryData } = await supabase
          .from("showcase_galleries")
          .select("*")
          .eq("showcase_site_id", data.id)
          .order("image_order", { ascending: true });
        
        if (galleryData) {
          const grouped = galleryData.reduce((acc, img) => {
            const section = img.section_type;
            if (!acc[section]) acc[section] = [];
            acc[section].push(img as GalleryImage);
            return acc;
          }, {} as Record<string, GalleryImage[]>);
          setGalleries(grouped);
        }

        const { data: videoData } = await supabase
          .from("showcase_gallery_videos")
          .select("*")
          .eq("showcase_site_id", data.id)
          .order("video_order", { ascending: true });
        
        if (videoData) {
          setGalleryVideos(videoData as GalleryVideo[]);
        }

        const { data: testimonialsData } = await supabase
          .from("showcase_testimonials")
          .select("*")
          .eq("showcase_site_id", data.id)
          .order("display_order", { ascending: true });
        
        if (testimonialsData) {
          setTestimonials(testimonialsData as Testimonial[]);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (!site) return;
    let cleanNumber = site.whatsapp_number.replace(/\D/g, "");
    if (!cleanNumber.startsWith("237") && cleanNumber.length < 12) {
      cleanNumber = "237" + cleanNumber;
    }
    const message = encodeURIComponent(`Bonjour ${site.owner_name}, je suis intéressé(e) par vos services.`);
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
  };

  const navigateToPage = (page: PageType) => {
    setMobileMenuOpen(false);
    const url = page === 'home' ? `/showcase/${subdomain}` : `/showcase/${subdomain}/${page}`;
    navigate(url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContactClick = () => {
    navigateToPage('contact');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-2xl font-bold">Site non trouvé</h2>
            <p className="text-muted-foreground">
              Ce site vitrine n'existe pas ou n'est pas encore publié.
            </p>
            <Button onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navigationItems = [
    { label: "Accueil", page: 'home' as PageType },
    ...(site.biography_content ? [{ label: "Biographie", page: 'biography' as PageType }] : []),
    ...(site.features && site.features.length > 0 ? [{ label: "Services", page: 'services' as PageType }] : []),
    { label: "Catalogue Formations", page: 'courses' as PageType },
    ...(site.formations && site.formations.length > 0 ? [{ label: "Formations", page: 'formations' as PageType }] : []),
    ...(Object.keys(galleries).length > 0 || Object.keys(galleryVideos).length > 0 ? [{ label: "Galerie", page: 'gallery' as PageType }] : []),
    ...(site.features && site.features.length > 0 ? [{ label: "Réserver", page: 'booking' as PageType }] : []),
    { label: "Blog", page: 'blog' as PageType },
    { label: "Contact", page: 'contact' as PageType },
  ];

  const seoTitle = site.seo_title || site.hero_title || site.business_name;
  const seoDescription = site.seo_description || site.hero_subtitle || `Découvrez ${site.business_name}`;
  const ogImage = site.og_image_url || site.hero_image_url || site.logo_url;
  const keywords = site.seo_keywords?.join(', ') || '';

  const themeMode = site.theme_mode || 'light';
  const bgColor = themeMode === 'dark' ? '#0f172a' : '#ffffff';

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        {keywords && <meta name="keywords" content={keywords} />}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>

      <div 
        className="min-h-screen"
        style={{ backgroundColor: bgColor, color: site.text_color || '#000000' }}
      >
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? `${themeMode === 'dark' ? 'bg-slate-900/95' : 'bg-background/95'} backdrop-blur-md shadow-md` : "bg-transparent"
        }`}>
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-20">
              <button 
                onClick={() => navigateToPage('home')}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                {site.logo_url ? (
                  <img 
                    src={site.logo_url} 
                    alt={site.business_name}
                    className="h-10 object-contain"
                  />
                ) : (
                  <span className="text-xl font-bold">{site.business_name}</span>
                )}
              </button>

              {/* Navigation Desktop */}
              <div 
                className="hidden md:flex items-center gap-8 px-6 py-3 rounded-full"
                style={{ 
                  backgroundColor: site.navigation_bg_color || 'rgba(0,0,0,0.8)',
                }}
              >
                {navigationItems.map((item) => (
                  <button
                    key={item.page}
                    onClick={() => navigateToPage(item.page)}
                    className={`text-sm font-medium transition-colors hover:opacity-80 whitespace-nowrap ${
                      currentPage === item.page ? 'font-bold' : ''
                    }`}
                    style={{ 
                      color: site.navigation_text_color || '#ffffff'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Navigation Mobile - Visible et scrollable horizontalement */}
              <div className="md:hidden flex-1 overflow-x-auto mx-4">
                <div 
                  className="flex items-center gap-4 px-4 py-2 rounded-full w-max"
                  style={{ 
                    backgroundColor: site.navigation_bg_color || 'rgba(0,0,0,0.8)',
                  }}
                >
                  {navigationItems.map((item) => (
                    <button
                      key={item.page}
                      onClick={() => navigateToPage(item.page)}
                      className={`text-xs font-medium transition-colors hover:opacity-80 whitespace-nowrap ${
                        currentPage === item.page ? 'font-bold' : ''
                      }`}
                      style={{ 
                        color: site.navigation_text_color || '#ffffff'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="pt-20">
          {currentPage === 'home' && <ShowcaseHome site={site} onContactClick={handleContactClick} onNavigate={navigateToPage} />}
          {currentPage === 'services' && <ShowcaseServices site={site} onContactClick={handleContactClick} />}
          {currentPage === 'courses' && (
            <section className="py-20 px-4">
              <div className="container mx-auto max-w-7xl">
                <ShowcaseCoursesPage 
                  showcaseSiteId={site.id}
                  primaryColor={site.primary_color || '#2563eb'}
                  textColor={site.text_color || '#000000'}
                  priceTextColor={site.price_text_color || '#ffffff'}
                  priceBgColor={site.price_bg_color || '#2563eb'}
                  legacyFormations={site.formations || []}
                />
              </div>
            </section>
          )}
          {currentPage === 'formations' && <ShowcaseFormations site={site} onContactClick={handleContactClick} />}
          {currentPage === 'about' && <ShowcaseAbout site={site} testimonials={testimonials} onContactClick={handleContactClick} />}
          {currentPage === 'biography' && <ShowcaseBiography site={site} />}
          {currentPage === 'gallery' && <ShowcaseGallery galleries={galleries} galleryVideos={galleryVideos} site={site} />}
          {currentPage === 'blog' && <ShowcaseBlog site={site} />}
          {currentPage === 'booking' && (
            <section className="py-20 px-4">
              <div className="max-w-2xl mx-auto">
                <BookingForm showcaseSiteId={site.id} site={site} onSuccess={() => navigateToPage('home')} />
              </div>
            </section>
          )}
          {currentPage === 'contact' && <ShowcaseContact site={site} />}
        </div>

        <ShowcaseFooter site={site} onNavigate={navigateToPage} />

        <ShowcaseAIChat 
          siteContext={{
            businessName: site.business_name,
            businessDescription: site.business_description || undefined,
            ownerName: site.owner_name,
            whatsappNumber: site.whatsapp_number,
            phoneNumber: site.phone_number,
            aboutDescription: site.about_description || undefined,
            features: site.features || undefined,
            formationTitle: site.formation_title || undefined,
            formationDescription: site.formation_description || undefined,
            formationPrice: site.formation_price || undefined,
          }}
          theme={{
            primaryColor: site.primary_color || '#D4AF37',
            secondaryColor: site.secondary_color || '#10B981',
          }}
        />

        {/* Bouton WhatsApp fixe en bas à gauche */}
        <Button
          onClick={handleWhatsAppClick}
          className="fixed bottom-6 left-6 z-40 shadow-2xl hover-scale"
          size="lg"
          style={{ 
            backgroundColor: site.primary_color || '#D4AF37', 
            color: '#ffffff',
          }}
        >
          <MessageCircle className="h-5 w-5 mr-2" />
          WhatsApp
        </Button>
      </div>
    </>
  );
}
