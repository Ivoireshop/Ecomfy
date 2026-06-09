import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Globe, Sparkles } from "lucide-react";

const REGISTRARS = [
  {
    name: "Hostinger",
    url: "https://www.hostinger.fr/domaines",
    blurb: "Le plus populaire en Afrique. Paiement Mobile Money accepté.",
    badge: "Recommandé",
    badgeTone: "default" as const,
  },
  {
    name: "Cloudflare",
    url: "https://dash.cloudflare.com/?to=/:account/domains/register",
    blurb: "Prix au coût réel, DNS rapide, gestion technique avancée.",
    badge: "Le moins cher",
    badgeTone: "secondary" as const,
  },
  {
    name: "OVH",
    url: "https://www.ovhcloud.com/fr/domains/",
    blurb: "Acteur européen fiable, large choix d'extensions (.fr, .ci...).",
  },
  {
    name: "LWS",
    url: "https://www.lws.fr/nom_de_domaine.php",
    blurb: "Hébergeur français accessible, support en français.",
  },
  {
    name: "Namecheap",
    url: "https://www.namecheap.com/domains/",
    blurb: "Prix compétitifs, interface simple, paiement par carte.",
  },
  {
    name: "Lovable",
    url: "https://docs.lovable.dev/features/custom-domain",
    blurb: "Achat & connexion automatiques depuis votre projet Lovable.",
    badge: "Plus simple",
    badgeTone: "outline" as const,
  },
];

export function DomainRegistrarSuggestions() {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-primary" />
          Acheter un nom de domaine
        </CardTitle>
        <CardDescription className="text-xs">
          Choisissez un fournisseur pour acheter votre domaine. Revenez ensuite ici pour le configurer avec les
          informations DNS plus bas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid sm:grid-cols-2 gap-2">
          {REGISTRARS.map((r) => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between gap-3 rounded-lg border bg-card p-3 hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{r.name}</span>
                  {r.badge && (
                    <Badge variant={r.badgeTone || "secondary"} className="text-[10px] px-1.5 py-0">
                      {r.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{r.blurb}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
            </a>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Comment pointer votre domaine vers votre site
          </div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-relaxed">
            <li>Achetez votre domaine sur l'un des fournisseurs ci-dessus.</li>
            <li>Connectez-vous à l'espace DNS du fournisseur (rubrique « Zone DNS » ou « Gestion DNS »).</li>
            <li>
              Ajoutez les enregistrements <b>CNAME</b> ou <b>A</b> indiqués dans la section ci-dessous (récupérables ici
              même).
            </li>
            <li>
              Patientez 5 à 60 minutes le temps que la propagation DNS soit effective, puis cliquez sur
              <b> Vérifier le domaine</b>.
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}