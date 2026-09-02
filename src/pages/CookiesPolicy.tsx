import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Cookie, Shield, ArrowLeft, CheckCircle2, Lock, FileText, 
  Settings, ExternalLink, Database, Server, Check, Copy, HelpCircle
} from "lucide-react";
import { toast } from "sonner";

export default function CookiesPolicy() {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copyToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast.success(`Adresse ${email} copiée dans le presse-papier !`);
    setTimeout(() => setCopiedEmail(null), 3000);
  };

  const lastUpdated = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">

        {/* Navigation & Hero Header Banner */}
        <div className="space-y-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-900 rounded-full gap-2 text-xs font-semibold">
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l'accueil Ecomfy</span>
            </Button>
          </Link>

          <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#0E7C66]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-xs font-bold px-3 py-1 rounded-full gap-1.5">
                <Cookie className="w-3.5 h-3.5" />
                <span>Protection des Données & Gestion des Cookies</span>
              </Badge>
              <span className="text-xs text-slate-400 font-medium">Dernière mise à jour : {lastUpdated}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-space font-extrabold text-white tracking-tight leading-tight flex items-center gap-3">
              Politique des Cookies Ecomfy
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl font-normal">
              La présente politique décrit en toute transparence l'utilisation des cookies et tracéurs numériques sur la plateforme SaaS **Ecomfy** (`ecomfy.cloud`), ainsi que les moyens mis à votre disposition pour les gérer et paramétrer vos préférences.
            </p>

            {/* Official Support Email Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between group hover:border-[#0E7C66]/50 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Protection des Données</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">privacy@ecomfy.cloud</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard("privacy@ecomfy.cloud")} className="h-8 w-8 text-slate-400 hover:text-white">
                  {copiedEmail === "privacy@ecomfy.cloud" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between group hover:border-[#0E7C66]/50 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assistance Technique</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">support@ecomfy.cloud</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard("support@ecomfy.cloud")} className="h-8 w-8 text-slate-400 hover:text-white">
                  {copiedEmail === "support@ecomfy.cloud" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between group hover:border-[#0E7C66]/50 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Renseignements & Info</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">info@ecomfy.cloud</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard("info@ecomfy.cloud")} className="h-8 w-8 text-slate-400 hover:text-white">
                  {copiedEmail === "info@ecomfy.cloud" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Sections Card */}
        <Card className="bg-slate-900/90 border-slate-800 text-slate-300 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-10">

          {/* Section 1 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">01</div>
              <h2 className="text-xl sm:text-2xl font-space font-bold text-white">Qu'est-ce qu'un Cookie et un Tracéur Numérique ?</h2>
            </div>
            <p className="text-sm leading-relaxed">
              Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette ou smartphone) lors de la consultation d'un site web ou de l'utilisation d'une application. Les cookies et technologies d'affichage équivalentes (LocalStorage, SessionStorage) permettent à la plateforme **Ecomfy** de mémoriser vos actions, votre session de connexion et vos préférences de navigation afin de vous offrir une expérience fluide et sécurisée.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">02</div>
              <h2 className="text-xl sm:text-2xl font-space font-bold text-white">Pourquoi Ecomfy utilise des Cookies ?</h2>
            </div>
            <p className="text-sm leading-relaxed">
              La plateforme **Ecomfy** recourt aux cookies et tracéurs pour assurer le bon fonctionnement de ses services marchands et d'administration :
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
              <li className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Authentification Sécurisée</strong> : Maintenir votre session utilisateur active sur votre Tableau de Bord.</span>
              </li>
              <li className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Tunnel de Commande (Checkout)</strong> : Mémoriser les articles ajoutés à votre panier dynamique Single-Page.</span>
              </li>
              <li className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Personnalisation des Vitrines</strong> : Conserver les préférences de couleur primaire et de thèmes de vos boutiques.</span>
              </li>
              <li className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Mesure de Performance & Sécurité</strong> : Analyser les temps de chargement et prévenir les accès malveillants.</span>
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">03</div>
              <h2 className="text-xl sm:text-2xl font-space font-bold text-white">Typologie des Cookies Exploités par Ecomfy</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> 1. Cookies Essentiels (Strictement Nécessaires)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ces tracéurs sont indispensables au fonctionnement de la plateforme Ecomfy (session Supabase Auth, sécurité du panier, jetons CSRF). Sans eux, les boutiques et le tableau de bord ne peuvent fonctionner.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> 2. Cookies de Fonctionnalité & Préférences
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ils permettent de mémoriser vos choix (langue i18n, devise FCFA, paramètres de boutique) pour offrir une expérience personnalisée et fluide lors de vos visites ultérieures.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                  <Server className="w-4 h-4" /> 3. Cookies de Performance & Analytique
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ces cookies anonymes permettent de mesurer le nombre de visiteurs, la vitesse d'affichage de nos pages (&lt; 2 secondes) et de diagnostiquer d'éventuelles erreurs techniques.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> 4. Cookies de Sécurité & Anti-Fraude
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ils permettent de protéger la plateforme contre les attaques par déni de service (DDoS) et de sécuriser la validation des transactions Mobile Money et Stripe.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">04</div>
              <h2 className="text-xl sm:text-2xl font-space font-bold text-white">Cookies Tiers & Partenaires Intégrés</h2>
            </div>
            <p className="text-sm leading-relaxed">
              Dans le cadre de ses fonctionnalités intégrées (paiements, hébergement et analyse), Ecomfy s'appuie sur des partenaires technologiques de confiance qui peuvent déposer des cookies sécurisés :
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-space">Partenaire</th>
                    <th className="p-3.5 font-space">Finalité</th>
                    <th className="p-3.5 font-space">Politique de Confidentialité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-3.5 font-bold text-white">Supabase Inc.</td>
                    <td className="p-3.5">Authentification sécurisée et stockage de session</td>
                    <td className="p-3.5 text-emerald-400">https://supabase.com/privacy</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-3.5 font-bold text-white">Stripe & CinetPay</td>
                    <td className="p-3.5">Traitement sécurisé des paiements et prévention anti-fraude</td>
                    <td className="p-3.5 text-emerald-400">https://stripe.com/privacy</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-3.5 font-bold text-white">Cloudflare Inc.</td>
                    <td className="p-3.5">Protection contre les attaques et accélération CDN</td>
                    <td className="p-3.5 text-emerald-400">https://cloudflare.com/privacypolicy</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-3.5 font-bold text-white">Google Analytics</td>
                    <td className="p-3.5">Analyse anonymisée de l'audience et des temps de chargement</td>
                    <td className="p-3.5 text-emerald-400">https://policies.google.com/privacy</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">05</div>
              <h2 className="text-xl sm:text-2xl font-space font-bold text-white">Durée de Conservation des Tracéurs</h2>
            </div>
            <p className="text-sm leading-relaxed">
              Les cookies utilisés par Ecomfy sont conservés pour des durées strictement limitées :
            </p>
            <ul className="space-y-2 text-xs">
              <li className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <strong>Cookies de Session</strong> : Supprimés automatiquement dès la fermeture de votre navigateur.
              </li>
              <li className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <strong>Cookies Persistants</strong> : Conservés pour une durée maximale de <strong>13 mois</strong> conformément aux directives de protection des données.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">06</div>
              <h2 className="text-xl sm:text-2xl font-space font-bold text-white">Gérer, Refuser et Paramétrer vos Cookies</h2>
            </div>
            <p className="text-sm leading-relaxed">
              Vous disposez de plusieurs options pour gérer et désactiver les cookies déposés sur votre terminal :
            </p>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <h3 className="font-bold text-white">1. Paramètres de votre Navigateur Web</h3>
                <p className="text-slate-400 leading-relaxed">
                  Vous pouvez configurer votre navigateur pour accepter, refuser ou bloquer systématiquement les cookies (Google Chrome, Safari, Mozilla Firefox, Microsoft Edge). Consultez le menu d'aide de votre navigateur.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
                <h3 className="font-bold text-amber-400">2. Conséquences du Refus des Cookies Essentiels</h3>
                <p className="text-amber-200/80 leading-relaxed text-[11px]">
                  Si vous désactivez l'ensemble des cookies essentiels, l'accès à votre Tableau de Bord Ecomfy et le processus d'achat sur les boutiques peuvent être perturbés ou nécessiter une réauthentification fréquente.
                </p>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">07</div>
              <h2 className="text-xl sm:text-2xl font-space font-bold text-white">Mises à Jour de la Politique des Cookies</h2>
            </div>
            <p className="text-sm leading-relaxed">
              Ecomfy se réserve le droit de réviser la présente Politique des Cookies afin de refléter toute évolution technique, réglementaire ou légale. Toute modification importante sera signalée sur la plateforme.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">08</div>
              <h2 className="text-xl sm:text-2xl font-space font-bold text-white">Contact & Délégué à la Protection des Données</h2>
            </div>
            <p className="text-sm leading-relaxed">
              Pour toute question relative à l'utilisation des cookies sur la plateforme Ecomfy :
            </p>
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5 font-mono">
              <div>Email Protection des Données : <span className="text-emerald-400 font-bold">privacy@ecomfy.cloud</span></div>
              <div>Support Général : <span className="text-emerald-400 font-bold">support@ecomfy.cloud</span></div>
              <div>Domaine Officiel : <span className="text-white">https://ecomfy.cloud</span></div>
            </div>
          </section>

        </Card>

      </main>
    </div>
  );
}
