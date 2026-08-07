import { useScrollReveal } from "@/hooks/useScrollReveal";
import bentoFormation from "@/assets/bento-formation.jpg";
import bentoCommunity from "@/assets/bento-community.jpg";
import bentoAds from "@/assets/bento-ads.jpg";

export function LandingGallery() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });

  const items = [
    {
      title: "Des formations de haut niveau",
      desc: "Apprenez avec les meilleurs experts africains. Stratégie, marketing, opérations.",
      img: bentoFormation,
      color: "bg-amber-100",
    },
    {
      title: "Une communauté active",
      desc: "Ne soyez plus jamais seul face à vos défis. Échangez et progressez ensemble.",
      img: bentoCommunity,
      color: "bg-blue-100",
    },
    {
      title: "Publicités performantes",
      desc: "Des créatifs publicitaires générés par l'IA qui convertissent vos visiteurs en acheteurs.",
      img: bentoAds,
      color: "bg-emerald-100",
    }
  ];

  return (
    <section className="py-24 bg-white overflow-hidden" id="gallery">
      <div className="container mx-auto px-4 md:px-6 mb-12">
        <div ref={ref} className={`transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1B2C] mb-4">
            Un écosystème <span className="text-[#F7C04A]">complet.</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl">
            Tout ce dont vous avez besoin pour réussir, réuni sur une seule et même plateforme.
          </p>
        </div>
      </div>

      {/* Horizontal scrolling gallery wrapper */}
      <div className="flex overflow-x-auto pb-12 pt-4 px-4 md:px-6 snap-x snap-mandatory hide-scrollbar gap-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {items.map((item, idx) => (
          <div 
            key={idx} 
            className="snap-center shrink-0 w-[85vw] md:w-[600px] h-[400px] rounded-[2rem] overflow-hidden relative group cursor-pointer border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500"
          >
            <img 
              src={item.img} 
              alt={item.title} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1B2C]/90 via-[#0F1B2C]/40 to-transparent"></div>
            
            <div className="absolute bottom-0 left-0 w-full p-8 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
              <div className={`w-12 h-2 ${item.color} rounded-full mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100`}></div>
              <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
              <p className="text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 max-w-md">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
        {/* Spacer for right edge */}
        <div className="shrink-0 w-4 md:w-12"></div>
      </div>
    </section>
  );
}
