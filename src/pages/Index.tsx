import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/seo/SEO";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuthReady } from "@/hooks/useAuthReady";

// Nouveaux composants de la landing page
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingTrust } from "@/components/landing/LandingTrust";
import { LandingPositioning } from "@/components/landing/LandingPositioning";
import { LandingVideoShowcase } from "@/components/landing/LandingVideoShowcase";
import { LandingTopSellers } from "@/components/landing/LandingTopSellers";
import { LandingPillarCreate } from "@/components/landing/LandingPillarCreate";
import { LandingPillarSell } from "@/components/landing/LandingPillarSell";
import { LandingPillarAI } from "@/components/landing/LandingPillarAI";
import { LandingConnectUsSection } from "@/components/landing/LandingConnectUsSection";
import { LandingPillarManage } from "@/components/landing/LandingPillarManage";
import { LandingPillarFinance } from "@/components/landing/LandingPillarFinance";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingAcademy } from "@/components/landing/LandingAcademy";
import { LandingEcosystem } from "@/components/landing/LandingEcosystem";
import { LandingPersonas } from "@/components/landing/LandingPersonas";
import { LandingStats } from "@/components/landing/LandingStats";
import { LandingTestimonials } from "@/components/landing/LandingTestimonials";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";

const Index = () => {
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

      <main>
        {/* Hero Section */}
        <LandingHero />

        {/* Logos partenaires */}
        <LandingTrust />

        {/* Positionnement global */}
        <LandingPositioning />

        {/* Vidéo de Présentation Autoplay (Vimeo 1225512009) */}
        <LandingVideoShowcase />

        {/* Section Preuve Sociale : Top Vendeurs Ecomfy */}
        <LandingTopSellers />

        {/* Fonctionnalités principales (Sticky Scroll) */}
        <LandingPillarCreate />
        <LandingPillarSell />
        <LandingPillarAI />

        {/* Section Phare ConnectUs */}
        <LandingConnectUsSection />

        <LandingPillarManage />
        <LandingPillarFinance />

        {/* Personas (Cibles) */}
        <LandingPersonas />

        {/* Comment ça marche */}
        <LandingHowItWorks />

        {/* Académie Ecomfy & Formations */}
        <LandingAcademy />

        {/* Ecosystème d'intégration */}
        <LandingEcosystem />

        {/* Chiffres & Confiance */}
        <LandingStats />
        <LandingTestimonials />

        {/* Tarifs */}
        <LandingPricing />

        {/* FAQ */}
        <LandingFaq />

        {/* Appel à l'action Final */}
        <LandingFinalCta />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
