import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Mail, Trash2, UserPlus, ShieldCheck, Clock, Ban, Eye, Edit3, DollarSign, PackageCheck, LayoutList, LineChart, Users, ShieldAlert, UsersRound, Send } from "lucide-react";

type Role = 
  | "view_orders" 
  | "edit_shop" 
  | "manage_expenses" 
  | "manage_delivered_orders"
  | "manage_catalog"
  | "view_stats"
  | "manage_customers"
  | "full_admin";

const ROLE_LABELS: Record<Role, string> = {
  view_orders: "Voir les commandes",
  edit_shop: "Modifier la boutique",
  manage_expenses: "Gérer les dépenses",
  manage_delivered_orders: "Commandes livrées",
  manage_catalog: "Gérer le catalogue",
  view_stats: "Voir les statistiques",
  manage_customers: "Service client",
  full_admin: "Accès total (Admin)",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  view_orders: "Consulter la liste des commandes sans modification.",
  edit_shop: "Modifier le thème, les pages et les paramètres.",
  manage_expenses: "Ajouter ou modifier les dépenses de la boutique.",
  manage_delivered_orders: "Valider les commandes comme étant livrées.",
  manage_catalog: "Ajouter, modifier ou supprimer des produits.",
  view_stats: "Accès complet au tableau de bord analytique.",
  manage_customers: "Gérer les avis et contacter les clients.",
  full_admin: "Contrôle total, incluant la gestion de l'équipe.",
};

const ROLE_ICONS: Record<Role, any> = {
  view_orders: Eye,
  edit_shop: Edit3,
  manage_expenses: DollarSign,
  manage_delivered_orders: PackageCheck,
  manage_catalog: LayoutList,
  view_stats: LineChart,
  manage_customers: Users,
  full_admin: ShieldAlert,
};

interface Collab {
  id: string;
  invited_email: string;
  roles: Role[];
  status: "pending" | "active" | "revoked";
  accepted_at: string | null;
  created_at: string;
}

interface Props {
  shopId: string;
  shopName: string;
}

