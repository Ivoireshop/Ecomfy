import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Filter, SlidersHorizontal } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ShowcaseServicesProps {
  site: any;
  onContactClick: () => void;
}

export const ShowcaseServices = ({ site, onContactClick }: ShowcaseServicesProps) => {
  const features = site.features || [];
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : (site.text_color || 'hsl(var(--foreground))');
  
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const heroSection = useScrollAnimation({ threshold: 0.1 });
  const servicesGrid = useScrollAnimation({ threshold: 0.2 });
  const ctaSection = useScrollAnimation({ threshold: 0.3 });
  
  // Extract unique categories from features
  const categories = useMemo(() => {
    const cats = new Set<string>();
    features.forEach((feature: any) => {
      if (feature.category) {
        cats.add(feature.category);
      }
    });
    return Array.from(cats);
  }, [features]);
  
  // Filter and sort services
  const filteredAndSortedServices = useMemo(() => {
    let services = [...features];
    
    // Filter by category
    if (selectedCategory !== "all") {
      services = services.filter((service: any) => service.category === selectedCategory);
    }
    
    // Sort services
    switch (sortBy) {
      case "price-asc":
        services.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
        break;
      case "price-desc":
        services.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
        break;
      case "popularity":
        services.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
        break;
      case "name":
        services.sort((a: any, b: any) => a.title.localeCompare(b.title));
        break;
      default:
        // Keep default order
        break;
    }
    
    return services;
  }, [features, selectedCategory, sortBy]);

  if (!features || features.length === 0) {
    return (
      <div className="min-h-screen py-20 px-4">
        <div className="container mx-auto text-center space-y-4">
          <h2 className="text-2xl font-bold" style={{ color: textColor }}>Nos Services</h2>
          <p className="text-muted-foreground">Aucun service disponible pour le moment.</p>
          <p className="text-sm text-muted-foreground">Veuillez configurer vos services dans l'éditeur.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section ref={heroSection.ref} className="section-spacing px-4">
        <div className={`container mx-auto max-w-4xl text-center scroll-fade-up ${heroSection.isVisible ? 'visible' : ''}`}>
          <Badge className="mb-4 lg:mb-6" variant="outline">
            Nos Services
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 lg:mb-6" style={{ color: textColor }}>
            Des solutions professionnelles adaptées à vos besoins
          </h1>
          <p className="text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            Découvrez nos services conçus pour vous accompagner vers l'excellence
          </p>
        </div>
      </section>

      {/* Filter and Sort Section */}
      <section className="pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>{filteredAndSortedServices.length} service{filteredAndSortedServices.length > 1 ? 's' : ''} trouvé{filteredAndSortedServices.length > 1 ? 's' : ''}</span>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              {/* Category Filter - Desktop */}
              <div className="hidden md:block flex-1 md:flex-initial md:min-w-[200px]">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By - Desktop */}
              <div className="hidden md:block flex-1 md:flex-initial md:min-w-[200px]">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Trier par" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Par défaut</SelectItem>
                    <SelectItem value="name">Nom (A-Z)</SelectItem>
                    <SelectItem value="price-asc">Prix croissant</SelectItem>
                    <SelectItem value="price-desc">Prix décroissant</SelectItem>
                    <SelectItem value="popularity">Popularité</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mobile Filter Button */}
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="md:hidden w-full">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filtrer et trier
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[400px]">
                  <SheetHeader>
                    <SheetTitle>Filtres et tri</SheetTitle>
                    <SheetDescription>
                      Affinez votre recherche de services
                    </SheetDescription>
                  </SheetHeader>
                  <div className="space-y-6 mt-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Catégorie</label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes les catégories</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Trier par</label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue placeholder="Trier par" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Par défaut</SelectItem>
                          <SelectItem value="name">Nom (A-Z)</SelectItem>
                          <SelectItem value="price-asc">Prix croissant</SelectItem>
                          <SelectItem value="price-desc">Prix décroissant</SelectItem>
                          <SelectItem value="popularity">Popularité</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={() => setIsFilterOpen(false)}
                    >
                      Appliquer les filtres
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section ref={servicesGrid.ref} className="pb-24 px-4">
        <div className="container mx-auto max-w-7xl">
          {filteredAndSortedServices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">
                Aucun service ne correspond à vos critères de recherche.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  setSelectedCategory("all");
                  setSortBy("default");
                }}
              >
                Réinitialiser les filtres
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
              {filteredAndSortedServices.map((feature: any, index: number) => (
              <Card 
                key={index}
                className={`card-modern group hover-scale scroll-scale ${servicesGrid.isVisible ? 'visible' : ''} delay-${Math.min((index % 3 + 1) * 100, 400)}`}
              >
                {feature.image_url && (
                  <div className="relative h-64 overflow-hidden">
                    <img 
                      src={feature.image_url}
                      alt={feature.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  </div>
                )}
                
                <div className="p-8">
                  <div className="flex items-start justify-between mb-4">
                    <h3 
                      className="heading-md flex-1"
                      style={{ color: textColor }}
                    >
                      {feature.title}
                    </h3>
                    {feature.price && (
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {feature.price} FCFA
                      </Badge>
                    )}
                  </div>
                  
                  {feature.category && (
                    <Badge variant="outline" className="mb-3">
                      {feature.category}
                    </Badge>
                  )}
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {feature.description}
                  </p>

                  {feature.benefits && feature.benefits.length > 0 && (
                    <div className="space-y-3 mb-6">
                      {feature.benefits.map((benefit: string, i: number) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button 
                    onClick={onContactClick}
                    className="w-full group"
                    variant="default"
                  >
                    En savoir plus
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaSection.ref} className="pb-24 px-4">
        <div 
          className={`container mx-auto max-w-4xl rounded-3xl p-12 md:p-16 text-center scroll-scale ${ctaSection.isVisible ? 'visible' : ''}`}
          style={{ 
            background: `linear-gradient(135deg, ${site.primary_color || 'hsl(var(--primary))'}, ${site.secondary_color || 'hsl(var(--secondary))'})` 
          }}
        >
          <h2 className="heading-lg text-white mb-6">
            Prêt à commencer ?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Contactez-nous dès aujourd'hui pour discuter de votre projet
          </p>
          <Button 
            size="lg"
            onClick={onContactClick}
            className="bg-white text-primary hover:bg-white/90 font-semibold px-8 py-6 text-lg rounded-full shadow-xl hover:scale-105 transition-all"
          >
            Contactez-nous
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};
