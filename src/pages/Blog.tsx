import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, ArrowRight, Sparkles, TrendingUp, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";

const Blog = () => {
  const articles = [
    {
      id: 1,
      title: "Comment l'IA révolutionne la création de contenu publicitaire en Afrique",
      excerpt: "Découvrez comment les entreprises africaines utilisent l'intelligence artificielle pour créer des campagnes publicitaires percutantes et adaptées à leur marché local.",
      date: "15 Mars 2024",
      category: "IA & Innovation",
      icon: Sparkles,
      readTime: "5 min",
    },
    {
      id: 2,
      title: "Guide complet : Créer des visuels qui convertissent",
      excerpt: "Les 10 principes essentiels pour créer des visuels publicitaires qui captent l'attention et génèrent des conversions. Exemples concrets et cas d'usage.",
      date: "10 Mars 2024",
      category: "Tutoriels",
      icon: Lightbulb,
      readTime: "8 min",
    },
    {
      id: 3,
      title: "VisualPro : L'histoire de notre mission",
      excerpt: "Comment deux entrepreneurs ivoiriens ont décidé de démocratiser la création visuelle professionnelle en Afrique grâce à l'intelligence artificielle.",
      date: "5 Mars 2024",
      category: "Entreprise",
      icon: TrendingUp,
      readTime: "6 min",
    },
    {
      id: 4,
      title: "Les tendances du marketing digital en Afrique pour 2024",
      excerpt: "Analyse des tendances émergentes du marketing digital sur le continent africain et comment les anticiper pour rester compétitif.",
      date: "1 Mars 2024",
      category: "Marketing",
      icon: TrendingUp,
      readTime: "7 min",
    },
    {
      id: 5,
      title: "Optimiser vos campagnes publicitaires sur les réseaux sociaux",
      excerpt: "Stratégies éprouvées pour maximiser l'impact de vos publicités sur Facebook, Instagram, LinkedIn et Twitter avec des visuels adaptés.",
      date: "25 Février 2024",
      category: "Tutoriels",
      icon: Lightbulb,
      readTime: "10 min",
    },
    {
      id: 6,
      title: "L'avenir de la création de contenu vidéo avec l'IA",
      excerpt: "Comment l'intelligence artificielle transforme la production vidéo et rend la création de contenu vidéo professionnel accessible à tous.",
      date: "20 Février 2024",
      category: "IA & Innovation",
      icon: Sparkles,
      readTime: "6 min",
    },
  ];

  const categories = ["Tous", "IA & Innovation", "Tutoriels", "Marketing", "Entreprise"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="text-center mb-12">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Blog & Ressources VisualPro
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Guides, tutoriels, cas d'usage et actualités pour maîtriser la création visuelle avec l'IA
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <Button
              key={category}
              variant={category === "Tous" ? "default" : "outline"}
              size="sm"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Featured Article */}
        <Card className="mb-12 overflow-hidden hover:shadow-xl transition-all">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-12">
              <Sparkles className="w-32 h-32 text-primary" />
            </div>
            <div className="p-8 flex flex-col justify-center">
              <span className="text-primary font-semibold text-sm mb-2">Article vedette</span>
              <h2 className="text-3xl font-bold mb-4">
                {articles[0].title}
              </h2>
              <p className="text-muted-foreground mb-6">
                {articles[0].excerpt}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {articles[0].date}
                </div>
                <span>•</span>
                <span>{articles[0].readTime} de lecture</span>
              </div>
              <Button className="w-fit">
                Lire l'article
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Articles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.slice(1).map((article) => {
            const Icon = article.icon;
            return (
              <Card key={article.id} className="p-6 hover:shadow-xl transition-all cursor-pointer group">
                <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-semibold text-primary mb-2 block">
                  {article.category}
                </span>
                <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {article.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {article.date}
                  </div>
                  <span>{article.readTime}</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Newsletter Section */}
        <Card className="mt-16 p-8 bg-gradient-to-br from-primary/10 to-secondary/10 text-center">
          <h2 className="text-3xl font-bold mb-4">Restez informé</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Recevez nos derniers articles, tutoriels et conseils directement dans votre boîte mail. 
            Une newsletter par mois, zéro spam.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Votre adresse email"
              className="flex-1 px-4 py-2 rounded-lg border border-border bg-background"
            />
            <Button>S'abonner</Button>
          </div>
        </Card>

        {/* Resources Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <Card className="p-6 text-center hover:shadow-xl transition-all">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Documentation</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Guides complets pour utiliser toutes les fonctionnalités
            </p>
            <Link to="/tutorial">
              <Button variant="outline" size="sm">
                Voir la documentation
              </Button>
            </Link>
          </Card>

          <Card className="p-6 text-center hover:shadow-xl transition-all">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Tutoriels vidéo</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Apprenez en regardant nos tutoriels pas à pas
            </p>
            <Button variant="outline" size="sm">
              Voir les vidéos
            </Button>
          </Card>

          <Card className="p-6 text-center hover:shadow-xl transition-all">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Cas d'usage</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Découvrez comment nos clients utilisent VisualPro
            </p>
            <Button variant="outline" size="sm">
              Lire les cas d'usage
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Blog;
