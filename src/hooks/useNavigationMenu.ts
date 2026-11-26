import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity, Banknote, BarChart2, Book, Bug, ClipboardCheck, Code2, CreditCard, FolderHeart, Globe, GraduationCap,
  Home, Image, Lock, Receipt, Search, Settings, ShieldCheck, Store, Tag, Truck, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deliveryService } from "@/lib/deliveryService";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useCommunityUnread } from "@/hooks/useCommunityUnread";

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: number;
}

/**
 * Entrées de navigation de l'espace connecté, communes au menu de bureau et au menu mobile :
 * toute nouvelle page s'ajoute ici et nulle part ailleurs.
 * `enabled` : tant que false, les droits (fondateur, agent terrain) ne sont pas lus.
 */
export function useNavigationMenu({ enabled = true }: { enabled?: boolean } = {}) {
  const { user, isReady } = useAuthReady();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const communityUnread = useCommunityUnread();
  const userId = user?.id;

  // Chaque droit est rattaché au compte qui l'a obtenu : il ne s'affiche jamais pour un autre.
  const [founderId, setFounderId] = useState<string | null>(null);
  const [fieldAgentId, setFieldAgentId] = useState<string | null>(null);

  useEffect(() => {
    // Seul le rôle en base donne accès au menu fondateur ; une erreur de lecture le masque.
    if (!enabled || !isReady || !userId) return;
    let cancelled = false;
    const checkFounderStatus = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        // « shareholder » existe en base mais pas dans les types générés.
        .in("role", ["founder", "co_founder", "shareholder", "admin"] as never[]);
      if (!cancelled) setFounderId(!error && data?.length ? userId : null);
    };
    checkFounderStatus();
    return () => { cancelled = true; };
  }, [enabled, isReady, userId]);

  useEffect(() => {
    // Relu à chaque changement de page : une désignation (ou une désactivation) faite
    // par l'administration apparaît dans le menu sans rechargement ni reconnexion.
    if (!enabled || !isReady || !userId) return;
    let cancelled = false;
    void deliveryService.isFieldAgent().then((ok) => {
      if (!cancelled) setFieldAgentId(ok ? userId : null);
    });
    return () => { cancelled = true; };
  }, [enabled, isReady, userId, pathname]);

  const isFounder = !!userId && founderId === userId;
  const isFieldAgent = !!userId && fieldAgentId === userId;

  const mainItems: NavigationItem[] = [
    { title: "Accueil", url: "/dashboard", icon: Home },
    { title: "Boutique", url: "/shop-manager", icon: Store },
    { title: "Affiliation 🤝", url: "/affiliate", icon: Users },
    { title: "SEO Intelligence 🔍", url: "/seo", icon: Search },
    { title: "Académie", url: "/academy", icon: GraduationCap },
    { title: "Communauté", url: "/community", icon: Users, badge: communityUnread },
    { title: "Tarifs", url: "/pricing", icon: CreditCard },
    { title: "Historique des paiements", url: "/payment-history", icon: Receipt },
    { title: "Bibliothèque", url: "/library", icon: FolderHeart },
    { title: "Ecomfy Pay 💳", url: "/ecomfy-pay", icon: CreditCard },
    { title: "Ecomfy Livraison 🚚", url: "/delivery/register", icon: Truck },
    { title: "Répertoire livreurs", url: "/delivery/directory", icon: Search },
    ...(isFieldAgent ? [{ title: "Missions terrain", url: "/delivery-agent", icon: ClipboardCheck }] : []),
    { title: "ConnectUs 🌐", url: "/connectus", icon: Globe },
  ];

  const comingSoonItems: NavigationItem[] = [
    { title: "Studio IA", url: "/studio", icon: Image },
  ];

  const founderItems: NavigationItem[] = isFounder ? [
    { title: t("sidebar.items.dashboard"), url: "/founder-dashboard", icon: BarChart2 },
    { title: "Fondation Livraison 🛡️", url: "/delivery-admin", icon: Truck },
    { title: "Opérations Livraison", url: "/delivery-admin/operations", icon: Activity },
    { title: "Visites terrain", url: "/delivery-admin/visits", icon: ClipboardCheck },
    { title: "Cotisations livraison", url: "/delivery-admin/fees", icon: Wallet },
    { title: "Finances livraison", url: "/delivery-admin/finance", icon: Banknote },
    { title: "Revue KYC", url: "/founder/kyc-review", icon: ShieldCheck },
    { title: "Paiements boutiques", url: "/founder/shop-payment-control", icon: Lock },
    { title: "Abonnements & commissions", url: "/founder/subscription-plans", icon: CreditCard },
    { title: t("sidebar.items.troubleshooting"), url: "/founder-troubleshooting", icon: Bug },
    { title: "Console API", url: "/api-documentation", icon: Code2 },
    { title: t("sidebar.items.promoCodes"), url: "/promo-codes", icon: Tag },
  ] : [];

  // La déconnexion, qui n'est pas une page, est ajoutée par chaque menu.
  const accountItems: NavigationItem[] = [
    { title: "Documentation 📚", url: "/documentation", icon: Book },
    { title: "Paramètres", url: "/profile", icon: Settings },
  ];

  return {
    mainItems,
    comingSoonItems,
    founderItems,
    founderLabel: t("sidebar.sections.admin"),
    accountItems,
    communityUnread,
  };
}

/** Ces entrées ont des sous-pages dans le menu : elles ne sont actives que sur leur adresse exacte. */
export const isExactMatch = (url: string) => url === "/delivery-admin";
