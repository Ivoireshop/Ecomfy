import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, User, ArrowRight, BookOpen, X } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { supabase } from "@/integrations/supabase/client";

interface ShowcaseBlogProps {
  site: any;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  author_name: string;
  category: string;
  read_time_minutes: number;
  published_at: string | null;
}

export const ShowcaseBlog = ({ site }: ShowcaseBlogProps) => {
  const [articles, setArticles] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : 'hsl(var(--foreground))';
  
  const heroSection = useScrollAnimation({ threshold: 0.1 });
  const articlesGrid = useScrollAnimation({ threshold: 0.2 });
  const newsletterSection = useScrollAnimation({ threshold: 0.3 });

  useEffect(() => {
    loadArticles();
  }, [site.id]);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("showcase_site_id", site.id)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error("Error loading blog posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

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
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Chargement des articles...</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Aucun article publié pour le moment</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles.map((article, index) => (
                  <Card 
                    key={article.id}
                    className={`card-modern group overflow-hidden scroll-scale cursor-pointer ${articlesGrid.isVisible ? 'visible' : ''} delay-${Math.min((index % 3 + 1) * 100, 400)}`}
                    onClick={() => setSelectedArticle(article)}
                  >
                    {/* Image */}
                    {article.image_url && (
                      <div className="relative h-56 overflow-hidden">
                        <img 
                          src={article.image_url}
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
                    )}

                    {/* Content */}
                    <div className="p-6">
                      {/* Meta */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(article.published_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{article.author_name}</span>
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
                      {article.excerpt && (
                        <p className="text-muted-foreground mb-4 line-clamp-3">
                          {article.excerpt}
                        </p>
                      )}

                      {/* Read More */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {article.read_time_minutes} min de lecture
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

              {articles.length >= 6 && (
                <div className="text-center mt-12">
                  <Button size="lg" variant="outline">
                    Voir plus d'articles
                  </Button>
                </div>
              )}
            </>
          )}
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

      {/* Article Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          {selectedArticle && (
            <>
              {/* Header with image */}
              {selectedArticle.image_url && (
                <div className="relative h-64 w-full overflow-hidden rounded-t-lg">
                  <img 
                    src={selectedArticle.image_url}
                    alt={selectedArticle.title}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-4 right-4 bg-white/90 hover:bg-white"
                    onClick={() => setSelectedArticle(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <ScrollArea className="max-h-[calc(90vh-16rem)] p-8">
                {/* Article header */}
                <div className="space-y-4 mb-8">
                  <Badge className="bg-primary text-primary-foreground">
                    {selectedArticle.category}
                  </Badge>
                  
                  <h1 className="text-4xl font-bold" style={{ color: textColor }}>
                    {selectedArticle.title}
                  </h1>
                  
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{selectedArticle.author_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(selectedArticle.published_at)}</span>
                    </div>
                    <span>{selectedArticle.read_time_minutes} min de lecture</span>
                  </div>
                </div>

                {/* Article content */}
                <div className="prose prose-lg max-w-none whitespace-pre-wrap leading-relaxed">
                  {selectedArticle.content}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};