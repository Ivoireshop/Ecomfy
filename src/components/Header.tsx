import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Menu, X, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/visualpro-logo.svg";
export function Header() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleTarifClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate("/subscription");
  };

  const menuItems = [
    { label: "Accueil", href: "/", onClick: (e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate("/"); } },
    { label: "Catalogue", href: "/catalogue", onClick: (e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate("/catalogue"); } },
    { label: "Formations", href: "/formations", onClick: (e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate("/formations"); } },
    { label: "Services", href: "/services", onClick: (e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate("/services"); } },
    { label: "Galerie", href: "/galerie", onClick: (e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate("/galerie"); } },
    { label: "Contact", href: "/contact", onClick: (e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate("/contact"); } },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - Always visible */}
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src={logo} alt="Logo VisualPro" className="h-6 w-6" />
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              VisualPro
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={item.onClick}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Se connecter
            </Button>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <Button onClick={() => navigate("/auth")}>
              <Sparkles className="mr-2 h-4 w-4" />
              Commencer
            </Button>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Ouvrir le menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-6 mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <img src={logo} alt="Logo VisualPro" className="h-7 w-7" />
                  <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    VisualPro
                  </span>
                </div>

                <nav className="flex flex-col gap-4">
                  {menuItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="text-lg font-medium text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => {
                        if (item.onClick) {
                          item.onClick(e);
                        }
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
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigate("/auth");
                      setIsOpen(false);
                    }}
                  >
                    Se connecter
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => {
                      navigate("/auth");
                      setIsOpen(false);
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Commencer
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
