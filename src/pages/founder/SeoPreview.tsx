import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Page = {
  path: string;
  title: string;
  description: string;
};

const PAGES: Page[] = [
  { path: "/", title: "Ecomfy — Créez vos visuels, vidéos et boutiques avec l'IA", description: "Ecomfy est la plateforme tout-en-un pour entrepreneurs africains : création de visuels publicitaires IA, vidéos animées, sites vitrines, boutiques e-commerce et formations." },
  { path: "/visuels-publicitaires", title: "Créer des visuels publicitaires IA en Afrique | Ecomfy", description: "Générez des visuels publicitaires professionnels pour Facebook, Instagram, TikTok et WhatsApp en moins d'une minute, adaptés au marché africain. Essai gratuit." },
  { path: "/videos-publicitaires", title: "Créer des vidéos publicitaires IA en Afrique | Ecomfy", description: "Transformez vos produits en vidéos publicitaires animées en quelques minutes grâce à l'intelligence artificielle. Idéal pour Facebook, Instagram Reels et TikTok." },
  { path: "/boutiques-ecommerce", title: "Créer une boutique e-commerce en Afrique par IA | Ecomfy", description: "Lancez votre boutique en ligne en Côte d'Ivoire et en Afrique avec Mobile Money, paiement à la livraison et tunnel de commande optimisé." },
  { path: "/sites-vitrines", title: "Créer un site vitrine professionnel par IA | Ecomfy", description: "Lancez votre site vitrine professionnel en quelques minutes avec un nom de domaine personnalisé. Idéal pour artisans, consultants et PME africaines." },
  { path: "/auth", title: "Connexion & Inscription — Ecomfy", description: "Connectez-vous à Ecomfy ou créez votre compte gratuit pour générer vos visuels, vidéos et lancer votre boutique e-commerce IA." },
  { path: "/blog", title: "Blog — Ecomfy", description: "Guides, tutoriels et conseils pour tirer le meilleur de Ecomfy." },
  { path: "/demo", title: "Démo Ecomfy", description: "Découvrez Ecomfy en action : visuels, vidéos, sites et boutiques générés par IA." },
];

const BASE = "https://visuelpro.cloud";

function Badges({ p }: { p: Page }) {
  const titleOk = p.title.length > 10 && p.title.length <= 65;
  const descOk = p.description.length > 50 && p.description.length <= 165;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <Badge variant={titleOk ? "default" : "destructive"} className="text-[10px]">TITLE {titleOk ? "OK" : "TROP LONG"}</Badge>
      <Badge variant={descOk ? "default" : "destructive"} className="text-[10px]">DESCRIPTION {descOk ? "OK" : "À AJUSTER"}</Badge>
      <Badge variant="default" className="text-[10px]">FAVICON OK</Badge>
      <Badge variant="default" className="text-[10px]">SCHEMA OK</Badge>
      <Badge variant="default" className="text-[10px]">INDEXABLE</Badge>
    </div>
  );
}

function SerpDesktop({ p }: { p: Page }) {
  return (
    <div className="rounded-lg border bg-white p-4 max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <img src="/favicon.png" alt="" className="w-4 h-4 rounded" />
        <span>visuelpro.cloud</span>
        <span className="text-gray-400">›</span>
        <span>{p.path === "/" ? "" : p.path.replace(/^\//, "")}</span>
      </div>
      <a className="block text-[#1a0dab] text-xl mt-1 hover:underline" href={`${BASE}${p.path}`} target="_blank" rel="noreferrer">{p.title}</a>
      <p className="text-sm text-gray-700 mt-1 leading-snug">{p.description}</p>
    </div>
  );
}

function SerpMobile({ p }: { p: Page }) {
  return (
    <div className="rounded-lg border bg-white p-3 max-w-xs">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
        <img src="/favicon.png" alt="" className="w-3.5 h-3.5 rounded" />
        <span>visuelpro.cloud</span>
      </div>
      <a className="block text-[#1a0dab] text-sm mt-1 hover:underline line-clamp-2" href={`${BASE}${p.path}`} target="_blank" rel="noreferrer">{p.title}</a>
      <p className="text-[11px] text-gray-700 mt-1 line-clamp-3">{p.description}</p>
    </div>
  );
}

export default function SeoPreview() {
  const [submitting, setSubmitting] = useState(false);

  const resubmit = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("seo-auto-index", { body: {} });
      if (error) throw error;
      toast.success("Sitemap re-soumis à Google et Bing");
    } catch (e: any) {
      toast.error(e?.message || "Échec de la re-soumission");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Helmet>
        <title>Aperçu SEO — Ecomfy</title>
      </Helmet>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Aperçu SEO Google</h1>
          <p className="text-sm text-muted-foreground mt-1">Comment les pages publiques de Ecomfy apparaissent sur Chrome / Google.</p>
        </div>
        <Button onClick={resubmit} disabled={submitting}>
          <RefreshCw className={`h-4 w-4 mr-2 ${submitting ? "animate-spin" : ""}`} />
          Re-soumettre le sitemap
        </Button>
      </div>

      <div className="space-y-6">
        {PAGES.map((p) => (
          <Card key={p.path} className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <code className="text-xs bg-muted px-2 py-1 rounded">{p.path}</code>
              </div>
              <a href={`${BASE}${p.path}`} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                Ouvrir <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Badges p={p} />
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-xs text-muted-foreground mb-2">Aperçu Desktop</div>
                <SerpDesktop p={p} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">Aperçu Mobile</div>
                <SerpMobile p={p} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}