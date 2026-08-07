import { ArrowRight, Image as ImageIcon, Video, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useNavigate } from "react-router-dom";
import bentoAds from "@/assets/bento-ads.jpg";
import bentoVideo from "@/assets/bento-video.jpg";

export function LandingMediaSection() {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  return (
    <section className="py-24 md:py-32 bg-white overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div 
          ref={ref}
          className={`transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1B2C] mb-6 leading-tight tracking-tight">
              Des visuels qui <span className="text-[#0E7C66]">arrêtent le scroll.</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Ne dépensez plus des fortunes en agences. Notre IA génère des images publicitaires et des vidéos animées ultra-convertissantes en un clic.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
            {/* Image Generator Card */}
            <div className="group rounded-[2rem] bg-slate-50 p-6 md:p-10 border border-slate-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-6">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[#0F1B2C] mb-3">Générateur de Visuels</h3>
              <p className="text-slate-600 mb-8 h-12">
                Transformez une simple photo produit en une affiche publicitaire professionnelle.
              </p>
              
              <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200 mb-8 aspect-[4/3]">
                <img 
                  src={bentoAds} 
                  alt="Générateur de visuels" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" /> IA générative
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                className="w-full justify-between hover:bg-white bg-white/50 border border-slate-200 text-[#0F1B2C] font-semibold rounded-xl h-12"
                onClick={() => navigate("/generator")}
              >
                Découvrir le générateur
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Video Generator Card */}
            <div className="group rounded-[2rem] bg-slate-50 p-6 md:p-10 border border-slate-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6">
                <Video className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[#0F1B2C] mb-3">Vidéos Animées</h3>
              <p className="text-slate-600 mb-8 h-12">
                Donnez vie à vos produits. Des vidéos captivantes parfaites pour TikTok, Reels et Facebook Ads.
              </p>
              
              <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200 mb-8 aspect-[4/3]">
                <img 
                  src={bentoVideo} 
                  alt="Générateur de vidéos" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                    <div className="w-0 h-0 border-t-8 border-t-transparent border-l-[14px] border-l-blue-600 border-b-8 border-b-transparent ml-1"></div>
                  </div>
                </div>
              </div>

              <Button 
                variant="ghost" 
                className="w-full justify-between hover:bg-white bg-white/50 border border-slate-200 text-[#0F1B2C] font-semibold rounded-xl h-12"
                onClick={() => navigate("/video-creator")}
              >
                Explorer la vidéo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
