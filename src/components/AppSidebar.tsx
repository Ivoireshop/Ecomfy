import { Home, Image, Video, MessageSquare, CreditCard, Globe, Tag, BarChart, Gift, HelpCircle } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const items = [
  { title: "Accueil", url: "/", icon: Home },
  { title: "Générateur", url: "/generator", icon: Image },
  { title: "Sites Vitrines", url: "/showcase-manager", icon: Globe },
  { title: "Bibliothèque", url: "/library", icon: Video },
  { title: "Parrainage", url: "/referral", icon: Gift },
  { title: "Abonnement", url: "/subscription", icon: CreditCard },
  { title: "Tutoriel", url: "/tutorial", icon: HelpCircle },
  { title: "Avis & Commentaires", url: "/feedback", icon: MessageSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isFounder, setIsFounder] = useState(false);

  useEffect(() => {
    const checkFounderStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          // @ts-ignore - Types will update after migration
          .in("role", ["founder", "co_founder"]);
        
        setIsFounder(data && data.length > 0);
      }
    };
    
    checkFounderStatus();
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "text-center px-0 mb-4" : "mb-4"}>
            <div className="flex items-center justify-between gap-2">
              {!isCollapsed && <span>VisualPro</span>}
              <UserAvatar />
            </div>
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end
                      className={({ isActive }) =>
                        isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className={isCollapsed ? "mx-auto" : "mr-2 h-4 w-4"} />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {isFounder && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/founder-dashboard" 
                        className={({ isActive }) =>
                          isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                        }
                      >
                        <BarChart className={isCollapsed ? "mx-auto" : "mr-2 h-4 w-4"} />
                        {!isCollapsed && <span>Tableau de Bord</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/promo-codes" 
                        className={({ isActive }) =>
                          isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                        }
                      >
                        <Tag className={isCollapsed ? "mx-auto" : "mr-2 h-4 w-4"} />
                        {!isCollapsed && <span>Codes Promo</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <div className={isCollapsed ? "flex justify-center" : "flex items-center gap-2 px-2"}>
              <ThemeToggle />
              {!isCollapsed && <span className="text-sm text-muted-foreground">Thème</span>}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}