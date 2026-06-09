import { Button } from "@/components/ui/button";
import { Store, GraduationCap, Image as ImageIcon, Video, Play, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import featureRapide from "@/assets/feature-rapide.jpg";
import founderImage from "@/assets/founder-ulrich-djate.jpg";
import cofounderImage from "@/assets/cofounder-agnissan-regnis.jpg";
import exampleHandbag from "@/assets/example-handbag-ad.jpg";
import examplePhone from "@/assets/example-phone-ad.jpg";
import exampleFood from "@/assets/example-food-ad.jpg";
import videoModelCosmetics from "@/assets/video-model-cosmetics.mp4.asset.json";
import videoModelHandbag from "@/assets/video-model-handbag-v2.mp4.asset.json";
import videoPreview1 from "@/assets/video-preview-1.jpg";
import videoPreview2 from "@/assets/video-preview-2.jpg";
import ecommerceDashboard from "@/assets/ecommerce-dashboard.jpg";
import ecommerceProductPage from "@/assets/ecommerce-product-page.jpg";
import ecommerceShopping from "@/assets/ecommerce-shopping.jpg";
import formationClassroom from "@/assets/formation-classroom.jpg";
import formationOnline from "@/assets/formation-online.jpg";

const useReveal = (threshold = 0.15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold, rootMargin: "0px 0px -60px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
};

interface ServiceSectionProps {
  title: string;
  subtitle: string;
  description: string;
  images: string[];
  videos?: string[];
  icon: React.ElementType;
  gradient: string;
  reversed?: boolean;
  cta: string;
  onClick: () => void;
}

const ServiceSection = ({ title, subtitle, description, images, videos, icon: Icon, gradient, reversed, cta, onClick }: ServiceSectionProps) => {
  const { ref, visible } = useReveal();
  const [mediaIdx, setMediaIdx] = useState(0);
  const isVideo = !!videos;
  const mediaCount = isVideo ? videos.length : images.length;

  useEffect(() => {
    if (isVideo || images.length <= 1) return;
    const iv = setInterval(() => setMediaIdx((p) => (p + 1) % images.length), 2500);
    return () => clearInterval(iv);
  }, [images.length, isVideo]);

  const handleVideoEnded = () => {
    if (videos) setMediaIdx((p) => (p + 1) % videos.length);
  };

  return (
    <div
      ref={ref}
      className={`flex flex-col ${reversed ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-8 md:gap-14 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
    >
      <div className="w-full md:w-1/2 relative">
        <div className={`absolute -inset-4 bg-gradient-to-br ${gradient} rounded-3xl opacity-20 blur-2xl`} />
        <div className="relative h-[260px] md:h-[340px] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
          {isVideo
            ? videos.map((src, i) => (
                <video
                  key={src}
                  src={src}
                  autoPlay={i === mediaIdx}
                  muted
                  playsInline
                  preload="none"
                  poster={images[i]}
                  onEnded={handleVideoEnded}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                    i === mediaIdx ? "opacity-100 scale-100" : "opacity-0 scale-105"
                  }`}
                />
              ))
            : images.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={title}
                  loading="lazy"
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                    i === mediaIdx ? "opacity-100 scale-100" : "opacity-0 scale-105"
                  }`}
                />
              ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {mediaCount > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {Array.from({ length: mediaCount }).map((_, i) => (
                <span key={i} className={`block h-1.5 rounded-full transition-all ${i === mediaIdx ? "w-6 bg-white" : "w-3 bg-white/40"}`} />
              ))}
            </div>
          )}
          {isVideo && (
            <div className="absolute top-3 right-3 bg-black/50 rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <Play className="w-3 h-3 text-white fill-white" />
              <span className="text-white text-xs font-medium">Vidéo</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-1/2 space-y-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${gradient} text-white text-xs font-semibold`}>
          <Icon className="w-3.5 h-3.5" />
          {subtitle}
        </div>
        <h3 className="text-2xl md:text-4xl font-extrabold text-foreground leading-tight">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-base">{description}</p>
        <Button onClick={onClick} className="group mt-2" size="lg">
          {cta}
          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
};

