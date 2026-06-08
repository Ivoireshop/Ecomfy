import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Zap, Clock, CalendarDays, Sparkles } from "lucide-react";
import { Session } from "@supabase/supabase-js";

interface QuotaInfo {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  exempt?: boolean;
  resets_at: string | null;
  error?: string;
}

interface UsageRecord {
  usage_date: string;
  request_count: number;
  last_feature: string | null;
  updated_at: string;
}

const AiQuota = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [history, setHistory] = useState<UsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => authSubscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadQuota();
      loadHistory();
    }
  }, [session]);

  const loadQuota = async () => {
    try {
      const { data, error } = await supabase.rpc("get_ai_quota", {
        _user_id: session!.user.id,
        _limit: 2,
      });

      if (error) throw error;
      setQuota((data as unknown) as QuotaInfo);
    } catch (error) {
      console.error("Erreur lors du chargement du quota:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger votre quota IA",
        variant: "destructive",
      });
    }
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_daily_usage")
        .select("usage_date, request_count, last_feature, updated_at")
        .eq("user_id", session!.user.id)
        .order("usage_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatResetTime = (iso: string | null) => {
    if (!iso) return "00:00 UTC";
    const d = new Date(iso);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00Z").toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const featureLabel = (feature: string | null) => {
    if (!feature) return "—";
    const map: Record<string, string> = {
      "product-ai-optimizer": "Optimiseur produit",
      "generate-product-sheet": "Fiche produit IA",
      "generate-ai-image": "Génération d'image",
      "generate-feature-image": "Image mise en avant",
      "generate-ad-visual": "Visuel publicitaire",
      "generate-shop-content": "Contenu boutique",
      "generate-showcase-site": "Site vitrine",
      "generate-video": "Génération vidéo",
      "create-video-from-image": "Vidéo depuis image",
      "generate-voiceover": "Voix off",
      "correct-text": "Correction texte",
      "extract-brand": "Extraction marque",
      "finance-advisor": "Expert comptable IA",
      "translate-product": "Traduction produit",
    };
    return map[feature] || feature;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement de votre quota IA...</p>
        </div>
      </div>
    );
  }

  const progressValue = quota && quota.limit ? Math.min((quota.used / quota.limit) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <section className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="h-7 w-7 text-primary" />
            Mon quota IA
          </h1>
          <p className="text-muted-foreground mt-1">
            Suivez votre utilisation des fonctionnalités d'intelligence artificielle.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Requêtes d'aujourd'hui
              </CardTitle>
              <CardDescription>
                Nombre de requêtes IA utilisées sur votre quota journalier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quota?.exempt ? (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1">
                    Fondateur — exempté
                  </Badge>
                  <span className="text-sm text-muted-foreground">Aucune limite ne s'applique à votre compte.</span>
                </div>
              ) : (
                <>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <span className="text-3xl font-bold">{quota?.used ?? 0}</span>
                      <span className="text-muted-foreground text-lg"> / {quota?.limit ?? 2}</span>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {quota?.remaining ?? 0} restante{quota && quota.remaining !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Progress value={progressValue} className="h-3" />
                  {quota && quota.remaining === 0 && (
                    <p className="text-sm text-destructive mt-2">
                      Vous avez atteint votre limite journalière. Réessayez demain.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Prochain reset
              </CardTitle>
              <CardDescription>
                Votre quota se réinitialise à minuit UTC.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatResetTime(quota?.resets_at ?? null)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(() => {
                  const now = new Date();
                  const reset = quota?.resets_at ? new Date(quota.resets_at) : null;
                  if (!reset) return "";
                  const diffMs = reset.getTime() - now.getTime();
                  const diffH = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
                  const diffM = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
                  return `Dans ${diffH}h ${diffM}m`;
                })()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Historique d'utilisation
            </CardTitle>
            <CardDescription>
              Les 30 derniers jours d'utilisation des fonctionnalités IA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune utilisation enregistrée pour le moment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Requêtes</TableHead>
                      <TableHead>Dernière fonction utilisée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((row) => (
                      <TableRow key={row.usage_date}>
                        <TableCell className="font-medium">
                          {formatDate(row.usage_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.request_count}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {featureLabel(row.last_feature)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default AiQuota;
