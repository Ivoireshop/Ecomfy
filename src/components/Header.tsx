import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuthReady } from "@/hooks/useAuthReady";
import logo from "@/assets/ecomfy-logo.svg";
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
    { label: t("header.home"), href: "/" },
    { label: t("header.features"), href: "/#services" },
    { label: t("header.pricing"), href: "/subscription" },
    { label: t("header.tutorial"), href: "/tutorial" },
    { label: t("header.demo"), href: "/demo" },
    { label: t("header.community", "Communauté"), href: "/community", key: "community" },
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src={logo} alt="Logo Ecomfy" className="h-7 w-7" />
            <span className="text-xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Ecomfy
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
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
                {(item as any).key === "community" && communityUnread > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                    {communityUnread > 99 ? "99+" : communityUnread}
                  </span>
                )}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <LanguageSelector />
            {isAuthenticated && <AICreditsBadge />}
            {!isAuthenticated && (
              <Button variant="ghost" onClick={() => navigate("/auth")}>
                {t("common.login")}
              </Button>
            )}
            <Button onClick={() => navigate(isAuthenticated ? "/" : "/auth")}>
              {isAuthenticated ? t("common.myAccount") : t("common.start")}
            </Button>
          </div>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex md:hidden items-center gap-2">
              {isAuthenticated && <AICreditsBadge />}
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">{t("header.openMenu")}</span>
                </Button>
              </SheetTrigger>
            </div>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-6 mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <img src={logo} alt="Logo Ecomfy" className="h-7 w-7" />
                  <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
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
                      {(item as any).key === "community" && communityUnread > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                          {communityUnread > 99 ? "99+" : communityUnread}
                        </span>
                      )}
                    </a>
                  ))}
                </nav>

                <div className="flex flex-col gap-3 mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-sm text-muted-foreground">{t("common.theme")}</span>
                    <ThemeToggle />
                  </div>
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-sm text-muted-foreground">{t("common.language")}</span>
                    <LanguageSelector showLabel />
                  </div>
                  {!isAuthenticated && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        navigate("/auth");
                        setIsOpen(false);
                      }}
                    >
                      {t("common.login")}
                    </Button>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => {
                      navigate(isAuthenticated ? "/" : "/auth");
                      setIsOpen(false);
                    }}
                  >
                    {isAuthenticated ? t("common.myAccount") : t("common.start")}
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
