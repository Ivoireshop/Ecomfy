import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, Copy, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Save, ArrowRight, ArrowLeft } from "lucide-react";
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
  const [currentStep, setCurrentStep] = useState(currentDomain && verificationCode ? 3 : 1);

  const lovableSubdomain = currentBaseUrl || (subdomain ? `${subdomain}.lovable.app` : '');

  // Auto-check DNS every 30 seconds when domain is configured and on step 3
  useEffect(() => {
    if (customDomain && verificationCode && localStatus !== 'verified' && currentStep === 3) {
      checkDnsRecords();
      const interval = setInterval(() => {
        checkDnsRecords();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [customDomain, verificationCode, localStatus, currentStep]);

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
      setCurrentStep(2);
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
      case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'checking': return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: DnsRecord['status']) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">Configuré</Badge>;
      case 'error': return <Badge variant="destructive">Erreur</Badge>;
      case 'pending': return <Badge variant="secondary">En attente</Badge>;
      case 'checking': return <Badge variant="outline">Vérification...</Badge>;
      default: return <Badge variant="outline">Non vérifié</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted rounded-full z-0"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full z-0 transition-all duration-300" style={{ width: `${((currentStep - 1) / 2) * 100}%` }}></div>
        {[1, 2, 3].map((step) => (
          <div key={step} className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${currentStep >= step ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted text-muted-foreground'}`}>
            {step}
          </div>
        ))}
      </div>

      {currentStep === 1 && (
        <Card className="animate-in fade-in slide-in-from-right-2 duration-300">
          <CardHeader>
            <CardTitle>Étape 1 : Saisissez votre domaine</CardTitle>
            <CardDescription>
              Avez-vous déjà un nom de domaine (ex: ovh.com, godaddy.com) ?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <DomainRegistrarSuggestions />
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="custom-domain">Nom de domaine à connecter</Label>
              <div className="flex gap-2">
                <Input
                  id="custom-domain"
                  placeholder="monsite.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Entrez votre domaine sans "www" ni "https://"
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t pt-4">
            <Button onClick={handleSaveDomain} disabled={!customDomain}>
              Suivant <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 2 && (
        <Card className="animate-in fade-in slide-in-from-right-2 duration-300">
          <CardHeader>
            <CardTitle>Étape 2 : Configuration DNS</CardTitle>
            <CardDescription>
              Ajoutez ces enregistrements dans l'espace client de votre fournisseur de domaine (OVH, GoDaddy, Hostinger...).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2 mb-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                📋 Instructions : Supprimez les anciens enregistrements A et CNAME avant d'ajouter ceux-ci.
              </p>
            </div>

            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="pt-6 pb-6">
                  <p className="font-semibold mb-3 flex items-center gap-2"><Badge variant="outline">1</Badge> Enregistrement CNAME</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Type</p>
                      <p className="font-mono">CNAME</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Nom / Host</p>
                      <p className="font-mono">www <Copy onClick={() => copyToClipboard('www')} className="inline h-3 w-3 cursor-pointer ml-1 text-muted-foreground hover:text-primary" /></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Valeur / Cible</p>
                      <p className="font-mono">{ECOMFY_CONFIG.CNAME_TARGET} <Copy onClick={() => copyToClipboard(ECOMFY_CONFIG.CNAME_TARGET)} className="inline h-3 w-3 cursor-pointer ml-1 text-muted-foreground hover:text-primary" /></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/50">
                <CardContent className="pt-6 pb-6">
                  <p className="font-semibold mb-3 flex items-center gap-2"><Badge variant="outline">2</Badge> Enregistrement A</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Type</p>
                      <p className="font-mono">A</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Nom / Host</p>
                      <p className="font-mono">@ <Copy onClick={() => copyToClipboard('@')} className="inline h-3 w-3 cursor-pointer ml-1 text-muted-foreground hover:text-primary" /></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Valeur / IPv4</p>
                      <p className="font-mono">{ECOMFY_CONFIG.A_RECORD_IP} <Copy onClick={() => copyToClipboard(ECOMFY_CONFIG.A_RECORD_IP)} className="inline h-3 w-3 cursor-pointer ml-1 text-muted-foreground hover:text-primary" /></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/50">
                <CardContent className="pt-6 pb-6">
                  <p className="font-semibold mb-3 flex items-center gap-2"><Badge variant="outline">3</Badge> Enregistrement TXT</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Type</p>
                      <p className="font-mono">TXT</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Nom / Host</p>
                      <p className="font-mono">@ <Copy onClick={() => copyToClipboard('@')} className="inline h-3 w-3 cursor-pointer ml-1 text-muted-foreground hover:text-primary" /></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Valeur</p>
                      <p className="font-mono text-xs break-all">ecomfy-site-verification={verificationCode} <Copy onClick={() => copyToClipboard(`ecomfy-site-verification=${verificationCode}`)} className="inline h-3 w-3 cursor-pointer ml-1 text-muted-foreground hover:text-primary" /></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
            <Button onClick={() => { setCurrentStep(3); checkDnsRecords(); }}>
              J'ai ajouté ces enregistrements <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 3 && (
        <Card className="animate-in fade-in slide-in-from-right-2 duration-300">
          <CardHeader>
            <CardTitle>Étape 3 : Vérification et Validation</CardTitle>
            <CardDescription>
              Ecomfy vérifie la propagation de vos DNS (Cela peut prendre jusqu'à 72h).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 bg-muted/30 rounded-xl border flex flex-col items-center justify-center min-h-[200px] text-center space-y-4">
              {localStatus === 'verified' ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-400">Domaine connecté avec succès !</h3>
                  <p className="text-sm text-muted-foreground max-w-md">Votre domaine pointe correctement vers nos serveurs. Le certificat SSL est en cours d'installation.</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold">Vérification en cours...</h3>
                  <div className="w-full max-w-md space-y-2 mt-4">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Propagation DNS</span>
                      <span>{localPropagation}%</span>
                    </div>
                    <Progress value={localPropagation} className="h-2" />
                  </div>
                  <p className="text-xs text-muted-foreground max-w-sm mt-4">La vérification est automatique toutes les 30s. Vous pouvez fermer cette page et revenir plus tard.</p>
                </>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg flex justify-between items-center bg-card">
                <span className="text-sm font-medium">Statut DNS</span>
                {getStatusBadge(localStatus as any)}
              </div>
              <div className="p-4 border rounded-lg flex justify-between items-center bg-card">
                <span className="text-sm font-medium">Statut SSL</span>
                <Badge variant={localSslStatus === 'active' ? 'default' : 'secondary'}>
                  {localSslStatus === 'active' ? '✓ Sécurisé' : '⏳ En attente'}
                </Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Revoir la configuration
            </Button>
            <Button variant="outline" onClick={checkDnsRecords} disabled={isChecking}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Forcer la vérification
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};