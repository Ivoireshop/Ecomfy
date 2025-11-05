import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Mail, Phone, Calendar, CheckCircle2, Loader2 } from "lucide-react";

interface ContactSubmission {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string;
  created_at: string;
  status: string;
  read_at: string | null;
}

interface ContactSubmissionsViewerProps {
  showcaseId: string;
}

export function ContactSubmissionsViewer({ showcaseId }: ContactSubmissionsViewerProps) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSubmissions();
  }, [showcaseId]);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .eq("showcase_site_id", showcaseId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error("Error loading submissions:", error);
      toast.error("Erreur lors du chargement des messages");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (submissionId: string) => {
    try {
      const { error } = await supabase
        .from("contact_submissions")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("id", submissionId);

      if (error) throw error;
      toast.success("Message marqué comme lu");
      loadSubmissions();
    } catch (error) {
      console.error("Error marking as read:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucun message reçu pour le moment</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Messages reçus ({submissions.length})</h3>
        <Badge variant="secondary">
          {submissions.filter((s) => s.status === "new").length} nouveaux
        </Badge>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-4 pr-4">
          {submissions.map((submission) => (
            <Card key={submission.id} className={submission.status === "new" ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{submission.full_name}</CardTitle>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <a href={`mailto:${submission.email}`} className="hover:underline">
                          {submission.email}
                        </a>
                      </div>
                      {submission.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <a href={`tel:${submission.phone}`} className="hover:underline">
                            {submission.phone}
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(submission.created_at).toLocaleString("fr-FR")}</span>
                      </div>
                    </div>
                  </div>
                  {submission.status === "new" && (
                    <Badge variant="default">Nouveau</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm whitespace-pre-wrap">{submission.message}</p>
                </div>
                {submission.status === "new" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsRead(submission.id)}
                    className="w-full"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marquer comme lu
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
