import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Mail, ArrowLeft, CheckCircle2, Lock, FileText, 
  HelpCircle, Copy, Check, Globe, Server, Database, UserCheck, Key
} from "lucide-react";
import { toast } from "sonner";

export default function PrivacyPolicy() {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copyToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast.success(`Adresse ${email} copiée dans le presse-papier !`);
    setTimeout(() => setCopiedEmail(null), 3000);
  };

  const lastUpdated = "25 Août 2026";

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">

        {/* Navigation & Header Hero */}
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
                <Shield className="w-3.5 h-3.5" />
                <span>Protection des Données & RGPD Compliant</span>
              </Badge>
              <span className="text-xs text-slate-400 font-medium">Dernière révision : {lastUpdated}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-space font-extrabold text-white tracking-tight leading-tight">
              Politique de Confidentialité Ecomfy
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl font-normal">
              La présente politique décrit en toute transparence la manière dont la plateforme SaaS **Ecomfy** (`ecomfy.cloud`) collecte, traite, sécurise et protège vos données personnelles et celles des acheteurs de vos boutiques e-commerce.
            </p>

            {/* Official Support Email Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
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

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between group hover:border-[#0E7C66]/50 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Général</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">contact@ecomfy.cloud</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard("contact@ecomfy.cloud")} className="h-8 w-8 text-slate-400 hover:text-white">
                  {copiedEmail === "contact@ecomfy.cloud" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section Card */}
        <Card className="bg-slate-900/90 border-slate-800 text-slate-300 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-10">

          {/* Section 1 */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">01</div>
              <h2 className="text-xl font-space font-bold text-white">1. Engagement et Identité du Responsable de Traitement</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              La plateforme **Ecomfy** (accessible via `https://ecomfy.cloud` et ses sous-domaines marchands `.ecomfy.cloud`) est éditée par la société Ecomfy. Nous plaçons la confidentialité, la souveraineté et la protection des données de nos marchands et de leurs clients au cœur de nos engagements technologiques.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">02</div>
              <h2 className="text-xl font-space font-bold text-white">2. Nature des Données Collectées</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-emerald-400 font-space flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> Données des Marchands & Vendeurs
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>Identité : Nom, prénom, adresse e-mail professionnelle.</li>
                  <li>Boutique : Nom commercial, logo, numéro WhatsApp business, devises.</li>
                  <li>Compte : Mot de passe chiffré (Supabase Auth / Argon2id).</li>
                  <li>Facturation : Historique des abonnements VIP (35 000 FCFA/mois) et reçus.</li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-amber-400 font-space flex items-center gap-2">
                  <Database className="w-4 h-4" /> Données des Clients Finales (Vitrines)
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>Commande : Nom du client, numéro de téléphone, ville et adresse de livraison.</li>
                  <li>Paniers : Articles ajoutés, historique de commandes et paniers abandonnés.</li>
                  <li>Paiement Mobile Money / Carte : Référence de transaction sécurisée CinetPay/Stripe.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">03</div>
              <h2 className="text-xl font-space font-bold text-white">3. Finalités du Traitement</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Vos données personnelles sont traitées exclusivement pour assurer l'exécution des fonctionnalités SaaS d'Ecomfy :
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-2 list-disc list-inside pl-2">
              <li>**Gestion des Boutiques & Single-Page Checkout** : Traitement des commandes et acheminement vers WhatsApp ou le système de livraison.</li>
              <li>**Studio IA Ecomfy** : Génération de visuels publicitaires, vidéos IA et fiches produits optimisées.</li>
              <li>**Système de Fidélisation & Relance** : Calcul automatique des statuts clients fidèles (Platine, Or, Argent) pour l'envoi de promotions via WhatsApp.</li>
              <li>**Sécurité & Prévention de la Fraude** : Détection des accès suspects et conformité bancaire.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">04</div>
              <h2 className="text-xl font-space font-bold text-white">4. Sécurité des Données et Hébergement</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Ecomfy applique des standards de cybersécurité de niveau bancaire :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <Lock className="w-5 h-5 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-white font-space">Chiffrement TLS 1.3</h4>
                <p className="text-[11px] text-slate-400">Toutes les communications réseau sont chiffrées en SSL/TLS.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <Server className="w-5 h-5 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-white font-space">Architecture Supabase RLS</h4>
                <p className="text-[11px] text-slate-400">Chaque marchand bénéficie d'une isolation hermétique de ses données (Row Level Security).</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <Key className="w-5 h-5 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-white font-space">Passerelles Certifiées PCI-DSS</h4>
                <p className="text-[11px] text-slate-400">Les transactions Stripe et CinetPay sont sécurisées directement par les opérateurs.</p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">05</div>
              <h2 className="text-xl font-space font-bold text-white">5. Vos Droits et Exercice des Droits</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Conformément à la réglementation sur les données personnelles (RGPD / Lois APDP), vous disposez à tout moment des droits suivants :
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>Droit d'accès, de rectification et de mise à jour de vos données.</li>
              <li>Droit à l'effacement définitif de votre compte marchand et de vos boutiques.</li>
              <li>Droit à la portabilité et à l'exportation de votre catalogue produit au format CSV/JSON.</li>
            </ul>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
              <span className="text-xs text-slate-300">Pour exercer vos droits, envoyez une simple demande écrite à notre délégué à la protection des données :</span>
              <Button size="sm" onClick={() => copyToClipboard("support@ecomfy.cloud")} className="rounded-full bg-[#0E7C66] text-white text-xs font-bold gap-1.5 shrink-0">
                <Mail className="w-3.5 h-3.5" />
                <span>support@ecomfy.cloud</span>
              </Button>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">06</div>
              <h2 className="text-xl font-space font-bold text-white">6. Adresses de Contact Officielles</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Pour toute demande spécifique ou assistance d'ordre juridique et technique :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <h4 className="text-xs font-bold text-white">Assistance Technique & Compte</h4>
                <a href="mailto:support@ecomfy.cloud" className="text-xs font-mono font-bold text-emerald-400 hover:underline block">support@ecomfy.cloud</a>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <h4 className="text-xs font-bold text-white">Informations & Partenariats</h4>
                <a href="mailto:info@ecomfy.cloud" className="text-xs font-mono font-bold text-emerald-400 hover:underline block">info@ecomfy.cloud</a>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <h4 className="text-xs font-bold text-white">Contact Général & Direction</h4>
                <a href="mailto:contact@ecomfy.cloud" className="text-xs font-mono font-bold text-emerald-400 hover:underline block">contact@ecomfy.cloud</a>
              </div>
            </div>
          </section>

        </Card>
      </main>
    </div>
  );
}
