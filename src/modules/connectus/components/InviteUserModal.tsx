import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConnectUsProfile } from "../types/connectus.types";
import { Send, UserPlus, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: ConnectUsProfile | null;
  onSendInvite: (targetId: string, message: string) => void;
  isFollowing?: boolean;
}

export function InviteUserModal({
  open,
  onOpenChange,
  targetUser,
  onSendInvite,
  isFollowing = false,
}: InviteUserModalProps) {
  const [inviteMessage, setInviteMessage] = useState("");

  if (!targetUser) return null;

  const defaultMessage = `Bonjour ${targetUser.full_name}, je t'invite à me suivre et échanger avec moi sur ConnectUs Ecomfy !`;

  const handleSend = () => {
    const finalMsg = inviteMessage.trim() || defaultMessage;
    onSendInvite(targetUser.id, finalMsg);
    toast({
      title: "Invitation envoyée avec succès ! 🎉",
      description: `Une invitation et une demande de suivi ont été transmises à ${targetUser.full_name}.`,
    });
    setInviteMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader className="space-y-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center font-bold shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 font-space">
                Inviter {targetUser.full_name}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Envoyez un message d'invitation personnalisé et commencez à vous suivre.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User Card Preview */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 my-2">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-[#0E7C66] to-teal-400 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden">
            {targetUser.avatar_url ? (
              <img src={targetUser.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (targetUser.full_name || "U")[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-xs text-slate-900 truncate">{targetUser.full_name}</h4>
            <p className="text-[11px] text-slate-500 truncate">@{targetUser.username}</p>
            {(targetUser.is_business || targetUser.show_shop_on_profile) && targetUser.shop_name && (
              <p className="text-[10px] text-[#0E7C66] font-semibold truncate mt-0.5">
                🏪 {targetUser.shop_name}
              </p>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Message d'invitation (Optionnel)</span>
          </label>
          <Textarea
            rows={3}
            placeholder={defaultMessage}
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            className="rounded-2xl text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-[#0E7C66]"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-full text-xs font-semibold"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 px-5"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Envoyer l'invitation</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
