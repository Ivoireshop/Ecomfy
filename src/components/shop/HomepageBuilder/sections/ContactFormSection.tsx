import React, { useState } from "react";
import { ContactFormSectionSettings } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { MessageSquare, Send, Phone, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ContactFormSectionProps {
  settings: ContactFormSectionSettings;
  primaryColor?: string;
  whatsappNumber?: string;
}

export const ContactFormSection: React.FC<ContactFormSectionProps> = ({
  settings,
  primaryColor = "#0E7C66",
  whatsappNumber,
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      toast({ title: "Champ requis", description: "Veuillez remplir votre nom et votre message.", variant: "destructive" });
      return;
    }

    const targetWa = settings.whatsapp_number || whatsappNumber;
    if (targetWa) {
      const cleanWa = targetWa.replace(/[^0-9]/g, "");
      const text = encodeURIComponent(`Bonjour, je vous contacte depuis la boutique.\n\n*Nom:* ${name}\n*Téléphone:* ${phone}\n*Email:* ${email}\n\n*Message:* ${message}`);
      window.open(`https://wa.me/${cleanWa}?text=${text}`, "_blank");
    }

    setSubmitted(true);
    toast({ title: "Message envoyé ✓", description: "Merci de nous avoir contactés." });
  };

  return (
    <section className="py-12 md:py-20 px-4 md:px-8 bg-slate-50 border-y border-slate-200" style={{ backgroundColor: settings.bg_color || undefined }}>
      <div className="max-w-4xl mx-auto">
        <Card className="p-6 md:p-10 rounded-3xl bg-white shadow-xl border-slate-200/80">
          <div className="text-center space-y-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto" style={{ color: primaryColor }}>
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 font-space">
              {settings.title || "Contactez-nous"}
            </h2>
            {settings.subtitle && (
              <p className="text-slate-600 text-sm max-w-lg mx-auto leading-relaxed">
                {settings.subtitle}
              </p>
            )}
          </div>

          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">Message bien reçu !</h3>
              <p className="text-slate-600 text-xs">Notre équipe vous répondra dans les plus brefs délais.</p>
              <Button variant="outline" size="sm" onClick={() => setSubmitted(false)} className="rounded-xl mt-2">
                Envoyer un autre message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Nom Complet *</Label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    className="h-11 bg-slate-50 border-slate-200 mt-1 rounded-xl text-sm"
                  />
                </div>

                {settings.show_phone && (
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Numéro de Téléphone</Label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 0700000000"
                      className="h-11 bg-slate-50 border-slate-200 mt-1 rounded-xl text-sm"
                    />
                  </div>
                )}
              </div>

              {settings.show_email && (
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Adresse E-mail</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemple@email.com"
                    className="h-11 bg-slate-50 border-slate-200 mt-1 rounded-xl text-sm"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold text-slate-700">Votre Message *</Label>
                <Textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Comment pouvons-nous vous aider ?"
                  className="bg-slate-50 border-slate-200 mt-1 rounded-xl text-sm"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-sm font-bold shadow-md rounded-xl gap-2 text-white uppercase tracking-wider mt-2 font-space"
                style={{ backgroundColor: primaryColor }}
              >
                <Send className="w-4 h-4" />
                {settings.button_text || "Envoyer le message"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </section>
  );
};
