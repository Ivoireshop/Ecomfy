import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/shop/PhoneInput";

const bookingSchema = z.object({
  full_name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  booking_date: z.date({ required_error: "Veuillez sélectionner une date" }),
  booking_time: z.string().min(1, "Veuillez sélectionner une heure"),
  service_type: z.string().min(1, "Veuillez sélectionner un type de service"),
  service_name: z.string().min(1, "Veuillez sélectionner un service"),
  number_of_participants: z.number().min(1).max(50),
  message: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  showcaseSiteId: string;
  site: any;
  onSuccess?: () => void;
}

export const BookingForm = ({ showcaseSiteId, site, onSuccess }: BookingFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      booking_time: "",
      service_type: "",
      service_name: "",
      number_of_participants: 1,
      message: "",
    },
  });

  const selectedServiceType = form.watch("service_type");

  const getServiceOptions = () => {
    if (!selectedServiceType) return [];
    
    if (selectedServiceType === "formation") {
      return site.formations?.map((f: any) => ({ value: f.title, label: f.title })) || [];
    }
    
    return site.features?.map((f: any) => ({ value: f.title, label: f.title })) || [];
  };

  const onSubmit = async (values: BookingFormValues) => {
    setIsSubmitting(true);
    try {
      const { normalizeToE164 } = await import("@/lib/phoneCountries");
      const normalizedPhone = values.phone ? (normalizeToE164(values.phone) || values.phone) : values.phone;
      const bookingData = {
        showcase_site_id: showcaseSiteId,
        full_name: values.full_name,
        email: values.email,
        phone: normalizedPhone,
        booking_date: format(values.booking_date, "yyyy-MM-dd"),
        booking_time: values.booking_time,
        service_type: values.service_type,
        service_name: values.service_name,
        number_of_participants: values.number_of_participants,
        message: values.message,
        status: "pending",
      };

      const { error } = await supabase.from("bookings").insert(bookingData);

      if (error) throw error;

      // Créer automatiquement une notification dans les messages
      const serviceTypeLabel = values.service_type === "formation" ? "Formation" : "Service";
      const notificationMessage = `📋 NOUVELLE RÉSERVATION\n\n` +
        `Type: ${serviceTypeLabel}\n` +
        `${serviceTypeLabel}: ${values.service_name}\n` +
        `Date: ${format(values.booking_date, "dd MMMM yyyy", { locale: fr })}\n` +
        `Heure: ${values.booking_time}\n` +
        `Nombre de participants: ${values.number_of_participants}\n` +
        (values.message ? `\nMessage:\n${values.message}` : "");

      await supabase.from("contact_submissions").insert({
        showcase_site_id: showcaseSiteId,
        full_name: values.full_name,
        email: values.email,
        phone: normalizedPhone,
        message: notificationMessage,
        status: "new",
      });

      // Envoyer la notification email au propriétaire
      try {
        await supabase.functions.invoke('send-booking-notification', {
          body: {
            showcaseSiteId,
            bookingDetails: {
              full_name: values.full_name,
              email: values.email,
              phone: normalizedPhone,
              booking_date: format(values.booking_date, "yyyy-MM-dd"),
              booking_time: values.booking_time,
              service_type: values.service_type,
              service_name: values.service_name,
              number_of_participants: values.number_of_participants,
              message: values.message,
            },
          },
        });
        console.log("Email notification sent successfully");
      } catch (emailError) {
        console.error("Error sending email notification:", emailError);
        // On ne bloque pas le processus si l'email échoue
      }

      toast({
        title: "Réservation envoyée !",
        description: "Vous recevrez une confirmation par email sous peu.",
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating booking:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la réservation. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ color: site.primary_color }}>Réserver</CardTitle>
        <CardDescription>
          Remplissez ce formulaire pour réserver votre consultation ou formation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom complet *</FormLabel>
                  <FormControl>
                    <Input placeholder="Votre nom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="votre@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <PhoneInput value={field.value || ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="booking_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: fr })
                            ) : (
                              <span>Sélectionner une date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          locale={fr}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="booking_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une heure" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="service_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de service *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {site.formations?.length > 0 && (
                        <SelectItem value="formation">Formation</SelectItem>
                      )}
                      {site.features?.length > 0 && (
                        <SelectItem value="service">Service/Consultation</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service spécifique *</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!selectedServiceType}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le service" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getServiceOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="number_of_participants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de participants *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Informations supplémentaires..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              style={{ backgroundColor: site.primary_color }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                "Envoyer la réservation"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};