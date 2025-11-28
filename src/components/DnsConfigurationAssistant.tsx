import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Globe, Copy, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status: "checking" | "success" | "error" | "pending";
  message?: string;
}

interface DnsConfigurationAssistantProps {
  showcaseId: string;
  subdomain: string;
  currentDomain?: string | null;
  onDomainSave: (domain: string) => Promise<void>;
}

export function DnsConfigurationAssistant({ 
  showcaseId, 
  subdomain, 
  currentDomain,
  onDomainSave 
}: DnsConfigurationAssistantProps) {
  const [customDomain, setCustomDomain] = useState(currentDomain || "");
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([
    {
      type: "A",
      name: "@",
      value: "185.158.133.1",
      status: "pending",
    },
    {
      type: "A",
      name: "www",
      value: "185.158.133.1",
      status: "pending",
    },
    {
      type: "TXT",
      name: "_lovable",
      value: `lovable_verify=${showcaseId}`,
      status: "pending",
    },
  ]);

  const lovableSubdomain = `${subdomain}.lovable.app`;

  const checkDnsRecords = async () => {
    if (!customDomain) {
      toast.error("Veuillez entrer un nom de domaine");
      return;
    }

    setIsChecking(true);
    const updatedRecords = [...dnsRecords];

    try {
      // Vérifier chaque enregistrement DNS via Google DNS over HTTPS
      for (let i = 0; i < updatedRecords.length; i++) {
        const record = updatedRecords[i];
        updatedRecords[i] = { ...record, status: "checking" };
        setDnsRecords([...updatedRecords]);

        const recordName = record.name === "@" 
          ? customDomain 
          : record.name === "www" 
            ? `www.${customDomain}`
            : `${record.name}.${customDomain}`;

        try {
          const response = await fetch(
            `https://dns.google/resolve?name=${recordName}&type=${record.type}`
          );
          const data = await response.json();

          if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
            // Vérifier si la valeur correspond
            const found = data.Answer.some((answer: any) => {
              if (record.type === "A") {
                return answer.data === record.value;
              } else if (record.type === "TXT") {
                // Nettoyer les guillemets des enregistrements TXT
                const txtValue = answer.data.replace(/"/g, "");
                return txtValue.includes(record.value);
              }
              return false;
            });

            if (found) {
              updatedRecords[i] = {
                ...record,
                status: "success",
                message: "Enregistrement correctement configuré",
              };
            } else {
              updatedRecords[i] = {
                ...record,
                status: "error",
                message: `Valeur incorrecte. Trouvé: ${data.Answer[0].data}`,
              };
            }
          } else {
            updatedRecords[i] = {
              ...record,
              status: "error",
              message: "Enregistrement non trouvé. La propagation peut prendre jusqu'à 72 heures.",
            };
          }
        } catch (error) {
          updatedRecords[i] = {
            ...record,
            status: "error",
            message: "Erreur lors de la vérification",
          };
        }

        setDnsRecords([...updatedRecords]);
        // Petite pause entre les requêtes
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setLastCheck(new Date());
      toast.success("Vérification DNS terminée");
    } catch (error) {
      toast.error("Erreur lors de la vérification DNS");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveDomain = async () => {
    if (!customDomain) {
      toast.error("Veuillez entrer un nom de domaine");
      return;
    }

    // Valider le format du domaine
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(customDomain)) {
      toast.error("Format de domaine invalide");
      return;
    }

    try {
      await onDomainSave(customDomain);
      toast.success("Domaine personnalisé enregistré");
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement du domaine");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papiers");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "checking":
        return <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "checking":
        return <Badge variant="secondary">Vérification...</Badge>;
      case "success":
        return <Badge className="bg-green-500 hover:bg-green-600">Configuré</Badge>;
      case "error":
        return <Badge variant="destructive">Non configuré</Badge>;
      default:
        return <Badge variant="outline">En attente</Badge>;
    }
  };

  const allRecordsConfigured = dnsRecords.every(r => r.status === "success");

  return (
    <div className="space-y-6">
      {/* Domaine Lovable actuel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domaine Lovable
          </CardTitle>
          <CardDescription>
            Votre site est actuellement accessible via ce sous-domaine
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input value={lovableSubdomain} readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(lovableSubdomain)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(`https://${lovableSubdomain}`, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration du domaine personnalisé */}
      <Card>
        <CardHeader>
          <CardTitle>Domaine Personnalisé</CardTitle>
          <CardDescription>
            Connectez votre propre nom de domaine à votre site vitrine
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain">Nom de domaine</Label>
            <div className="flex gap-2">
              <Input
                id="custom-domain"
                placeholder="exemple.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
              />
              <Button onClick={handleSaveDomain} disabled={!customDomain}>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Entrez votre domaine sans "www" (exemple: monsite.com)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Assistant de configuration DNS */}
      {customDomain && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Configuration DNS</span>
              <Button
                variant="outline"
                size="sm"
                onClick={checkDnsRecords}
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Vérifier
                  </>
                )}
              </Button>
            </CardTitle>
            <CardDescription>
              Configurez ces enregistrements DNS chez votre registrar de domaine
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastCheck && (
              <p className="text-sm text-muted-foreground">
                Dernière vérification: {lastCheck.toLocaleTimeString()}
              </p>
            )}

            {/* Statut global */}
            {allRecordsConfigured && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Tous les enregistrements DNS sont correctement configurés ! Votre domaine sera actif sous peu.
                </AlertDescription>
              </Alert>
            )}

            {/* Liste des enregistrements DNS */}
            <div className="space-y-3">
              {dnsRecords.map((record, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(record.status)}
                          <Badge variant="outline">{record.type}</Badge>
                          {getStatusBadge(record.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Nom:</span>
                            <div className="font-mono font-semibold">{record.name}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valeur:</span>
                            <div className="font-mono font-semibold text-xs break-all">
                              {record.value}
                            </div>
                          </div>
                        </div>

                        {record.message && (
                          <p className={`text-sm ${
                            record.status === "success" 
                              ? "text-green-600" 
                              : record.status === "error" 
                                ? "text-destructive" 
                                : "text-muted-foreground"
                          }`}>
                            {record.message}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(record.value)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Instructions */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Connectez-vous à votre registrar de domaine (OVH, Namecheap, GoDaddy, etc.)</li>
                    <li>Accédez à la zone DNS de votre domaine</li>
                    <li>Ajoutez les enregistrements ci-dessus exactement comme indiqué</li>
                    <li>Attendez 10-15 minutes puis cliquez sur "Vérifier"</li>
                    <li>La propagation complète peut prendre jusqu'à 72 heures</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Propagation DNS:</strong> Les modifications DNS peuvent prendre de quelques minutes à 72 heures pour se propager complètement à travers le monde. Soyez patient !
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
