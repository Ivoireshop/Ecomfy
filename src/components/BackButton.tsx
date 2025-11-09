import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on homepage
  if (location.pathname === "/") {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(-1)}
      className="fixed top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 z-40 bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-accent"
    >
      <ArrowLeft className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Retour</span>
    </Button>
  );
}
