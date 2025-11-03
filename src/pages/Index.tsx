import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles, Zap, Globe, Palette } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Intelligence Artificielle Africaine</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            VisualPro
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
            Créez des visuels publicitaires professionnels adaptés au marché africain en moins d'une minute
          </p>
          
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
            onClick={() => navigate("/generator")}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer mon premier visuel
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Rapide et Simple</h3>
            <p className="text-muted-foreground">
              Obtenez votre visuel professionnel en moins d'une minute, sans compétences en design
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-secondary/10 rounded-full flex items-center justify-center">
              <Globe className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Adapté à l'Afrique</h3>
            <p className="text-muted-foreground">
              Des visuels qui reflètent la diversité et la richesse culturelle du marché africain
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <Palette className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">IA Intelligente</h3>
            <p className="text-muted-foreground">
              Notre IA génère automatiquement le visuel et le texte publicitaire parfaits pour votre produit
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-12 border">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à transformer votre marketing ?
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Rejoignez les entrepreneurs africains qui créent déjà leurs visuels avec VisualPro
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-6"
            onClick={() => navigate("/generator")}
          >
            Commencer gratuitement
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
