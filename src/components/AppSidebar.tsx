import { Home, Image, Video, MessageSquare, CreditCard, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  { title: "Bibliothèque", url: "/library", icon: Video },
  { title: "Abonnement", url: "/subscription", icon: CreditCard },
  { title: "Avis & Commentaires", url: "/feedback", icon: MessageSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
      toast({
        title: "Déconnecté",
        description: "Vous avez été déconnecté avec succès.",
      });
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la déconnexion",
        variant: "destructive",
      });
    }
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "text-center px-0" : ""}>
            {isCollapsed ? "VP" : "VisualPro"}
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
              
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut}>
                  <LogOut className={isCollapsed ? "mx-auto" : "mr-2 h-4 w-4"} />
                  {!isCollapsed && <span>Déconnexion</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
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