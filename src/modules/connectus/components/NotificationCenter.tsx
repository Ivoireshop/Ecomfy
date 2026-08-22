import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Heart, UserPlus, MessageSquare, ShoppingBag, Check, UserCheck, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ConnectUsNotification } from "../types/connectus.types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface NotificationCenterProps {
  notifications?: ConnectUsNotification[];
  onAcceptInvitation?: (notifId: string, actorUserId: string) => Promise<boolean>;
  onDeclineInvitation?: (notifId: string) => Promise<boolean>;
  onToggleFollow?: (targetUserId: string) => void;
}

const INITIAL_DEMO_NOTIFS: ConnectUsNotification[] = [
  {
    id: "demo-n1",
    user_id: "me",
    actor_id: "demo-user-1",
    actor: {
      id: "demo-user-1",
      user_id: "demo-user-1",
      username: "koffi_fashion",
      full_name: "Koffi Mensah",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      cover_url: null,
      bio: null,
      location: null,
      website_url: null,
      is_verified: true,
      is_business: true,
      followers_count: 10,
      following_count: 5,
      posts_count: 2,
      created_at: new Date().toISOString(),
    },
    type: "invite_request",
    message: "vous invite à vous abonner et le suivre sur ConnectUs !",
    status: "pending",
    read: false,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-n2",
    user_id: "me",
    actor_id: "demo-user-2",
    actor: {
      id: "demo-user-2",
      user_id: "demo-user-2",
      username: "aminata_beauty",
      full_name: "Aminata Diallo",
      avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
      cover_url: null,
      bio: null,
      location: null,
      website_url: null,
      is_verified: true,
      is_business: true,
      followers_count: 10,
      following_count: 5,
      posts_count: 2,
      created_at: new Date().toISOString(),
    },
    type: "like",
    message: "a aimé votre publication sur la nouvelle collection.",
    read: false,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];

export function NotificationCenter({
  notifications = [],
  onAcceptInvitation,
  onDeclineInvitation,
  onToggleFollow,
}: NotificationCenterProps) {
  const displayNotifs = notifications.length > 0 ? notifications : INITIAL_DEMO_NOTIFS;
  const [localNotifs, setLocalNotifs] = useState<ConnectUsNotification[]>(displayNotifs);

  const handleMarkAllRead = () => {
    setLocalNotifs(prev => prev.map(n => ({ ...n, read: true })));
    toast({ title: "Toutes les notifications marquées comme lues ✓" });
  };

  const handleAccept = async (notifId: string, actorUserId: string) => {
    setLocalNotifs(prev =>
      prev.map(n => (n.id === notifId ? { ...n, status: "accepted", read: true } : n))
    );
    if (onAcceptInvitation) {
      await onAcceptInvitation(notifId, actorUserId);
    } else {
      toast({
        title: "Invitation acceptée ✓",
        description: "Vous vous suivez mutuellement à présent !",
      });
    }
  };

  const handleDecline = async (notifId: string) => {
    setLocalNotifs(prev =>
      prev.map(n => (n.id === notifId ? { ...n, status: "declined", read: true } : n))
    );
    if (onDeclineInvitation) {
      await onDeclineInvitation(notifId);
    } else {
      toast({ title: "Invitation refusée" });
    }
  };

  const getIcon = (type: ConnectUsNotification["type"]) => {
    switch (type) {
      case "invite_request":
      case "follow":
        return <UserPlus className="h-4 w-4 text-[#0E7C66]" />;
      case "invite_accepted":
        return <UserCheck className="h-4 w-4 text-emerald-600" />;
      case "like":
        return <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />;
      case "comment":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      default:
        return <ShoppingBag className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-space font-bold text-lg text-slate-900 flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#0E7C66]" /> Centre de Notifications ConnectUs
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          className="rounded-full text-xs font-bold border-slate-300 gap-1"
        >
          <Check className="h-3.5 w-3.5" /> Tout marquer comme lu
        </Button>
      </div>

      <div className="space-y-2.5">
        {localNotifs.map((n) => {
          let timeAgo = "Récemment";
          try {
            if (n.created_at) {
              timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr });
            }
          } catch (e) {}

          const isInvitePending = n.type === "invite_request" && (!n.status || n.status === "pending");
          const isInviteAccepted = n.status === "accepted";

          return (
            <Card
              key={n.id}
              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                !n.read ? "bg-emerald-50/40 border-emerald-200/80 shadow-2xs" : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {n.actor?.avatar_url ? (
                      <img src={n.actor.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover border border-slate-100" />
                    ) : (
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#0E7C66] to-emerald-400 text-white flex items-center justify-center font-bold text-sm">
                        {(n.actor?.full_name || "M")[0]}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-2xs">
                      {getIcon(n.type)}
                    </span>
                  </div>

                  <div className="min-w-0 text-xs">
                    <p className="text-slate-900 font-medium leading-tight">
                      <span className="font-bold">{n.actor?.full_name || "Membre ConnectUs"}</span>{" "}
                      {n.message || n.post_summary || "a interagi avec vous."}
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">{timeAgo}</span>
                  </div>
                </div>

                {!n.read && (
                  <Badge className="bg-[#0E7C66] h-2.5 w-2.5 rounded-full p-0 border-0 shrink-0" />
                )}
              </div>

              {/* Interactive Action Buttons for Follow Invitations */}
              {isInvitePending && (
                <div className="flex items-center gap-2 pt-1 pl-14">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(n.id, n.actor_id)}
                    className="h-8 px-4 rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold gap-1 shadow-2xs"
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Accepter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecline(n.id)}
                    className="h-8 px-3 rounded-full text-xs font-bold text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-600 gap-1"
                  >
                    <X className="h-3.5 w-3.5" /> Refuser
                  </Button>
                </div>
              )}

              {/* State when invitation is accepted */}
              {isInviteAccepted && (
                <div className="flex items-center gap-2 pt-1 pl-14 text-xs font-bold text-emerald-700">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[10px]">
                    <UserCheck className="h-3 w-3" /> Invitation acceptée • Suivi mutuel activé
                  </Badge>
                </div>
              )}

              {/* Return invitation accepted banner */}
              {n.type === "invite_accepted" && (
                <div className="flex items-center gap-2 pt-1 pl-14">
                  <Button
                    size="sm"
                    onClick={() => onToggleFollow && onToggleFollow(n.actor_id)}
                    className="h-8 px-4 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold gap-1 shadow-2xs"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Suivre en retour
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
