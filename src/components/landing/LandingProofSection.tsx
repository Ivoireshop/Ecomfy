import { Star } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingProofSection({ feedbacks = [] }: { feedbacks?: any[] }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });

  // Use dummy data if none provided (for the preview)
  const displayFeedbacks = feedbacks.length > 0 ? feedbacks : [
    {
      id: 1,
      full_name: "Awa Diallo",
      country: "Sénégal",
      rating: 5,
      comment: "Depuis que j'utilise Ecomfy, je n'ai plus besoin de payer un graphiste. Mes ventes ont explosé grâce aux vidéos IA.",
      photo_url: null,
    },
    {
      id: 2,
      full_name: "Marc Koffi",
      country: "Côte d'Ivoire",
      rating: 5,
      comment: "La boutique a été lancée en moins de 10 minutes avec le paiement Mobile Money déjà intégré. Un gain de temps énorme.",
      photo_url: null,
    },
    {
      id: 3,
      full_name: "Sarah Mensah",
      country: "Bénin",
      rating: 5,
      comment: "Les formations m'ont permis de comprendre comment cibler mes publicités sur Facebook. Le ROI est incroyable.",
      photo_url: null,
    },
    {
      id: 4,
      full_name: "Amadou Bah",
      country: "Guinée",
      rating: 4,
      comment: "Plateforme très intuitive. J'aime particulièrement la génération de fiches produits avec l'IA. C'est magique.",
      photo_url: null,
    }
  ];

  // Duplicate for marquee effect
  const loop = [...displayFeedbacks, ...displayFeedbacks];

  return (
    <section className="py-24 md:py-32 bg-[#FAFAF7] border-y border-slate-200 overflow-hidden">
      <div className="container mx-auto px-4 mb-16 text-center" ref={ref}>
        <div className={`transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1B2C] mb-4">
            Rejoint par <span className="text-[#0E7C66]">+10 000 entrepreneurs</span>
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Découvrez comment Ecomfy transforme le quotidien et le chiffre d'affaires des e-commerçants à travers l'Afrique.
          </p>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Gradients for fade effect */}
        <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-[#FAFAF7] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-[#FAFAF7] to-transparent z-10 pointer-events-none" />
        
        <div className="overflow-hidden group py-4">
          <div className="flex animate-marquee group-hover:[animation-play-state:paused]">
            {loop.map((f, i) => (
              <article
                key={`${f.id}-${i}`}
                className="shrink-0 w-[300px] md:w-[380px] mx-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="flex items-center gap-4 mb-4">
                  {f.photo_url ? (
                    <img
                      src={f.photo_url}
                      alt={f.full_name}
                      loading="lazy"
                      className="w-14 h-14 rounded-full object-cover ring-4 ring-slate-50"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0F1B2C] to-slate-700 flex items-center justify-center text-lg font-bold text-white ring-4 ring-slate-50">
                      {(f.full_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-[#0F1B2C] truncate">{f.full_name}</div>
                    {f.country && <div className="text-xs text-slate-500 font-medium truncate">{f.country}</div>}
                    <div className="flex items-center gap-0.5 mt-1">
                      {[...Array(5)].map((_, k) => (
                        <Star key={k} className={`w-3.5 h-3.5 ${k < (f.rating || 0) ? "text-[#F7C04A] fill-[#F7C04A]" : "text-slate-200"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-slate-700 leading-relaxed italic text-sm md:text-base">
                  "{f.comment}"
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
