import { CalendarDays, Check, ChevronDown, Copy, MailOpen, MessageCircle, MoreHorizontal, Phone, Send, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ShopOrder } from "@/lib/shopOrders";
import { phoneDigits, STATUS_MAP, whatsappLink } from "./orderDisplay";

// Boutons et menus d'une commande, communs à la vue en cartes et à la vue en liste. Un clic ici ne doit pas remonter
// à la carte ou à la ligne (qui marque la commande comme lue) : les menus, rendus à part, l'arrêtent aussi.

const stop = (e: React.MouseEvent) => e.stopPropagation();

// Dans une carte, les boutons tiennent sur une ligne : leur libellé n'apparaît que si la place le permet (largeur de
// la barre d'actions, déclarée conteneur par la carte). Classes écrites en entier pour être vues par Tailwind.
const CONTACT_BUTTON = "h-8 w-8 p-0 text-xs [@container(min-width:29rem)]:w-auto [@container(min-width:29rem)]:px-2";
const CONTACT_LABEL = "ml-1 hidden [@container(min-width:29rem)]:inline";
const SHIP_BUTTON = "h-8 w-8 p-0 text-xs [@container(min-width:21rem)]:w-auto [@container(min-width:21rem)]:px-2";
const SHIP_LABEL = "ml-1 hidden items-center [@container(min-width:21rem)]:inline-flex";

/** Statut de la commande, à la couleur du statut choisi. */
export function OrderStatusSelect({ order, onChange, className }: {
  order: ShopOrder;
  onChange: (status: string) => void;
  className?: string;
}) {
  return (
    <Select value={order.order_status} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Statut de la commande"
        className={cn("h-8 w-[132px] border-0 text-xs font-semibold", STATUS_MAP[order.order_status]?.color ?? "bg-muted text-foreground", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_MAP).map(([key, value]) => (
          <SelectItem key={key} value={key}>
            <span className="flex items-center gap-2"><span aria-hidden className={cn("h-2 w-2 rounded-full", value.dot)} />{value.label}</span>
          </SelectItem>
        ))}
        {!STATUS_MAP[order.order_status] && <SelectItem value={order.order_status}>{order.order_status}</SelectItem>}
      </SelectContent>
    </Select>
  );
}

/** Appeler et WhatsApp ; en `compact`, les icônes seules. */
export function ContactButtons({ order, compact }: { order: ShopOrder; compact?: boolean }) {
  if (!order.customer_phone) return null;
  const size = compact ? "h-8 w-8 p-0" : CONTACT_BUTTON;
  return (
    <>
      <Button asChild size="sm" className={cn(size, "bg-blue-600 text-white hover:bg-blue-700")}>
        <a href={`tel:${phoneDigits(order.customer_phone)}`} title="Appeler" aria-label="Appeler" onClick={stop}>
          <Phone className="h-3.5 w-3.5" />{!compact && <span className={CONTACT_LABEL}>Appeler</span>}
        </a>
      </Button>
      <Button asChild size="sm" className={cn(size, "bg-green-600 text-white hover:bg-green-700")}>
        <a href={whatsappLink(order)} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp" onClick={stop}>
          <MessageCircle className="h-3.5 w-3.5" />{!compact && <span className={CONTACT_LABEL}>WhatsApp</span>}
        </a>
      </Button>
    </>
  );
}

/** Menu « Envoyer » : son propre partenaire de livraison, ou une structure. Absent quand la commande ne peut pas partir. */
export function ShipMenu({ canSend, canTransmit, onShip, onTransmit, compact }: {
  canSend: boolean;
  canTransmit: boolean;
  onShip: () => void;
  onTransmit: () => void;
  compact?: boolean;
}) {
  if (!canSend) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" title="Envoyer la commande" aria-label="Envoyer la commande" onClick={stop}
          className={cn("bg-indigo-600 text-white hover:bg-indigo-700", compact ? "h-8 w-8 p-0" : SHIP_BUTTON)}>
          <Send className="h-3.5 w-3.5" />
          {!compact && <span className={SHIP_LABEL}>Envoyer<ChevronDown className="ml-0.5 h-3.5 w-3.5" /></span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        <DropdownMenuItem onSelect={onShip}>
          <Send className="mr-2 h-4 w-4 text-indigo-600" /> Expédier avec un partenaire
        </DropdownMenuItem>
        {canTransmit && (
          <DropdownMenuItem onSelect={onTransmit}>
            <Truck className="mr-2 h-4 w-4 text-emerald-600" /> Transmettre à une structure
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Autres actions de la commande. */
export function OrderMoreMenu({ order, copied, onCopy, onSchedule, onMarkRead, onShowTracking }: {
  order: ShopOrder;
  copied: boolean;
  onCopy: () => void;
  onSchedule: () => void;
  onMarkRead: () => void;
  /** Absent quand la commande n'est confiée à aucune structure. */
  onShowTracking?: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Autres actions" aria-label="Autres actions" onClick={stop}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        <DropdownMenuItem onSelect={onCopy}>
          <Copy className="mr-2 h-4 w-4 text-slate-600" /> Copier les informations
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSchedule}>
          <CalendarDays className="mr-2 h-4 w-4 text-amber-600" />
          {order.scheduled_delivery_date ? "Modifier la date de livraison" : "Planifier la livraison"}
        </DropdownMenuItem>
        {onShowTracking && (
          <DropdownMenuItem onSelect={onShowTracking}>
            <Truck className="mr-2 h-4 w-4 text-emerald-600" /> Voir le suivi
          </DropdownMenuItem>
        )}
        {!order.is_read && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onMarkRead}>
              <MailOpen className="mr-2 h-4 w-4 text-blue-600" /> Marquer comme lue
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
