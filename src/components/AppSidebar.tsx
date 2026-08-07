import { 
  Home, Image, Video, Store, BarChart2, Settings, LogOut, Code2, Bug, Book, Tag, Users
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemProps {
  item: { title: string; url: string; icon: React.ElementType; onClick?: () => void };
  isCollapsed: boolean;
}

const NavItem = ({ item, isCollapsed }: NavItemProps) => (
  <SidebarMenuItem>
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarMenuButton asChild>
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="w-full flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 transition-colors font-inter text-[13.5px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground text-left"
            >
              <item.icon className="h-[18px] w-[18px] shrink-0 opacity-75" />
              <span className={isCollapsed ? "md:hidden" : ""}>{item.title}</span>
            </button>
          ) : (
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 transition-colors font-inter text-[13.5px] font-medium ${
                  isActive 
                    ? "bg-[#0E7C66]/10 text-[#0E7C66] font-semibold" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0 opacity-75" />
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

interface NavSectionProps {
  label?: string;
  items: { title: string; url: string; icon: React.ElementType; onClick?: () => void }[];
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

  const mainItems = [
    { title: "Accueil", url: "/dashboard", icon: Home },
    { title: "Visuels", url: "/generator", icon: Image },
    { title: "Vidéos", url: "/video-creator", icon: Video },
    { title: "Boutique", url: "/shop-manager", icon: Store },
    { title: "Statistiques", url: "/statistics", icon: BarChart2 },
  ];

  const bottomItems = [
    { title: "Paramètres", url: "/profile", icon: Settings },
    { title: "Déconnexion", url: "#", icon: LogOut, onClick: handleSignOut },
  ];

  useEffect(() => {
    const checkFounderStatus = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          // @ts-ignore
          .in("role", ["founder", "co_founder"]);
        
        setIsFounder(data && data.length > 0);
      } else {
        setIsFounder(false);
      }
    };
    
    if (isReady) checkFounderStatus();
  }, [isReady, user?.id]);

  const founderItems = [
    { title: t("sidebar.items.dashboard"), url: "/founder-dashboard", icon: BarChart2 },
    { title: t("sidebar.items.troubleshooting"), url: "/founder-troubleshooting", icon: Bug },
    { title: "Documentation", url: "/docs", icon: Book },
    { title: "Console API", url: "/api-documentation", icon: Code2 },
    { title: t("sidebar.items.promoCodes"), url: "/promo-codes", icon: Tag },
  ];

  return (
    <Sidebar collapsible="icon" className="bg-white border-r border-slate-200">
      <SidebarContent className="flex flex-col h-full bg-white">
        <TooltipProvider>
          {/* Header */}
          <SidebarGroup className="pb-4 pt-5">
            <div className={isCollapsed ? "flex flex-col items-center gap-3 px-1" : "flex flex-col gap-3 px-3"}>
              <div className="flex items-center justify-between gap-2">
                {!isCollapsed && (
                  <div className="flex items-center gap-2.5 font-space font-bold text-[22px] tracking-tight text-[#E85C3A]">
                    Ecomfy
                  </div>
                )}
                {isCollapsed && (
                  <div className="w-[26px] h-[26px] rounded-[7px] text-[#E85C3A] flex items-center justify-center text-[18px] font-space font-bold">
                    E
                  </div>
                )}
              </div>
              <SidebarTrigger className="mt-2 h-8 w-8 min-h-[32px] min-w-[32px] rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted flex items-center justify-center" />
            </div>
          </SidebarGroup>

          {/* Navigation groups */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-1">
            <NavSection items={mainItems} isCollapsed={isCollapsed} />
            
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
