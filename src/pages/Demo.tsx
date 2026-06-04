import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayCircle, Settings, GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AcademyCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  video_url: string;
  thumbnail_url: string | null;
  duration: string | null;
  level: string | null;
  order_index: number;
};

// Convert any YouTube URL into an embed URL
const toEmbed = (url: string) => {
  if (!url) return url;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
};

const thumbFor = (course: AcademyCourse) => {
  if (course.thumbnail_url) return course.thumbnail_url;
  const yt = course.video_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
  return null;
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "Général",
  account: "Créer son compte",
  visuals: "Visuels publicitaires",
  videos: "Vidéos animées",
  showcase: "Sites vitrine",
  shop: "Boutiques e-commerce",
  courses: "Formations",
  api: "API & intégrations",
};

const Academy = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [active, setActive] = useState<AcademyCourse | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("academy_courses" as any)
        .select("*")
        .eq("is_published", true)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      setCourses((data as any) ?? []);
      setLoading(false);
    };
    load();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        // @ts-ignore
        .in("role", ["founder", "co_founder"]);
      setIsAdmin(!!roles && roles.length > 0);
    });
  }, []);

  const categories = useMemo(() => {
    const set = new Set(courses.map((c) => c.category));
    return Array.from(set);
  }, [courses]);

  const filtered = useMemo(
    () => (filter === "all" ? courses : courses.filter((c) => c.category === filter)),
    [courses, filter]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            VisualPro Academy
          </h1>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => navigate("/academy-manager")}>
              <Settings className="h-4 w-4 mr-2" />
              Gérer
            </Button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="text-center mb-10 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-3">Apprenez à maîtriser VisualPro</h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Formations pas à pas pour créer votre compte, générer vos visuels, monter vos vidéos,
            lancer votre site vitrine ou votre boutique — et utiliser VisualPro sans difficulté.
          </p>
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
              Toutes ({courses.length})
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={filter === cat ? "default" : "outline"}
                onClick={() => setFilter(cat)}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="max-w-xl mx-auto">
            <CardContent className="py-12 text-center space-y-3">
              <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground" />
              <h3 className="font-semibold text-lg">Aucune formation pour le moment</h3>
              <p className="text-sm text-muted-foreground">
                Les premières vidéos seront publiées très prochainement.
              </p>
              {isAdmin && (
                <Button onClick={() => navigate("/academy-manager")}>
                  Ajouter la première formation
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {filtered.map((course) => {
              const thumb = thumbFor(course);
              return (
                <Card
                  key={course.id}
                  className="overflow-hidden cursor-pointer group hover:shadow-xl transition-all"
                  onClick={() => setActive(course)}
                >
                  <div className="relative aspect-video bg-muted">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={course.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                        <PlayCircle className="h-12 w-12 text-primary/70" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <PlayCircle className="h-9 w-9 text-primary" />
                      </div>
                    </div>
                    {course.duration && (
                      <Badge className="absolute bottom-2 right-2 bg-black/80 text-white hover:bg-black/80">
                        {course.duration}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[course.category] ?? course.category}
                      </Badge>
                      {course.level && <Badge variant="outline" className="text-xs">{course.level}</Badge>}
                    </div>
                    <h3 className="font-semibold text-base line-clamp-2">{course.title}</h3>
                    {course.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl">{active?.title}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="px-6 pb-6 space-y-4">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  className="w-full h-full"
                  src={toEmbed(active.video_url)}
                  title={active.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              {active.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{active.description}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Academy;
