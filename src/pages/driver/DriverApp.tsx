import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Package, ScanLine, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function DriverApp() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Basic auth check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const navItems = [
    { icon: Package, label: "Missions", path: "/delivery/driver" },
    { icon: ScanLine, label: "Scanner", path: "/delivery/driver/scanner" },
    { icon: UserCircle, label: "Profil", path: "/delivery/driver/profile" },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 shadow-md z-10 flex items-center justify-between">
        <h1 className="font-bold text-lg">Ecomfy Driver</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border flex justify-around items-center h-16 z-50 px-2 safe-area-bottom">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== "/delivery/driver" && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "fill-primary/20")} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
