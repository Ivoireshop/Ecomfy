import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon, Video, Globe, Palette, Megaphone, Target, CheckCircle2 } from "lucide-react";

const Services = () => {
  const navigate = useNavigate();

  const services = [
    {
      icon: ImageIcon,
      title: "Création de Visuels Publicitaires",
      description: "Des visuels professionnels pour vos campagnes marketing, optimisés pour tous les réseaux sociaux",
      features: [
        "Design personnalisé à votre marque",
        "Formats adaptés (Instagram, Facebook, LinkedIn)",
        "Révisions illimitées",
        "Livraison sous 48h"
      ],
      color: "text-primary"
    },
    {
      icon: Video,
      title: "Production de Vidéos Marketing",
      description: "Des vidéos captivantes pour présenter vos produits et services de manière professionnelle",
      features: [
        "Animations fluides et modernes",
        "Musique et voix off incluses",
        "Export HD pour toutes plateformes",
        "Montage professionnel"
      ],
      color: "text-secondary"
    },
    {
      icon: Globe,
      title: "Création de Sites Vitrine",
      description: "Un site web professionnel pour présenter votre activité et attirer de nouveaux clients",
      features: [
        "Design responsive et moderne",
        "Formulaire de contact intégré",
        "Optimisation SEO",
        "Domaine personnalisé"
      ],
      color: "text-purple-600"
    },
    {
      icon: Palette,
      title: "Identité Visuelle",
      description: "Création de votre identité de marque complète pour vous démarquer de la concurrence",
      features: [
        "Logo professionnel unique",
        "Charte graphique complète",
        "Palette de couleurs harmonieuse",
        "Guide de style"
      ],
      color: "text-orange-500"
    },
    {
      icon: Megaphone,
      title: "Stratégie Marketing Digital",
      description: "Accompagnement personnalisé pour développer votre présence en ligne efficacement",
      features: [
        "Audit de votre présence actuelle",
        "Plan d'action personnalisé",
        "Suivi et optimisation",
        "Rapports mensuels"
      ],
      color: "text-green-500"
    },
    {
      icon: Target,
      title: "Campagnes Publicitaires",
      description: "Gestion complète de vos campagnes publicitaires sur les réseaux sociaux",
      features: [
        "Ciblage précis de votre audience",
        "Optimisation du budget",
        "Suivi des performances",
        "Amélioration continue"
      ],
      color: "text-blue-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent">
            Nos Services
          </h1>
          <p className="text-xl text-muted-foreground">
            Des solutions complètes pour développer votre présence digitale et booster votre activité
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto mb-20">
          {services.map((service, idx) => (
            <Card key={idx} className="p-8 hover:shadow-xl transition-all hover:scale-105">
              <service.icon className={`w-16 h-16 ${service.color} mb-6`} />
              <h3 className="text-2xl font-bold mb-4">{service.title}</h3>
              <p className="text-muted-foreground mb-6">{service.description}</p>
              
              <ul className="space-y-3 mb-6">
                {service.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle2 className={`w-5 h-5 ${service.color} mr-2 mt-0.5 flex-shrink-0`} />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button className="w-full" onClick={() => navigate("/contact")}>
                Demander un devis
              </Button>
            </Card>
          ))}
        </div>

        {/* Process Section */}
        <div className="max-w-5xl mx-auto mb-20">
          <h2 className="text-4xl font-bold text-center mb-12">Notre Processus</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Consultation", description: "Discussion de vos besoins et objectifs" },
              { step: "2", title: "Proposition", description: "Élaboration d'une solution personnalisée" },
              { step: "3", title: "Réalisation", description: "Création et développement de votre projet" },
              { step: "4", title: "Livraison", description: "Finalisation et accompagnement" }
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="p-12 bg-gradient-to-br from-primary/10 via-purple-500/10 to-secondary/10">
            <h2 className="text-3xl font-bold mb-4">Prêt à démarrer votre projet ?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Contactez-nous pour discuter de vos besoins et obtenir un devis personnalisé
            </p>
            <Button size="lg" onClick={() => navigate("/contact")}>
              Nous contacter
            </Button>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Services;
