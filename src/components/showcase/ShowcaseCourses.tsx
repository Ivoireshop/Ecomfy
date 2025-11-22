import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock, Users, ArrowRight } from "lucide-react";

interface Course {
  id: string;
  title: string;
  short_description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  category: string;
  duration: string | null;
  level: string | null;
}

interface ShowcaseCoursesProps {
  showcaseSiteId: string;
  onCourseClick: (courseId: string) => void;
  primaryColor?: string;
  textColor?: string;
  priceTextColor?: string;
  priceBgColor?: string;
  legacyFormations?: any[];
}

export function ShowcaseCourses({
  showcaseSiteId,
  onCourseClick,
  primaryColor = "#2563eb",
  textColor = "#000000",
  priceTextColor = "#ffffff",
  priceBgColor = "#2563eb",
  legacyFormations = [],
}: ShowcaseCoursesProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  
  // Convertir les formations legacy en format Course
  const legacyCourses: Course[] = legacyFormations.map((formation, index) => ({
    id: `legacy-${index}`,
    title: formation.title || '',
    short_description: formation.description || null,
    price: parseFloat(formation.price?.replace(/[^0-9.]/g, '') || '0'),
    currency: 'XOF',
    image_url: formation.image_url || null,
    category: 'formation',
    duration: formation.duration || null,
    level: null,
  }));

  useEffect(() => {
    loadCourses();
  }, [showcaseSiteId]);

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("showcase_site_id", showcaseSiteId)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Combiner les cours de la table avec les formations legacy
      setCourses([...legacyCourses, ...(data || [])]);
    } catch (error) {
      console.error("Error loading courses:", error);
      // En cas d'erreur, au moins afficher les formations legacy
      setCourses(legacyCourses);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((course) => {
    if (filter === "all") return true;
    return course.category === filter;
  });

  const formations = courses.filter((c) => c.category === "formation");
  const services = courses.filter((c) => c.category === "service");

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          Aucune formation ou service disponible pour le moment
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold" style={{ color: textColor }}>
          Nos Formations & Services
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Découvrez notre catalogue complet de formations professionnelles et services
        </p>
      </div>

      <div className="flex justify-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          Tout ({courses.length})
        </Button>
        {formations.length > 0 && (
          <Button
            variant={filter === "formation" ? "default" : "outline"}
            onClick={() => setFilter("formation")}
          >
            Formations ({formations.length})
          </Button>
        )}
        {services.length > 0 && (
          <Button
            variant={filter === "service" ? "default" : "outline"}
            onClick={() => setFilter("service")}
          >
            Services ({services.length})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => (
          <Card
            key={course.id}
            className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => onCourseClick(course.id)}
          >
            {course.image_url ? (
              <div className="relative h-48 overflow-hidden">
                <img
                  src={course.image_url}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <Badge className="absolute top-4 right-4 capitalize">
                  {course.category}
                </Badge>
              </div>
            ) : (
              <div
                className="h-48 flex items-center justify-center"
                style={{ backgroundColor: primaryColor + "20" }}
              >
                <Badge className="capitalize">{course.category}</Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="line-clamp-2">{course.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {course.short_description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {course.short_description}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {course.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {course.duration}
                  </div>
                )}
                {course.level && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {course.level}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div 
                  className="text-2xl font-bold px-4 py-2 rounded-lg"
                  style={{ 
                    color: priceTextColor,
                    backgroundColor: priceBgColor
                  }}
                >
                  {course.price.toLocaleString()} {course.currency}
                </div>
                <Button size="sm" style={{ backgroundColor: primaryColor }}>
                  Voir détails
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
