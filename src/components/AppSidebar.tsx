import { 
  Home, Image, Video, Store, BarChart2, Settings, LogOut, Code2, Bug, Book, Tag, Users, CreditCard, FolderHeart, Truck, GraduationCap, Globe, Search
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useToast } from "@/hooks/use-toast";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemProps {
  item: {
    title: string;
    url: string;
    icon: React.ElementType;
    comingSoon?: boolean;
    onClick?: () => void;
  };
  isCollapsed: boolean;
}

const NavItem = ({ item, isCollapsed }: NavItemProps) => {
  const { toast } = useToast();

  if (item.comingSoon) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild tooltip={`${item.title} (Bientôt disponible)`}>
              <div
                onClick={(e) => {
                  e.preventDefault();
                  toast({
                    title: "Bientôt disponible 🚀",
                    description: `L'option ${item.title.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()} sera disponible très prochainement.`,
                  });
                }}
                className="flex items-center justify-between gap-2 rounded-r-[9px] px-2.5 py-2 transition-all duration-200 font-inter text-[13px] font-medium text-slate-400 bg-slate-50/40 opacity-60 cursor-not-allowed w-full text-left select-none border-l-4 border-transparent hover:bg-slate-100/50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <item.icon className="h-[18px] w-[18px] shrink-0 opacity-50 text-slate-400" />
                  <span className={isCollapsed ? "md:hidden truncate" : "truncate"}>
                    {item.title}
                  </span>
                </div>
                {!isCollapsed && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-600 shrink-0 uppercase tracking-tighter border border-slate-300/60">
                    Bientôt disponible
                  </span>
                )}
              </div>
            </SidebarMenuButton>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">
              <p>{item.title} (Bientôt disponible)</p>
            </TooltipContent>
          )}
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton asChild tooltip={item.title}>
            {item.onClick ? (
              <button
                onClick={item.onClick}
                className="flex items-center gap-2.5 rounded-r-[9px] px-2.5 py-2 transition-all duration-200 font-inter text-[13.5px] font-medium border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground w-full text-left"
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 transition-opacity ${isCollapsed ? '' : 'opacity-75'}`} />
                <span className={isCollapsed ? "md:hidden" : ""}>{item.title}</span>
              </button>
            ) : (
              <NavLink
                to={item.url}
                end={item.url === "/"}
                className={({ isActive }) => {
                  const isCurrent = isActive;
                  return `flex items-center gap-2.5 rounded-r-[9px] px-2.5 py-2 transition-all duration-200 font-inter text-[13.5px] font-medium border-l-4 ${
                    isCurrent
                      ? "bg-primary/10 text-primary font-semibold border-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`;
                }}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 transition-opacity ${isCollapsed ? '' : 'opacity-75'}`} />
                <span className={isCollapsed ? "md:hidden" : ""}>{item.title}</span>
              </NavLink>
            )}
          </SidebarMenuButton>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right">
            <p>{item.title}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </SidebarMenuItem>
  );
};

interface NavSectionProps {
  label?: string;
  items: { title: string; url: string; icon: React.ElementType; comingSoon?: boolean; onClick?: () => void }[];
  isCollapsed: boolean;
}

const NavSection = ({ label, items, isCollapsed }: NavSectionProps) => (
  <SidebarGroup className="mb-2">
    {!isCollapsed && label && (
      <SidebarGroupLabel className="font-inter text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground/70 px-2.5 mb-1">
        {label}
      </SidebarGroupLabel>
    )}
    <SidebarGroupContent>
      <SidebarMenu>
        {items.map((item) => (
          <NavItem key={item.title} item={item} isCollapsed={isCollapsed} />
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isFounder, setIsFounder] = useState(false);
  const { user, isReady } = useAuthReady();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la déconnexion",
        variant: "destructive",
      });
    }
  };

  // 1. Available active options first
  const activeMainItems = [
    { title: "Accueil", url: "/dashboard", icon: Home },
    { title: "Boutique", url: "/shop-manager", icon: Store },
    { title: "SEO Intelligence 🔍", url: "/seo", icon: Search },
    { title: "Académie", url: "/academy", icon: GraduationCap },
    { title: "Communauté", url: "/community", icon: Users },
    { title: "Tarifs", url: "/pricing", icon: CreditCard },
    { title: "Bibliothèque", url: "/library", icon: FolderHeart },
  ];

  // 2. Grouped "Bientôt disponible" options placed below Bibliothèque
  const comingSoonItems = [
    { title: "ConnectUs 🌐", url: "/connectus", icon: Globe, comingSoon: true },
    { title: "Ecomfy Pay 💳", url: "/ecomfy-pay", icon: CreditCard, comingSoon: true },
    { title: "Studio IA", url: "/studio", icon: Image, comingSoon: true },
    { title: "Ecomfy Livraison 🚚", url: "/delivery/register", icon: Truck, comingSoon: true },
  ];

  const bottomItems = [
    { title: "Documentation 📚", url: "/documentation", icon: Book },
    { title: "Paramètres", url: "/profile", icon: Settings },
    { title: "Déconnexion", url: "#", icon: LogOut, onClick: handleSignOut },
  ];

  useEffect(() => {
    const checkFounderStatus = async () => {
      if (user?.email?.toLowerCase() === "djateulrich@gmail.com") {
        setIsFounder(true);
        return;
      }
      if (user?.id) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          // @ts-ignore
          .in("role", ["founder", "co_founder", "shareholder", "admin"]);
        
        setIsFounder(data && data.length > 0);
      } else {
        setIsFounder(false);
      }
    };
    
    if (isReady) checkFounderStatus();
  }, [isReady, user?.id, user?.email]);

  const founderItems = [
    { title: t("sidebar.items.dashboard"), url: "/founder-dashboard", icon: BarChart2 },
    { title: "Fondation Livraison 🛡️", url: "/delivery-admin", icon: Truck },
    { title: t("sidebar.items.troubleshooting"), url: "/founder-troubleshooting", icon: Bug },
    { title: "Console API", url: "/api-documentation", icon: Code2 },
    { title: t("sidebar.items.promoCodes"), url: "/promo-codes", icon: Tag },
  ];

  return (
    <Sidebar collapsible="none" className="hidden md:flex bg-white border-r border-slate-200">
      <SidebarContent className="flex flex-col h-full bg-white">
        <TooltipProvider>
          {/* Header */}
          <SidebarGroup className="pb-4 pt-5">
            <div className={isCollapsed ? "flex flex-col items-center gap-3 px-1" : "flex flex-col gap-3 px-3"}>
              <div className="flex items-center justify-between gap-2 mb-2">
                {!isCollapsed && (
                  <div className="flex items-center gap-2.5 font-space font-bold text-[22px] tracking-tight text-[#0E7C66]">
                    Ecomfy
                  </div>
                )}
                {isCollapsed && (
                  <div className="w-[26px] h-[26px] rounded-[7px] text-[#0E7C66] flex items-center justify-center text-[18px] font-space font-bold">
                    E
                  </div>
                )}
              </div>
            </div>
          </SidebarGroup>

          {/* Navigation groups */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-1">
            {/* Options Actives Disponibles */}
            <NavSection items={activeMainItems} isCollapsed={isCollapsed} />
            
            {/* Options Bientôt Disponibles Regroupées après Bibliothèque */}
            <NavSection label="Bientôt disponible" items={comingSoonItems} isCollapsed={isCollapsed} />

            {isFounder && (
              <NavSection label={t("sidebar.sections.admin")} items={founderItems} isCollapsed={isCollapsed} />
            )}
          </div>

          {/* Footer */}
          <SidebarGroup className="mt-auto pb-4">
            <div className="mx-3 pt-3 border-t border-slate-100">
              <NavSection items={bottomItems} isCollapsed={isCollapsed} />
              <SidebarGroupContent>
                <div className={isCollapsed ? "flex flex-col items-center gap-2 mt-4" : "flex items-center justify-between gap-2 mt-4"}>
                  <LanguageSelector />
                </div>
              </SidebarGroupContent>
            </div>
          </SidebarGroup>
        </TooltipProvider>
      </SidebarContent>
    </Sidebar>
  );
}
