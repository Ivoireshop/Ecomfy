import { Wand2, Image as ImageIcon, Video, FileText } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingPillarAI() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const features = [
    {
      icon: <FileText className="w-5 h-5 text-purple-500" />,
      title: "Descriptions persuasives",
      description: "L'IA rédige des fiches produits optimisées SEO qui poussent à l'achat."
    },
    {
      icon: <ImageIcon className="w-5 h-5 text-purple-500" />,
      title: "Studio Photo virtuel",
      description: "Détourez et générez des décors premium pour vos produits."
    },
    {
      icon: <Video className="w-5 h-5 text-purple-500" />,
      title: "Vidéos publicitaires",
      description: "Transformez une simple image en vidéo pour vos campagnes TikTok et Facebook."
    }
  ];

  return (
    <section id="ai" className="py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`flex flex-col lg:flex-row items-center gap-16 transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Texte et Features */}
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-sm font-semibold">
              <Wand2 className="w-4 h-4" />
              <span>3. GÉNÉRER</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
              Votre studio créatif <br />
              <span className="text-purple-600">propulsé par l'IA</span>.
            </h2>
            
            <p className="text-lg text-slate-600">
              Décrivez ce que vous voulez, l'IA génère vos fiches produits, visuels et vidéos publicitaires en quelques secondes. Plus besoin d'agence de communication.
            </p>

            <div className="space-y-6 pt-4">
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="mt-1 w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{feature.title}</h3>
                    <p className="text-slate-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Composite */}
          <div className="flex-1 relative w-full h-[500px]">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-100 rounded-full filter blur-3xl opacity-50"></div>
            
            {/* Main Window (AI Studio Mockup) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0F1B2C] rounded-2xl shadow-2xl border border-slate-800 overflow-hidden z-10 animate-float-slow">
              
              {/* Header */}
              <div className="border-b border-white/10 p-4 flex items-center gap-3">
                <Wand2 className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">Assistant Ecomfy IA</span>
              </div>
              
              {/* Chat Area */}
              <div className="p-4 space-y-4">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-purple-600/20 text-purple-100 border border-purple-500/30 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%] text-sm">
                    Génère un avatar vidéo qui présente ma nouvelle collection.
                  </div>
                </div>
                
                {/* AI Response Generating */}
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4 w-full max-w-[90%]">
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 className="w-4 h-4 text-purple-400 animate-pulse" />
                      <span className="text-slate-300 text-xs font-medium uppercase tracking-wider">Vidéo générée</span>
                    </div>
                    
                    {/* Video with Scan Effect overlay */}
                    <div className="w-full h-40 bg-slate-800/50 rounded-lg relative overflow-hidden flex items-center justify-center">
                      <video 
                        className="w-full h-full object-cover" 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        poster="/src/assets/video-preview-1.jpg"
                      >
                        <source src="https://assets.mixkit.co/videos/preview/mixkit-woman-speaking-in-front-of-the-camera-42998-large.mp4" type="video/mp4" />
                        <source src="https://cdn.coverr.co/videos/coverr-a-woman-talking-on-her-phone-while-looking-at-her-laptop-2815/1080p.mp4" type="video/mp4" />
                        <img src="/src/assets/video-preview-1.jpg" alt="Video fallback" className="w-full h-full object-cover" />
                      </video>
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/20 to-transparent h-[200%] animate-scan pointer-events-none"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Widget 1: Video Gen */}
            <div className="absolute -left-4 bottom-1/4 bg-[#0a0f18] p-3 rounded-xl shadow-xl border border-slate-800 z-20 flex items-center gap-3 animate-float text-white">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Video className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold">Vidéo publicitaire</p>
                <p className="text-xs text-slate-400">Format TikTok (9:16)</p>
              </div>
            </div>

            {/* Floating Widget 2: Copywriting */}
            <div className="absolute -right-8 top-1/4 bg-[#0a0f18] p-4 rounded-xl shadow-xl border border-slate-800 z-20 w-48 animate-float text-white">
              <div className="flex gap-2 items-center mb-2">
                <FileText className="w-4 h-4 text-green-400" />
                <p className="text-xs font-bold">Titre Accrocheur</p>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-slate-700 rounded w-full"></div>
                <div className="h-2 bg-slate-700 rounded w-4/5"></div>
                <div className="h-2 bg-slate-700 rounded w-2/3"></div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </section>
  );
}
