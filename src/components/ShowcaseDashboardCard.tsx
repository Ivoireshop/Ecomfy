import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ShowcaseDashboardCardProps {
  siteId: string;
  businessName: string;
}

export function ShowcaseDashboardCard({ siteId, businessName }: ShowcaseDashboardCardProps) {
  const navigate = useNavigate();
  const [bookingsCount, setBookingsCount] = useState<number>(0);
  const [messagesCount, setMessagesCount] = useState<number>(0);
  const [pendingBookings, setPendingBookings] = useState<number>(0);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [siteId]);

  const loadStats = async () => {
    try {
      // Charger les réservations
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("showcase_site_id", siteId);

      if (!bookingsError && bookings) {
        setBookingsCount(bookings.length);
        setPendingBookings(bookings.filter(b => b.status === "pending").length);
      }

      // Charger les messages
      const { data: messages, error: messagesError } = await supabase
        .from("contact_submissions")
        .select("id, status")
        .eq("showcase_site_id", siteId);

      if (!messagesError && messages) {
        setMessagesCount(messages.length);
        setUnreadMessages(messages.filter(m => m.status === "new").length);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBookings = () => {
    navigate(`/showcase-editor/${siteId}?tab=bookings`);
  };

  const handleManageMessages = () => {
    navigate(`/showcase-editor/${siteId}?tab=contacts`);
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Ne rien afficher si aucune donnée
  if (bookingsCount === 0 && messagesCount === 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Tableau de bord - {businessName}</span>
          {(pendingBookings > 0 || unreadMessages > 0) && (
            <Badge variant="destructive">
              {pendingBookings + unreadMessages} nouveau(x)
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Gérez vos réservations et messages rapidement
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Carte Réservations */}
          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Réservations</h3>
              </div>
              {pendingBookings > 0 && (
                <Badge variant="secondary">{pendingBookings} en attente</Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-primary mb-4">
              {bookingsCount}
            </p>
            <Button 
              onClick={handleManageBookings}
              className="w-full"
              size="sm"
            >
              Gérer les réservations
            </Button>
          </div>

          {/* Carte Messages */}
          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Messages</h3>
              </div>
              {unreadMessages > 0 && (
                <Badge variant="secondary">{unreadMessages} non lu(s)</Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-primary mb-4">
              {messagesCount}
            </p>
            <Button 
              onClick={handleManageMessages}
              className="w-full"
              size="sm"
            >
              Gérer les messages
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