const StatsSection = () => {
  const { ref, visible } = useReveal(0.2);
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`grid grid-cols-3 gap-6 max-w-3xl mx-auto transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {[
            { val: "500+", label: "Utilisateurs actifs" },
            { val: "10k+", label: "Créations générées" },
            { val: "98%", label: "Satisfaction client" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-1">{s.val}</div>
              <div className="text-sm text-muted-foreground font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const LandingMediaSections = ({ session }: { session: unknown }) => {
  const navigate = useNavigate();

  return (
    <>
      <section id="services" className="py-16 md:py-24 space-y-20 md:space-y-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Une plateforme, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">toutes les solutions</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Chaque outil dont vous avez besoin pour lancer et développer votre activité en ligne
            </p>
          </div>

          <div className="space-y-20 md:space-y-32 max-w-6xl mx-auto">
            <ServiceSection
              title="Visuels Publicitaires IA"
              subtitle="Création de visuels"
              description="Générez des images publicitaires professionnelles en quelques secondes grâce à l'intelligence artificielle. Parfait pour vos campagnes marketing sur les réseaux sociaux."
              images={[exampleHandbag, examplePhone, exampleFood]}
              icon={ImageIcon}
              gradient="from-orange-500 to-pink-500"
              cta="Créer un visuel"
              onClick={() => navigate(session ? "/generator" : "/auth")}
            />

            <ServiceSection
              title="Vidéos Animées Pro"
              subtitle="Vidéo & Animation"
              description="Transformez n'importe quel visuel en vidéo captivante avec des animations fluides et des effets professionnels. Idéal pour capturer l'attention sur TikTok, Instagram et Facebook."
              images={[videoPreview1, videoPreview2]}
              videos={[videoModelCosmetics.url, videoModelHandbag.url]}
              icon={Video}
              gradient="from-blue-500 to-cyan-500"
              reversed
              cta="Créer une vidéo"
              onClick={() => navigate(session ? "/video-creator" : "/auth")}
            />

            <ServiceSection
              title="Boutiques E-commerce"
              subtitle="E-commerce"
              description="Vendez vos produits en ligne avec une boutique complète : gestion des stocks, paiements Mobile Money, suivi des commandes et livraisons intégrées."
              images={[ecommerceDashboard, ecommerceProductPage, ecommerceShopping]}
              icon={Store}
              gradient="from-emerald-500 to-teal-500"
              reversed
              cta="Créer une boutique"
              onClick={() => navigate(session ? "/shop-manager" : "/auth")}
            />

            <ServiceSection
              title="Formations en Ligne"
              subtitle="E-learning"
              description="Créez et vendez vos formations avec des modules structurés, un espace étudiant dédié, des certificats automatiques et des liens de paiement intégrés."
              images={[formationClassroom, formationOnline]}
              icon={GraduationCap}
              gradient="from-amber-500 to-yellow-500"
              reversed
              cta="Créer une formation"
              onClick={() => navigate(session ? "/courses-manager" : "/auth")}
            />
          </div>
        </div>
      </section>

      {!session && <StatsSection />}
    </>
  );
};

export const LandingTeamSection = () => (
  <section className="py-16 md:py-24 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Notre équipe</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Des passionnés dévoués à démocratiser la création digitale en Afrique</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center hover:shadow-xl transition-all">
          <img src={founderImage} alt="Ulrich DJATÉ" loading="lazy" className="w-28 h-28 rounded-full mx-auto mb-4 object-cover ring-4 ring-primary/20" />
          <h3 className="text-xl font-bold mb-1">Ulrich DJATÉ</h3>
          <p className="text-primary font-semibold text-sm mb-3">Fondateur, CEO & Architecte</p>
          <p className="text-muted-foreground text-sm mb-4">Expert en IA, développement et vibe coding</p>
          <blockquote className="italic text-xs text-primary border-l-4 border-primary pl-3 py-1 text-left">"L'innovation en Afrique commence par croire en nos propres capacités."</blockquote>
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center hover:shadow-xl transition-all">
          <img src={cofounderImage} alt="Regnis AGNISSAN" loading="lazy" className="w-28 h-28 rounded-full mx-auto mb-4 object-cover ring-4 ring-secondary/20" />
          <h3 className="text-xl font-bold mb-1">Regnis AGNISSAN</h3>
          <p className="text-secondary font-semibold text-sm mb-3">Co-fondateur</p>
          <p className="text-muted-foreground text-sm mb-4">Entrepreneur digital et expert en e-commerce</p>
          <blockquote className="italic text-xs text-secondary border-l-4 border-secondary pl-3 py-1 text-left">"Ensemble, bâtissons l'avenir du commerce en ligne en Afrique."</blockquote>
        </div>
      </div>
    </div>
  </section>
);

export default LandingMediaSections;
