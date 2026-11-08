import { Card } from "@/components/ui/card";
import { Button } from "./CUButton";
import { Badge } from "@/components/ui/badge";
import { Bell, Heart, UserPlus, MessageSquare, MessageCircle, Check, UserCheck, X } from "lucide-react";
import { ConnectUsNotification } from "../types/connectus.types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface NotificationCenterProps {
  notifications: ConnectUsNotification[];
  onAcceptInvitation: (notifId: string, actorUserId: string) => Promise<boolean>;
  onDeclineInvitation: (notifId: string) => Promise<boolean>;
  onMarkAllRead: () => Promise<void>;
  onToggleFollow?: (targetUserId: string) => void;
  onOpenProfile?: (userId: string) => void;
  followingMap?: Record<string, boolean>;
}

const iconFor = (type: ConnectUsNotification["type"]) => {
  switch (type) {
    case "invite_request":
    case "follow":
      return <UserPlus className="h-4 w-4 text-[#0E7C66]" />;
    case "invite_accepted":
      return <UserCheck className="h-4 w-4 text-emerald-600" />;
    case "like":
      return <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />;
    case "comment":
    case "comment_reply":
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    default:
      return <MessageCircle className="h-4 w-4 text-amber-500" />;
  }
};

export function NotificationCenter({
  notifications,
  onAcceptInvitation,
  onDeclineInvitation,
  onMarkAllRead,
  onToggleFollow,
  onOpenProfile,
  followingMap = {},
}: NotificationCenterProps) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="font-space font-bold text-lg text-slate-900 flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#0E7C66]" /> Notifications
          {unread > 0 && <Badge className="bg-rose-500 text-white text-[10px] font-extrabold">{unread}</Badge>}
        </h2>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={onMarkAllRead} className="rounded-full text-xs font-bold border-slate-300 gap-1">
            <Check className="h-3.5 w-3.5" /> Tout marquer comme lu
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="p-10 text-center rounded-3xl space-y-2 bg-white border border-slate-200">
          <Bell className="h-10 w-10 mx-auto text-slate-300" />
          <p className="font-bold text-sm text-slate-900">Aucune notification pour le moment</p>
          <p className="text-xs text-slate-500">Vous serez prévenu ici des j'aime, commentaires, nouveaux abonnés et messages.</p>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {notifications.map((n) => {
            const when = (() => {
              const t = new Date(n.created_at).getTime();
              return Number.isNaN(t) ? "" : formatDistanceToNow(new Date(t), { addSuffix: true, locale: fr });
            })();
            const isInvitePending = n.type === "invite_request" && (!n.status || n.status === "pending");
            const actorName = n.actor?.full_name || "Un membre";

            return (
              <li key={n.id}>
                <Card
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    !n.read ? "bg-emerald-50/40 border-emerald-200/80" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button type="button" onClick={() => onOpenProfile?.(n.actor_id)} className="relative shrink-0" aria-label={`Voir le profil de ${actorName}`}>
                        {n.actor?.avatar_url ? (
                          <img src={n.actor.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover border border-slate-100" />
                        ) : (
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#0E7C66] to-emerald-400 text-white flex items-center justify-center font-bold text-sm">
                            {actorName[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-2xs">{iconFor(n.type)}</span>
                      </button>

                      <div className="min-w-0 text-xs">
                        <p className="text-slate-900 leading-snug break-words">
                          <button type="button" onClick={() => onOpenProfile?.(n.actor_id)} className="font-bold hover:underline">
                            {actorName}
                          </button>{" "}
                          {n.message || "a interagi avec vous."}
                        </p>
                        {n.post_summary && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">« {n.post_summary} »</p>}
                        <span className="text-[10px] text-slate-400 font-semibold">{when}</span>
                      </div>
                    </div>
                    {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-[#0E7C66] shrink-0 mt-1" aria-label="Non lue" />}
                  </div>

                  {isInvitePending && (
                    <div className="flex items-center gap-2 pl-14">
                      <Button size="sm" onClick={() => onAcceptInvitation(n.id, n.actor_id)} className="h-8 px-4 rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold gap-1">
                        <UserCheck className="h-3.5 w-3.5" /> Accepter
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onDeclineInvitation(n.id)} className="h-8 px-3 rounded-full text-xs font-bold text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-600 gap-1">
                        <X className="h-3.5 w-3.5" /> Refuser
                      </Button>
                    </div>
                  )}
                  {n.type === "invite_request" && n.status === "accepted" && (
                    <div className="pl-14">
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[10px]">
                        <UserCheck className="h-3 w-3" /> Invitation acceptée
                      </Badge>
                    </div>
                  )}
                  {n.type === "invite_request" && n.status === "declined" && (
                    <div className="pl-14">
                      <Badge className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]">Invitation refusée</Badge>
                    </div>
                  )}
                  {(n.type === "invite_accepted" || n.type === "follow") && onToggleFollow && !followingMap[n.actor_id] && (
                    <div className="pl-14">
                      <Button size="sm" onClick={() => onToggleFollow(n.actor_id)} className="h-8 px-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1">
                        <UserPlus className="h-3.5 w-3.5" /> Suivre en retour
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
