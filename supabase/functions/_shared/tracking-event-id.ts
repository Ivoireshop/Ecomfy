// Identifiant d'événement publicitaire d'une commande : le MÊME calcul côté navigateur (src/lib/trackingIds.ts)
// et côté serveur. C'est ce qui permet à Meta (et TikTok, Snapchat, GA4) de dédoublonner l'événement du pixel
// et celui de l'API de conversions. Toute modification doit être faite aux deux endroits ;
// supabase/tests/purchase-dedup.test.ts vérifie qu'ils restent identiques.

/** Purchase : un seul identifiant possible par commande, quel que soit l'appelant. */
export const purchaseEventId = (orderNumber: string | number): string =>
  `ord_${String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

/** Autres événements liés à une commande (ex. InitiateCheckout) : préfixés par le nom, pour ne jamais être confondus avec le Purchase. */
export const orderEventId = (event: string, orderNumber: string | number): string =>
  event === "Purchase" ? purchaseEventId(orderNumber) : `${event.toLowerCase()}_${purchaseEventId(orderNumber)}`;
