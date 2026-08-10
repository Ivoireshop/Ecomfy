import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingFaq() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const faqs = [
    {
      question: "Ai-je besoin de compétences en code pour utiliser Ecomfy ?",
      answer: "Absolument pas. Ecomfy a été conçu spécifiquement pour être simple et intuitif. Si vous savez utiliser un smartphone, vous savez créer une boutique Ecomfy. De plus, notre assistant IA peut configurer la boutique pour vous en répondant à quelques questions."
    },
    {
      question: "Puis-je lier mon propre nom de domaine ?",
      answer: "Oui ! Tous nos forfaits incluent la possibilité de lier votre propre nom de domaine personnalisé (ex: maboutique.com) pour une image 100% professionnelle. Sinon, nous vous fournissons un sous-domaine gratuit (ex: maboutique.ecomfy.cloud)."
    },
    {
      question: "Comment puis-je recevoir mes paiements ?",
      answer: "Nous intégrons nativement les moyens de paiement locaux via CinetPay (Wave, Orange Money, MTN, Moov) et internationaux via Stripe (Visa, Mastercard, Apple Pay). L'argent va directement sur votre compte, Ecomfy ne prend aucune commission sur vos ventes."
    },
    {
      question: "Puis-je gérer Ecomfy depuis mon téléphone ?",
      answer: "Oui, la plateforme est entièrement responsive. Vous pouvez créer votre boutique, ajouter des produits, et gérer vos commandes directement depuis votre téléphone portable."
    },
    {
      question: "Y a-t-il des frais cachés ou des commissions sur les ventes ?",
      answer: "Non. Vous payez uniquement votre abonnement mensuel ou annuel. Nous ne prenons absolument aucune commission sur vos ventes. L'intégralité de votre chiffre d'affaires vous revient."
    }
  ];

  return (
    <section className="py-24 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`max-w-3xl mx-auto transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Questions fréquentes
            </h2>
            <p className="text-slate-600">
              Tout ce que vous devez savoir sur Ecomfy.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full bg-slate-50 p-6 rounded-2xl border border-slate-100">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-slate-200 last:border-0">
                <AccordionTrigger className="text-left font-semibold text-slate-900 hover:text-[#0E7C66] text-lg py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 text-base leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
