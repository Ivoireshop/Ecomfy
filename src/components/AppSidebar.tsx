import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isExactMatch, useNavigationMenu } from "@/hooks/useNavigationMenu";
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
    badge?: number;
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
                end={isExactMatch(item.url)}
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
                {!!item.badge && (
                  <span
                    className={`ml-auto min-w-[18px] rounded-full bg-primary px-1.5 text-center text-[10px] font-bold leading-[18px] text-primary-foreground ${isCollapsed ? "md:hidden" : ""}`}
                    aria-label={`${item.badge} non lu${item.badge > 1 ? "s" : ""}`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
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
  items: { title: string; url: string; icon: React.ElementType; comingSoon?: boolean; onClick?: () => void; badge?: number }[];
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
  const { toast } = useToast();
  const { mainItems, comingSoonItems, founderItems, founderLabel, accountItems } = useNavigationMenu();

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

  const bottomItems = [
    ...accountItems,
    { title: "Déconnexion", url: "#", icon: LogOut, onClick: handleSignOut },
  ];

  return (
    <Sidebar collapsible="none" className="hidden md:flex env-sticky env-screen sticky top-0 h-screen shrink-0 self-start bg-white border-r border-slate-200">
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
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-1">
            {/* Options Actives Disponibles */}
            <NavSection items={mainItems} isCollapsed={isCollapsed} />
            
            {/* Options Bientôt Disponibles Regroupées après Bibliothèque */}
            <NavSection label="Bientôt disponible" items={comingSoonItems.map((item) => ({ ...item, comingSoon: true }))} isCollapsed={isCollapsed} />

            {founderItems.length > 0 && (
              <NavSection label={founderLabel} items={founderItems} isCollapsed={isCollapsed} />
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
