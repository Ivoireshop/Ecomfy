import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/seo/SEO";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuthReady } from "@/hooks/useAuthReady";

// Nouveaux composants de la landing page
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingGallery } from "@/components/landing/LandingGallery";
import { LandingShopSection } from "@/components/landing/LandingShopSection";
import { LandingMediaSection } from "@/components/landing/LandingMediaSection";
import { LandingScrollStory } from "@/components/landing/LandingScrollStory";
import { LandingAiSection } from "@/components/landing/LandingAiSection";
import { LandingProofSection } from "@/components/landing/LandingProofSection";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";

const Index = () => {
  const navigate = useNavigate();
  const { session, isReady } = useAuthReady();

  useEffect(() => {
    // Redirige vers le dashboard si l'utilisateur est déjà connecté
    if (isReady && session?.user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isReady, navigate, session]);

  // Si l'utilisateur est connecté, on n'affiche rien (le useEffect redirige)
  if (session?.user) return null;

  return (
    <div className="min-h-screen bg-white selection:bg-[#0E7C66] selection:text-white font-['Inter',sans-serif]">
      <SEO
        title="Ecomfy — L'avenir du e-commerce en Afrique"
        description="Créez votre boutique en ligne, générez des visuels et vidéos publicitaires avec l'IA et développez votre business en Afrique."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Ecomfy",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "url": "https://ecomfy.cloud/",
          "description": "Plateforme IA tout-en-un pour entrepreneurs africains.",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "XOF" }
        }}
      />
      
      {/* Header existant (conserve la logique multilingue, thème, auth) */}
      <Header />

      {/* Hero Section */}
      <LandingHero />

      {/* Galerie Horizontale (Vitrines) */}
      <LandingGallery />

      {/* Section Boutique en 60s */}
      <LandingShopSection />

      {/* Section IA Médias (Visuels & Vidéos) */}
      <LandingMediaSection />

      {/* Narrative Sticky: De zéro à l'empire */}
      <LandingScrollStory />

      {/* Assistant IA Temps réel */}
      <LandingAiSection />

      {/* Preuve sociale (Témoignages) */}
      <LandingProofSection />

      {/* Tarifs (Essai vs Pro) */}
      <LandingPricing />

      {/* Appel à l'action Final */}
      <LandingFinalCta />

      {/* Footer Existant */}
      <Footer />
    </div>
  );
};

export default Index;
