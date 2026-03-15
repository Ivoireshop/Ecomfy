import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on homepage, showcase pages, shop pages, or pages with their own back button
  const hiddenPaths = ["/", "/shop-manager", "/shop-builder", "/showcase-manager", "/showcase-builder"];
  if (
    hiddenPaths.includes(location.pathname) || 
    location.pathname.startsWith("/showcase/") || 
    location.pathname.startsWith("/shop/") ||
    location.pathname.startsWith("/shop-editor/") ||
    location.pathname.startsWith("/showcase-editor/")
  ) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate(-1)}
      className="fixed top-1 left-10 sm:top-3 sm:left-14 z-40 bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-accent h-8 w-8"
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
