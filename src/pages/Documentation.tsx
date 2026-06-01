import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthReady } from "@/hooks/useAuthReady";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Book, Search, Rocket, Layers, Image as ImageIcon, Video, Globe, Store,
  GraduationCap, CreditCard, Bug, ShieldCheck, Code2, Database, Mail,
  Bell, Workflow, Server, KeyRound, ScrollText, Boxes, Wrench, Network,
  Lock, GitBranch, Cpu, FileText, ArrowRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Documentation content                                              */
/* ------------------------------------------------------------------ */

type DocSection = {
  id: string;
  title: string;
  icon: any;
  category: string;
  summary: string;
  body: Array<
    | { type: "p"; text: string }
    | { type: "h"; text: string }
    | { type: "ul"; items: string[] }
    | { type: "code"; lang?: string; text: string }
    | { type: "callout"; tone?: "info" | "warn" | "danger"; text: string }
    | { type: "table"; head: string[]; rows: string[][] }
  >;
};

const SECTIONS: DocSection[] = [
  /* -------------------- Getting started -------------------- */
  {
    id: "introduction",
    title: "Introduction à VisualPro",
    icon: Rocket,
    category: "Démarrage",
    summary: "Vue d'ensemble de la plateforme, des modules et de l'architecture.",
    body: [
      { type: "p", text: "VisualPro est une plateforme tout-en-un pour entrepreneurs africains : génération de visuels et vidéos IA, sites vitrines, boutiques e-commerce, formations en ligne et API." },
      { type: "h", text: "Modules principaux" },
      { type: "ul", items: [
        "Génération IA : images et vidéos publicitaires (gpt-image-1, Gemini, Minimax).",
        "Sites vitrines : pages publiques personnalisables sur visuelpro.cloud.",
        "Boutiques e-commerce : produits, commandes, paiements GeniusPay, livraison.",
        "Formations : cours, modules, certificats PDF avec QR.",
        "API & Intégrations : clés vp_..., N8N/Zapier, webhooks.",
      ]},
      { type: "h", text: "Pile technique" },
      { type: "ul", items: [
        "Frontend : React 18 + Vite + TypeScript + Tailwind + shadcn/ui.",
        "Backend : Lovable Cloud (Supabase) — Postgres + Auth + Storage + Edge Functions Deno.",
        "Paiements : GeniusPay (FCFA) via process-payment + geniuspay-webhook.",
        "Email : Managed Email sur notify.visuelpro.cloud.",
        "IA : Lovable AI Gateway (Gemini, GPT-5), Replicate (Minimax vidéo).",
      ]},
      { type: "callout", tone: "info", text: "Toute la configuration backend est dans supabase/ (config.toml, migrations/, functions/)." },
    ],
  },
  {
    id: "architecture",
    title: "Architecture & arborescence",
    icon: Layers,
    category: "Démarrage",
    summary: "Comment le code est organisé et où trouver quoi.",
    body: [
      { type: "h", text: "Arborescence" },
      { type: "code", text:
`src/
  pages/              Pages routées dans App.tsx
  components/         Composants partagés + sous-dossiers shop/, showcase/
  hooks/              useAuthReady, useFCM, useOrderNotifications...
  integrations/       Client Supabase (auto-généré, ne pas modifier)
  lib/                Utilitaires (abidjanZones, paymentRedirect...)
  i18n/               5 locales : fr, en, es, pt, ar
supabase/
  config.toml         Config edge functions
  migrations/         SQL versionné — chaque table public a ses GRANTs
  functions/          Edge functions Deno (npm: imports)
` },
      { type: "h", text: "Routage" },
      { type: "p", text: "Toutes les routes sont déclarées dans src/App.tsx. Les pages authentifiées passent par ProtectedRoute ; certaines exigent un abonnement actif (requireActiveSubscription)." },
      { type: "callout", tone: "warn", text: "Ne jamais modifier manuellement src/integrations/supabase/{client,types}.ts ni le fichier .env — ils sont auto-générés." },
    ],
  },
  {
    id: "local-setup",
    title: "Installation locale",
    icon: Wrench,
    category: "Démarrage",
    summary: "Cloner, installer et lancer le projet en local.",
    body: [
      { type: "code", lang: "bash", text:
`git clone <repo>
cd visualpro
npm install
npm run dev      # Vite — http://localhost:8080
npm run build    # build production` },
      { type: "p", text: "Le fichier .env est fourni par Lovable Cloud (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID)." },
      { type: "h", text: "Capacitor (mobile)" },
      { type: "p", text: "Voir NATIVE-SETUP.md et scripts/setup-native.sh pour iOS/Android." },
    ],
  },

  /* -------------------- Authentification -------------------- */
  {
    id: "auth",
    title: "Authentification & sessions",
    icon: Lock,
    category: "Auth & rôles",
    summary: "Signup/login, Google & Apple OAuth, session stabilization.",
    body: [
      { type: "p", text: "L'authentification utilise Supabase Auth. Pas de signup anonyme — formulaires email/password classiques + OAuth Google et Apple." },
      { type: "h", text: "Hook useAuthReady" },
      { type: "code", lang: "tsx", text:
`const { user, session, isReady } = useAuthReady();
if (!isReady) return <Loader/>;
if (!user) return <Navigate to="/auth"/>;` },
      { type: "h", text: "ProtectedRoute" },
      { type: "p", text: "Wrappe les pages privées. Accepte requireActiveSubscription pour bloquer les non-abonnés." },
      { type: "callout", tone: "warn", text: "Déconnexion : toujours window.location.href = '/auth' (full reload) pour purger l'état React." },
      { type: "h", text: "Email sanitization" },
      { type: "p", text: "Toujours .trim().toLowerCase() les emails avant signIn / signUp pour éviter des sessions fantômes." },
    ],
  },
  {
    id: "user-roles",
    title: "Rôles utilisateurs",
    icon: ShieldCheck,
    category: "Auth & rôles",
    summary: "Système founder / co_founder / user via user_roles + has_role().",
    body: [
      { type: "p", text: "Les rôles sont stockés dans la table user_roles (enum app_role). Ne JAMAIS stocker un rôle dans profiles — risque d'escalade." },
      { type: "code", lang: "sql", text:
`-- Vérifier un rôle (security definer, bypass RLS)
select public.has_role(auth.uid(), 'founder');` },
      { type: "h", text: "Compte fondateur" },
      { type: "p", text: "djateulrich@gmail.com a le rôle founder — accès au dashboard fondateur, troubleshooting, et interventions techniques." },
    ],
  },

  /* -------------------- Génération IA -------------------- */
  {
    id: "image-generation",
    title: "Génération d'images IA",
    icon: ImageIcon,
    category: "Génération IA",
    summary: "Modes Simple, Edit, Banner, Replacement — cache 30j, auto-correction.",
    body: [
      { type: "h", text: "Pipeline" },
      { type: "ul", items: [
        "1. Correction grammaticale silencieuse (OpenAI) via correct-text.",
        "2. Hash SHA-256 (prompt + params) → check cache 30 jours.",
        "3. Génération via generate-ai-image (priorité : gpt-image-1 → Gemini → Minimax).",
        "4. Stockage Supabase Storage + insertion generated_images.",
      ]},
      { type: "h", text: "Modes disponibles" },
      { type: "table", head: ["Mode", "Usage"], rows: [
        ["Simple", "Prompt texte uniquement"],
        ["Edit", "Modifier une image existante"],
        ["Banner", "Format bannière publicitaire"],
        ["Replacement", "Remplacer un produit dans un visuel (URL ou image)"],
        ["Pro / URL import", "Extrait infos produit depuis une URL pour variantes sociales"],
      ]},
      { type: "callout", tone: "info", text: "Timeout : 90s (correction + génération en séquence)." },
    ],
  },
  {
    id: "video-generation",
    title: "Génération vidéo",
    icon: Video,
    category: "Génération IA",
    summary: "Vidéos publicitaires Minimax + fallback Cloudinary zoompan.",
    body: [
      { type: "p", text: "UI dédiée VideoCreator (max 4 images). Génération via create-video-from-image (Replicate Minimax)." },
      { type: "ul", items: [
        "Edge function : verify_jwt désactivé, validation manuelle du token.",
        "Progression : barre 10→85% animée pendant 60-90s d'attente.",
        "Fallback : si l'IA échoue, génération MP4 Cloudinary (zoompan).",
        "Lecture : chargement 2 étapes (média puis métadonnées) pour playback natif.",
      ]},
    ],
  },

  /* -------------------- Sites vitrines -------------------- */
  {
    id: "showcase",
    title: "Sites vitrines",
    icon: Globe,
    category: "Modules",
    summary: "Pages publiques sur subdomain.visuelpro.cloud + domaines custom.",
    body: [
      { type: "h", text: "Routage" },
      { type: "p", text: "/showcase/:subdomain et /showcase/:subdomain/:page. Domaines personnalisés résolus par hostname dans App.tsx." },
      { type: "h", text: "DNS pour domaine custom" },
      { type: "ul", items: [
        "CNAME → sites.visuelpro.cloud",
        "ou A record → 185.178.193.121",
      ]},
      { type: "h", text: "Sections" },
      { type: "p", text: "Home, About, Bio, Services (filtrables, tri FCFA), Gallery, Blog, Courses, Contact, Footer. Mobile-first : nav horizontale en scroll." },
      { type: "callout", tone: "info", text: "Trash 30j : éléments supprimés conservés 30 jours (table showcase_trash)." },
    ],
  },
  {
    id: "ecommerce",
    title: "Boutiques e-commerce",
    icon: Store,
    category: "Modules",
    summary: "ShopEditor, produits, commandes, paiements, pixels, analytics.",
    body: [
      { type: "h", text: "Architecture" },
      { type: "p", text: "ShopEditor = ShopSidebar + ProductsTable + OrdersList + ShopSettings + AnalyticsViewer." },
      { type: "h", text: "Tarification" },
      { type: "ul", items: [
        "Frais d'activation : $2",
        "Commission par transaction : $0.025",
      ]},
      { type: "h", text: "Paiement & livraison" },
      { type: "ul", items: [
        "Abidjan (zones reconnues) : Cash on Delivery OU Mobile Money.",
        "Hors Abidjan : Mobile Money uniquement (forcé automatiquement).",
        "Tunnel checkout : 3 étapes, champs contact/livraison customisables.",
      ]},
      { type: "h", text: "Conversion" },
      { type: "p", text: "Countdown, barre de stock animée, notifications social proof (cycle 5s, pause 6s)." },
      { type: "h", text: "Pixels supportés" },
      { type: "p", text: "Facebook, TikTok, Snap, Google Analytics — multi-providers." },
    ],
  },
  {
    id: "courses",
    title: "Formations en ligne",
    icon: GraduationCap,
    category: "Modules",
    summary: "Cours, enrollments, certificats PDF avec QR.",
    body: [
      { type: "p", text: "Architecture indépendante du showcase. Gestion via /courses-manager." },
      { type: "ul", items: [
        "Inscription étudiant : reset password silencieux si email existe.",
        "Progression style systeme.io.",
        "Certificats PDF avec QR vérifiable sur /verify-certificate/:n.",
        "WhatsApp post-achat : lien direct sur page succès + email.",
      ]},
      { type: "callout", tone: "warn", text: "Suppression étudiant : supprimer student_access AVANT enrollments (contrainte FK)." },
    ],
  },

  /* -------------------- Paiements -------------------- */
  {
    id: "payments",
    title: "Paiements GeniusPay",
    icon: CreditCard,
    category: "Paiements",
    summary: "Checkout hébergé pay.genius.ci, webhook HMAC, crediting via metadata.",
    body: [
      { type: "p", text: "GeniusPay est l'unique gateway actif (Lygos retiré). Devise : FCFA." },
      { type: "h", text: "Flux" },
      { type: "code", text:
`Client → process-payment (edge)
       → pay.genius.ci (checkout hébergé)
       → geniuspay-webhook (HMAC verify)
       → crediting via metadata (user_id, plan, tokens...)
       → redirect visuelpro.cloud/payment-success` },
      { type: "h", text: "Webhook" },
      { type: "ul", items: [
        "Signature HMAC vérifiée systématiquement.",
        "Metadata détermine l'action : abonnement, tokens, commande boutique, inscription formation.",
        "Toute redirection passe par visuelpro.cloud.",
      ]},
    ],
  },

  /* -------------------- Backend -------------------- */
  {
    id: "edge-functions",
    title: "Edge Functions",
    icon: Server,
    category: "Backend",
    summary: "Conventions Deno : npm: imports, verify_jwt, HTTP 200 toujours.",
    body: [
      { type: "h", text: "Règles" },
      { type: "ul", items: [
        "Imports : toujours `npm:` (ex. `npm:@supabase/supabase-js@2`). Jamais esm.sh.",
        "verify_jwt: false dans config.toml + validation manuelle via supabaseClient.auth.getUser().",
        "Réponse : toujours HTTP 200 OK avec body `{ success, error }`.",
        "CORS headers obligatoires (OPTIONS + Access-Control-Allow-*).",
      ]},
      { type: "code", lang: "ts", text:
`import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: \`Bearer \${token}\` } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ success: false, error: "unauthorized" });
    // ... logic
    return json({ success: true, result });
  } catch (e) {
    return json({ success: false, error: String(e) });
  }
});` },
      { type: "h", text: "Fonctions clés" },
      { type: "table", head: ["Fonction", "Rôle"], rows: [
        ["process-payment", "Initie un paiement GeniusPay"],
        ["geniuspay-webhook", "Callback HMAC + crediting"],
        ["generate-ai-image", "Génération images (multi-provider)"],
        ["create-video-from-image", "Génération vidéo Minimax"],
        ["app-health-monitor", "Probes santé tous modules"],
        ["app-remediation", "Interventions techniques (audit)"],
        ["send-transactional-email", "Email transactionnel Managed"],
      ]},
    ],
  },
  {
    id: "database",
    title: "Base de données & RLS",
    icon: Database,
    category: "Backend",
    summary: "Migrations, GRANTs obligatoires, RLS, triggers.",
    body: [
      { type: "callout", tone: "danger", text: "Chaque CREATE TABLE public.* DOIT être suivi de GRANTs dans la même migration. RLS seul ne suffit pas." },
      { type: "code", lang: "sql", text:
`CREATE TABLE public.exemple (id uuid primary key default gen_random_uuid(), ...);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exemple TO authenticated;
GRANT ALL ON public.exemple TO service_role;
ALTER TABLE public.exemple ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_rw" ON public.exemple FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());` },
      { type: "h", text: "Triggers de validation" },
      { type: "p", text: "Préférer triggers BEFORE INSERT/UPDATE aux CHECK constraints pour les règles time-based (CHECK doit être immutable)." },
      { type: "h", text: "Tables clés" },
      { type: "ul", items: [
        "user_roles, profiles, subscriptions",
        "generated_images, generated_videos, image_cache",
        "shops, products, orders, order_stats (auto via trigger)",
        "courses, modules, enrollments, student_access, certificates",
        "showcase_sites, showcase_trash",
        "incidents, app_remediation_audit",
      ]},
    ],
  },
  {
    id: "realtime",
    title: "Realtime & notifications",
    icon: Bell,
    category: "Backend",
    summary: "Supabase Realtime, FCM web push, notifications natives.",
    body: [
      { type: "code", lang: "sql", text:
`ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;` },
      { type: "code", lang: "ts", text:
`const ch = supabase
  .channel('orders')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
    (p) => toast('Nouvelle commande !'))
  .subscribe();` },
      { type: "h", text: "Push" },
      { type: "ul", items: [
        "Web : useFCM (Firebase Cloud Messaging) + public/firebase-messaging-sw.js",
        "Natif : useNativePush (Capacitor)",
        "Hook commerce : useOrderNotifications",
      ]},
    ],
  },
  {
    id: "email",
    title: "Infrastructure email",
    icon: Mail,
    category: "Backend",
    summary: "Managed Email Lovable sur notify.visuelpro.cloud.",
    body: [
      { type: "p", text: "Tous les emails (auth, transactionnels) sortent via Managed Email." },
      { type: "ul", items: [
        "Templates : supabase/functions/_shared/transactional-email-templates/",
        "Registry : registry.ts mappe les noms vers les composants React.",
        "Queue : process-email-queue (cron), gestion DLQ et rate limit.",
        "Unsubscribe : tokens dans email_unsubscribe_tokens.",
      ]},
    ],
  },

  /* -------------------- Sécurité & ops -------------------- */
  {
    id: "security",
    title: "Sécurité",
    icon: ShieldCheck,
    category: "Sécurité & ops",
    summary: "DOMPurify, RLS, validation tokens, séparation rôles.",
    body: [
      { type: "ul", items: [
        "XSS : DOMPurify obligatoire pour tout dangerouslySetInnerHTML.",
        "Auth : jamais de check admin côté client (localStorage). Toujours via has_role() en SQL.",
        "RLS : activée sur toutes les tables public + policies scopées à auth.uid().",
        "Secrets : jamais en clair dans le code. Stockés via secrets tool.",
        "Edge functions : verify_jwt désactivé mais validation manuelle systématique.",
      ]},
    ],
  },
  {
    id: "troubleshooting",
    title: "Centre de dépannage",
    icon: Bug,
    category: "Sécurité & ops",
    summary: "Probes santé, interventions techniques, journal d'audit.",
    body: [
      { type: "p", text: "Page /founder-troubleshooting — accès founder/co_founder uniquement." },
      { type: "h", text: "Onglets" },
      { type: "ul", items: [
        "Vue d'ensemble : statut probes (DB, auth, paiements, email, IA).",
        "Modules : stats par module (showcase, courses, visuels, vidéos, ads, e-commerce).",
        "Incidents : alertes ouvertes/résolues + email d'alerte.",
        "Interventions : 8 patches techniques (purge, rebuild stats, requeue emails, vacuum cache...).",
        "Journal d'audit : qui, quand, quel résultat — table app_remediation_audit.",
      ]},
      { type: "callout", tone: "info", text: "Chaque action serveur est tracée (actor, params, success, durée, IP, user-agent)." },
    ],
  },

  /* -------------------- API publique -------------------- */
  {
    id: "public-api",
    title: "API publique & intégrations",
    icon: Code2,
    category: "API",
    summary: "Clés vp_..., N8N/Zapier, webhooks.",
    body: [
      { type: "p", text: "Clés API au format vp_XXXX gérées dans /api-documentation. Guides N8N et Zapier inclus." },
      { type: "h", text: "Authentification" },
      { type: "code", lang: "http", text:
`POST https://<projet>.functions.supabase.co/<function>
Authorization: Bearer vp_xxxxxxxxxxxxxxxx
Content-Type: application/json` },
    ],
  },
  {
    id: "i18n",
    title: "Internationalisation",
    icon: Network,
    category: "Frontend",
    summary: "i18next, 5 locales, auto-translate DOM.",
    body: [
      { type: "ul", items: [
        "Langues : fr (défaut), en, es, pt, ar.",
        "Fichiers : src/i18n/locales/*.json — toujours synchronisés.",
        "Hook : useTranslation() — clés hiérarchiques (sidebar.items.home).",
        "lib/autoTranslateDOM.ts : traduit dynamiquement les nœuds texte non gérés.",
      ]},
    ],
  },
  {
    id: "design-system",
    title: "Design system",
    icon: Boxes,
    category: "Frontend",
    summary: "Tokens HSL, shadcn/ui, mobile-first, no AI icons.",
    body: [
      { type: "ul", items: [
        "Tokens HSL dans src/index.css + tailwind.config.ts.",
        "Jamais de couleurs hardcodées dans les composants — toujours sémantiques (bg-primary, text-foreground).",
        "Mobile-first strict, zero overlap, primaires en haut à droite / secondaires en haut à gauche.",
        "Pas d'icônes 'IA' (baguette magique, étoiles) — style corporate.",
      ]},
    ],
  },

  /* -------------------- DevOps -------------------- */
  {
    id: "deployment",
    title: "Déploiement & domaines",
    icon: Cpu,
    category: "DevOps",
    summary: "Lovable Publish, visuelpro.cloud, sous-domaines.",
    body: [
      { type: "ul", items: [
        "Publish via Lovable — déploiement automatique des edge functions.",
        "Domaine principal : visuelpro.cloud (jamais lovable.app dans le branding).",
        "Sous-domaines vitrines : <slug>.visuelpro.cloud.",
        "Email : notify.visuelpro.cloud (Managed Email).",
        "SEO : indexation manuelle Google Search Console + sitemap.xml.",
      ]},
    ],
  },
  {
    id: "migrations",
    title: "Migrations SQL",
    icon: GitBranch,
    category: "DevOps",
    summary: "Créer une nouvelle migration timestampée.",
    body: [
      { type: "p", text: "Les migrations sont read-only une fois créées. Pour modifier le schéma, créer un nouveau fichier daté." },
      { type: "code", lang: "sql", text:
`-- supabase/migrations/<timestamp>_<slug>.sql
CREATE TABLE public.ma_table (...);
GRANT SELECT ON public.ma_table TO authenticated;
GRANT ALL ON public.ma_table TO service_role;
ALTER TABLE public.ma_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ;` },
    ],
  },
  {
    id: "conventions",
    title: "Conventions & workflow",
    icon: Workflow,
    category: "DevOps",
    summary: "Branding, code style, do's and dont's.",
    body: [
      { type: "h", text: "À FAIRE" },
      { type: "ul", items: [
        "Mobile-first, accessibilité, tokens sémantiques.",
        "Toujours .trim().toLowerCase() les emails auth.",
        "Toujours GRANT après CREATE TABLE public.*.",
        "Toujours npm: imports dans les edge functions.",
        "Logout = window.location.href = '/auth'.",
      ]},
      { type: "h", text: "À NE PAS FAIRE" },
      { type: "ul", items: [
        "Modifier src/integrations/supabase/{client,types}.ts ou .env.",
        "Stocker un rôle dans profiles.",
        "Utiliser esm.sh dans les edge functions.",
        "Hardcoder des couleurs (text-white, bg-black) dans les composants.",
        "Ajouter d'icônes 'baguette IA' — branding corporate.",
      ]},
    ],
  },
  {
    id: "secrets",
    title: "Secrets & variables",
    icon: KeyRound,
    category: "DevOps",
    summary: "Liste des secrets configurés et leur usage.",
    body: [
      { type: "table", head: ["Secret", "Usage"], rows: [
        ["LOVABLE_API_KEY", "Lovable AI Gateway (Gemini, GPT-5)"],
        ["OPENAI_API_KEY", "gpt-image-1 et correction texte"],
        ["REPLICATE_API_TOKEN", "Minimax vidéo"],
        ["GENIUSPAY_API_KEY / SECRET", "Paiements + signature webhook"],
        ["RESEND_API_KEY / Managed Email", "Email transactionnel"],
        ["FIREBASE_*", "Push web"],
      ]},
      { type: "callout", tone: "warn", text: "Jamais d'echo des secrets en console. Toujours test -n \"$VAR\"." },
    ],
  },

  /* -------------------- Changelog -------------------- */
  {
    id: "changelog",
    title: "Changelog récent",
    icon: ScrollText,
    category: "Référence",
    summary: "Ajouts majeurs récents.",
    body: [
      { type: "ul", items: [
        "Centre de dépannage fondateur (probes santé tous modules).",
        "Interventions techniques serveur + journal d'audit.",
        "Migration GeniusPay (retrait Lygos).",
        "Sites vitrines : trash 30j, blog, services filtrables, mobile-first.",
        "E-commerce : LP mode, single-page checkout, pixels multi-providers, abandoned carts.",
        "Formations : certificats QR, WhatsApp post-achat, gestion sequence FK.",
        "Génération vidéo : Minimax + fallback Cloudinary, barre de progression.",
      ]},
    ],
  },
  {
    id: "faq",
    title: "FAQ développeur",
    icon: FileText,
    category: "Référence",
    summary: "Réponses aux questions fréquentes.",
    body: [
      { type: "h", text: "Pourquoi mes données ne s'affichent pas malgré une RLS correcte ?" },
      { type: "p", text: "Vérifier les GRANTs sur la table. Sans GRANT, la Data API renvoie une erreur de permission. Voir section Base de données." },
      { type: "h", text: "Edge function renvoie 401 ?" },
      { type: "p", text: "verify_jwt doit être false ET la fonction doit valider manuellement le token via supabaseClient.auth.getUser()." },
      { type: "h", text: "Webhook GeniusPay ne crédite pas ?" },
      { type: "p", text: "Vérifier la metadata envoyée à process-payment. Le webhook utilise metadata pour identifier user_id / action." },
      { type: "h", text: "Comment tester un email transactionnel ?" },
      { type: "p", text: "Edge function preview-transactional-email + ajout dans registry.ts." },
    ],
  },
];

