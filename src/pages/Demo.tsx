import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Image, 
  Video, 
  Globe, 
  CreditCard, 
  Users, 
  PlayCircle,
  CheckCircle2,
  ShoppingBag
} from "lucide-react";

const demoVideos = [
  {
    id: "images",
    title: "Créer des Visuels Publicitaires",
    description: "Apprenez à générer des images professionnelles pour vos campagnes marketing en quelques clics.",
    icon: Image,
    color: "bg-blue-500",
    duration: "3:24",
    steps: [
      "Accédez à l'outil de génération d'images",
      "Décrivez votre produit et votre message",
      "Choisissez un style publicitaire",
      "Générez et téléchargez votre visuel"
    ],
    videoUrl: "https://www.youtube.com/embed/zGCI8dms0FU",
    thumbnail: "https://img.youtube.com/vi/zGCI8dms0FU/maxresdefault.jpg"
  },
  {
    id: "videos",
    title: "Créer des Vidéos Publicitaires",
    description: "Découvrez comment transformer vos idées en vidéos captivantes avec voix-off professionnelle.",
    icon: Video,
    color: "bg-purple-500",
    duration: "4:12",
    steps: [
      "Sélectionnez le format vidéo souhaité",
      "Décrivez votre message et votre cible",
      "Choisissez le style de voix-off",
      "Téléchargez votre vidéo prête à publier"
    ],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Placeholder - à remplacer
    thumbnail: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&h=450&fit=crop"
  },
  {
    id: "showcase",
    title: "Créer un Site Vitrine",
    description: "Créez un site web professionnel pour présenter vos produits ou services sans coder.",
    icon: Globe,
    color: "bg-green-500",
    duration: "5:45",
    steps: [
      "Choisissez un template adapté à votre secteur",
      "Personnalisez les couleurs et le contenu",
      "Ajoutez vos images et témoignages",
      "Publiez votre site en un clic"
    ],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Placeholder - à remplacer
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop"
  },
  {
    id: "shop",
    title: "Créer une Boutique E-commerce",
    description: "Lancez votre boutique en ligne complète avec catalogue, paiements Mobile Money et gestion des commandes.",
    icon: ShoppingBag,
    color: "bg-emerald-500",
    duration: "6:10",
    steps: [
      "Créez votre boutique et personnalisez le thème",
      "Ajoutez vos produits (photos, prix FCFA, stock)",
      "Activez Mobile Money & Cash à la livraison",
      "Partagez le lien et suivez vos commandes en temps réel"
    ],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=800&h=450&fit=crop"
  },
  {
    id: "credits",
    title: "Gérer vos Crédits",
    description: "Comprenez le système de crédits et comment optimiser votre utilisation de la plateforme.",
    icon: CreditCard,
    color: "bg-orange-500",
    duration: "2:30",
    steps: [
      "Consultez votre solde de crédits",
      "Achetez des packs ou abonnez-vous",
      "Suivez votre historique de consommation",
      "Profitez des offres promotionnelles"
    ],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Placeholder - à remplacer
    thumbnail: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=800&h=450&fit=crop"
  },
  {
    id: "referral",
    title: "Programme de Parrainage",
    description: "Maximisez vos gains en invitant vos amis et en profitant du système de récompenses.",
    icon: Users,
    color: "bg-pink-500",
    duration: "2:15",
    steps: [
      "Obtenez votre lien de parrainage unique",
      "Partagez-le avec vos contacts",
      "Suivez vos parrainages en temps réel",
      "Recevez vos crédits bonus automatiquement"
    ],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Placeholder - à remplacer
    thumbnail: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=450&fit=crop"
  }
];

const Demo = () => {
  const navigate = useNavigate();
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("images");

  const handlePlayVideo = (videoId: string) => {
    setActiveVideo(videoId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Démonstrations Vidéo
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <PlayCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Tutoriels Vidéo</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Apprenez en regardant
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8">
            Découvrez comment utiliser chaque fonctionnalité de VisualPro à travers nos vidéos de démonstration détaillées
          </p>
        </div>

        {/* Video Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="max-w-6xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 mb-8">
            {demoVideos.map((video) => {
              const Icon = video.icon;
              return (
                <TabsTrigger key={video.id} value={video.id} className="gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{video.title.split(' ')[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {demoVideos.map((video) => {
            const Icon = video.icon;
            return (
              <TabsContent key={video.id} value={video.id} className="space-y-6">
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg ${video.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-2xl">{video.title}</CardTitle>
                          <Badge variant="secondary">{video.duration}</Badge>
                        </div>
                        <CardDescription className="text-base">{video.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Video Player */}
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      {activeVideo === video.id ? (
                        <iframe
                          className="w-full h-full"
                          src={video.videoUrl}
                          title={video.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <div 
                          className="relative w-full h-full cursor-pointer group"
                          onClick={() => handlePlayVideo(video.id)}
                        >
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <PlayCircle className="h-10 w-10 text-primary" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Steps */}
                    <div>
                      <h3 className="font-semibold text-lg mb-4">Étapes à suivre :</h3>
                      <div className="space-y-3">
                        {video.steps.map((step, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            </div>
                            <p className="text-muted-foreground">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t">
                      <Button onClick={() => navigate("/generator")}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Essayer maintenant
                      </Button>
                      <Button variant="outline" onClick={() => navigate("/tutorial")}>
                        Voir le guide complet
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Additional Resources */}
        <div className="mt-16 max-w-4xl mx-auto">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="text-2xl">Besoin d'aide supplémentaire ?</CardTitle>
              <CardDescription>Explorez nos autres ressources pour maîtriser VisualPro</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-4 justify-start"
                onClick={() => navigate("/tutorial")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Guide d'utilisation</div>
                    <div className="text-xs text-muted-foreground">Documentation complète</div>
                  </div>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="h-auto py-4 justify-start"
                onClick={() => navigate("/feedback")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Support & Feedback</div>
                    <div className="text-xs text-muted-foreground">Contactez notre équipe</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Demo;
