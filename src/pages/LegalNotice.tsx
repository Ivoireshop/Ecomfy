import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Scale, Mail, ArrowLeft, Building2, User, Server, 
  ShieldAlert, Copy, Check, Globe, Phone, MapPin
} from "lucide-react";
import { toast } from "sonner";

export default function LegalNotice() {
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
                <span>Mentions Légales & Informations Réglementaires</span>
              </Badge>
              <span className="text-xs text-slate-400 font-medium">Dernière mise à jour : {lastUpdated}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-space font-extrabold text-white tracking-tight leading-tight">
              Mentions Légales Ecomfy
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl font-normal">
              Informations légales obligatoires concernant l'éditeur, l'hébergement, la propriété intellectuelle et les coordonnées officielles de la plateforme **Ecomfy** (`ecomfy.cloud`).
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
              <h2 className="text-xl font-space font-bold text-white">1. Éditeur de la Plateforme</h2>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Plateforme SaaS :</span>
                  <span className="font-bold text-white text-sm">Ecomfy Cloud</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Domaine Officiel :</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">https://ecomfy.cloud</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Siège & Localisation :</span>
                  <span className="font-medium text-white flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Abidjan, Côte d'Ivoire
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Email Officiel :</span>
                  <span className="font-mono text-emerald-400 font-bold">contact@ecomfy.cloud</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">02</div>
              <h2 className="text-xl font-space font-bold text-white">2. Direction de la Publication</h2>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-space font-bold text-base text-white">Ulrich DJATÉ</h3>
                <p className="text-xs text-slate-400">Fondateur & Directeur Général de Ecomfy</p>
                <p className="text-xs font-mono text-emerald-400">contact@ecomfy.cloud</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center font-bold font-space">
                CEO
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">03</div>
              <h2 className="text-xl font-space font-bold text-white">3. Infrastructure et Hébergement Cloud</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <Server className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white font-space">Hébergement Front-End & CDN</h3>
                <p className="text-[11px] text-slate-400">Déployé sur l'infrastructure globale ultra-rapide Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA (`vercel.com`).</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white font-space">Base de Données & Auth</h3>
                <p className="text-[11px] text-slate-400">Infrastructure de base de données PostgreSQL et Authentification gérée sur Supabase Inc., San Francisco, CA, USA.</p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">04</div>
              <h2 className="text-xl font-space font-bold text-white">4. Propriété Intellectuelle et Marque</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              L'enseigne **Ecomfy**, le logo Ecomfy, les interfaces applicatives, les thèmes e-commerce, le code source et les algorithmes du Studio IA sont la propriété exclusive de Ecomfy. Toute reproduction, copie ou diffusion non autorisée par écrit est strictement interdite.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center text-xs font-bold font-space">05</div>
              <h2 className="text-xl font-space font-bold text-white">5. Adresses E-mails de Contact Officiel</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Vous pouvez nous contacter directement selon la nature de votre demande :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <h4 className="text-xs font-bold text-white">Assistance Technique & Support</h4>
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
