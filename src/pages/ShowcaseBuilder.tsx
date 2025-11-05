import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Globe, Phone, MessageCircle } from "lucide-react";

const showcaseSchema = z.object({
  businessName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  businessDescription: z.string().optional(),
  ownerName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  whatsappNumber: z.string().min(8, "Numéro WhatsApp invalide"),
  phoneNumber: z.string().min(8, "Numéro de téléphone invalide"),
  subdomain: z.string().min(3, "Le sous-domaine doit contenir au moins 3 caractères").regex(/^[a-z0-9-]+$/, "Uniquement lettres minuscules, chiffres et tirets"),
  formationTitle: z.string().optional(),
  formationDescription: z.string().optional(),
  formationPrice: z.string().optional(),
});

type ShowcaseFormData = z.infer<typeof showcaseSchema>;

export default function ShowcaseBuilder() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ShowcaseFormData>({
    resolver: zodResolver(showcaseSchema),
    defaultValues: {
      subdomain: "",
    },
  });

  const subdomain = watch("subdomain");

  const onSubmit = async (data: ShowcaseFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté pour créer un site vitrine");
        navigate("/auth");
        return;
      }

      const { data: site, error } = await supabase
        .from("showcase_sites")
        .insert({
          user_id: user.id,
          subdomain: data.subdomain,
          business_name: data.businessName,
          business_description: data.businessDescription,
          owner_name: data.ownerName,
          whatsapp_number: data.whatsappNumber,
          phone_number: data.phoneNumber,
          formation_title: data.formationTitle,
          formation_description: data.formationDescription,
          formation_price: data.formationPrice,
          is_published: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Ce nom de domaine est déjà utilisé");
        } else {
          toast.error("Erreur lors de la création du site vitrine");
        }
        return;
      }

      toast.success("Site vitrine créé avec succès !");
      navigate(`/showcase/${data.subdomain}`);
    } catch (error) {
      console.error("Error creating showcase site:", error);
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Créer votre site vitrine</h1>
          <p className="text-muted-foreground">
            Créez votre site professionnel en quelques minutes pour présenter votre entreprise ou vos formations
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informations sur l'entreprise */}
          <Card>
            <CardHeader>
              <CardTitle>Informations sur l'entreprise</CardTitle>
              <CardDescription>Présentez votre activité</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="businessName">Nom de l'entreprise *</Label>
                <Input
                  id="businessName"
                  {...register("businessName")}
                  placeholder="Ex: Formation Digital Pro"
                />
                {errors.businessName && (
                  <p className="text-sm text-destructive mt-1">{errors.businessName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="businessDescription">Description</Label>
                <Textarea
                  id="businessDescription"
                  {...register("businessDescription")}
                  placeholder="Décrivez votre activité, vos services..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Informations sur le propriétaire */}
          <Card>
            <CardHeader>
              <CardTitle>Vos informations</CardTitle>
              <CardDescription>Comment vous présenter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ownerName">Votre nom *</Label>
                <Input
                  id="ownerName"
                  {...register("ownerName")}
                  placeholder="Ex: Jean Dupont"
                />
                {errors.ownerName && (
                  <p className="text-sm text-destructive mt-1">{errors.ownerName.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Formation (optionnel) */}
          <Card>
            <CardHeader>
              <CardTitle>Formation proposée (optionnel)</CardTitle>
              <CardDescription>Si vous proposez une formation spécifique</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="formationTitle">Titre de la formation</Label>
                <Input
                  id="formationTitle"
                  {...register("formationTitle")}
                  placeholder="Ex: Marketing Digital Avancé"
                />
              </div>

              <div>
                <Label htmlFor="formationDescription">Description de la formation</Label>
                <Textarea
                  id="formationDescription"
                  {...register("formationDescription")}
                  placeholder="Décrivez le contenu, les bénéfices..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="formationPrice">Prix</Label>
                <Input
                  id="formationPrice"
                  {...register("formationPrice")}
                  placeholder="Ex: 50 000 FCFA"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de contact *</CardTitle>
              <CardDescription>Comment vos clients peuvent vous joindre</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="whatsappNumber">
                  <MessageCircle className="inline w-4 h-4 mr-2" />
                  Numéro WhatsApp *
                </Label>
                <Input
                  id="whatsappNumber"
                  {...register("whatsappNumber")}
                  placeholder="Ex: +225 0123456789"
                />
                {errors.whatsappNumber && (
                  <p className="text-sm text-destructive mt-1">{errors.whatsappNumber.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phoneNumber">
                  <Phone className="inline w-4 h-4 mr-2" />
                  Numéro de téléphone *
                </Label>
                <Input
                  id="phoneNumber"
                  {...register("phoneNumber")}
                  placeholder="Ex: +225 0123456789"
                />
                {errors.phoneNumber && (
                  <p className="text-sm text-destructive mt-1">{errors.phoneNumber.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Nom de domaine */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Globe className="inline w-5 h-5 mr-2" />
                Nom de domaine *
              </CardTitle>
              <CardDescription>
                Votre site sera accessible à l'adresse indiquée ci-dessous
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="subdomain">Sous-domaine</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    {...register("subdomain")}
                    placeholder="monsite"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground whitespace-nowrap">.visualpro.app</span>
                </div>
                {subdomain && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Votre site sera accessible à : <strong>{subdomain}.visualpro.app</strong>
                  </p>
                )}
                {errors.subdomain && (
                  <p className="text-sm text-destructive mt-1">{errors.subdomain.message}</p>
                )}
              </div>

              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm">
                  💡 <strong>Conseil :</strong> Choisissez un nom court et facile à retenir. 
                  Vous pourrez connecter votre propre domaine plus tard depuis les paramètres.
                </p>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création en cours...
              </>
            ) : (
              "Créer mon site vitrine"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}