import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "./CUButton";
import { Textarea } from "@/components/ui/textarea";
import { ConnectUsProfile } from "../types/connectus.types";
import { Send, UserPlus, Sparkles, Loader2 } from "lucide-react";

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: ConnectUsProfile | null;
  onSendInvite: (targetId: string, message: string) => Promise<boolean>;
}

export function InviteUserModal({ open, onOpenChange, targetUser, onSendInvite }: InviteUserModalProps) {
  const [inviteMessage, setInviteMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!targetUser) return null;

  const defaultMessage = `Bonjour ${targetUser.full_name}, je t'invite à me suivre et à échanger avec moi sur ConnectUs !`;

  const handleSend = async () => {
    setSending(true);
    const ok = await onSendInvite(targetUser.user_id, inviteMessage.trim() || defaultMessage);
    setSending(false);
    if (ok) {
      setInviteMessage("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader className="space-y-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 font-space">Inviter {targetUser.full_name}</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Vous suivrez ce membre et il recevra votre message d'invitation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 my-2">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-[#0E7C66] to-teal-400 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden">
            {targetUser.avatar_url ? <img src={targetUser.avatar_url} alt="" className="h-full w-full object-cover" /> : (targetUser.full_name || "U")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-xs text-slate-900 truncate">{targetUser.full_name}</h4>
            <p className="text-[11px] text-slate-500 truncate">@{targetUser.username}</p>
            {Boolean(targetUser.show_shop_on_profile) && targetUser.shop_name && (
              <p className="text-[10px] text-[#0E7C66] font-semibold truncate mt-0.5">🏪 {targetUser.shop_name}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="invite-message" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Message (facultatif)</span>
          </label>
          <Textarea
            id="invite-message"
            rows={3}
            maxLength={500}
            placeholder={defaultMessage}
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            className="rounded-2xl text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-[#0E7C66]"
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={sending} className="rounded-full text-xs font-semibold">
            Annuler
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending} className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold gap-2">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>Envoyer l'invitation</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
