import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Phone, Navigation, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "react-qr-code";

interface DriversListProps {
  providerId: string;
}

export function DriversList({ providerId }: DriversListProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const inviteCode = providerId.substring(0, 8).toUpperCase();
  const inviteLink = `${window.location.origin}/delivery/driver?code=${inviteCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({
      title: "Lien copié !",
      description: "Vous pouvez l'envoyer à votre livreur.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["provider-drivers", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_company_members")
        .select(`
          id,
          user_id,
          role,
          is_active,
          created_at,
          profiles:user_id (
            first_name,
            last_name,
            phone_number
          ),
          order_deliveries:driver_id (
            id,
            status
          )
        `)
        .eq("provider_id", providerId)
        .eq("role", "driver");

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5 text-primary" />
          Mon Équipe de Livreurs
        </CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Inviter un livreur
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Inviter un livreur</DialogTitle>
              <DialogDescription>
                Partagez ce lien avec votre livreur pour qu'il rejoigne votre équipe.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4 mt-4">
              <div className="bg-white p-2 rounded-xl border">
                <QRCode value={inviteLink} size={150} />
              </div>
              <div className="grid flex-1 gap-2 w-full">
                <p className="text-sm font-medium text-center">Code d'entreprise : <span className="font-bold text-primary">{inviteCode}</span></p>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm break-all font-mono text-center">
                  {inviteLink}
                </div>
              </div>
            </div>
            <Button onClick={handleCopy} className="w-full mt-4">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copié !" : "Copier le lien d'invitation"}
            </Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mt-4">
          {drivers?.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              Aucun livreur dans votre équipe.
            </div>
          ) : (
            drivers?.map((driver: any) => {
              const profile = Array.isArray(driver.profiles) ? driver.profiles[0] : driver.profiles;
              const name = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Inconnu";
              const deliveries = driver.order_deliveries || [];
              const inTransitCount = deliveries.filter((d: any) => d.status === "in_transit").length;
              const deliveredCount = deliveries.filter((d: any) => d.status === "delivered").length;

              return (
                <div key={driver.id} className="border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
                      {name ? name.substring(0, 1) : "?"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{name || "Sans nom"}</h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        {profile?.phone_number && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {profile.phone_number}
                          </span>
                        )}
                        <Badge variant={driver.is_active ? "default" : "secondary"} className={driver.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                          {driver.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="text-center px-4 py-2 bg-slate-50 rounded-lg">
                      <div className="text-xl font-bold text-slate-800">{inTransitCount}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> En cours
                      </div>
                    </div>
                    <div className="text-center px-4 py-2 bg-slate-50 rounded-lg">
                      <div className="text-xl font-bold text-green-600">{deliveredCount}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        Livrés
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
