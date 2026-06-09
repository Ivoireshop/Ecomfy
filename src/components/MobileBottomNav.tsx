import { Home, Image, CreditCard, Menu } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Video, Globe, Store, GraduationCap, HelpCircle, PlayCircle, Gift, MessageSquare, Code2, Receipt, BookOpen } from "lucide-react";

const mainNav = [
  { title: "Accueil", url: "/", icon: Home },
  { title: "Générateur", url: "/generator", icon: Image },
  { title: "Abonnement", url: "/subscription", icon: CreditCard },
];

const allItems = [
  { title: "Accueil", url: "/", icon: Home },
  { title: "Générateur", url: "/generator", icon: Image },
  { title: "Bibliothèque", url: "/library", icon: Video },
  { title: "Formations", url: "/courses-manager", icon: BookOpen },
  { title: "Boutiques", url: "/shop-manager", icon: Store },
  { title: "Espace Étudiant", url: "/student", icon: GraduationCap },
  { title: "Tutoriel", url: "/tutorial", icon: HelpCircle },
  { title: "Démo Vidéo", url: "/demo", icon: PlayCircle },
  { title: "Abonnement", url: "/subscription", icon: CreditCard },
  { title: "Historique", url: "/payment-history", icon: Receipt },
  { title: "Parrainage", url: "/referral", icon: Gift },
  { title: "Avis", url: "/feedback", icon: MessageSquare },
  { title: "API", url: "/api-documentation", icon: Code2 },
];

const PUBLIC_PAGES = ["/", "/auth", "/reset-password", "/privacy-policy", "/terms-of-service", "/cookies-policy", "/api-documentation", "/legal-notice"];

export function MobileBottomNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isShowcaseView = location.pathname.startsWith("/showcase/");
  const isShopView = location.pathname.startsWith("/shop/") || location.pathname.startsWith("/shop-preview/");
  const isOrderConfirmed = location.pathname.startsWith("/order-confirmed");
  const isPublicPage = PUBLIC_PAGES.includes(location.pathname);

  if (isShowcaseView || isShopView || isPublicPage || isOrderConfirmed) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-around h-14">
        {mainNav.map((item) => (
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
        ))}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] text-muted-foreground transition-colors">
              <Menu className="h-5 w-5" />
              <span>Plus</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl pb-8">
            <div className="grid grid-cols-3 gap-3 pt-4">
              {allItems.map((item) => (
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
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