export function ShopCollaboratorsManager({ shopId, shopName }: Props) {
  const [list, setList] = useState<Collab[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>(["view_orders"]);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("shop_collaborators" as any) as any)
      .select("id, invited_email, roles, status, accepted_at, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    setList((data as Collab[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [shopId]);

  const toggleRole = (r: Role) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const invite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      toast.error("Adresse email invalide");
      return;
    }
    if (roles.length === 0) { toast.error("Sélectionnez au moins un rôle"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-shop-collaborator", {
        body: { shop_id: shopId, email: trimmed, roles, shop_name: shopName },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de l'envoi");
      toast.success("Invitation envoyée", { description: `Un email a été envoyé à ${trimmed}.` });
      setEmail("");
      setRoles(["view_orders"]);
      load();
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message || "Impossible d'envoyer l'invitation" });
    } finally {
      setSending(false);
    }
  };

  const updateRoles = async (id: string, nextRoles: Role[]) => {
    const { error } = await (supabase.from("shop_collaborators" as any) as any)
      .update({ roles: nextRoles }).eq("id", id);
    if (error) toast.error("Erreur"); else { toast.success("Rôles mis à jour"); load(); }
  };

  const revoke = async (id: string) => {
    if (!confirm("Révoquer l'accès de ce collaborateur ?")) return;
    const { error } = await (supabase.from("shop_collaborators" as any) as any)
      .update({ status: "revoked" }).eq("id", id);
    if (error) toast.error("Erreur"); else { toast.success("Accès révoqué"); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer définitivement cette invitation ?")) return;
    const { error } = await (supabase.from("shop_collaborators" as any) as any)
      .delete().eq("id", id);
    if (error) toast.error("Erreur"); else { toast.success("Supprimé"); load(); }
  };

  return (
    <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
            <UsersRound className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Collaborateurs</h2>
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold px-2 py-0.5">NEW</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Invitez votre équipe et gérez précisément leurs permissions sur cette boutique.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left column: Invite Form */}
        <div className="xl:col-span-7 space-y-6">
          <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-card overflow-hidden relative">
            {/* Subtle background decoration */}
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <UserPlus className="w-32 h-32" />
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg">
                <UserPlus className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold">Inviter un membre</h3>
            </div>

            <div className="space-y-8 relative z-10">
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold text-foreground">Adresse e-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="exemple@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-background/50 border-border/60 focus-visible:ring-primary/20 focus-visible:border-primary transition-all text-base"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground">Permissions attribuées</Label>
                  <span className="text-xs text-muted-foreground font-medium">{roles.length} sélectionnée(s)</span>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
                    const isActive = roles.includes(r);
                    const Icon = ROLE_ICONS[r];
                    return (
                      <label 
                        key={r} 
                        className={`group flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isActive 
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm" 
                            : "border-border/50 hover:border-border hover:bg-muted/30 bg-background/50"
                        }`}
                      >
                        <Checkbox 
                          checked={isActive} 
                          onCheckedChange={() => toggleRole(r)} 
                          className={`mt-0.5 transition-colors ${isActive ? "" : "opacity-40 group-hover:opacity-100"}`} 
                        />
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`font-bold text-sm leading-none ${isActive ? "text-primary" : "text-foreground"}`}>
                              {ROLE_LABELS[r]}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground leading-snug">
                            {ROLE_DESCRIPTIONS[r]}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Button 
                onClick={invite} 
                disabled={sending || !email.trim()} 
                className="w-full h-12 text-base font-semibold shadow-sm gap-2"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Envoi de l'invitation...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Envoyer l'invitation sécurisée
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right column: List */}
        <div className="xl:col-span-5 space-y-6">
          <Card className="p-0 rounded-2xl shadow-sm border-border/50 bg-card overflow-hidden flex flex-col h-full max-h-[800px]">
            <div className="p-6 md:p-8 border-b border-border/50 bg-muted/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Équipe actuelle</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{list.length} membre(s) invité(s)</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  <p className="text-sm font-medium">Chargement des accès...</p>
                </div>
              ) : list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">Aucun collaborateur</h4>
                  <p className="text-sm text-muted-foreground max-w-[250px]">
                    Vous êtes le seul gestionnaire de cette boutique pour le moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-2">
                  {list.map((c) => (
                    <div key={c.id} className="p-4 rounded-xl border border-border/50 bg-background hover:border-border transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">{c.invited_email}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            {c.status === "active" && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 border-0 gap-1 font-semibold"><ShieldCheck className="h-3.5 w-3.5" /> Actif</Badge>}
                            {c.status === "pending" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 gap-1 font-semibold"><Clock className="h-3.5 w-3.5" /> En attente</Badge>}
                            {c.status === "revoked" && <Badge variant="destructive" className="gap-1 font-semibold"><Ban className="h-3.5 w-3.5" /> Révoqué</Badge>}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {c.status !== "revoked" && (
                            <Button size="icon" variant="ghost" onClick={() => revoke(c.id)} title="Révoquer l'accès" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => remove(c.id)} title="Supprimer définitivement" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="bg-muted/40 rounded-lg p-2.5 flex flex-wrap gap-1.5">
                        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
                          const has = c.roles.includes(r);
                          return (
                            <button
                              key={r}
                              onClick={() => updateRoles(c.id, has ? c.roles.filter((x) => x !== r) : [...c.roles, r])}
                              className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                                has 
                                  ? "bg-primary text-primary-foreground shadow-sm" 
                                  : "bg-background text-muted-foreground border hover:border-primary/50"
                              }`}
                              title={has ? "Cliquer pour retirer ce rôle" : "Cliquer pour ajouter ce rôle"}
                            >
                              {has && <ShieldCheck className="h-3 w-3" />}
                              {ROLE_LABELS[r]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}