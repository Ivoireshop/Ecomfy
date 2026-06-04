import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle } from "lucide-react";

type DemoVideo = {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  category: string;
  duration?: string;
};

const DEMOS: DemoVideo[] = [
  {
    id: "intro",
    title: "Formation complète VisualPro",
    description: "Maîtrisez toutes les fonctionnalités de VisualPro en une seule formation.",
    youtubeId: "z4Lko-oFNsY",
    category: "Présentation",
    duration: "1:20:00",
  },
];

const Demo = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="text-center mb-10 max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-4">Démo Vidéo</Badge>
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Découvrez VisualPro en vidéo</h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Quelques démonstrations rapides pour voir la plateforme en action.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {DEMOS.map((demo) => (
            <Card key={demo.id} className="overflow-hidden">
              <div className="relative aspect-video bg-black">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${demo.youtubeId}?start=3026`}
                  title={demo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{demo.category}</Badge>
                  {demo.duration && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <PlayCircle className="h-3 w-3" />
                      {demo.duration}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-lg">{demo.title}</h3>
                <p className="text-sm text-muted-foreground">{demo.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Demo;