import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, UserPlus, Trash2, Crown, Briefcase, ShieldAlert, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface FounderMember {
  id: string;
  user_id: string;
  role: "founder" | "co_founder" | "shareholder" | "admin";
  created_at: string;
  email: string;
  full_name: string;
  is_main_founder: boolean;
}

export const FounderManager = () => {
  const { toast } = useToast();
  const [founders, setFounders] = useState<FounderMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMainFounder, setIsMainFounder] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"co_founder" | "shareholder" | "admin">("co_founder");

  // Revoke modal state
  const [memberToRevoke, setMemberToRevoke] = useState<FounderMember | null>(null);

  const fetchFounders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-founder-roles", {
        body: { action: "list" },
      });

      if (error) throw error;

      if (data?.founders) {
        setFounders(data.founders);
        setIsMainFounder(!!data.isMainFounder);
      }
    } catch (err: any) {
      console.error("Error fetching founders:", err);
      toast({
        title: "Erreur de chargement",
        description: err?.message || "Impossible de charger la liste des fondateurs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFounders();
  }, []);

  const handleAddFounder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      toast({
        title: "Email requis",
        description: "Veuillez saisir l'adresse email de la personne à nommer.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-founder-roles", {
        body: {
          action: "add",
          email: email.trim(),
          role,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Échec de l'attribution du rôle");
      }

      toast({
        title: "✨ Nouveau membre nommé !",
        description: data.message || `Le rôle de ${role} a été accordé avec succès.`,
      });

      setEmail("");
      fetchFounders();
    } catch (err: any) {
      toast({
        title: "Erreur d'attribution",
        description: err?.message || "Impossible de nommer cette personne.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!memberToRevoke) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-founder-roles", {
        body: {
          action: "revoke",
          target_user_id: memberToRevoke.user_id,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Échec de la révocation");
      }

      toast({
        title: "Droits révoqués",
        description: `Les accès fondateurs de ${memberToRevoke.email} ont été retirés.`,
      });

      setMemberToRevoke(null);
      fetchFounders();
    } catch (err: any) {
      toast({
        title: "Erreur de révocation",
        description: err?.message || "Impossible de révoquer ce membre.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (member: FounderMember) => {
    if (member.is_main_founder || member.role === "founder") {
      return (
        <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold px-3 py-1 gap-1.5 shadow-sm">
          <Crown className="w-3.5 h-3.5" /> Fondateur Principal
        </Badge>
      );
    }
    switch (member.role) {
      case "co_founder":
        return (
          <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-semibold px-3 py-1 gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Co-Fondateur
          </Badge>
        );
      case "shareholder":
        return (
          <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30 font-semibold px-3 py-1 gap-1.5 shadow-sm">
            <Briefcase className="w-3.5 h-3.5" /> Actionnaire
          </Badge>
        );
      case "admin":
      default:
        return (
          <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 font-semibold px-3 py-1 gap-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" /> Administrateur
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
          <Crown className="w-32 h-32 text-amber-500" />
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold mb-2">
              <Crown className="w-3.5 h-3.5" /> Gouvernance Ecomfy
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Gestion des Fondateurs & Administrateurs
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Gérez les membres de l'équipe dirigeante ayant accès au Tableau de Bord Fondateur.
              Le Fondateur Principal (<strong>Ulrich DJATÉ</strong>) est le seul autorisé à nommer et à révoquer les co-fondateurs et actionnaires.
            </p>
          </div>
        </div>
      </div>

      {/* Form: Add New Founder */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#0E7C66]" /> Nommer un Fondateur / Administrateur
          </CardTitle>
          <CardDescription>
            Saisissez l'adresse email d'un utilisateur inscrit sur Ecomfy pour lui accorder les privilèges de direction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddFounder} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Adresse email du membre
              </label>
              <Input
                type="email"
                placeholder="ex: associe@ecomfy.cloud"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="w-full sm:w-64 space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Rôle à attribuer
              </label>
              <Select value={role} onValueChange={(val: any) => setRole(val)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="co_founder">👑 Co-Fondateur (Accès Total)</SelectItem>
                  <SelectItem value="shareholder">💼 Actionnaire (Accès Métriques/Finances)</SelectItem>
                  <SelectItem value="admin">🛡️ Administrateur Plateforme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl px-6 w-full sm:w-auto whitespace-nowrap shadow-md shadow-[#0E7C66]/20 transition-all shrink-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Traitement...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" /> Nommer membre
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List of Current Founders */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" /> Équipe Dirigeante Actuelle ({founders.length})
            </CardTitle>
            <CardDescription>
              Liste officielle des personnes disposant des droits de fondateur ou d'administrateur.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchFounders} disabled={isLoading} className="rounded-xl">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Actualiser"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#0E7C66]" />
              Chargement de la liste des dirigeants...
            </div>
          ) : founders.length === 0 ? (
            <div className="py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
              <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="font-semibold">Aucun co-fondateur additionnel trouvé.</p>
              <p className="text-xs text-slate-400 mt-1">Utilisez le formulaire ci-dessus pour nommer des membres de l'équipe.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {founders.map((member) => (
                <div
                  key={member.id || member.user_id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    member.is_main_founder
                      ? "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/40 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-sm shrink-0 ${
                          member.is_main_founder
                            ? "bg-gradient-to-br from-amber-500 to-amber-600"
                            : "bg-gradient-to-br from-[#0E7C66] to-teal-700"
                        }`}
                      >
                        {(member.full_name || member.email || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                          {member.full_name || "Membre Ecomfy"}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                      </div>
                    </div>
                    {getRoleBadge(member)}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Ajouté le {new Date(member.created_at).toLocaleDateString("fr-FR")}
                    </span>

                    {member.is_main_founder ? (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                        Propriétaire du projet
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMemberToRevoke(member)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs h-8 rounded-lg px-2.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Révoquer les droits
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Revoking */}
      <Dialog open={!!memberToRevoke} onOpenChange={() => setMemberToRevoke(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Confirmation de révocation
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir retirer les droits de fondateur / administrateur à <strong>{memberToRevoke?.email}</strong> ?
              Cette personne perdra immédiatement l'accès au Tableau de Bord Fondateur.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setMemberToRevoke(null)} className="rounded-xl">
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={isSubmitting}
              className="rounded-xl font-bold"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Confirmer la révocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
