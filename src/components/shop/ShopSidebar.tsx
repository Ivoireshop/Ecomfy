import { BarChart3, ShoppingCart, Package, Store, Palette, Settings, Users, TrendingUp, Zap, Eye, Save, Loader2, ArrowLeft, PieChart, Paintbrush, Receipt, MessageSquare, Wallet, Brain, ShoppingBag, UserPlus, Bot, LayoutTemplate, Heart, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type ActiveSection = "overview" | "products" | "orders" | "abandoned" | "loyal-customers" | "promo-codes" | "appearance" | "statistics" | "theme" | "shop-themes" | "billing" | "finances" | "ai-optimizer" | "assistant" | "reviews" | "collaborators" | "settings";

interface ShopSidebarProps {
  shopName: string;
  slug: string;
  primaryColor: string;
  logoUrl?: string | null;
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  unreadOrders: number;
  productCount: number;
  isActivated: boolean;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  onPreview: () => void;
  isPublished: boolean;
  allowedSections?: ActiveSection[];
  isOwner?: boolean;
  onMobileClose?: () => void;
}

const NAV_ITEMS: { id: ActiveSection; label: string; icon: React.ElementType; isNew?: boolean; ownerOnly?: boolean }[] = [
  { id: "overview", label: "Tableau de bord", icon: BarChart3 },
  { id: "orders", label: "Commandes", icon: ShoppingCart },
  { id: "abandoned", label: "Paniers abandonnés", icon: ShoppingBag, isNew: true },
  { id: "loyal-customers", label: "Clients Fidèles", icon: Heart, isNew: true },
  { id: "promo-codes", label: "Codes Promo", icon: Tag, isNew: true },
  { id: "products", label: "Produits", icon: Package },
  { id: "statistics", label: "Statistiques", icon: PieChart },
  { id: "finances", label: "Finances", icon: Wallet },
  { id: "ai-optimizer", label: "Optimiseur IA", icon: Brain },
  { id: "assistant", label: "Assistant IA", icon: Bot, isNew: true },
  { id: "appearance", label: "Boutique", icon: Palette },
  { id: "theme", label: "Thème", icon: Paintbrush },
  { id: "shop-themes", label: "Thèmes", icon: LayoutTemplate, isNew: true },
  { id: "billing", label: "Facturation", icon: Receipt },
  { id: "reviews", label: "Avis", icon: MessageSquare },
  { id: "collaborators", label: "Collaborateurs", icon: UserPlus, isNew: true, ownerOnly: true },
  { id: "settings", label: "Paramètres", icon: Settings },
];

export function ShopSidebar({
  shopName, slug, primaryColor, logoUrl, activeSection, onSectionChange,
  unreadOrders, productCount, isActivated, onBack, onSave, saving, onPreview, isPublished,
  allowedSections, isOwner = true, onMobileClose,
}: ShopSidebarProps) {
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    if (allowedSections && !allowedSections.includes(item.id)) return false;
    return true;
  });
  return (
    <aside className="w-[240px] shrink-0 bg-white border-r border-slate-200 text-slate-700 flex flex-col h-full md:h-screen md:sticky md:top-0 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: primaryColor + "15" }}>
                <Store className="h-4 w-4" style={{ color: primaryColor }} />
              </div>
            )}
            <span className="font-space font-bold text-[15px] truncate text-slate-900">{shopName}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {visibleItems.map((item) => {
          const isActive = activeSection === item.id;
          const count = item.id === "orders" ? unreadOrders : item.id === "products" ? productCount : 0;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSectionChange(item.id);
                if (onMobileClose) onMobileClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-inter transition-all ${
                isActive
                  ? "bg-[#0E7C66]/10 text-[#0E7C66] font-semibold"
                  : "text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0 opacity-75" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.isNew && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">NEW</span>
              )}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.id === "orders" ? "bg-[#0E7C66] text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {count > 999 ? "999+" : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-3 pb-4 space-y-2">
        {!isActivated && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2 text-orange-600 text-xs font-medium">
              <Zap className="h-3.5 w-3.5" />
              Non activée
            </div>
          </div>
        )}
        {isActivated && isPublished && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-[#0E7C66] hover:text-[#0E7C66] hover:bg-[#0E7C66]/10"
            onClick={onPreview}
            title="Ouvrir le lien public à utiliser pour vos campagnes publicitaires"
          >
            <Eye className="h-4 w-4" />
            Voir en magasin
          </Button>
        )}
        <Button
          size="sm"
          className="w-full gap-2 bg-[#0E7C66] hover:bg-[#0E7C66]/90 text-white"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sauvegarder
        </Button>
      </div>
    </aside>
  );
}
