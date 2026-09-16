import { Home, Image, Store, Truck, Menu, Users, CreditCard, FolderHeart, BarChart2, Settings, LogOut, GraduationCap, Globe } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NavItemDef {
  title: string;
  url: string;
  icon: React.ElementType;
  comingSoon?: boolean;
  onClick?: string;
}

const mainNav: NavItemDef[] = [
  { title: "Accueil", url: "/dashboard", icon: Home },
  { title: "Boutique", url: "/shop-manager", icon: Store },
  { title: "Académie", url: "/academy", icon: GraduationCap },
  { title: "ConnectUs", url: "/connectus", icon: Globe, comingSoon: true },
];

const activeItems: NavItemDef[] = [
  { title: "Accueil", url: "/dashboard", icon: Home },
  { title: "Boutique", url: "/shop-manager", icon: Store },
  { title: "Académie", url: "/academy", icon: GraduationCap },
  { title: "Communauté", url: "/community", icon: Users },
  { title: "Tarifs", url: "/pricing", icon: CreditCard },
  { title: "Bibliothèque", url: "/library", icon: FolderHeart },
  { title: "Statistiques", url: "/statistics", icon: BarChart2 },
  { title: "Paramètres", url: "/profile", icon: Settings },
];

const comingSoonItems: NavItemDef[] = [
  { title: "ConnectUs 🌐", url: "/connectus", icon: Globe, comingSoon: true },
  { title: "Ecomfy Pay 💳", url: "/ecomfy-pay", icon: CreditCard, comingSoon: true },
  { title: "Studio IA", url: "/studio", icon: Image, comingSoon: true },
  { title: "Livraison 🚚", url: "/delivery-dashboard", icon: Truck, comingSoon: true },
];

const PUBLIC_PAGES = ["/", "/auth", "/reset-password", "/privacy-policy", "/terms-of-service", "/cookies-policy", "/legal-notice"];

export function MobileBottomNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const isShowcaseView = location.pathname.startsWith("/showcase/");
  const isShopView = location.pathname.startsWith("/shop/") || location.pathname.startsWith("/shop-preview/");
  const isOrderConfirmed = location.pathname.startsWith("/order-confirmed");
  const isPublicPage = PUBLIC_PAGES.includes(location.pathname);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch (error) {
      console.error("Erreur de déconnexion", error);
    }
  };

  if (isShowcaseView || isShopView || isPublicPage || isOrderConfirmed) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-around h-14">
        {mainNav.map((item) => {
          if (item.comingSoon) {
            return (
              <button
                key={item.title}
                onClick={() => {
                  toast({
                    title: "Bientôt disponible 🚀",
                    description: `L'option ${item.title} sera bientôt accessible.`,
                  });
                }}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] text-slate-400 opacity-60 cursor-not-allowed relative"
              >
                <item.icon className="h-5 w-5 opacity-50" />
                <span className="truncate">{item.title}</span>
                <span className="absolute -top-1 right-1 text-[7px] font-extrabold bg-amber-100 text-amber-900 px-1 rounded-full">
                  Bientôt
                </span>
              </button>
            );
          }

          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] transition-colors ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </NavLink>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] text-muted-foreground transition-colors">
              <Menu className="h-5 w-5" />
              <span>Plus</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[75vh] rounded-t-2xl pb-8 overflow-y-auto">
            <div className="space-y-4 pt-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-1">
                  Fonctionnalités Disponibles
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {activeItems.map((item) => (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      end={item.url === "/"}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="text-center leading-tight">{item.title}</span>
                    </NavLink>
                  ))}
                  <button
                    onClick={() => {
                      setOpen(false);
                      handleSignOut();
                    }}
                    className="flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs transition-colors text-muted-foreground hover:bg-muted"
                  >
                    <LogOut className="h-5 w-5 text-rose-500" />
                    <span className="text-center leading-tight">Déconnexion</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block mb-2 px-1">
                  Bientôt Disponible
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {comingSoonItems.map((item) => (
                    <button
                      key={item.title}
                      onClick={() => {
                        toast({
                          title: "Bientôt disponible 🚀",
                          description: `L'option ${item.title.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()} sera bientôt accessible.`,
                        });
                      }}
                      className="flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs transition-colors text-slate-400 bg-slate-50/60 opacity-60 cursor-not-allowed relative border border-slate-200/60"
                    >
                      <item.icon className="h-5 w-5 opacity-50" />
                      <span className="text-center leading-tight line-clamp-1">{item.title}</span>
                      <span className="text-[8px] font-extrabold px-1 rounded bg-slate-200 text-slate-600 mt-0.5">
                        Bientôt
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
