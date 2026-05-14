import { BarChart3, ShoppingCart, Package, Store, Palette, Settings, Users, TrendingUp, Zap, Eye, Save, Loader2, ArrowLeft, PieChart, Paintbrush, Receipt, MessageSquare, Wallet, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type ActiveSection = "overview" | "products" | "orders" | "appearance" | "statistics" | "theme" | "billing" | "finances" | "ai-optimizer" | "reviews" | "settings";

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
}

const NAV_ITEMS: { id: ActiveSection; label: string; icon: React.ElementType; }[] = [
  { id: "overview", label: "Tableau de bord", icon: BarChart3 },
  { id: "orders", label: "Commandes", icon: ShoppingCart },
  { id: "products", label: "Produits", icon: Package },
  { id: "statistics", label: "Statistiques", icon: PieChart },
  { id: "finances", label: "Finances", icon: Wallet },
  { id: "ai-optimizer", label: "Optimiseur IA", icon: Brain },
  { id: "appearance", label: "Boutique", icon: Palette },
  { id: "theme", label: "Thème", icon: Paintbrush },
  { id: "billing", label: "Facturation", icon: Receipt },
  { id: "reviews", label: "Avis", icon: MessageSquare },
  { id: "settings", label: "Paramètres", icon: Settings },
];

export function ShopSidebar({
  shopName, slug, primaryColor, logoUrl, activeSection, onSectionChange,
  unreadOrders, productCount, isActivated, onBack, onSave, saving, onPreview, isPublished,
}: ShopSidebarProps) {
  return (
    <aside className="w-[240px] shrink-0 bg-[#1a1d2e] text-white flex flex-col min-h-screen sticky top-0">
      {/* Header */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: primaryColor + "30" }}>
                <Store className="h-4 w-4" style={{ color: primaryColor }} />
              </div>
            )}
            <span className="font-semibold text-sm truncate">{shopName}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          const count = item.id === "orders" ? unreadOrders : item.id === "products" ? productCount : 0;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.id === "orders" ? "bg-blue-500 text-white" : "bg-white/20 text-white/80"
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
          <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2 text-orange-300 text-xs font-medium">
              <Zap className="h-3.5 w-3.5" />
              Non activée
            </div>
          </div>
        )}
        {isActivated && isPublished && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-green-300 hover:text-white hover:bg-green-500/20"
            onClick={onPreview}
            title="Ouvrir le lien public à utiliser pour vos campagnes publicitaires"
          >
            <Eye className="h-4 w-4" />
            Voir en magasin
          </Button>
        )}
        <Button
          size="sm"
          className="w-full gap-2"
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
