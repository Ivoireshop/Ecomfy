import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ArrowRight, BookOpen } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface ShowcaseBlogProps {
  site: any;
}

export const ShowcaseBlog = ({ site }: ShowcaseBlogProps) => {
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : 'hsl(var(--foreground))';
  
  const heroSection = useScrollAnimation({ threshold: 0.1 });
  const articlesGrid = useScrollAnimation({ threshold: 0.2 });
  const newsletterSection = useScrollAnimation({ threshold: 0.3 });

  // Articles d'exemple - à remplacer par de vraies données
  const articles = [
    {
      id: 1,
      title: "Comment réussir votre transformation digitale",
      excerpt: "Découvrez les clés pour mener à bien votre projet de transformation digitale et propulser votre entreprise vers le succès.",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
      author: site.owner_name,
      date: "15 Mars 2024",
      category: "Digital",
      readTime: "5 min"
    },
    {
      id: 2,
      title: "Les tendances du marketing digital en 2024",
      excerpt: "Explorez les dernières tendances qui façonnent le paysage du marketing digital cette année.",
      image: "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800",
      author: site.owner_name,
      date: "10 Mars 2024",
      category: "Marketing",
      readTime: "7 min"
    },
    {
      id: 3,
      title: "L'importance de la formation continue",
      excerpt: "Pourquoi investir dans la formation continue est essentiel pour rester compétitif sur le marché.",
      image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
      author: site.owner_name,
      date: "5 Mars 2024",
      category: "Formation",
      readTime: "6 min"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section ref={heroSection.ref} className="section-spacing px-4 bg-muted/30">
        <div className={`container mx-auto max-w-4xl text-center scroll-fade-up ${heroSection.isVisible ? 'visible' : ''}`}>
          <Badge className="mb-6" variant="outline">
            <BookOpen className="h-4 w-4 mr-2" />
            Notre Blog
          </Badge>
          <h1 className="heading-xl mb-6 text-balance" style={{ color: textColor }}>
            Actualités & Conseils
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Découvrez nos derniers articles, conseils et insights pour vous accompagner dans votre réussite
          </p>
        </div>
      </section>

      {/* Articles Grid */}
      <section ref={articlesGrid.ref} className="section-spacing px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article, index) => (
              <Card 
                key={article.id}
                className={`card-modern group overflow-hidden scroll-scale ${articlesGrid.isVisible ? 'visible' : ''} delay-${Math.min((index % 3 + 1) * 100, 400)}`}
              >
                {/* Image */}
                <div className="relative h-56 overflow-hidden">
                  <img 
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge 
                      className="bg-primary text-primary-foreground"
                    >
                      {article.category}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Meta */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{article.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{article.author}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 
                    className="text-xl font-bold mb-3 group-hover:text-primary transition-colors"
                    style={{ color: textColor }}
                  >
                    {article.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-muted-foreground mb-4 line-clamp-3">
                    {article.excerpt}
                  </p>

                  {/* Read More */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {article.readTime} de lecture
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="group/btn"
                    >
                      Lire la suite
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-12">
            <Button size="lg" variant="outline">
              Voir plus d'articles
            </Button>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section ref={newsletterSection.ref} className="pb-24 px-4">
        <div 
          className={`container mx-auto max-w-4xl rounded-3xl p-12 md:p-16 text-center scroll-scale ${newsletterSection.isVisible ? 'visible' : ''}`}
          style={{ 
            background: `linear-gradient(135deg, ${site.primary_color || 'hsl(var(--primary))'}, ${site.secondary_color || 'hsl(var(--secondary))'})` 
          }}
        >
          <h2 className="heading-lg text-white mb-6">
            Restez informé
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Inscrivez-vous à notre newsletter pour recevoir nos derniers articles et conseils
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Votre adresse email"
              className="flex-1 px-6 py-4 rounded-full text-foreground"
            />
            <Button 
              size="lg"
              className="bg-white text-primary hover:bg-white/90 font-semibold px-8 rounded-full shadow-xl"
            >
              S'inscrire
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
