import { Star, Quote } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingTestimonials() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const testimonials = [
    {
      name: "Mariam Doumbia",
      role: "Fondatrice, Beauty Cosmétiques",
      content: "Je n'y connais rien en code, mais j'ai pu lancer ma boutique en ligne en une soirée. L'intégration de Wave et Orange Money est un game changer pour mes ventes à Abidjan.",
      rating: 5,
      image: "https://images.unsplash.com/photo-1531123897727-8f129e1bf98c?auto=format&fit=crop&q=80&w=200&h=200"
    },
    {
      name: "Marc Leroy",
      role: "Gérant, Tech Store",
      content: "L'assistant IA d'Ecomfy m'a fait gagner un temps fou sur la rédaction de mes fiches produits. Mes ventes ont augmenté de 40% le premier mois.",
      rating: 5,
      image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200&h=200"
    },
    {
      name: "Sarah Koné",
      role: "Créatrice de Mode",
      content: "Avant je bricolais avec WhatsApp et un fichier Excel. Aujourd'hui, tout est centralisé. Je suis notifiée à chaque commande et mes clients trouvent ça très pro.",
      rating: 5,
      image: "https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&q=80&w=200&h=200"
    }
  ];

  return (
    <section className="py-24 bg-slate-50 border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
              Ne nous croyez pas <br />
              <span className="text-[#0E7C66]">sur parole</span>.
            </h2>
            <p className="text-lg text-slate-600">
              Découvrez ce que les entrepreneurs qui utilisent Ecomfy tous les jours en pensent.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative"
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <Quote className="absolute top-8 right-8 w-10 h-10 text-slate-100" />
                <div className="flex gap-1 mb-6 text-amber-400">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed mb-8 relative z-10">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100">
                    <img src={testimonial.image} alt={testimonial.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
