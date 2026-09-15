export type DeviceType = "desktop" | "tablet" | "mobile";

export type SectionType =
  | "hero"
  | "products_grid"
  | "categories"
  | "features"
  | "text_image"
  | "testimonials"
  | "banner_cta"
  | "faq"
  | "footer_custom";

export interface HeroSectionSettings {
  title: string;
  subtitle: string;
  description?: string;
  badge?: string;
  bg_type: "color" | "gradient" | "image";
  bg_color?: string;
  bg_gradient?: string;
  bg_image_url?: string;
  text_color?: string;
  primary_button_text: string;
  primary_button_link_type: "checkout" | "products" | "custom";
  primary_button_custom_url?: string;
  primary_button_bg?: string;
  secondary_button_text?: string;
  secondary_button_link_type?: "products" | "custom";
  secondary_button_custom_url?: string;
  content_alignment: "left" | "center" | "right";
  overlay_opacity?: number;
  height: "compact" | "medium" | "full";
}

export interface ProductsGridSectionSettings {
  title: string;
  subtitle?: string;
  selection_rule: "all" | "featured" | "category" | "manual";
  selected_category?: string;
  selected_product_ids?: string[];
  limit: number;
  columns_desktop: 2 | 3 | 4;
  columns_mobile: 1 | 2;
  button_text: string;
  button_action: "checkout" | "view_product";
  show_compare_price: boolean;
  show_stock_badge: boolean;
}

export interface CategoriesSectionSettings {
  title: string;
  subtitle?: string;
  categories: {
    id: string;
    name: string;
    image_url?: string;
    item_count_label?: string;
  }[];
  columns_desktop: 2 | 3 | 4;
}

export interface FeatureItem {
  id: string;
  icon_name: "truck" | "shield" | "phone" | "award" | "zap" | "star" | "clock" | "refresh";
  title: string;
  description: string;
}

export interface FeaturesSectionSettings {
  title?: string;
  items: FeatureItem[];
  bg_color?: string;
  card_bg?: string;
  text_color?: string;
}

export interface TextImageSectionSettings {
  title: string;
  subtitle?: string;
  description: string;
  image_url: string;
  image_position: "left" | "right";
  button_text?: string;
  button_link_type?: "products" | "custom";
  button_custom_url?: string;
  bg_color?: string;
}

export interface TestimonialItem {
  id: string;
  author_name: string;
  author_role?: string;
  author_avatar?: string;
  rating: number;
  content: string;
}

export interface TestimonialsSectionSettings {
  title: string;
  subtitle?: string;
  items: TestimonialItem[];
  bg_color?: string;
}

export interface BannerCtaSectionSettings {
  title: string;
  description?: string;
  badge?: string;
  button_text: string;
  button_action: "checkout" | "products";
  bg_color?: string;
  text_color?: string;
  show_countdown?: boolean;
  countdown_hours?: number;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqSectionSettings {
  title: string;
  subtitle?: string;
  items: FaqItem[];
}

export interface FooterCustomSectionSettings {
  business_description?: string;
  show_social_links: boolean;
  facebook_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  whatsapp_number?: string;
  show_payment_badges: boolean;
  copyright_text?: string;
}

export type SectionSettings =
  | HeroSectionSettings
  | ProductsGridSectionSettings
  | CategoriesSectionSettings
  | FeaturesSectionSettings
  | TextImageSectionSettings
  | TestimonialsSectionSettings
  | BannerCtaSectionSettings
  | FaqSectionSettings
  | FooterCustomSectionSettings
  | Record<string, any>;

export interface HomepageSection {
  id: string;
  type: SectionType;
  enabled: boolean;
  settings: SectionSettings;
}

export interface HomepageGlobalStyles {
  primary_color?: string;
  secondary_color?: string;
  bg_color?: string;
  text_color?: string;
  button_radius?: "rounded-md" | "rounded-xl" | "rounded-2xl" | "rounded-full";
}

export interface HomepageConfig {
  enabled: boolean;
  template_slug?: string;
  global_styles: HomepageGlobalStyles;
  sections: HomepageSection[];
  updated_at?: string;
}
