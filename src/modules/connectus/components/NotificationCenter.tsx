import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Heart, UserPlus, MessageSquare, ShoppingBag, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface NotificationItem {
  id: string;
  actorName: string;
  actorAvatar?: string | null;
  type: "follow" | "like" | "comment" | "sale";
  text: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    actorName: "Aminata Diallo",
    actorAvatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
    type: "follow",
    text: "a commencé à vous suivre sur ConnectUs.",
    time: "Il y a 15 min",
    read: false,
  },
  {
    id: "n2",
    actorName: "Koffi Mensah",
    actorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    type: "like",
    text: "a aimé votre publication sur la nouvelle collection.",
    time: "Il y a 45 min",
    read: false,
  },
  {
    id: "n3",
    actorName: "Sékou Tech",
    actorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    type: "comment",
    text: 'a commenté : "Superbe réactivité pour l\'expédition !" ',
    time: "Il y a 2 heures",
    read: true,
  }
];

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast({ title: "Toutes les notifications marquées comme lues ✓" });
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "follow":
        return <UserPlus className="h-4 w-4 text-[#0E7C66]" />;
      case "like":
        return <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />;
      case "comment":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "sale":
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

      <div className="space-y-2">
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
              !n.read ? "bg-emerald-50/40 border-emerald-200/60" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                {n.actorAvatar ? (
                  <img src={n.actorAvatar} alt="" className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">
                    {n.actorName[0]}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-2xs">
                  {getIcon(n.type)}
                </span>
              </div>

              <div className="min-w-0 text-xs">
                <p className="text-slate-900">
                  <span className="font-bold">{n.actorName}</span> {n.text}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">{n.time}</span>
              </div>
            </div>

            {!n.read && (
              <Badge className="bg-[#0E7C66] h-2 w-2 rounded-full p-0 border-0 shrink-0" />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
