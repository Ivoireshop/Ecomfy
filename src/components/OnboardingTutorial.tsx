import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Image, Video, Globe, CreditCard, Users, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OnboardingTutorialProps {
  userId: string;
  onComplete: () => void;
}

const tutorialSteps = [
  {
    title: "Bienvenue sur VisualPro ! 🎉",
    description: "Découvrez comment créer des visuels professionnels en quelques clics. Ce tutoriel vous guidera à travers les fonctionnalités principales.",
    icon: Sparkles,
    color: "text-primary"
  },
  {
    title: "Création de Visuels",
    description: "Générez des images publicitaires professionnelles en décrivant simplement votre produit. Notre IA s'occupe du reste !",
    icon: Image,
    color: "text-blue-500",
    tips: [
      "Décrivez votre produit en détail",
      "Choisissez le style qui correspond à votre marque",
      "Ajoutez du texte personnalisé si nécessaire"
    ]
  },
  {
    title: "Génération de Vidéos",
    description: "Créez des vidéos publicitaires captivantes avec voix-off professionnelle pour vos campagnes marketing.",
    icon: Video,
    color: "text-purple-500",
    tips: [
      "Parfait pour les réseaux sociaux",
      "Voix-off automatique en français",
      "Plusieurs formats disponibles"
    ]
  },
  {
    title: "Sites Vitrine",
    description: "Créez des sites web professionnels pour présenter vos produits, services ou formations en un clic.",
    icon: Globe,
    color: "text-green-500",
    tips: [
      "Templates personnalisables",
      "Optimisé pour mobile",
      "Déploiement instantané"
    ]
  },
  {
    title: "Crédits et Abonnements",
    description: "Choisissez le plan qui vous convient : achetez des packs de crédits à la carte ou optez pour un abonnement illimité.",
    icon: CreditCard,
    color: "text-orange-500",
    tips: [
      "3 créations gratuites pour commencer",
      "Packs de crédits à partir de 1000 FCFA",
      "Abonnement Pro : créations illimitées"
    ]
  },
  {
    title: "Parrainage",
    description: "Invitez vos amis et gagnez des crédits gratuits à chaque inscription réussie !",
    icon: Users,
    color: "text-pink-500",
    tips: [
      "Partagez votre lien unique",
      "Gagnez des crédits bonus",
      "Aidez votre communauté"
    ]
  }
];

export const OnboardingTutorial = ({ userId, onComplete }: OnboardingTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const { toast } = useToast();

  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const step = tutorialSteps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = async () => {
    await markOnboardingComplete();
    setIsOpen(false);
    onComplete();
  };

  const handleComplete = async () => {
    await markOnboardingComplete();
    setIsOpen(false);
    toast({
      title: "Tutoriel terminé ! 🎉",
      description: "Vous êtes prêt à créer vos premiers visuels professionnels.",
    });
    onComplete();
  };

  const markOnboardingComplete = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking onboarding complete:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-full bg-${step.color}/10`}>
              <Icon className={`h-8 w-8 ${step.color}`} />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl">{step.title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Étape {currentStep + 1} sur {tutorialSteps.length}
              </p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </DialogHeader>

        <DialogDescription className="text-base leading-relaxed mt-4">
          {step.description}
        </DialogDescription>

        {step.tips && (
          <div className="mt-6 space-y-3">
            <h4 className="font-semibold text-sm text-foreground">💡 Conseils :</h4>
            <ul className="space-y-2">
              {step.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-6">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="sm:mr-auto"
          >
            Passer le tutoriel
          </Button>
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Précédent
            </Button>
          )}
          <Button onClick={handleNext}>
            {currentStep === tutorialSteps.length - 1 ? "Terminer" : "Suivant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
