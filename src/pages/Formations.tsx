import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { BookOpen, Users, Award, Clock, CheckCircle2 } from "lucide-react";

const Formations = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent">
            Nos Formations Professionnelles
          </h1>
          <p className="text-xl text-muted-foreground mb-12">
            Développez vos compétences digitales avec des formations pratiques et certifiantes
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto mb-20">
          <Card className="p-6 text-center">
            <Users className="w-12 h-12 text-primary mx-auto mb-4" />
            <div className="text-3xl font-bold mb-2">500+</div>
            <div className="text-muted-foreground">Étudiants formés</div>
          </Card>
          <Card className="p-6 text-center">
            <BookOpen className="w-12 h-12 text-secondary mx-auto mb-4" />
            <div className="text-3xl font-bold mb-2">15+</div>
            <div className="text-muted-foreground">Formations disponibles</div>
          </Card>
          <Card className="p-6 text-center">
            <Award className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <div className="text-3xl font-bold mb-2">100%</div>
            <div className="text-muted-foreground">Certification incluse</div>
          </Card>
          <Card className="p-6 text-center">
            <Clock className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <div className="text-3xl font-bold mb-2">24/7</div>
            <div className="text-muted-foreground">Accès illimité</div>
          </Card>
        </div>

        {/* Pourquoi nos formations */}
        <div className="max-w-5xl mx-auto mb-20">
          <h2 className="text-4xl font-bold text-center mb-12">Pourquoi choisir nos formations ?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8">
              <CheckCircle2 className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-4">Contenu Pratique</h3>
              <p className="text-muted-foreground">
                Des formations conçues par des professionnels avec des cas pratiques tirés du monde réel
              </p>
            </Card>
            <Card className="p-8">
              <CheckCircle2 className="w-12 h-12 text-secondary mb-4" />
              <h3 className="text-2xl font-bold mb-4">Accompagnement</h3>
              <p className="text-muted-foreground">
                Support personnalisé via WhatsApp et sessions de Q&A hebdomadaires
              </p>
            </Card>
            <Card className="p-8">
              <CheckCircle2 className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Certification</h3>
              <p className="text-muted-foreground">
                Obtenez un certificat reconnu à la fin de chaque formation
              </p>
            </Card>
            <Card className="p-8">
              <CheckCircle2 className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Flexible</h3>
              <p className="text-muted-foreground">
                Apprenez à votre rythme avec un accès illimité au contenu
              </p>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="p-12 bg-gradient-to-br from-primary/10 via-purple-500/10 to-secondary/10">
            <h2 className="text-3xl font-bold mb-4">Commencez votre formation dès aujourd'hui</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Investissez dans vos compétences et boostez votre carrière
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/catalogue")}>
                Voir le catalogue
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/contact")}>
                Nous contacter
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Formations;
