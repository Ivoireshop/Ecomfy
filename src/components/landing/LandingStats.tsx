import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingStats() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const stats = [
    { value: "500+", label: "Boutiques actives" },
    { value: "1.2M+", label: "De chiffre d'affaires généré" },
    { value: "98%", label: "De clients satisfaits" },
    { value: "24/7", label: "Support réactif" },
  ];

  return (
    <section className="py-24 bg-[#0F1B2C] text-white overflow-hidden relative">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-[#0E7C66] rounded-full filter blur-[150px] opacity-30 -translate-y-1/2"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div 
          ref={ref}
          className={`transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="flex flex-col items-center justify-center p-6"
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="text-4xl md:text-5xl font-black mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm md:text-base text-slate-400 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