const CATEGORIES = Array.from(new Set(SECTIONS.map((s) => s.category)));

/* ------------------------------------------------------------------ */
/* Renderers                                                          */
/* ------------------------------------------------------------------ */

const Block = ({ b }: { b: DocSection["body"][number] }) => {
  if (b.type === "p") return <p className="leading-relaxed text-foreground/85">{b.text}</p>;
  if (b.type === "h") return <h3 className="text-lg font-semibold mt-6 mb-2">{b.text}</h3>;
  if (b.type === "ul")
    return (
      <ul className="space-y-1.5 pl-5 list-disc marker:text-primary text-foreground/85">
        {b.items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    );
  if (b.type === "code")
    return (
      <pre className="bg-muted/70 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
        <code className="font-mono">{b.text}</code>
      </pre>
    );
  if (b.type === "callout") {
    const tone = b.tone ?? "info";
    const cls =
      tone === "danger" ? "border-destructive/40 bg-destructive/5 text-destructive"
      : tone === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      : "border-primary/40 bg-primary/5 text-foreground";
    return <div className={`border-l-4 rounded-r-md px-4 py-3 text-sm ${cls}`}>{b.text}</div>;
  }
  if (b.type === "table")
    return (
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>{b.head.map((h, i) => <th key={i} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((c, j) => <td key={j} className="px-3 py-2 align-top text-foreground/85">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return null;
};

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Documentation() {
  const { user, isReady } = useAuthReady();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      if (!isReady) return;
      if (!user) { setAllowed(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        // @ts-ignore
        .in("role", ["founder", "co_founder"]);
      setAllowed(!!(data && data.length));
    })();
  }, [isReady, user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) =>
      s.title.toLowerCase().includes(q)
      || s.summary.toLowerCase().includes(q)
      || s.category.toLowerCase().includes(q)
    );
  }, [query]);

  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  if (!isReady || allowed === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-4">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Accès restreint</h2>
          <p className="text-sm text-muted-foreground">
            La documentation interne est réservée aux comptes fondateurs et développeurs autorisés.
          </p>
          <Button asChild><Link to="/">Retour à l'accueil</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <Book className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base md:text-lg truncate">Documentation VisualPro</h1>
              <Badge variant="outline" className="hidden sm:inline-flex">Interne</Badge>
            </div>
            <p className="text-xs text-muted-foreground hidden md:block">Référence technique complète — pages, modules, API, ops.</p>
          </div>
          <div className="relative w-44 md:w-72">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="pl-8 h-9"
            />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-[73px] lg:self-start">
          <ScrollArea className="lg:h-[calc(100vh-100px)] pr-2">
            <nav className="space-y-5">
              {CATEGORIES.map((cat) => {
                const items = filtered.filter((s) => s.category === cat);
                if (!items.length) return null;
                return (
                  <div key={cat}>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-2">{cat}</div>
                    <ul className="space-y-0.5">
                      {items.map((s) => {
                        const Icon = s.icon;
                        const isActive = s.id === active;
                        return (
                          <li key={s.id}>
                            <button
                              onClick={() => setActive(s.id)}
                              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                                isActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-foreground/75 hover:bg-muted"
                              }`}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{s.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {!filtered.length && (
                <p className="text-xs text-muted-foreground px-2">Aucun résultat.</p>
              )}
            </nav>
          </ScrollArea>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          <Card className="p-6 md:p-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <current.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <Badge variant="secondary" className="mb-1.5">{current.category}</Badge>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{current.title}</h2>
                <p className="text-muted-foreground mt-1">{current.summary}</p>
              </div>
            </div>
            <div className="space-y-4 mt-6">
              {current.body.map((b, i) => <Block key={i} b={b} />)}
            </div>

            {/* Prev / Next */}
            <div className="mt-10 pt-6 border-t border-border flex items-center justify-between gap-3">
              {(() => {
                const idx = SECTIONS.findIndex((s) => s.id === current.id);
                const prev = SECTIONS[idx - 1];
                const next = SECTIONS[idx + 1];
                return (
                  <>
                    {prev ? (
                      <Button variant="ghost" onClick={() => setActive(prev.id)} className="flex flex-col items-start h-auto py-2">
                        <span className="text-[11px] text-muted-foreground">Précédent</span>
                        <span className="text-sm font-medium">{prev.title}</span>
                      </Button>
                    ) : <span />}
                    {next ? (
                      <Button variant="ghost" onClick={() => setActive(next.id)} className="flex flex-col items-end h-auto py-2 ml-auto">
                        <span className="text-[11px] text-muted-foreground">Suivant</span>
                        <span className="text-sm font-medium flex items-center gap-1">{next.title} <ArrowRight className="h-3.5 w-3.5" /></span>
                      </Button>
                    ) : <span />}
                  </>
                );
              })()}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}