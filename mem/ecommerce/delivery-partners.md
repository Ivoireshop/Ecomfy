---
name: Delivery Partners Integration
description: DLK Services + tiers livreurs s'inscrivent, vendeurs connectent, transfert auto à la confirmation
type: feature
---
- Tables: `delivery_providers` (DLK pré-seedé, slug=dlk-services, is_recommended), `shop_delivery_connections` (auto_transfer toggle), colonnes orders `delivery_provider_id` + `delivery_transferred_at`.
- Rôle app_role 'delivery' ajouté.
- Trigger `auto_transfer_order_to_delivery` BEFORE UPDATE sur orders : à passage en 'confirmed' assigne le premier livreur connecté actif (auto_transfer=true) de la boutique.
- UI vendeur : onglet "Livraison" dans ShopSettings → ShopDeliveryPartners (recherche, badge Recommandé, Connecter/Déconnecter, toggle auto-transfert).
- Pages livreur : `/delivery-signup` (créer/éditer fiche, requiert login), `/delivery-dashboard` (KPIs, commandes transférées avec coordonnées client complètes, produits, notes boutique, statut éditable, appel/WhatsApp).
- RLS : livreurs voient orders + order_items uniquement quand `delivery_provider_id` pointe vers leur fiche.