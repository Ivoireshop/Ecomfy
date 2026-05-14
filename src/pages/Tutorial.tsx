import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Image, Video, Globe, CreditCard, Users, PlayCircle, ShoppingBag } from "lucide-react";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const tutorialCards = [
  {
    title: "Création de Visuels",
    description: "Générez des images publicitaires professionnelles en décrivant simplement votre produit.",
    icon: Image,
    color: "bg-blue-500",
    features: [
      "Description intuitive du produit",
      "Choix de styles variés",
      "Personnalisation du texte",
      "Export en haute qualité"
    ]
  },
  {
    title: "Génération de Vidéos",
    description: "Créez des vidéos publicitaires captivantes avec voix-off professionnelle.",
    icon: Video,
    color: "bg-purple-500",
    features: [
      "Vidéos pour réseaux sociaux",
      "Voix-off automatique",
      "Plusieurs formats disponibles",
      "Musique de fond incluse"
    ]
  },
  {
    title: "Sites Vitrine",
    description: "Créez des sites web professionnels pour présenter vos produits ou services.",
    icon: Globe,
    color: "bg-green-500",
    features: [
      "Templates personnalisables",
      "Optimisé pour mobile",
      "Déploiement instantané",
      "Nom de domaine personnalisé"
    ]
  },
  {
    title: "Création de Boutique",
    description: "Lancez votre boutique e-commerce VisualPro en quelques minutes : produits, paiements Mobile Money, livraison.",
    icon: ShoppingBag,
    color: "bg-emerald-500",
    features: [
      "Catalogue produits avec photos & prix en FCFA",
      "Paiements Mobile Money + Cash à la livraison",
      "Tunnel de commande optimisé mobile",
      "Statistiques, finances et notifications en temps réel"
    ]
  },
  {
    title: "Crédits et Abonnements",
    description: "Choisissez le plan qui vous convient selon vos besoins.",
    icon: CreditCard,
    color: "bg-orange-500",
    features: [
      "3 créations gratuites",
      "Packs de crédits flexibles",
      "Abonnement Pro illimité",
      "Paiement sécurisé"
    ]
  },
  {
    title: "Programme de Parrainage",
    description: "Invitez vos amis et gagnez des crédits gratuits.",
    icon: Users,
    color: "bg-pink-500",
    features: [
      "Lien de parrainage unique",
      "Crédits bonus automatiques",
      "Suivi en temps réel",
      "Récompenses illimitées"
    ]
  }
];

const Tutorial = () => {
  const navigate = useNavigate();
  const [showInteractiveTutorial, setShowInteractiveTutorial] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    getUser();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Interactive Tutorial Modal */}
      {showInteractiveTutorial && userId && (
        <OnboardingTutorial 
          userId={userId} 
          onComplete={() => setShowInteractiveTutorial(false)} 
        />
      )}

      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Guide d'Utilisation
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Apprenez à utiliser VisualPro</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Maîtrisez toutes les fonctionnalités
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8">
            Découvrez comment tirer le meilleur parti de VisualPro pour créer des visuels professionnels
          </p>

          <Button 
            size="lg" 
            onClick={() => setShowInteractiveTutorial(true)}
            className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
          >
            <PlayCircle className="mr-2 h-5 w-5" />
            Lancer le tutoriel interactif
          </Button>
        </div>

        {/* Tutorial Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {tutorialCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {card.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Start Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="text-2xl">Premiers Pas</CardTitle>
              <CardDescription>Suivez ces étapes simples pour commencer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Créez votre compte</h4>
                  <p className="text-sm text-muted-foreground">
                    Inscrivez-vous gratuitement et recevez 3 créations offertes pour démarrer
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Choisissez votre création</h4>
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez entre visuel, vidéo ou site vitrine selon vos besoins
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Décrivez votre projet</h4>
                  <p className="text-sm text-muted-foreground">
                    Fournissez les détails de votre produit ou service, l'IA fait le reste
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Téléchargez et partagez</h4>
                  <p className="text-sm text-muted-foreground">
                    Votre création est prête en quelques secondes, téléchargez-la et utilisez-la
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              onClick={() => navigate("/generator")}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Commencer à créer
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/subscription")}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Voir les tarifs
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
