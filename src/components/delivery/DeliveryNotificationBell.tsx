import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDeliveryNotifications } from "@/hooks/useDeliveryNotifications";

const TONE_DOT: Record<string, string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  error: "bg-red-400",
  info: "bg-sky-400",
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Cloche des notifications de vérification (candidat et administrateur). */
export function DeliveryNotificationBell({ onNew }: { onNew?: () => void } = {}) {
  const navigate = useNavigate();
  const { items, unread, loading, markAllRead } = useDeliveryNotifications(onNew);

  return (
    <Popover onOpenChange={(open) => { if (open && unread > 0) void markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={unread > 0 ? `${unread} notification(s) non lue(s)` : "Notifications"}
          className="relative border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-slate-900 border-slate-800 text-slate-100">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
          <span className="text-xs font-semibold">Notifications</span>
          {items.length > 0 && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> lues à l'ouverture
            </span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-xs text-slate-500">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Aucune notification pour le moment.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => n.link && navigate(n.link)}
                className="w-full text-left px-3 py-2.5 border-b border-slate-800/60 hover:bg-slate-800/60 flex gap-2.5"
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TONE_DOT[n.tone] ?? TONE_DOT.info}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-white">{n.title}</span>
                  {n.body && <span className="block text-[11px] text-slate-400 mt-0.5">{n.body}</span>}
                  <span className="block text-[10px] text-slate-500 mt-1">{formatWhen(n.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
