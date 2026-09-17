import React from "react";
import { HomepageConfig, HomepageSection } from "./types";
import { HeroSection } from "./sections/HeroSection";
import { ProductsGridSection } from "./sections/ProductsGridSection";
import { SingleProductCheckoutSection } from "./sections/SingleProductCheckoutSection";
import { FeaturedProductsSection } from "./sections/FeaturedProductsSection";
import { CategoriesSection } from "./sections/CategoriesSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { TextImageSection } from "./sections/TextImageSection";
import { VideoSection } from "./sections/VideoSection";
import { TestimonialsSection } from "./sections/TestimonialsSection";
import { BannerCtaSection } from "./sections/BannerCtaSection";
import { FaqSection } from "./sections/FaqSection";
import { ContactFormSection } from "./sections/ContactFormSection";
import { FooterCustomSection } from "./sections/FooterCustomSection";

interface HomepageRendererProps {
  config: HomepageConfig;
  shop: any;
  products: any[];
  primaryColor?: string;
  onAddToCart?: (product: any) => void;
  onViewProduct?: (product: any) => void;
  onSelectCategory?: (category: string) => void;
  onActionClick?: (actionType: string, url?: string) => void;
  onDirectOrder?: (orderData: {
    product: any;
    quantity: number;
    customer_name: string;
    customer_phone: string;
    customer_address?: string;
  }) => Promise<boolean | void>;
}

export const HomepageRenderer: React.FC<HomepageRendererProps> = ({
  config,
  shop,
  products = [],
  primaryColor = "#0E7C66",
  onAddToCart,
  onViewProduct,
  onSelectCategory,
  onActionClick,
  onDirectOrder,
}) => {
  if (!config || !config.enabled || !Array.isArray(config.sections)) {
    return null;
  }

  const enabledSections = config.sections.filter((s) => s.enabled);

  return (
    <div className="w-full min-h-screen bg-background">
      {enabledSections.map((section) => {
        switch (section.type) {
          case "hero":
            return (
              <HeroSection
                key={section.id}
                settings={section.settings as any}
                primaryColor={primaryColor}
                onAction={(type, url) => onActionClick?.(type, url)}
              />
            );
          case "single_product_checkout":
            return (
              <SingleProductCheckoutSection
                key={section.id}
                settings={section.settings as any}
                products={products}
                primaryColor={primaryColor}
                onDirectOrder={onDirectOrder}
              />
            );
          case "products_grid":
            return (
              <ProductsGridSection
                key={section.id}
                settings={section.settings as any}
                products={products}
                primaryColor={primaryColor}
                onAddToCart={onAddToCart}
                onViewProduct={onViewProduct}
              />
            );
          case "featured_products":
            return (
              <FeaturedProductsSection
                key={section.id}
                settings={section.settings as any}
                products={products}
                primaryColor={primaryColor}
                onAddToCart={onAddToCart}
                onViewProduct={onViewProduct}
              />
            );
          case "categories":
            return (
              <CategoriesSection
                key={section.id}
                settings={section.settings as any}
                onSelectCategory={onSelectCategory}
              />
            );
          case "features":
            return (
              <FeaturesSection
                key={section.id}
                settings={section.settings as any}
                primaryColor={primaryColor}
              />
            );
          case "text_image":
            return (
              <TextImageSection
                key={section.id}
                settings={section.settings as any}
                primaryColor={primaryColor}
                onAction={(type, url) => onActionClick?.(type, url)}
              />
            );
          case "video":
            return (
              <VideoSection
                key={section.id}
                settings={section.settings as any}
                primaryColor={primaryColor}
                onAction={(type, url) => onActionClick?.(type, url)}
              />
            );
          case "testimonials":
            return (
              <TestimonialsSection
                key={section.id}
                settings={section.settings as any}
              />
            );
          case "banner_cta":
            return (
              <BannerCtaSection
                key={section.id}
                settings={section.settings as any}
                primaryColor={primaryColor}
                onAction={(action) => onActionClick?.(action)}
              />
            );
          case "faq":
            return (
              <FaqSection key={section.id} settings={section.settings as any} />
            );
          case "contact_form":
            return (
              <ContactFormSection
                key={section.id}
                settings={section.settings as any}
                primaryColor={primaryColor}
                whatsappNumber={shop?.whatsapp_number}
              />
            );
          case "footer_custom":
            return (
              <FooterCustomSection
                key={section.id}
                settings={section.settings as any}
                shopName={shop?.business_name}
                logoUrl={shop?.logo_url}
                primaryColor={primaryColor}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
};
