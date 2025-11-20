import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Mail, Phone, Calendar, Clock, Users, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Booking {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  booking_date: string;
  booking_time: string;
  service_type: string;
  service_name: string;
  number_of_participants: number | null;
  message: string | null;
  status: string;
  created_at: string;
}

interface BookingsViewerProps {
  showcaseId: string;
}

export function BookingsViewer({ showcaseId }: BookingsViewerProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [showcaseId]);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("showcase_site_id", showcaseId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast.error("Erreur lors du chargement des réservations");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", bookingId);

      if (error) throw error;
      toast.success("Statut mis à jour avec succès");
      loadBookings();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erreur lors de la mise à jour du statut");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "confirmed":
        return "default";
      case "cancelled":
        return "destructive";
      case "completed":
        return "secondary";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente";
      case "confirmed":
        return "Confirmé";
      case "cancelled":
        return "Annulé";
      case "completed":
        return "Terminé";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune réservation reçue pour le moment</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Réservations ({bookings.length})</h3>
        <Badge variant="secondary">
          {bookings.filter((b) => b.status === "pending").length} en attente
        </Badge>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-4 pr-4">
          {bookings.map((booking) => (
            <Card key={booking.id} className={booking.status === "pending" ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{booking.full_name}</CardTitle>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <a href={`mailto:${booking.email}`} className="hover:underline">
                          {booking.email}
                        </a>
                      </div>
                      {booking.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <a href={`tel:${booking.phone}`} className="hover:underline">
                            {booking.phone}
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(booking.created_at), "d MMMM yyyy", { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(booking.status)}>
                    {getStatusLabel(booking.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Date de réservation</span>
                    </div>
                    <p className="font-semibold">
                      {format(new Date(booking.booking_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Heure</span>
                    </div>
                    <p className="font-semibold">{booking.booking_time}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground font-medium">Type de service</div>
                    <p className="font-semibold capitalize">{booking.service_type}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground font-medium">Service/Formation</div>
                    <p className="font-semibold">{booking.service_name}</p>
                  </div>
                  {booking.number_of_participants && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">Participants</span>
                      </div>
                      <p className="font-semibold">{booking.number_of_participants}</p>
                    </div>
                  )}
                </div>

                {booking.message && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>Message du client</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{booking.message}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <span className="text-sm text-muted-foreground">Changer le statut:</span>
                  <Select
                    value={booking.status}
                    onValueChange={(value) => updateStatus(booking.id, value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
