import { 
  Home, Image, Video, MessageSquare, CreditCard, Globe, Tag, BarChart, 
  Gift, HelpCircle, PlayCircle, Code2, Store, GraduationCap, Receipt,
  MoreHorizontal
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import logo from "@/assets/visualpro-logo.svg";

const primaryNav = [
  { title: "Accueil", url: "/", icon: Home },
  { title: "Générateur", url: "/generator", icon: Image },
  { title: "Bibliothèque", url: "/library", icon: Video },
  { title: "Sites Vitrines", url: "/showcase-manager", icon: Globe },
  { title: "Boutiques", url: "/shop-manager", icon: Store },
];

const secondaryNav = [
  { title: "Espace Étudiant", url: "/student", icon: GraduationCap },
  { title: "Tutoriel", url: "/tutorial", icon: HelpCircle },
  { title: "Démo Vidéo", url: "/demo", icon: PlayCircle },
  { title: "Abonnement", url: "/subscription", icon: CreditCard },
  { title: "Historique", url: "/payment-history", icon: Receipt },
  { title: "Parrainage", url: "/referral", icon: Gift },
  { title: "Avis", url: "/feedback", icon: MessageSquare },
  { title: "API", url: "/api-documentation", icon: Code2 },
];

const founderNav = [
  { title: "Tableau de Bord", url: "/founder-dashboard", icon: BarChart },
  { title: "Codes Promo", url: "/promo-codes", icon: Tag },
];

// Mobile bottom nav: show top 5 items
const mobileNav = [
  { title: "Accueil", url: "/", icon: Home },
  { title: "Créer", url: "/generator", icon: Image },
  { title: "Sites", url: "/showcase-manager", icon: Globe },
  { title: "Boutiques", url: "/shop-manager", icon: Store },
];

export function DashboardNav() {
  const location = useLocation();
  const [isFounder, setIsFounder] = useState(false);

  useEffect(() => {
    const checkFounderStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          // @ts-ignore
          .in("role", ["founder", "co_founder"]);
        setIsFounder(data && data.length > 0);
      }
    };
    checkFounderStatus();
  }, []);

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <>
      {/* Desktop Top Navigation Bar */}
      <nav className="hidden md:block sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2 shrink-0">
              <img src={logo} alt="VisualPro" className="h-6 w-6" />
              <span className="font-bold text-base bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                VisualPro
              </span>
            </NavLink>

            {/* Primary Nav */}
            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={300}>
                {primaryNav.map((item) => (
                  <Tooltip key={item.url}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive(item.url)
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{item.title}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>

            {/* Right side: More menu + Avatar + Theme */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="text-sm">Plus</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Apprendre</DropdownMenuLabel>
                  {secondaryNav.slice(0, 3).map((item) => (
                    <DropdownMenuItem key={item.url} asChild>
                      <NavLink to={item.url} className="flex items-center gap-2 cursor-pointer">
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </NavLink>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Compte</DropdownMenuLabel>
                  {secondaryNav.slice(3).map((item) => (
                    <DropdownMenuItem key={item.url} asChild>
                      <NavLink to={item.url} className="flex items-center gap-2 cursor-pointer">
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </NavLink>
                    </DropdownMenuItem>
                  ))}
                  {isFounder && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Administration</DropdownMenuLabel>
                      {founderNav.map((item) => (
                        <DropdownMenuItem key={item.url} asChild>
                          <NavLink to={item.url} className="flex items-center gap-2 cursor-pointer">
                            <item.icon className="h-4 w-4" />
                            {item.title}
                          </NavLink>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <ThemeToggle />
              <UserAvatar />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-safe">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileNav.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-all ${
                isActive(item.url)
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.url) ? "scale-110" : ""} transition-transform`} />
              <span className="text-[10px] font-medium">{item.title}</span>
            </NavLink>
          ))}
          
          {/* More menu on mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg text-muted-foreground">
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px] font-medium">Plus</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52 mb-2">
              <DropdownMenuItem asChild>
                <NavLink to="/library" className="flex items-center gap-2 cursor-pointer">
                  <Video className="h-4 w-4" /> Bibliothèque
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {secondaryNav.map((item) => (
                <DropdownMenuItem key={item.url} asChild>
                  <NavLink to={item.url} className="flex items-center gap-2 cursor-pointer">
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </NavLink>
                </DropdownMenuItem>
              ))}
              {isFounder && (
                <>
                  <DropdownMenuSeparator />
                  {founderNav.map((item) => (
                    <DropdownMenuItem key={item.url} asChild>
                      <NavLink to={item.url} className="flex items-center gap-2 cursor-pointer">
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </NavLink>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm text-muted-foreground">Thème</span>
                <ThemeToggle />
              </div>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-center px-2 py-1.5">
                <UserAvatar />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </>
  );
}

// Keep backward compat export
export function AppSidebar() {
  return null;
}
