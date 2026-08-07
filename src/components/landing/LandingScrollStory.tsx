import { useEffect, useRef, useState } from "react";
import { Store, TrendingUp, Users, Smartphone, ShieldCheck } from "lucide-react";

export function LandingScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const steps = [
    {
      title: "1. Construisez votre marque",
      desc: "Ne soyez plus un vendeur anonyme. Créez une boutique professionnelle avec un nom de domaine personnalisé et une identité forte.",
      icon: Store,
      color: "text-emerald-600 bg-emerald-100",
      image: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    },
    {
      title: "2. Attirez les clients",
      desc: "Générez des visuels et vidéos IA qui stoppent le défilement sur Facebook et TikTok, augmentant votre taux de clic par trois.",
      icon: TrendingUp,
      color: "text-orange-600 bg-orange-100",
      image: "bg-gradient-to-br from-orange-100 to-orange-50",
    },
    {
      title: "3. Convertissez & Encaissez",
      desc: "Offrez le paiement à la livraison (COD) ou intégrez directement Mobile Money pour maximiser vos ventes locales.",
      icon: Smartphone,
      color: "text-blue-600 bg-blue-100",
      image: "bg-gradient-to-br from-blue-100 to-blue-50",
    },
    {
      title: "4. Fidélisez votre audience",
      desc: "Gérez vos commandes d'une main de maître, sécurisez vos livraisons et bâtissez une clientèle fidèle sur le long terme.",
      icon: Users,
      color: "text-purple-600 bg-purple-100",
      image: "bg-gradient-to-br from-purple-100 to-purple-50",
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const { top, height } = containerRef.current.getBoundingClientRect();
      const scrollProgress = -top / (height - window.innerHeight);
      
      if (scrollProgress >= 0 && scrollProgress <= 1) {
        const index = Math.min(
          steps.length - 1,
          Math.floor(scrollProgress * steps.length)
        );
        setActiveIndex(index);
      } else if (scrollProgress < 0) {
        setActiveIndex(0);
      } else if (scrollProgress > 1) {
        setActiveIndex(steps.length - 1);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [steps.length]);

  return (
    <section className="bg-[#0F1B2C] text-white py-24 md:py-0">
      {/* Mobile view (Stack) */}
      <div className="md:hidden container mx-auto px-4 space-y-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">De zéro à l'empire.</h2>
          <p className="text-slate-400">Le parcours exact pour dominer votre marché.</p>
        </div>
        
        {steps.map((step, idx) => (
          <div key={idx} className="space-y-6">
            <div className={`w-full aspect-square rounded-2xl ${step.image} flex items-center justify-center p-8`}>
              {/* Fallback mockup representation */}
              <div className="w-full h-full bg-white/50 backdrop-blur rounded-xl border border-white/20 shadow-xl flex items-center justify-center">
                 <step.icon className={`w-16 h-16 ${step.color.split(' ')[0]}`} />
              </div>
            </div>
            <div>
              <div className={`inline-flex p-3 rounded-xl ${step.color} mb-4`}>
                <step.icon className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
              <p className="text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop view (Sticky scroll) */}
      <div ref={containerRef} className="hidden md:block h-[400vh] relative">
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <div className="container mx-auto px-6 grid grid-cols-2 gap-16 items-center">
            
            {/* Left text */}
            <div className="max-w-xl">
              <h2 className="text-5xl font-extrabold mb-16">De zéro à l'empire.</h2>
              
              <div className="space-y-12">
                {steps.map((step, idx) => (
                  <div 
                    key={idx} 
                    className={`transition-all duration-500 transform ${
                      activeIndex === idx 
                        ? "opacity-100 translate-x-0 scale-100" 
                        : "opacity-30 -translate-x-4 scale-95"
                    }`}
                  >
                    <div className="flex items-start gap-6">
                      <div className={`shrink-0 p-4 rounded-2xl transition-colors duration-500 ${activeIndex === idx ? step.color : 'bg-slate-800 text-slate-500'}`}>
                        <step.icon className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-bold mb-3">{step.title}</h3>
                        <p className={`text-lg transition-colors duration-500 ${activeIndex === idx ? 'text-slate-300' : 'text-slate-600'}`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right visual */}
            <div className="relative h-[600px] w-full rounded-3xl overflow-hidden bg-slate-800 border border-slate-700 shadow-2xl">
              {steps.map((step, idx) => (
                <div 
                  key={idx}
                  className={`absolute inset-0 transition-opacity duration-700 ${step.image} flex items-center justify-center p-12 ${
                    activeIndex === idx ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                >
                  <div className={`w-full h-full bg-white/40 backdrop-blur-md rounded-2xl border border-white/30 shadow-2xl transition-all duration-700 transform flex items-center justify-center ${
                    activeIndex === idx ? "scale-100 translate-y-0" : "scale-95 translate-y-8"
                  }`}>
                     <step.icon className={`w-32 h-32 ${step.color.split(' ')[0]} opacity-80`} />
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
