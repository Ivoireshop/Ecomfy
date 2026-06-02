import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { normalizeToE164 } from "@/lib/phoneCountries";
import { PhoneInput } from "@/components/shop/PhoneInput";

interface ContactFormProps {
  showcaseSiteId: string;
  businessName: string;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export function ContactForm({ showcaseSiteId, businessName, theme }: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const normalizedPhone = formData.phone
        ? (normalizeToE164(formData.phone) || formData.phone)
        : null;
      const { error } = await supabase.from("contact_submissions").insert({
        showcase_site_id: showcaseSiteId,
        full_name: formData.fullName,
        email: formData.email,
        phone: normalizedPhone,
        message: formData.message,
      });

      if (error) throw error;

      // Send email notification to site owner
      try {
        await supabase.functions.invoke("send-contact-notification", {
          body: {
            showcaseSiteId,
            contactName: formData.fullName,
            contactEmail: formData.email,
            contactPhone: normalizedPhone,
            message: formData.message,
          },
        });
        console.log("Notification email sent");
      } catch (emailError) {
        // Log but don't fail the submission if email fails
        console.error("Failed to send notification email:", emailError);
      }

      toast.success("Message envoyé avec succès ! Nous vous contacterons bientôt.");
      setFormData({ fullName: "", email: "", phone: "", message: "" });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      toast.error("Erreur lors de l'envoi du message. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="border-2" style={{ borderColor: theme?.primaryColor ? `${theme.primaryColor}33` : undefined }}>
      <CardHeader>
        <CardTitle className="text-2xl">Contactez-nous</CardTitle>
        <CardDescription>
          Laissez-nous un message et nous vous répondrons dans les plus brefs délais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              required
              placeholder="Votre nom"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
              placeholder="votre@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <PhoneInput
              value={formData.phone}
              onChange={(v) => handleChange("phone", v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleChange("message", e.target.value)}
              required
              placeholder="Votre message..."
              rows={5}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
            size="lg"
            style={{
              backgroundColor: theme?.primaryColor,
              color: "white",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Envoyer le message
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
