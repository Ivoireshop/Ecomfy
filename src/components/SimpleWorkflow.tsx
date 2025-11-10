import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft, Check, Link as LinkIcon, Image as ImageIcon, Sparkles } from "lucide-react";
import { BrandExtractor } from "./BrandExtractor";
import { MultiImageUploader } from "./MultiImageUploader";
import { VariationGenerator } from "./VariationGenerator";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  {
    id: 1,
    title: "Extraction de Marque",
    description: "Entrez votre URL pour extraire automatiquement votre marque",
    icon: LinkIcon,
  },
  {
    id: 2,
    title: "Images de Référence",
    description: "Uploadez 5-10 images de votre produit pour un rendu optimal",
    icon: ImageIcon,
  },
  {
    id: 3,
    title: "Génération & Sélection",
    description: "Choisissez parmi 5 variations générées automatiquement",
    icon: Sparkles,
  },
];

interface SimpleWorkflowProps {
  productData: {
    productName: string;
    niche: string;
    description: string;
    platform: string;
    price: string;
    benefits?: string;
  };
  onComplete: (data: {
    brandData?: any;
    productImages?: string[];
    selectedVariation?: string;
  }) => void;
}

export function SimpleWorkflow({ productData, onComplete }: SimpleWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [brandData, setBrandData] = useState<any>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete workflow
      onComplete({
        brandData,
        productImages,
        selectedVariation: selectedVariation || undefined,
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true; // Brand extraction is optional
      case 2:
        return true; // Product images are optional
      case 3:
        return selectedVariation !== null; // Must select a variation
      default:
        return false;
    }
  };

  const CurrentStepIcon = STEPS[currentStep - 1].icon;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <CurrentStepIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Étape {currentStep}/{STEPS.length}: {STEPS[currentStep - 1].title}
                </CardTitle>
                <CardDescription className="mt-1">
                  {STEPS[currentStep - 1].description}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {Math.round(progress)}% complété
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
      </Card>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && (
          <BrandExtractor
            onBrandExtracted={(data) => {
              setBrandData(data);
            }}
          />
        )}

        {currentStep === 2 && (
          <MultiImageUploader
            onImagesUploaded={(images) => {
              setProductImages(images);
            }}
            maxImages={10}
          />
        )}

        {currentStep === 3 && (
          <VariationGenerator
            productData={productData}
            onVariationSelected={(imageUrl) => {
              setSelectedVariation(imageUrl);
            }}
            numberOfVariations={5}
          />
        )}
      </div>

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>

            <div className="flex gap-2">
              {STEPS.map((step) => (
                <div
                  key={step.id}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    step.id <= currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
            >
              {currentStep === STEPS.length ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Terminer
                </>
              ) : (
                <>
                  Suivant
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
