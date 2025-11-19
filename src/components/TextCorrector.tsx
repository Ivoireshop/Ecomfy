import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TextCorrectorProps {
  initialText?: string;
  onCorrected?: (correctedText: string) => void;
}

export function TextCorrector({ initialText = "", onCorrected }: TextCorrectorProps) {
  const [originalText, setOriginalText] = useState(initialText);
  const [correctedText, setCorrectedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handleCorrect = async () => {
    if (!originalText.trim()) {
      toast.error("Veuillez entrer un texte à corriger");
      return;
    }

    setIsLoading(true);
    setShowComparison(false);

    try {
      const { data, error } = await supabase.functions.invoke("correct-text", {
        body: { text: originalText },
      });

      if (error) {
        if (error.message.includes("429")) {
          toast.error("Trop de requêtes. Veuillez patienter quelques instants.");
        } else if (error.message.includes("402")) {
          toast.error("Crédits insuffisants. Veuillez recharger votre compte.");
        } else {
          throw error;
        }
        return;
      }

      if (data?.correctedText) {
        setCorrectedText(data.correctedText);
        setShowComparison(true);
        toast.success("Texte corrigé avec succès !");
        
        if (onCorrected) {
          onCorrected(data.correctedText);
        }
      } else {
        toast.error("Aucune correction générée");
      }
    } catch (error: any) {
      console.error("Erreur de correction:", error);
      toast.error(error?.message || "Erreur lors de la correction du texte");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Texte copié dans le presse-papiers");
  };

  const resetCorrection = () => {
    setCorrectedText("");
    setShowComparison(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Correcteur Automatique de Texte
        </CardTitle>
        <CardDescription>
          Corrigez automatiquement toutes les erreurs d'orthographe, grammaire et formulation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="text-to-correct">Texte à corriger</Label>
          <Textarea
            id="text-to-correct"
            placeholder="Collez ou tapez votre texte ici..."
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            className="min-h-[120px]"
            disabled={isLoading}
          />
        </div>

        <Button 
          onClick={handleCorrect} 
          disabled={isLoading || !originalText.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Correction en cours...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Corriger le texte
            </>
          )}
        </Button>

        {showComparison && correctedText && (
          <div className="space-y-4 animate-fade-in">
            <Alert className="border-primary/20 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                Texte corrigé avec succès ! Toutes les erreurs ont été éliminées.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Texte Original */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground">Texte original</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(originalText)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copier
                  </Button>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30 min-h-[120px]">
                  <p className="text-sm whitespace-pre-wrap">{originalText}</p>
                </div>
              </div>

              {/* Texte Corrigé */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-primary font-semibold">Texte corrigé</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(correctedText)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copier
                  </Button>
                </div>
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 min-h-[120px]">
                  <p className="text-sm whitespace-pre-wrap font-medium">{correctedText}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={resetCorrection}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Nouvelle correction
              </Button>
              <Button
                onClick={() => {
                  setOriginalText(correctedText);
                  setShowComparison(false);
                  setCorrectedText("");
                  toast.success("Texte corrigé appliqué");
                }}
                className="flex-1"
              >
                Utiliser ce texte
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
