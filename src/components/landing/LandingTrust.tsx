import { ShieldCheck } from "lucide-react";

export function LandingTrust() {
  const brands = [
    "AFRICA STORE", "BEAUTY CI", "TECH SHOP", "FASHION ABJ", "E-MARKET", 
    "COSMETICA", "AFRO DIGITAL", "SMART GADGETS"
  ];

  return (
    <section className="py-12 bg-white border-b border-slate-100 overflow-hidden">
      <div className="container mx-auto px-4 mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-[#0E7C66]" />
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
            Ils nous font confiance
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">
          Plus de 500 entrepreneurs génèrent des ventes chaque jour avec Ecomfy.
        </h2>
      </div>

      <div className="relative w-full flex items-center h-20">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
        
        {/* Scrolling content */}
        <div className="flex animate-scroll whitespace-nowrap gap-16 items-center w-max">
          {[...brands, ...brands].map((brand, index) => (
            <div 
              key={index} 
              className="text-2xl font-black text-slate-300 uppercase tracking-widest px-8"
            >
              {brand}
            </div>
          ))}
        </div>

        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
      </div>
    </section>
  );
}
