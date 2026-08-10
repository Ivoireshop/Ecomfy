import { useScrollReveal } from "@/hooks/useScrollReveal";
import logo from "@/assets/ecomfy-logo.png";

export function LandingEcosystem() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const integrations = [
    { name: "CinetPay", type: "Paiement" },
    { name: "Stripe", type: "Paiement" },
    { name: "Wave", type: "Mobile Money" },
    { name: "Orange Money", type: "Mobile Money" },
    { name: "WhatsApp", type: "Support & Vente" },
    { name: "Meta Pixel", type: "Marketing" },
    { name: "Google Analytics", type: "Analytics" }
  ];

  return (
    <section id="resources" className="py-24 bg-slate-50 border-t border-slate-100 overflow-hidden">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`max-w-5xl mx-auto text-center transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
            Un écosystème <span className="text-[#0E7C66]">ouvert</span>
          </h2>
          <p className="text-lg text-slate-600 mb-16 max-w-2xl mx-auto">
            Connectez vos outils préférés en un clic. Encaissez vos paiements locaux et internationaux sans configuration technique.
          </p>

          <div className="relative w-full h-96 flex items-center justify-center">
            {/* Center Logo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="w-24 h-24 bg-white rounded-2xl shadow-[0_0_40px_rgba(14,124,102,0.3)] border border-[#0E7C66]/20 flex items-center justify-center p-4">
                <img src={logo} alt="Ecomfy" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Connecting lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50%" cy="50%" r="140" fill="none" stroke="#0E7C66" strokeWidth="1" strokeDasharray="4 4" className="animate-[spin_60s_linear_infinite]" />
              <circle cx="50%" cy="50%" r="220" fill="none" stroke="#0E7C66" strokeWidth="1" strokeDasharray="4 4" className="animate-[spin_90s_linear_infinite_reverse]" />
            </svg>

            {/* Integration Nodes (using CSS positioning for a simple orbit look) */}
            <div className="absolute top-[10%] left-[25%] animate-float">
              <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 font-bold text-blue-600">Wave</div>
            </div>
            
            <div className="absolute top-[20%] right-[20%] animate-float-slow">
              <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 font-bold text-orange-500">Orange Money</div>
            </div>

            <div className="absolute bottom-[20%] left-[15%] animate-float">
              <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 font-bold text-green-500">WhatsApp</div>
            </div>

            <div className="absolute bottom-[10%] right-[25%] animate-float-slow">
              <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 font-bold text-[#635BFF]">Stripe</div>
            </div>

            <div className="absolute top-[50%] left-[10%] -translate-y-1/2 animate-float-slow">
              <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 font-bold text-slate-800">CinetPay</div>
            </div>

            <div className="absolute top-[50%] right-[10%] -translate-y-1/2 animate-float">
              <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 font-bold text-blue-500">Meta Pixel</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
