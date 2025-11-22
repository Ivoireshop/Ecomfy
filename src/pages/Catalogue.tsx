import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

const Catalogue = () => {
  const navigate = useNavigate();

  const courses = [
    {
      id: 1,
      title: "Formation Marketing Digital",
      description: "Maîtrisez les stratégies de marketing digital pour développer votre activité en ligne",
      price: "49 000 FCFA",
      duration: "8 semaines",
      level: "Débutant",
      modules: 12,
    },
    {
      id: 2,
      title: "Création de Contenu Visuel",
      description: "Apprenez à créer des visuels professionnels pour vos réseaux sociaux et campagnes",
      price: "39 000 FCFA",
      duration: "6 semaines",
      level: "Débutant",
      modules: 10,
    },
    {
      id: 3,
      title: "Stratégie de Communication",
      description: "Développez une stratégie de communication efficace pour votre entreprise",
      price: "59 000 FCFA",
      duration: "10 semaines",
      level: "Intermédiaire",
      modules: 15,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent">
            Catalogue de Formations
          </h1>
          <p className="text-xl text-muted-foreground mb-12">
            Découvrez nos formations professionnelles pour développer vos compétences digitales
          </p>
        </div>

        {/* Formations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {courses.map((course) => (
            <Card key={course.id} className="p-6 hover:shadow-xl transition-all hover:scale-105">
              <div className="mb-4">
                <span className="inline-block px-3 py-1 text-sm bg-primary/10 text-primary rounded-full mb-4">
                  {course.level}
                </span>
                <h3 className="text-2xl font-bold mb-3">{course.title}</h3>
                <p className="text-muted-foreground mb-4">{course.description}</p>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary mr-2" />
                  <span>{course.duration}</span>
                </div>
                <div className="flex items-center text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary mr-2" />
                  <span>{course.modules} modules</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold text-primary">{course.price}</span>
                </div>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  S'inscrire
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <Card className="p-12 bg-gradient-to-br from-primary/10 via-purple-500/10 to-secondary/10">
            <h2 className="text-3xl font-bold mb-4">Prêt à commencer votre formation ?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Rejoignez des centaines d'apprenants qui développent leurs compétences avec VisualPro
            </p>
            <Button size="lg" onClick={() => navigate("/auth")}>
              Voir toutes les formations
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Catalogue;
