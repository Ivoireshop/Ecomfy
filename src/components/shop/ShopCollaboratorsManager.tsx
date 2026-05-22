import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Mail, Trash2, UserPlus, ShieldCheck, Clock, Ban } from "lucide-react";

type Role = "view_orders" | "edit_shop" | "manage_expenses" | "manage_delivered_orders";

const ROLE_LABELS: Record<Role, string> = {
  view_orders: "Voir les commandes",
  edit_shop: "Modifier la boutique",
  manage_expenses: "Gérer les dépenses",
  manage_delivered_orders: "Gérer les commandes livrées",
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Collaborateurs</h2>
        <Badge className="bg-amber-500 hover:bg-amber-500 text-white">BETA</Badge>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Invitez des collaborateurs par email et choisissez précisément ce qu'ils peuvent faire sur la boutique. Ils accèdent à la boutique après avoir accepté l'invitation depuis leur compte VisualPro.
      </p>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Inviter un collaborateur</h3>
        <div className="space-y-1.5">
          <Label>Email du collaborateur</Label>
          <Input
            type="email"
            placeholder="exemple@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Rôles attribués</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <label key={r} className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                <span className="text-sm">{ROLE_LABELS[r]}</span>
              </label>
            ))}
          </div>
        </div>
        <Button onClick={invite} disabled={sending} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Envoyer l'invitation
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Collaborateurs ({list.length})</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun collaborateur pour le moment.</p>
        ) : (
          <div className="divide-y">
            {list.map((c) => (
              <div key={c.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm break-all">{c.invited_email}</span>
                    {c.status === "active" && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white gap-1"><ShieldCheck className="h-3 w-3" /> Actif</Badge>}
                    {c.status === "pending" && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> En attente</Badge>}
                    {c.status === "revoked" && <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> Révoqué</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
                      const has = c.roles.includes(r);
                      return (
                        <button
                          key={r}
                          onClick={() => updateRoles(c.id, has ? c.roles.filter((x) => x !== r) : [...c.roles, r])}
                          className={`text-[11px] px-2 py-1 rounded-full border transition ${has ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:border-primary/50"}`}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.status !== "revoked" && (
                    <Button size="sm" variant="outline" onClick={() => revoke(c.id)}>Révoquer</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}