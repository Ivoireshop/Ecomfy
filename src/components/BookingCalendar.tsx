import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Clock, Mail, Phone, User, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Booking {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  booking_date: string;
  booking_time: string;
  service_type: string;
  service_name: string;
  number_of_participants: number;
  message?: string;
  status: string;
  created_at: string;
}

interface BookingCalendarProps {
  showcaseSiteId: string;
}

export const BookingCalendar = ({ showcaseSiteId }: BookingCalendarProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("bookings")
        .select("*")
        .eq("showcase_site_id", showcaseSiteId)
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les réservations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [showcaseSiteId, filterStatus]);

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (error) throw error;

      toast({
        title: "Statut mis à jour",
        description: `La réservation a été marquée comme ${getStatusLabel(newStatus)}`,
      });

      loadBookings();
      setSelectedBooking(null);
    } catch (error) {
      console.error("Error updating booking:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "En attente",
      confirmed: "Confirmée",
      cancelled: "Annulée",
      completed: "Terminée",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      confirmed: "bg-green-500",
      cancelled: "bg-red-500",
      completed: "bg-blue-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const filteredBookings = date
    ? bookings.filter((booking) => booking.booking_date === format(date, "yyyy-MM-dd"))
    : bookings;

  const bookingsByDate = bookings.reduce((acc, booking) => {
    const dateKey = booking.booking_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(booking);
    return acc;
  }, {} as Record<string, Booking[]>);

  const modifiers = {
    booked: Object.keys(bookingsByDate).map((dateStr) => new Date(dateStr)),
  };

  const modifiersStyles = {
    booked: { fontWeight: "bold", textDecoration: "underline" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestion des Réservations</h2>
          <p className="text-muted-foreground">
            {bookings.length} réservation(s) au total
          </p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="confirmed">Confirmées</SelectItem>
            <SelectItem value="cancelled">Annulées</SelectItem>
            <SelectItem value="completed">Terminées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Calendrier</CardTitle>
            <CardDescription>Sélectionnez une date pour voir les réservations</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={fr}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {date ? format(date, "EEEE d MMMM yyyy", { locale: fr }) : "Toutes les réservations"}
            </CardTitle>
            <CardDescription>
              {filteredBookings.length} réservation(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Chargement...</p>
              ) : filteredBookings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucune réservation pour cette date
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((booking) => (
                    <Card
                      key={booking.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{booking.booking_time}</span>
                          </div>
                          <Badge className={getStatusColor(booking.status)}>
                            {getStatusLabel(booking.status)}
                          </Badge>
                        </div>
                        <p className="font-medium">{booking.full_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.service_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {booking.number_of_participants} participant(s)
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la réservation</DialogTitle>
            <DialogDescription>
              Réservation du {selectedBooking && format(new Date(selectedBooking.booking_date), "d MMMM yyyy", { locale: fr })}
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{selectedBooking.full_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedBooking.email}</p>
                  </div>
                </div>
                {selectedBooking.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Téléphone</p>
                      <p className="font-medium">{selectedBooking.phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date et heure</p>
                    <p className="font-medium">
                      {format(new Date(selectedBooking.booking_date), "d MMMM yyyy", { locale: fr })} à {selectedBooking.booking_time}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service</p>
                  <Badge variant="outline">{selectedBooking.service_type}</Badge>
                  <p className="font-medium mt-1">{selectedBooking.service_name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBooking.number_of_participants} participant(s)
                  </p>
                </div>
                {selectedBooking.message && (
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Message</p>
                      <p className="text-sm">{selectedBooking.message}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => updateBookingStatus(selectedBooking.id, "confirmed")}
                  disabled={selectedBooking.status === "confirmed"}
                  variant="default"
                  className="flex-1"
                >
                  Confirmer
                </Button>
                <Button
                  onClick={() => updateBookingStatus(selectedBooking.id, "completed")}
                  disabled={selectedBooking.status === "completed"}
                  variant="outline"
                  className="flex-1"
                >
                  Marquer terminée
                </Button>
                <Button
                  onClick={() => updateBookingStatus(selectedBooking.id, "cancelled")}
                  disabled={selectedBooking.status === "cancelled"}
                  variant="destructive"
                  className="flex-1"
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};