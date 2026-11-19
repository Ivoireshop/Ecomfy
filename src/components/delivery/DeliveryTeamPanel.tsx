import React, { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import {
  DELIVERY_ROLE_LABELS,
  type DeliveryAssignableDriver,
  type DeliveryStaffMember,
  type DeliveryStaffRole,
  type DeliveryWorkspaceRole,
} from "@/types/delivery";

const STATUS_LABELS: Record<DeliveryStaffMember["status"], string> = {
  invited: "Invitation en attente",
  active: "Actif",
  inactive: "Désactivé",
};

/** Lien à transmettre à l'invité (l'envoi par e-mail n'est pas branché : on copie le lien). */
const inviteLink = (token: string) => `${window.location.origin}/delivery/join?token=${token}`;

interface Props {
  companyId: string;
  /** Rôle de la personne connectée : seul le propriétaire nomme ou modifie un administrateur. */
  role: DeliveryWorkspaceRole;
}

export function DeliveryTeamPanel({ companyId, role }: Props) {
  const { toast } = useToast();
  const [team, setTeam] = useState<DeliveryStaffMember[]>([]);
  const [drivers, setDrivers] = useState<DeliveryAssignableDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<DeliveryStaffRole>("operations");
  const [driverId, setDriverId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [members, drv] = await Promise.all([
        deliveryService.listTeam(companyId),
        deliveryService.getAssignableDrivers(companyId),
      ]);
      setTeam(members);
      setDrivers(drv);
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Équipe indisponible", description: err instanceof Error ? err.message : "Erreur inattendue" });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast({ title: success });
      await load();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Action impossible", description: err instanceof Error ? err.message : "Erreur inattendue" });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      toast({ title: "Lien d'invitation copié", description: "Transmettez-le à la personne invitée (valable 14 jours)." });
    } catch {
      toast({ variant: "destructive", title: "Copie impossible", description: inviteLink(token) });
    }
  };

  const invite = async () => {
    setBusy(true);
    try {
      const token = await deliveryService.inviteStaff(companyId, email, newRole, newRole === "driver" ? driverId : null);
      await copy(token);
      setEmail("");
      setDriverId("");
      await load();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Invitation impossible", description: err instanceof Error ? err.message : "Erreur inattendue" });
    } finally {
      setBusy(false);
    }
  };

  // Les livreurs déjà liés à un compte ne sont plus proposés.
  const takenDrivers = new Set(team.filter((m) => m.driver_id && m.status !== "inactive").map((m) => m.driver_id));
  const freeDrivers = drivers.filter((d) => !takenDrivers.has(d.id));
  const roles: DeliveryStaffRole[] = role === "owner" ? ["admin", "operations", "reception", "driver"] : ["operations", "reception", "driver"];
  const active = team.filter((m) => m.status === "active").length;

  return (
    <Card className="bg-slate-900 border-slate-800 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" /> Équipe de la structure
          <span className="text-xs font-normal text-slate-400">
            {team.length} {team.length > 1 ? "collaborateurs" : "collaborateur"} • {active} {active > 1 ? "actifs" : "actif"}
          </span>
        </h2>
        <Button onClick={load} size="sm" variant="outline" disabled={loading} className="bg-slate-900 border-slate-800 text-slate-300">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-end rounded-lg border border-slate-800 bg-slate-950 p-3">
        <div>
          <label className="text-xs text-slate-400" htmlFor="staff-email">E-mail du collaborateur</label>
          <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.com" className="bg-slate-900 border-slate-700" />
        </div>
        <div>
          <label className="text-xs text-slate-400" htmlFor="staff-role">Rôle</label>
          <select id="staff-role" value={newRole} onChange={(e) => setNewRole(e.target.value as DeliveryStaffRole)} className="h-10 w-full rounded-md bg-slate-900 border border-slate-700 text-sm px-2 text-slate-200">
            {roles.map((r) => (
              <option key={r} value={r}>{DELIVERY_ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        {newRole === "driver" ? (
          <div>
            <label className="text-xs text-slate-400" htmlFor="staff-driver">Fiche livreur</label>
            <select id="staff-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)} className="h-10 w-full rounded-md bg-slate-900 border border-slate-700 text-sm px-2 text-slate-200">
              <option value="">Choisir…</option>
              {freeDrivers.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>
        ) : <div />}
        <Button onClick={invite} disabled={busy || !email.trim() || (newRole === "driver" && !driverId)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
          <UserPlus className="w-4 h-4 mr-2" /> Inviter
        </Button>
      </div>

      {team.length === 0 && !loading ? (
        <p className="text-sm text-slate-500">Aucun collaborateur pour le moment. Invitez votre équipe : chacun ne verra que ce que son rôle permet.</p>
      ) : (
        <div className="space-y-2">
          {team.map((m) => {
            const locked = m.role === "admin" && role !== "owner";
            return (
              <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{m.invited_email}</span>
                    <Badge className="bg-slate-800 text-slate-300 text-[10px]">{DELIVERY_ROLE_LABELS[m.role]}</Badge>
                    <Badge className={m.status === "active" ? "bg-emerald-500/20 text-emerald-300 text-[10px]" : m.status === "invited" ? "bg-amber-500/20 text-amber-300 text-[10px]" : "bg-red-500/20 text-red-300 text-[10px]"}>
                      {STATUS_LABELS[m.status]}
                    </Badge>
                    {m.driver_name && <span className="text-[11px] text-slate-400">Fiche : {m.driver_name}</span>}
                  </div>
                  {m.status === "active" && (
                    <p className="text-[11px] text-slate-400">
                      {m.driver_id
                        ? `${m.assigned_total} attribuée(s) • ${m.in_progress} en cours • ${m.delivered} livrée(s) • `
                        : ""}
                      {m.actions_30d} action(s) sur 30 jours
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.status === "invited" && m.invitation_token && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => copy(m.invitation_token!)} className="bg-slate-900 border-slate-700 text-slate-200 text-xs">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copier le lien
                    </Button>
                  )}
                  {m.status === "invited" && !locked && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => deliveryService.revokeStaffInvite(m.id), "Invitation révoquée")} className="bg-slate-900 border-red-500/40 text-red-400 text-xs">
                      Révoquer
                    </Button>
                  )}
                  {m.status === "active" && !locked && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => deliveryService.setStaffStatus(m.id, "inactive"), "Accès désactivé")} className="bg-slate-900 border-red-500/40 text-red-400 text-xs">
                      Désactiver
                    </Button>
                  )}
                  {m.status === "inactive" && !locked && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => deliveryService.setStaffStatus(m.id, "active"), "Accès réactivé")} className="bg-slate-900 border-slate-700 text-slate-200 text-xs">
                      Réactiver
                    </Button>
                  )}
                  {m.status !== "invited" && !locked && m.role !== "driver" && (
                    <select
                      aria-label="Changer le rôle"
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => act(() => deliveryService.setStaffRole(m.id, e.target.value as DeliveryStaffRole), "Rôle modifié")}
                      className="h-8 rounded-md bg-slate-900 border border-slate-700 text-xs px-2 text-slate-200"
                    >
                      {roles.filter((r) => r !== "driver").map((r) => (
                        <option key={r} value={r}>{DELIVERY_ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default DeliveryTeamPanel;
