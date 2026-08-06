import { 
  Home, Image, Video, MessageSquare, CreditCard, Globe, Tag, BarChart, 
  Gift, HelpCircle, PlayCircle, Code2, Store, GraduationCap, Receipt, BookOpen, Activity, Bug, Book, Zap, Users
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";

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
  item: { title: string; url: string; icon: React.ElementType };
  isCollapsed: boolean;
}

const NavItem = ({ item, isCollapsed }: NavItemProps) => (
  <SidebarMenuItem>
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 transition-colors font-inter text-[13.5px] font-medium ${
                isActive 
                  ? "bg-accent/10 text-foreground font-semibold" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0 opacity-75" />
            <span className={isCollapsed ? "md:hidden" : ""}>{item.title}</span>
          </NavLink>
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
  label: string;
  items: { title: string; url: string; icon: React.ElementType }[];
  isCollapsed: boolean;
}

const NavSection = ({ label, items, isCollapsed }: NavSectionProps) => (
  <SidebarGroup className="mb-2">
    {!isCollapsed && (
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

  const mainItems = [
    { title: t("sidebar.items.home"), url: "/", icon: Home },
    { title: t("sidebar.items.generator"), url: "/generator", icon: Image },
    { title: t("sidebar.items.library"), url: "/library", icon: Video },
  ];
  const businessItems = [
    { title: t("sidebar.items.courses"), url: "/courses-manager", icon: BookOpen },
    { title: t("sidebar.items.shops"), url: "/shop-manager", icon: Store },
  ];
  const learningItems = [
    { title: t("sidebar.items.studentSpace"), url: "/student", icon: GraduationCap },
    { title: t("sidebar.items.tutorial"), url: "/tutorial", icon: HelpCircle },
    { title: t("sidebar.items.videoDemo"), url: "/demo", icon: PlayCircle },
  ];
  const accountItems = [
    { title: t("sidebar.items.subscription"), url: "/subscription", icon: CreditCard },
    { title: t("sidebar.items.history"), url: "/payment-history", icon: Receipt },
    { title: t("sidebar.items.aiQuota"), url: "/ai-quota", icon: Zap },
    { title: t("sidebar.items.referral"), url: "/referral", icon: Gift },
    { title: "Communauté", url: "/community", icon: Users },
    { title: t("sidebar.items.feedback"), url: "/feedback", icon: MessageSquare },
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
    { title: t("sidebar.items.dashboard"), url: "/founder-dashboard", icon: BarChart },
    { title: t("sidebar.items.troubleshooting"), url: "/founder-troubleshooting", icon: Bug },
    { title: "Documentation", url: "/docs", icon: Book },
    { title: "Console API", url: "/api-documentation", icon: Code2 },
    { title: t("sidebar.items.promoCodes"), url: "/promo-codes", icon: Tag },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        <TooltipProvider>
      {/* Header */}
          <SidebarGroup className="pb-4 pt-5">
            <div className={isCollapsed ? "flex flex-col items-center gap-3 px-1" : "flex flex-col gap-3 px-3"}>
              <div className="flex items-center justify-between gap-2">
                {!isCollapsed && (
                  <div className="flex items-center gap-2.5 font-space font-bold text-[17px] tracking-tight">
                    <div className="w-[26px] h-[26px] rounded-[7px] bg-foreground text-background flex items-center justify-center text-[14px]">
                      E
                    </div>
                    Ecomfy
                  </div>
                )}
                {isCollapsed && (
                  <div className="w-[26px] h-[26px] rounded-[7px] bg-foreground text-background flex items-center justify-center text-[14px] font-space font-bold">
                    E
                  </div>
                )}
              </div>
              <SidebarTrigger className="mt-2 h-8 w-8 min-h-[32px] min-w-[32px] rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted flex items-center justify-center" />
            </div>
          </SidebarGroup>

          {/* Navigation groups */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-1">
            <NavSection label={t("sidebar.sections.creation")} items={mainItems} isCollapsed={isCollapsed} />
            <NavSection label={t("sidebar.sections.business")} items={businessItems} isCollapsed={isCollapsed} />
            <NavSection label={t("sidebar.sections.learn")} items={learningItems} isCollapsed={isCollapsed} />
            <NavSection label={t("sidebar.sections.account")} items={accountItems} isCollapsed={isCollapsed} />
            {isFounder && (
              <NavSection label={t("sidebar.sections.admin")} items={founderItems} isCollapsed={isCollapsed} />
            )}
          </div>

          {/* Footer */}
          <SidebarGroup className="mt-auto pb-4">
            <div className="mx-3 pt-3 border-t border-border/60">
              <SidebarGroupContent>
                <div className={isCollapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between gap-2"}>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    {!isCollapsed && <span className="font-inter text-[12.5px] text-muted-foreground">{t("common.theme")}</span>}
                  </div>
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
