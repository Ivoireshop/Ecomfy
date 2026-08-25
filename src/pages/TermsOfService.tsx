import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Mail, ArrowLeft, CheckCircle2, ShieldCheck, 
  Store, CreditCard, Sparkles, Scale, Copy, Check, ShoppingCart, Zap
} from "lucide-react";
import { toast } from "sonner";

export default function TermsOfService() {
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
                <Scale className="w-3.5 h-3.5" />
                <span>Conditions Générales d'Utilisation et de Vente (CGU / CGV)</span>
              </Badge>
              <span className="text-xs text-slate-400 font-medium">Dernière révision : {lastUpdated}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-space font-extrabold text-white tracking-tight leading-tight">
              Conditions Générales d'Utilisation Ecomfy
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl font-normal">
              Les présentes conditions régissent l'utilisation de la plateforme e-commerce multi-tenant **Ecomfy** (`ecomfy.cloud`), la création de boutiques en ligne, l'utilisation du Studio IA, la souscription aux abonnements SaaS et l'Académie Ecomfy.
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Général & Juridique</span>
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
              <h2 className="text-xl font-space font-bold text-white">1. Objet et Acceptation des Conditions</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Les présentes Conditions Générales d'Utilisation (CGU/CGV) s'appliquent sans restriction ni réserve à tout accès ou utilisation des services proposés par **Ecomfy**. En vous inscrivant ou en déployant une boutique en ligne, vous reconnaissez avoir pris connaissance et accepté l'intégralité des présentes conditions.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">02</div>
              <h2 className="text-xl font-space font-bold text-white">2. Description des Services Ecomfy</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <Store className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white font-space">Création de Vitrine E-commerce</h3>
                <p className="text-[11px] text-slate-400">Création de boutique sous sous-domaine personnalisé (`maboutique.ecomfy.cloud`), tunnel Single-Page Checkout et intégration WhatsApp.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-bold text-white font-space">Studio IA & Contenus</h3>
                <p className="text-[11px] text-slate-400">Génération automatique de visuels produits studio, scripts vidéos publicitaires et fiches produits persuatives.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white font-space">Pass VIP Académie & Formations</h3>
                <p className="text-[11px] text-slate-400">Accès aux masterclasses de vente (Facebook Ads, TikTok) via l'abonnement VIP (35 000 FCFA/mois) ou achat individuel à l'unité.</p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">03</div>
              <h2 className="text-xl font-space font-bold text-white">3. Conditions d'Abonnement et Tarification SaaS</h2>
            </div>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-2 list-disc list-inside pl-2">
              <li>**Frais d'activation boutique** : L'activation initiale d'une boutique est soumise au tarif unique de 1 300 FCFA (2$ USD).</li>
              <li>**Abonnement VIP Ecomfy (35 000 FCFA / mois)** : Donne un accès illimité au Studio IA, aux domaines personnalisés et à l'intégralité des masterclasses de l'Espace Étudiant.</li>
              <li>**Formations Achetées à l'Unité** : Les masterclasses achetées individuellement restent débloquées à vie dans l'Espace Étudiant du compte acquéreur.</li>
              <li>**Paiements sécurisés** : Effectués via Mobile Money (Wave, Orange Money, MTN, Moov via CinetPay) ou Carte bancaire (Stripe).</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">04</div>
              <h2 className="text-xl font-space font-bold text-white">4. Obligations des Marchands et Responsabilité</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Le marchand est seul responsable des produits commercialisés sur sa boutique en ligne Ecomfy, de l'exactitude des prix affichés, de la livraison effective des commandes aux acheteurs et du respect des lois en vigueur. Ecomfy décline toute responsabilité en cas de litige commercial entre un marchand et son client final.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">05</div>
              <h2 className="text-xl font-space font-bold text-white">5. Propriété Intellectuelle et Droits IA</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Le marchand conserve l'entière propriété de ses marques, logos et catalogues produits. Les contenus et visuels générés via le **Studio IA Ecomfy** sont concédés au marchand pour une utilisation commerciale libre et illimitée dans le cadre de l'exploitation de sa boutique Ecomfy.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">06</div>
              <h2 className="text-xl font-space font-bold text-white">6. Contacts Officiels de l'Équipe Ecomfy</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Notre équipe d'assistance se tient à votre disposition pour vous accompagner au quotidien :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <h4 className="text-xs font-bold text-white">Assistance Technique & Support</h4>
                <a href="mailto:support@ecomfy.cloud" className="text-xs font-mono font-bold text-emerald-400 hover:underline block">support@ecomfy.cloud</a>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <h4 className="text-xs font-bold text-white">Renseignements & Partenariats</h4>
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
