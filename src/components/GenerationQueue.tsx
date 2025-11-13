import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, AlertCircle, Loader2, X, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface QueueItem {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  prompt: string;
  platform: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  image_url?: string;
}

export const GenerationQueue = () => {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [currentProcessing, setCurrentProcessing] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadQueueItems();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel("generation_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_queue",
        },
        (payload) => {
          console.log("Queue change:", payload);
          loadQueueItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadQueueItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's queue items
      const { data, error } = await supabase
        .from("generation_queue")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setQueueItems(data as QueueItem[] || []);

      // Count current processing items
      const processing = (data || []).filter(item => item.status === "processing").length;
      setCurrentProcessing(processing);
    } catch (error) {
      console.error("Error loading queue items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelItem = async (itemId: string) => {
    setCancelingId(itemId);
    try {
      const { error } = await supabase.functions.invoke('cancel-queue-item', {
        body: { queueItemId: itemId }
      });

      if (error) throw error;

      toast({
        title: "Génération annulée",
        description: "L'item a été retiré de la file d'attente",
      });

      loadQueueItems();
    } catch (error) {
      console.error("Error canceling queue item:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'annuler cette génération",
        variant: "destructive",
      });
    } finally {
      setCancelingId(null);
    }
  };

  const handleClearCompleted = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const completedIds = queueItems
        .filter(item => item.status === "completed" || item.status === "failed")
        .map(item => item.id);

      if (completedIds.length === 0) {
        toast({
          title: "Aucun item à nettoyer",
          description: "Aucune génération terminée ou échouée à supprimer",
        });
        return;
      }

      // Delete completed/failed items
      const { error } = await supabase
        .from("generation_queue")
        .delete()
        .in("id", completedIds)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "File nettoyée",
        description: `${completedIds.length} item(s) supprimé(s)`,
      });

      loadQueueItems();
    } catch (error) {
      console.error("Error clearing completed items:", error);
      toast({
        title: "Erreur",
        description: "Impossible de nettoyer la file",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            En cours
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
            <CheckCircle className="w-3 h-3 mr-1" />
            Terminé
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">
            <AlertCircle className="w-3 h-3 mr-1" />
            Échoué
          </Badge>
        );
      default:
        return null;
    }
  };

  const pendingCount = queueItems.filter(item => item.status === "pending").length;
  const showAlert = pendingCount > 0 || currentProcessing >= 10;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (queueItems.length === 0) {
    return null;
  }

  const completedCount = queueItems.filter(item => item.status === "completed" || item.status === "failed").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <span>File d'attente des générations</span>
              <Badge variant="secondary">
                {currentProcessing} / 10 en cours
              </Badge>
            </CardTitle>
            <CardDescription>
              Suivi en temps réel de vos générations d'images
            </CardDescription>
          </div>
          {completedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCompleted}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Vider terminés ({completedCount})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAlert && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {pendingCount > 0 
                ? `${pendingCount} génération(s) en attente. Elles seront traitées dès qu'un slot se libère.`
                : "Capacité maximale atteinte. Les nouvelles générations seront mises en attente."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {queueItems.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg p-4 space-y-2 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(item.status)}
                    <Badge variant="outline">{item.platform}</Badge>
                  </div>
                  <p className="text-sm font-medium line-clamp-1">
                    {item.prompt}
                  </p>
                  {item.error_message && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Erreur: {item.error_message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.image_url && item.status === "completed" && (
                    <img
                      src={item.image_url}
                      alt="Generated"
                      className="w-16 h-16 rounded object-cover"
                    />
                  )}
                  {(item.status === "pending" || item.status === "processing") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelItem(item.id)}
                      disabled={cancelingId === item.id}
                      className="h-8 w-8 p-0"
                      title="Annuler cette génération"
                    >
                      {cancelingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Créé: {new Date(item.created_at).toLocaleTimeString("fr-FR")}</span>
                {item.started_at && (
                  <span>Démarré: {new Date(item.started_at).toLocaleTimeString("fr-FR")}</span>
                )}
                {item.completed_at && (
                  <span>Terminé: {new Date(item.completed_at).toLocaleTimeString("fr-FR")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};