import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock, Sparkles, Check, Trash2, PhoneCall, Loader2, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  scheduled_delivery_date?: string | null;
  internal_delivery_note?: string | null;
}

interface ScheduleDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSaveSuccess: (orderId: string, deliveryDate: string | null, note: string | null) => void;
}

export function ScheduleDeliveryModal({
  isOpen,
  onClose,
  order,
  onSaveSuccess,
}: ScheduleDeliveryModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  // Helper to format ISO YYYY-MM-DD
  const formatISODate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getTodayISO = (): string => formatISODate(new Date());

  const getTomorrowISO = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatISODate(d);
  };

  const getAfterTomorrowISO = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return formatISODate(d);
  };

  const getNextMondayISO = (): string => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysUntilMonday);
    return formatISODate(d);
  };

  useEffect(() => {
    if (order) {
      setSelectedDate(order.scheduled_delivery_date || "");
      setNote(order.internal_delivery_note || "");
    }
  }, [order]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const dateValue = selectedDate.trim() ? selectedDate.trim() : null;
      const noteValue = note.trim() ? note.trim() : null;

      // Primary attempt: update dedicated delivery schedule columns + notes fallback
      const primaryPayload: Record<string, any> = {
        scheduled_delivery_date: dateValue,
        internal_delivery_note: noteValue,
        updated_at: new Date().toISOString(),
      };

      // Also compose a notes summary if note or date is provided
      let composedNotes: string | null = null;
      if (dateValue || noteValue) {
        const dateTag = dateValue ? `[LIVRAISON PRÉVUE: ${dateValue}]` : "";
        composedNotes = [dateTag, noteValue].filter(Boolean).join(" ");
        primaryPayload.notes = composedNotes;
      }

      let { error } = await supabase
        .from("orders")
        .update(primaryPayload as any)
        .eq("id", order.id);

      // Fallback: If PostgREST schema error (e.g., column missing or cache issue), try updating standard fields only
      if (error && (error.code === "PGRST204" || error.message?.includes("column") || error.code === "42703")) {
        console.warn("[ScheduleDeliveryModal] Fallback to standard notes column due to schema cache:", error);
        const fallbackPayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (composedNotes !== null) {
          fallbackPayload.notes = composedNotes;
        }
        const fallbackRes = await supabase
          .from("orders")
          .update(fallbackPayload as any)
          .eq("id", order.id);
        error = fallbackRes.error;
      }

      if (error) {
        console.error("Schedule delivery error detail:", error);

        let userMsg = "Impossible d'enregistrer la date de livraison.";
        if (error.code === "42501" || error.message?.includes("permission") || error.message?.includes("policy")) {
          userMsg = "Permission refusée : vous n'avez pas les droits nécessaires pour modifier cette commande.";
        } else if (error.message?.includes("FetchError") || error.message?.includes("network")) {
          userMsg = "Erreur de connexion réseau. Veuillez vérifier votre connexion internet et réessayer.";
        } else if (error.message) {
          userMsg = error.message;
        }

        toast.error("Erreur d'enregistrement", {
          description: userMsg,
        });
        return;
      }

      toast.success("Planification de livraison enregistrée !", {
        description: dateValue
          ? `Livraison programmée pour la commande #${order.order_number}.`
          : noteValue
          ? "Note enregistrée pour la commande."
          : "La date de livraison a été réinitialisée.",
      });

      onSaveSuccess(order.id, dateValue, noteValue);
      onClose();
    } catch (err: any) {
      console.error("Schedule delivery unhandled exception:", err);
      toast.error("Erreur d'enregistrement", {
        description: err?.message || "Une erreur inattendue est survenue. Les informations saisies sont conservées dans le formulaire.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSelectedDate("");
    setNote("");
  };

  const getFormattedDateLabel = (isoStr: string) => {
    if (!isoStr) return "";
    try {
      const parts = isoStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      }
    } catch (_) {}
    return isoStr;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-card border-border shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 rounded-2xl">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-extrabold text-foreground">
                Planifier la livraison
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Commande <span className="font-mono font-bold text-foreground">#{order.order_number}</span> — Client : <span className="font-semibold text-foreground">{order.customer_name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              ⚡ Raccourcis rapides
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={selectedDate === getTomorrowISO() ? "default" : "outline"}
                className={`h-11 flex flex-col items-center justify-center rounded-2xl border-2 transition-all text-xs font-bold ${
                  selectedDate === getTomorrowISO()
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-md"
                    : "border-border hover:border-indigo-300 hover:bg-indigo-50/40"
                }`}
                onClick={() => setSelectedDate(getTomorrowISO())}
              >
                <span>Demain</span>
                <span className="text-[10px] opacity-80 font-normal">
                  {new Date(Date.now() + 86400000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </Button>

              <Button
                type="button"
                variant={selectedDate === getAfterTomorrowISO() ? "default" : "outline"}
                className={`h-11 flex flex-col items-center justify-center rounded-2xl border-2 transition-all text-xs font-bold ${
                  selectedDate === getAfterTomorrowISO()
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-md"
                    : "border-border hover:border-indigo-300 hover:bg-indigo-50/40"
                }`}
                onClick={() => setSelectedDate(getAfterTomorrowISO())}
              >
                <span>Après-demain</span>
                <span className="text-[10px] opacity-80 font-normal">
                  {new Date(Date.now() + 172800000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </Button>

              <Button
                type="button"
                variant={selectedDate === getNextMondayISO() ? "default" : "outline"}
                className={`h-11 flex flex-col items-center justify-center rounded-2xl border-2 transition-all text-xs font-bold ${
                  selectedDate === getNextMondayISO()
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-md"
                    : "border-border hover:border-indigo-300 hover:bg-indigo-50/40"
                }`}
                onClick={() => setSelectedDate(getNextMondayISO())}
              >
                <span>Lundi pro.</span>
                <span className="text-[10px] opacity-80 font-normal">Prochain lundi</span>
              </Button>
            </div>
          </div>

          {/* Date Picker Input */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>📅 Choisir une date précise</span>
              {selectedDate && (
                <span className="text-indigo-600 dark:text-indigo-400 capitalize font-medium text-[11px]">
                  {getFormattedDateLabel(selectedDate)}
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                type="date"
                min={getTodayISO()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-12 rounded-2xl border-border/80 text-base font-semibold px-4 focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          {/* Internal Delivery Note */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5 text-indigo-500" />
              <span>Note interne (Échange avec le client)</span>
            </Label>
            <Textarea
              placeholder="Ex: Le client est disponible après 14h au bureau. Appeler avant de venir."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] rounded-2xl border-border/80 text-sm focus-visible:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
          {order.scheduled_delivery_date && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              disabled={saving}
              className="text-xs text-destructive hover:bg-destructive/10 rounded-xl"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Effacer la date
            </Button>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl flex-1 sm:flex-none"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex-1 sm:flex-none gap-1.5 shadow-md"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
