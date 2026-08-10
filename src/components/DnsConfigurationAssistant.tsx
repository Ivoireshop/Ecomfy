import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, Copy, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DomainRegistrarSuggestions } from "@/components/DomainRegistrarSuggestions";

// Fixed DNS configuration for Ecomfy
const ECOMFY_CONFIG = {
  CNAME_TARGET: 'sites.ecomfy.cloud',
  A_RECORD_IP: '185.178.193.121',
  CLOUDFLARE_VERIFY: 'verify.ecomfy.cloud',
};

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status: 'checking' | 'success' | 'error' | 'pending';
  message?: string;
}

interface DnsConfigurationAssistantProps {
  showcaseId?: string;
  resourceId?: string;
  resourceType?: 'showcase' | 'shop';
  subdomain?: string;
  currentBaseUrl?: string;
  currentDomain?: string;
  verificationCode?: string;
  domainStatus?: string;
  propagationPercentage?: number;
  sslStatus?: string;
  onDomainSave: (domain: string) => Promise<void>;
}

export const DnsConfigurationAssistant = ({
  showcaseId,
  resourceId,
  resourceType = 'showcase',
  subdomain,
  currentBaseUrl,
  currentDomain = "",
  verificationCode = "",
  domainStatus = "not_configured",
  propagationPercentage = 0,
  sslStatus = "pending",
  onDomainSave,
}: DnsConfigurationAssistantProps) => {
  const effectiveResourceId = resourceId || showcaseId!;
  const effectiveResourceType = resourceType;
  const resourceLabel = 'boutique';
  const [customDomain, setCustomDomain] = useState(currentDomain);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [localPropagation, setLocalPropagation] = useState(propagationPercentage);
  const [localStatus, setLocalStatus] = useState(domainStatus);
  const [localSslStatus, setLocalSslStatus] = useState(sslStatus);

  const lovableSubdomain = currentBaseUrl || (subdomain ? `${subdomain}.lovable.app` : '');

  // Auto-check DNS every 30 seconds when domain is configured
  useEffect(() => {
    if (customDomain && verificationCode && localStatus !== 'verified') {
      checkDnsRecords();
      const interval = setInterval(() => {
        checkDnsRecords();
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [customDomain, verificationCode, localStatus]);

  // Update local state when props change
  useEffect(() => {
    setLocalPropagation(propagationPercentage);
    setLocalStatus(domainStatus);
    setLocalSslStatus(sslStatus);
  }, [propagationPercentage, domainStatus, sslStatus]);

  const checkDnsRecords = async () => {
    if (!customDomain || !verificationCode) return;
    
    setIsChecking(true);
    setLastCheck(new Date());

    try {
      const { data, error } = await supabase.functions.invoke('verify-domain-dns', {
        body: {
          resourceId: effectiveResourceId,
          resourceType: effectiveResourceType,
          showcaseId: effectiveResourceType === 'showcase' ? effectiveResourceId : undefined,
          shopId: effectiveResourceType === 'shop' ? effectiveResourceId : undefined,
          domain: customDomain,
          verificationCode,
        },
      });

      if (error) throw error;

      if (data.success) {
        setDnsRecords(data.results);
        setLocalPropagation(data.propagationPercentage);
        setLocalStatus(data.status);
        setLocalSslStatus(data.sslReady ? 'active' : 'pending');

        if (data.propagationPercentage === 100) {
          toast.success("Configuration DNS complète ! SSL en cours d'activation...");
        } else if (data.propagationPercentage > 0) {
          toast.info(`Propagation DNS : ${data.propagationPercentage}%`);
        }
      }
    } catch (error) {
      console.error("Error checking DNS records:", error);
      toast.error("Erreur lors de la vérification des DNS");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveDomain = async () => {
    if (!customDomain) {
      toast.error("Veuillez entrer un nom de domaine");
      return;
    }

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

  const getStatusIcon = (status: DnsRecord['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'checking':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: DnsRecord['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">Configuré</Badge>;
      case 'error':
        return <Badge variant="destructive">Erreur</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'checking':
        return <Badge variant="outline">Vérification...</Badge>;
      default:
        return <Badge variant="outline">Non vérifié</Badge>;
    }
  };

  const getOverallStatusMessage = () => {
    switch (localStatus) {
      case 'verified':
        return {
          title: '✓ Configuration terminée',
          description: 'Votre domaine est correctement configuré et le SSL est actif.',
          variant: 'default' as const,
        };
      case 'partial_propagation':
        return {
          title: '⏳ Propagation DNS en cours',
          description: `${localPropagation}% complété - La propagation peut prendre jusqu'à 72 heures.`,
          variant: 'default' as const,
        };
      case 'pending_verification':
        return {
          title: '🔍 En attente de configuration',
          description: 'Ajoutez les enregistrements DNS ci-dessous dans votre gestionnaire de domaine.',
          variant: 'default' as const,
        };
      default:
        return {
          title: 'Configuration non démarrée',
          description: 'Entrez votre domaine personnalisé pour commencer.',
          variant: 'secondary' as const,
        };
    }
  };

  const allRecordsConfigured = localStatus === 'verified';
  const statusMessage = getOverallStatusMessage();

  return (
    <div className="space-y-6">
      {/* Where to buy a domain */}
      <DomainRegistrarSuggestions />

      {/* Lovable Subdomain */}
      <Card>
        <CardHeader>
          <CardTitle>Domaine Ecomfy actuel</CardTitle>
          <CardDescription>
            Votre {resourceLabel} est actuellement accessible via cette adresse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input 
              value={lovableSubdomain} 
              readOnly 
              className="font-mono text-sm bg-muted"
            />
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

      {/* Custom Domain Input */}
      <Card>
        <CardHeader>
          <CardTitle>Domaine Personnalisé</CardTitle>
          <CardDescription>
            Connectez votre propre nom de domaine à votre {resourceLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain">Nom de domaine</Label>
            <div className="flex gap-2">
              <Input
                id="custom-domain"
                placeholder="monsite.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
              />
              <Button onClick={handleSaveDomain} disabled={!customDomain}>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Entrez votre domaine sans "www" (exemple: maboutique.com)
            </p>
          </div>
        </CardContent>
      </Card>

      {customDomain && verificationCode && (
        <Card>
          <CardHeader>
            <CardTitle>Assistant de Configuration DNS</CardTitle>
            <CardDescription>
              Vérification automatique toutes les 30 secondes • Configuration universelle compatible avec tous les registrars
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{statusMessage.title}</h3>
                {localStatus === 'verified' && <CheckCircle2 className="h-6 w-6 text-green-500" />}
              </div>
              <p className="text-sm text-muted-foreground">{statusMessage.description}</p>
              
              {/* Propagation Progress */}
              {localStatus !== 'not_configured' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progression de la propagation DNS</span>
                    <span className="font-semibold">{localPropagation}%</span>
                  </div>
                  <Progress value={localPropagation} className="h-2" />
                </div>
              )}

              {/* SSL Status */}
              {localPropagation > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Statut SSL (HTTPS)</span>
                  <Badge variant={localSslStatus === 'active' ? 'default' : 'secondary'}>
                    {localSslStatus === 'active' ? '✓ Actif' : '⏳ En attente'}
                  </Badge>
                </div>
              )}
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Configuration DNS Universelle</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkDnsRecords}
                  disabled={isChecking}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
                  {isChecking ? 'Vérification...' : 'Vérifier maintenant'}
                </Button>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  📋 Instructions pour votre gestionnaire de domaine
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Compatible avec GoDaddy, OVH, Namecheap, Hostinger, Cloudflare, Google Domains, etc.
                </p>
              </div>

              {/* DNS Records */}
              <div className="space-y-4">
                {/* CNAME Record for www */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {dnsRecords.find(r => r.type === 'CNAME') ? 
                          getStatusIcon(dnsRecords.find(r => r.type === 'CNAME')!.status) : 
                          <Clock className="h-5 w-5 text-gray-400" />
                        }
                        <div>
                          <p className="font-semibold">1. Enregistrement CNAME (sous-domaine www)</p>
                          {dnsRecords.find(r => r.type === 'CNAME') && getStatusBadge(dnsRecords.find(r => r.type === 'CNAME')!.status)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm bg-muted p-3 rounded-md">
                      <div>
                        <p className="text-muted-foreground mb-1">Type</p>
                        <p className="font-mono">CNAME</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Nom / Host</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono">www</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard('www')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Valeur / Target</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xs">{ECOMFY_CONFIG.CNAME_TARGET}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(ECOMFY_CONFIG.CNAME_TARGET)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {dnsRecords.find(r => r.type === 'CNAME')?.message && (
                      <p className="text-sm text-muted-foreground mt-3">
                        {dnsRecords.find(r => r.type === 'CNAME')!.message}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* A Record for root domain */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {dnsRecords.find(r => r.type === 'A') ? 
                          getStatusIcon(dnsRecords.find(r => r.type === 'A')!.status) : 
                          <Clock className="h-5 w-5 text-gray-400" />
                        }
                        <div>
                          <p className="font-semibold">2. Enregistrement A (domaine racine)</p>
                          {dnsRecords.find(r => r.type === 'A') && getStatusBadge(dnsRecords.find(r => r.type === 'A')!.status)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm bg-muted p-3 rounded-md">
                      <div>
                        <p className="text-muted-foreground mb-1">Type</p>
                        <p className="font-mono">A</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Nom / Host</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono">@</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard('@')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Valeur / IPv4</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono">{ECOMFY_CONFIG.A_RECORD_IP}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(ECOMFY_CONFIG.A_RECORD_IP)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {dnsRecords.find(r => r.type === 'A')?.message && (
                      <p className="text-sm text-muted-foreground mt-3">
                        {dnsRecords.find(r => r.type === 'A')!.message}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* TXT Record for verification */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {dnsRecords.find(r => r.type === 'TXT') ? 
                          getStatusIcon(dnsRecords.find(r => r.type === 'TXT')!.status) : 
                          <Clock className="h-5 w-5 text-gray-400" />
                        }
                        <div>
                          <p className="font-semibold">3. Enregistrement TXT (vérification du domaine)</p>
                          {dnsRecords.find(r => r.type === 'TXT') && getStatusBadge(dnsRecords.find(r => r.type === 'TXT')!.status)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm bg-muted p-3 rounded-md">
                      <div>
                        <p className="text-muted-foreground mb-1">Type</p>
                        <p className="font-mono">TXT</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Nom / Host</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono">@</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard('@')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Valeur / Value</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xs break-all">ecomfy-site-verification={verificationCode}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(`ecomfy-site-verification=${verificationCode}`)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {dnsRecords.find(r => r.type === 'TXT')?.message && (
                      <p className="text-sm text-muted-foreground mt-3">
                        {dnsRecords.find(r => r.type === 'TXT')!.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Additional Information */}
              <div className="space-y-3">
                <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                          ⚠️ Si vous utilisez Cloudflare
                        </p>
                        <p className="text-yellow-800 dark:text-yellow-200">
                          Désactivez le mode "Proxied" (orange → gris) pour les enregistrements lors de la première configuration.
                          Vous pourrez le réactiver une fois le SSL provisionné.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                  <p className="font-medium">💡 Informations importantes :</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li>La propagation DNS peut prendre de 5 minutes à 72 heures</li>
                    <li>Le certificat SSL est généré automatiquement une fois les DNS validés</li>
                    <li>Vérification automatique toutes les 30 secondes pendant la propagation</li>
                    <li>Supprimez tout ancien enregistrement A ou CNAME existant pour ce domaine</li>
                  </ul>
                </div>

                {lastCheck && (
                  <p className="text-xs text-muted-foreground text-center">
                    Dernière vérification: {lastCheck.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};