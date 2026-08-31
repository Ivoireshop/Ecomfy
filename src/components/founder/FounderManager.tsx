import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, UserPlus, Trash2, Crown, Briefcase, ShieldAlert, Loader2, Sparkles, Mail, Lock } from "lucide-react";
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
      }
    } catch (err: any) {
      console.error("Error fetching founders:", err);
      // Fallback: Display main founder Ulrich DJATÉ
      setFounders([
        {
          id: "main-founder",
          user_id: "main-founder-id",
          role: "founder",
          created_at: new Date().toISOString(),
          email: "djateulrich@gmail.com",
          full_name: "Ulrich DJATÉ",
          is_main_founder: true,
        },
      ]);
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
        description: "Veuillez saisir l'adresse email de la personne à inviter.",
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

      // Try sending transactional email invitation
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            recipientEmail: email.trim(),
            subject: "Invitation à l'Équipe Dirigeante Ecomfy",
            html: `
              <h2>Félicitations !</h2>
              <p>Ulrich DJATÉ (Fondateur Principal) vous a nommé en tant que <strong>${role}</strong> sur la plateforme Ecomfy.</p>
              <p>Vous pouvez maintenant vous connecter à votre compte et consulter la Console de Pilotage Fondateur.</p>
            `,
          },
        });
      } catch (e) {
        console.warn("Could not send invite email:", e);
      }

      toast({
        title: "✨ Invitation envoyée par mail !",
        description: `Le rôle a été accordé avec succès à ${email.trim()}.`,
      });

      setEmail("");
      fetchFounders();
    } catch (err: any) {
      toast({
        title: "Erreur d'invitation",
        description: err?.message || "Impossible d'inviter cette personne.",
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
    if (member.is_main_founder || member.role === "founder" || member.email.toLowerCase().includes("djateulrich")) {
      return (
        <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold px-3 py-1 gap-1.5 shadow-sm">
          <Crown className="w-3.5 h-3.5" /> Fondateur Principal & Propriétaire Unique
        </Badge>
      );
    }
    switch (member.role) {
      case "co_founder":
        return (
          <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-semibold px-3 py-1 gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Co-Fondateur Invité
          </Badge>
        );
      case "shareholder":
        return (
          <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30 font-semibold px-3 py-1 gap-1.5 shadow-sm">
            <Briefcase className="w-3.5 h-3.5" /> Actionnaire / Investisseur
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
              <Crown className="w-3.5 h-3.5" /> Propriété Exclusive Ecomfy
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Gestion de l'Équipe Dirigeante (Nomination par Email)
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Vous êtes <strong>Ulrich DJATÉ (`djateulrich@gmail.com`)</strong>, l'unique Fondateur Principal, Concepteur et Architecte d'Ecomfy. Vous seul avez la capacité d'ajouter, modifier ou révoquer l'accès aux co-fondateurs, actionnaires et investisseurs par invitation mail.
            </p>
          </div>
        </div>
      </div>

      {/* Form: Invite New Founder by Email */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#0E7C66]" /> Nommer et Inviter un Membre par Email
          </CardTitle>
          <CardDescription>
            Saisissez l'adresse email de la personne à qui vous souhaitez ouvrir l'accès à la Console Fondateur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddFounder} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Adresse email du membre à inviter
              </label>
              <Input
                type="email"
                placeholder="ex: investisseur@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="w-full sm:w-64 space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Titre / Rôle à attribuer
              </label>
              <Select value={role} onValueChange={(val: any) => setRole(val)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="co_founder">👑 Co-Fondateur (Accès Total)</SelectItem>
                  <SelectItem value="shareholder">💼 Actionnaire / Investisseur (Suivi Financier)</SelectItem>
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
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" /> Inviter par Email
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List of Nominated Founders */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" /> Équipe Dirigeante Officielle ({founders.length})
            </CardTitle>
            <CardDescription>
              Seules les personnes figurant sur cette liste ont accès au Tableau de Bord Fondateur.
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
              Chargement de l'équipe dirigeante...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {founders.map((member) => {
                const isMain = member.is_main_founder || member.email.toLowerCase().includes("djateulrich");
                return (
                  <div
                    key={member.id || member.user_id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isMain
                        ? "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/40 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-sm shrink-0 ${
                            isMain
                              ? "bg-gradient-to-br from-amber-500 to-amber-600"
                              : "bg-gradient-to-br from-[#0E7C66] to-teal-700"
                          }`}
                        >
                          {(member.full_name || member.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                            {isMain ? "Ulrich DJATÉ" : (member.full_name || member.email)}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                        </div>
                      </div>
                      {getRoleBadge(member)}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {isMain ? "Fondateur d'Origine" : `Nommé le ${new Date(member.created_at).toLocaleDateString("fr-FR")}`}
                      </span>

                      {isMain ? (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Inaltérable
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
                );
              })}
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
              Êtes-vous sûr de vouloir retirer les accès à <strong>{memberToRevoke?.email}</strong> ?
              Cette personne n'aura plus accès aux finances et aux statistiques du projet.
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
