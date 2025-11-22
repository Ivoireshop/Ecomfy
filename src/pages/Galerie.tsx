import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import exampleHandbag from "@/assets/example-handbag-ad.jpg";
import examplePhone from "@/assets/example-phone-ad.jpg";
import exampleFood from "@/assets/example-food-ad.jpg";
import exampleBeauty from "@/assets/example-beauty-ad.jpg";
import exampleFitness from "@/assets/example-fitness-ad.jpg";
import exampleRealestate from "@/assets/example-realestate-ad.jpg";

const Galerie = () => {
  const categories = [
    { name: "Tous", active: true },
    { name: "Mode", active: false },
    { name: "Technologie", active: false },
    { name: "Food", active: false },
    { name: "Beauté", active: false },
    { name: "Sport", active: false },
    { name: "Immobilier", active: false },
  ];

  const projects = [
    {
      image: exampleHandbag,
      title: "Campagne Mode Luxe",
      category: "Mode",
      description: "Publicité pour une marque de sacs à main de luxe"
    },
    {
      image: examplePhone,
      title: "Lancement Smartphone",
      category: "Technologie",
      description: "Campagne de lancement pour un nouveau smartphone"
    },
    {
      image: exampleFood,
      title: "Restaurant Gastronomique",
      category: "Food",
      description: "Visuels pour un restaurant haut de gamme"
    },
    {
      image: exampleBeauty,
      title: "Collection Beauté",
      category: "Beauté",
      description: "Campagne pour une gamme de produits cosmétiques"
    },
    {
      image: exampleFitness,
      title: "Salle de Sport Premium",
      category: "Sport",
      description: "Marketing pour un centre de fitness moderne"
    },
    {
      image: exampleRealestate,
      title: "Promotion Immobilière",
      category: "Immobilier",
      description: "Visuels pour un projet immobilier de prestige"
    },
    {
      image: exampleHandbag,
      title: "Boutique Accessoires",
      category: "Mode",
      description: "Campagne e-commerce pour accessoires de mode"
    },
    {
      image: examplePhone,
      title: "Store Tech",
      category: "Technologie",
      description: "Promotion pour une boutique d'électronique"
    },
    {
      image: exampleFood,
      title: "Chaîne de Restaurants",
      category: "Food",
      description: "Branding complet pour une franchise"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent">
            Notre Galerie
          </h1>
          <p className="text-xl text-muted-foreground">
            Découvrez nos réalisations et laissez-vous inspirer par nos créations
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {categories.map((category, idx) => (
            <Badge 
              key={idx}
              variant={category.active ? "default" : "outline"}
              className="cursor-pointer px-6 py-2 text-sm hover:scale-105 transition-all"
            >
              {category.name}
            </Badge>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {projects.map((project, idx) => (
            <Card 
              key={idx} 
              className="overflow-hidden hover:shadow-xl transition-all hover:scale-105 cursor-pointer group"
            >
              <div className="relative h-80 overflow-hidden">
                <img 
                  src={project.image} 
                  alt={project.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <Badge className="mb-2" variant="secondary">{project.category}</Badge>
                    <h3 className="text-xl font-bold mb-2">{project.title}</h3>
                    <p className="text-sm text-gray-200">{project.description}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <Card className="p-12 bg-gradient-to-br from-primary/10 via-purple-500/10 to-secondary/10">
            <h2 className="text-3xl font-bold mb-4">Votre projet pourrait être ici</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Contactez-nous pour créer des visuels exceptionnels pour votre marque
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Galerie;
