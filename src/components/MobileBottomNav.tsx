import { Home, Store, Menu, LogOut, GraduationCap, Globe } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSelector } from "@/components/LanguageSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isExactMatch, useNavigationMenu, type NavigationItem } from "@/hooks/useNavigationMenu";

/** Raccourcis de la barre du bas ; le menu complet est derrière « Plus ». */
const mainNav: NavigationItem[] = [
  { title: "Accueil", url: "/dashboard", icon: Home },
  { title: "Boutique", url: "/shop-manager", icon: Store },
  { title: "Académie", url: "/academy", icon: GraduationCap },
  { title: "ConnectUs", url: "/connectus", icon: Globe },
];

const PUBLIC_PAGES = ["/", "/auth", "/reset-password", "/privacy-policy", "/terms-of-service", "/cookies-policy", "/legal-notice"];

export function MobileBottomNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { mainItems, comingSoonItems, founderItems, founderLabel, accountItems, communityUnread } =
    useNavigationMenu({ enabled: open });

  const isShowcaseView = location.pathname.startsWith("/showcase/");
  const isShopView = location.pathname.startsWith("/shop/") || location.pathname.startsWith("/shop-preview/");
  const isOrderConfirmed = location.pathname.startsWith("/order-confirmed");
  // ConnectUs a sa propre barre de navigation mobile (et un retour au tableau de bord) : pas de double barre.
  const isConnectUs = location.pathname.startsWith("/connectus");
  const isPublicPage = PUBLIC_PAGES.includes(location.pathname);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch (error) {
      console.error("Erreur de déconnexion", error);
    }
  };

  if (isShowcaseView || isShopView || isPublicPage || isOrderConfirmed || isConnectUs) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-around h-14">
        {mainNav.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] transition-colors ${
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
          </NavLink>
        ))}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] text-muted-foreground transition-colors">
              <span className="relative">
                <Menu className="h-5 w-5" />
                {communityUnread > 0 && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                )}
              </span>
              <span>Plus</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[75vh] rounded-t-2xl pb-8 overflow-y-auto" aria-describedby={undefined}>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            {/* Mêmes rubriques, dans le même ordre, que le menu de bureau. */}
            <div className="space-y-4 pt-4">
              <MenuGrid items={mainItems} onSelect={() => setOpen(false)} />

              <MenuSection title="Bientôt disponible" tone="text-amber-700">
                <div className="grid grid-cols-3 gap-2">
                  {comingSoonItems.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => {
                        toast({
                          title: "Bientôt disponible 🚀",
                          description: `L'option ${item.title} sera disponible très prochainement.`,
                        });
                      }}
                      className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-[11px] transition-colors text-slate-400 bg-slate-50/60 opacity-60 cursor-not-allowed relative border border-slate-200/60"
                    >
                      <item.icon className="h-5 w-5 opacity-50" />
                      <span className="text-center leading-tight line-clamp-1">{item.title}</span>
                      <span className="text-[8px] font-extrabold px-1 rounded bg-slate-200 text-slate-600 mt-0.5">
                        Bientôt
                      </span>
                    </button>
                  ))}
                </div>
              </MenuSection>

              {founderItems.length > 0 && (
                <MenuSection title={founderLabel}>
                  <MenuGrid items={founderItems} onSelect={() => setOpen(false)} />
                </MenuSection>
              )}

              <div className="border-t border-slate-100 pt-3">
                <MenuGrid items={accountItems} onSelect={() => setOpen(false)}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      handleSignOut();
                    }}
                    className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-[11px] transition-colors text-muted-foreground hover:bg-muted"
                  >
                    <LogOut className="h-5 w-5 text-rose-500" />
                    <span className="text-center leading-tight">Déconnexion</span>
                  </button>
                </MenuGrid>
                <div className="mt-2 flex justify-center">
                  <LanguageSelector showLabel />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

function MenuSection({ title, tone = "text-slate-400", children }: { title: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-3">
      <span className={`text-[11px] font-bold uppercase tracking-wider block mb-2 px-1 ${tone}`}>{title}</span>
      {children}
    </div>
  );
}

function MenuGrid({ items, onSelect, children }: { items: NavigationItem[]; onSelect: () => void; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <NavLink
          key={item.url}
          to={item.url}
          end={isExactMatch(item.url)}
          onClick={onSelect}
          className={({ isActive }) =>
            `flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-[11px] transition-colors ${
              isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"
            }`
          }
        >
          <span className="relative">
            <item.icon className="h-5 w-5" />
            {!!item.badge && (
              <span
                className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground"
                aria-label={`${item.badge} non lu${item.badge > 1 ? "s" : ""}`}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </span>
          <span className="text-center leading-tight">{item.title}</span>
        </NavLink>
      ))}
      {children}
    </div>
  );
}
