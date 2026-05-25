import { 
  Home, Image, Video, MessageSquare, CreditCard, Globe, Tag, BarChart, 
  Gift, HelpCircle, PlayCircle, Code2, Store, GraduationCap, Receipt, BookOpen, Activity
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
              `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                isActive 
                  ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
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
  <SidebarGroup>
    {!isCollapsed && (
      <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-1">
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
    { title: t("sidebar.items.showcases"), url: "/showcase-manager", icon: Globe },
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
    { title: t("sidebar.items.referral"), url: "/referral", icon: Gift },
    { title: t("sidebar.items.feedback"), url: "/feedback", icon: MessageSquare },
    { title: t("sidebar.items.api"), url: "/api-documentation", icon: Code2 },
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
    { title: t("sidebar.items.ordersDiag"), url: "/orders-diagnostic", icon: Activity },
    { title: t("sidebar.items.promoCodes"), url: "/promo-codes", icon: Tag },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        <TooltipProvider>
      {/* Header */}
          <SidebarGroup className="pb-2 pt-3">
            <div className={isCollapsed ? "flex flex-col items-center gap-3 px-1" : "flex flex-col gap-3 px-3"}>
              <div className="flex items-center justify-between gap-2">
                {!isCollapsed && (
                  <span className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    VisualPro
                  </span>
                )}
                {isCollapsed && (
                  <span className="font-bold text-xs bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    VP
                  </span>
                )}
                {!isCollapsed && <UserAvatar />}
              </div>
              <SidebarTrigger className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted flex items-center justify-center" />
              {isCollapsed && <UserAvatar />}
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
            <SidebarGroupContent>
              <div className={isCollapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between gap-2 px-3"}>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  {!isCollapsed && <span className="text-sm text-muted-foreground">{t("common.theme")}</span>}
                </div>
                <LanguageSelector />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </TooltipProvider>
      </SidebarContent>
    </Sidebar>
  );
}
