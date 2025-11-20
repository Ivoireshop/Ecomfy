import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, ExternalLink, Settings, Trash2, Eye, EyeOff, Copy, CheckCircle2, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShowcaseDashboardCard } from "@/components/ShowcaseDashboardCard";

interface ShowcaseSite {
  id: string;
  subdomain: string;
  business_name: string;
  is_published: boolean;
  created_at: string;
}

export default function ShowcaseManager() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<ShowcaseSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("showcase_sites")
        .select("id, subdomain, business_name, is_published, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading sites:", error);
        toast.error("Erreur lors du chargement des sites");
      } else {
        setSites(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (siteId: string) => {
    try {
      const { error } = await supabase
        .from("showcase_sites")
        .delete()
        .eq("id", siteId);

      if (error) {
        toast.error("Erreur lors de la suppression");
      } else {
        toast.success("Site supprimé avec succès");
        loadSites();
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Une erreur est survenue");
    }
    setDeleteDialogOpen(false);
    setSiteToDelete(null);
  };

  const getPublicUrl = (subdomain: string) => {
    return `${window.location.origin}/showcase/${subdomain}`;
  };

  const copyPublicUrl = (subdomain: string, siteId: string) => {
    const url = getPublicUrl(subdomain);
    navigator.clipboard.writeText(url);
    setCopiedId(siteId);
    toast.success("Lien copié dans le presse-papier!");
    
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const togglePublish = async (siteId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("showcase_sites")
        .update({ is_published: !currentStatus })
        .eq("id", siteId);

      if (error) {
        toast.error("Erreur lors de la modification");
      } else {
        toast.success(!currentStatus ? "Site publié avec succès !" : "Site dépublié");
        loadSites();
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Une erreur est survenue");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Mes sites vitrines</h1>
            <p className="text-muted-foreground">
              Gérez vos sites professionnels
            </p>
          </div>
          <Button onClick={() => navigate("/showcase-builder")}>
            <Plus className="mr-2 h-4 w-4" />
            Créer un site
          </Button>
        </div>

        {sites.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <h3 className="text-xl font-semibold">Aucun site vitrine</h3>
              <p className="text-muted-foreground">
                Commencez par créer votre premier site professionnel
              </p>
              <Button onClick={() => navigate("/showcase-builder")}>
                <Plus className="mr-2 h-4 w-4" />
                Créer mon premier site
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Tableaux de bord pour chaque site */}
            <div className="space-y-6 mb-8">
              {sites.map((site) => (
                <ShowcaseDashboardCard
                  key={`dashboard-${site.id}`}
                  siteId={site.id}
                  businessName={site.business_name}
                />
              ))}
            </div>

            {/* Grille des sites */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <Card key={site.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-xl">{site.business_name}</CardTitle>
                    {site.is_published ? (
                      <Badge>Publié</Badge>
                    ) : (
                      <Badge variant="outline">Brouillon</Badge>
                    )}
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {site.subdomain}.visualpro.app
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {site.is_published && (
                    <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <span>Site en ligne</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={getPublicUrl(site.subdomain)}
                          readOnly
                          className="text-xs font-mono h-8"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2"
                          onClick={() => copyPublicUrl(site.subdomain, site.id)}
                        >
                          {copiedId === site.id ? (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 px-2"
                          onClick={() => window.open(getPublicUrl(site.subdomain), "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(`/showcase/${site.subdomain}`, "_blank")}
                    disabled={!site.is_published}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {site.is_published ? "Prévisualiser" : "Site non publié"}
                  </Button>
                  
                  <Button
                    variant={site.is_published ? "outline" : "default"}
                    className="w-full"
                    onClick={() => togglePublish(site.id, site.is_published)}
                  >
                    {site.is_published ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Dépublier
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Publier
                      </>
                    )}
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/showcase-editor/${site.id}`)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSiteToDelete(site.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          </>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce site vitrine ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => siteToDelete && handleDelete(siteToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}