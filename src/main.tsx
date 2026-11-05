import "./index.css";
import { getLeanShopKind } from "./lib/leanShopPath";
import { reloadOnceOnChunkError } from "./lib/lazyWithRetry";

// Point d'entrée volontairement minuscule : il choisit, d'après l'URL, ce qu'il faut télécharger.
// Les visiteurs d'une fiche produit (trafic des publicités) reçoivent l'application de boutique allégée,
// pas le site complet (tableau de bord, studio, landing, i18n...).
const container = document.getElementById("root")!;
const kind = getLeanShopKind(window.location.pathname, window.location.hostname, import.meta.env.DEV);

if (kind) {
  // On demande la page en parallèle de l'enveloppe de l'application : un seul aller-retour réseau au lieu de deux.
  if (kind === "product") void import("./pages/ProductView").catch(() => {});
  else if (kind === "shop") void import("./pages/ShopView").catch(() => {});
  import("./boot/bootShop").then((m) => m.default(container)).catch(reloadOnceOnChunkError);
} else {
  import("./boot/bootApp").then((m) => m.default(container)).catch(reloadOnceOnChunkError);
}
