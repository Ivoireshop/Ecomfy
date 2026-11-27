import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Gift, Users, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListPagination } from "@/components/ListPagination";
import { usePagedList } from "@/hooks/usePagedList";
import { readAll, readPage } from "@/lib/pagination";

const REFERRALS_PAGE_SIZE = 20;

interface Referral {
  id: string;
  referral_code: string;
  referred_id: string | null;
  status: string;
  bonus_generations: number;
  created_at: string;
  completed_at: string | null;
}

const Referral = () => {
  const [referralCode, setReferralCode] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  // null tant que le total n'est pas lu : jamais un zéro trompeur.
  const [totalBonus, setTotalBonus] = useState<number | null>(null);
  const { toast } = useToast();

  const referrals = usePagedList<Referral>({
    enabled: !!userId,
    filterKey: userId,
    pageSize: REFERRALS_PAGE_SIZE,
    fetchPage: ({ page, pageSize }) =>
      readPage<Referral>(page, pageSize, (from, to) =>
        supabase.from("referrals").select("*", { count: "exact" })
          .eq("referrer_id", userId).eq("status", "completed")
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(from, to)),
  });

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // La ligne la plus récente porte le code de parrainage de l'utilisateur.
      const { data: latest, error } = await supabase
        .from("referrals")
        .select("referral_code")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (latest) setReferralCode(latest.referral_code);

      // Le total des bonus porte sur tous les parrainages réussis, pas sur la page affichée.
      const completed = await readAll<{ bonus_generations: number }>((from, to) =>
        supabase.from("referrals").select("id, bonus_generations")
          .eq("referrer_id", user.id).eq("status", "completed")
          .order("id").range(from, to));
      setTotalBonus(completed.reduce((sum, r) => sum + r.bonus_generations, 0));
    } catch (error) {
      console.error("Error loading referral data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos données de parrainage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;
    navigator.clipboard.writeText(referralLink);
    toast({
      title: "Copié !",
      description: "Lien de parrainage copié dans le presse-papiers",
    });
  };

  const shareReferral = async () => {
    const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;
    const shareText = `🎁 Rejoins-moi sur cette plateforme et obtiens 5 générations gratuites ! Utilise mon code : ${referralCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Parrainage",
          text: shareText,
          url: referralLink,
        });
      } catch (error) {
        console.log("Sharing cancelled");
      }
    } else {
      copyReferralCode();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Programme de Parrainage</h1>
          <p className="text-muted-foreground">
            Partagez votre code et gagnez des générations gratuites
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Filleuls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{referrals.loading || referrals.error ? "—" : referrals.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Utilisateurs parrainés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                Bonus Gagnés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBonus ?? "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Générations gratuites
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Récompense
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+3</div>
              <p className="text-xs text-muted-foreground mt-1">
                Par parrainage réussi
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Code Card */}
        <Card>
          <CardHeader>
            <CardTitle>Votre Code de Parrainage</CardTitle>
            <CardDescription>
              Partagez ce code avec vos amis. Vous recevrez 3 générations gratuites pour chaque inscription réussie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={referralCode}
                readOnly
                className="font-mono text-lg font-bold"
              />
              <Button onClick={copyReferralCode} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={shareReferral} className="flex-1">
                Partager le Lien
              </Button>
              <Button onClick={copyReferralCode} variant="outline" className="flex-1">
                Copier le Lien
              </Button>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Comment ça marche ?</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Partagez votre code de parrainage avec vos amis</li>
                <li>Ils s'inscrivent en utilisant votre code et reçoivent 5 générations gratuites (3 + 2 bonus)</li>
                <li>Vous recevez 3 générations gratuites pour chaque inscription</li>
                <li>Il n'y a pas de limite au nombre de parrainages !</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Referral History */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des Parrainages</CardTitle>
            <CardDescription>
              Liste de tous vos filleuls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
            ) : referrals.error ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-destructive">Impossible de charger vos filleuls.</p>
                <Button size="sm" variant="outline" onClick={referrals.reload}>Réessayer</Button>
              </div>
            ) : referrals.rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun filleul pour le moment</p>
                <p className="text-sm mt-1">Partagez votre code pour commencer à gagner des bonus !</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.rows.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium">Filleul inscrit</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(referral.completed_at!).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Gift className="h-3 w-3" />
                      +{referral.bonus_generations}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <ListPagination page={referrals.page} pageSize={referrals.pageSize} total={referrals.total} onPageChange={referrals.setPage} disabled={referrals.loading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Referral;
