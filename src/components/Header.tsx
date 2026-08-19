import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuthReady } from "@/hooks/useAuthReady";
import logo from "@/assets/ecomfy-logo.png";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AICreditsBadge } from "@/components/AICreditsBadge";
import { useCommunityUnread } from "@/hooks/useCommunityUnread";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { session } = useAuthReady();
  const isAuthenticated = !!session?.user;
  const { t } = useTranslation();
  const communityUnread = useCommunityUnread();

  const menuItems = [
    { label: "Fonctionnalités", href: "/#features" },
    { label: "Solutions", href: "/#solutions" },
    { label: "Comment ça marche", href: "/#how-it-works" },
    { label: "Académie 🎓", href: "/#academy" },
    { label: "Tarifs", href: "/#pricing" },
    { label: "Ressources", href: "/#resources" },
  ];

  const scrollToHash = (hash: string) => {
    const id = hash.replace(/^#/, "");
    const tryScroll = (attempt = 0) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempt < 20) {
        setTimeout(() => tryScroll(attempt + 1), 100);
      }
    };
    tryScroll();
  };

  const handleNavClick = (href: string) => {
    if (href.startsWith("/#")) {
      const hash = href.substring(1);
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => scrollToHash(hash), 150);
      } else {
        scrollToHash(hash);
      }
    } else {
      navigate(href);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src={logo} alt="Logo Ecomfy" className="h-7 w-7" />
            <span className="text-xl font-extrabold text-[#0E7C66]">
              Ecomfy
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                }}
                className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <LanguageSelector />
            {isAuthenticated && <AICreditsBadge />}
            {!isAuthenticated && (
              <Button variant="ghost" onClick={() => navigate("/auth")} className="font-medium">
                Se connecter
              </Button>
            )}
            <Button 
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
              className="bg-[#0E7C66] hover:bg-[#0A5F4F] text-white rounded-full px-6 font-semibold shadow-sm hover:shadow-md transition-all btn-interactive"
            >
              {isAuthenticated ? "Accéder à mon espace" : "Créer mon compte"}
            </Button>
          </div>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex md:hidden items-center gap-2">
              {isAuthenticated && <AICreditsBadge />}
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Ouvrir le menu</span>
                </Button>
              </SheetTrigger>
            </div>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-6 mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <img src={logo} alt="Logo Ecomfy" className="h-7 w-7" />
                  <span className="text-xl font-bold text-[#0E7C66]">
                    Ecomfy
                  </span>
                </div>

                <nav className="flex flex-col gap-4">
                  {menuItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="text-lg font-medium text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavClick(item.href);
                        setIsOpen(false);
                      }}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                <div className="flex flex-col gap-3 mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-sm text-muted-foreground">Thème</span>
                    <ThemeToggle />
                  </div>
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-sm text-muted-foreground">Langue</span>
                    <LanguageSelector showLabel />
                  </div>
                  {!isAuthenticated && (
                    <Button
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => {
                        navigate("/auth");
                        setIsOpen(false);
                      }}
                    >
                      Se connecter
                    </Button>
                  )}
                  <Button
                    className="w-full bg-[#0E7C66] hover:bg-[#0A5F4F] text-white rounded-full font-semibold"
                    onClick={() => {
                      navigate(isAuthenticated ? "/dashboard" : "/auth");
                      setIsOpen(false);
                    }}
                  >
                    {isAuthenticated ? "Accéder à mon espace" : "Créer mon compte"}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
