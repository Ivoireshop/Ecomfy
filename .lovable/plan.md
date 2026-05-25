Voici le plan pour livrer les 3 chantiers dans l'ordre demandé. Je propose de les exécuter en 3 itérations distinctes (1 message = 1 chantier livré) pour pouvoir tester chaque brique avant de passer à la suivante.

## Chantier 1 — Notifications de commande configurables

Pour chaque boutique, le propriétaire pourra personnaliser depuis `ShopSettings` :
- **Titre** de la notification (ex: « 💰 Nouvelle commande {shop} »)
- **Texte/format** : champs à inclure (nom client, téléphone, ville, total, nombre de produits, liste des produits)
- **Nombre max de produits** affichés dans la notif (1 à 5)
- **Langue** de la notification (FR, EN, ES, PT, AR)
- **Modèle** : choix entre 3 templates prédéfinis ou mode personnalisé

Implémentation :
- Migration : ajout colonnes `notification_settings jsonb` sur `shops` (template, language, max_products, custom_title, custom_body_fields, etc.)
- Mise à jour `send-push-notification/index.ts` pour lire ces réglages et formater le titre/corps selon la langue + template choisi
- Mise à jour `useOrderNotifications.ts` (`getOrderNotificationBody`) pour respecter les mêmes règles côté foreground sound/voice
- Nouvelle section "Notifications" dans `ShopSettings.tsx` avec aperçu live de la notification

## Chantier 2 — Langue de l'application (i18n globale)

Ajout d'un système i18n pour toute l'app VisualPro :
- Librairie : `i18next` + `react-i18next` (légère, sans dépendance lourde)
- Langues : FR (défaut), EN, ES, PT, AR (RTL pris en charge)
- Sélecteur de langue dans le `Header` (icône globe) — visible aussi avant connexion
- Persistance : `localStorage` + colonne `preferred_language` sur `profiles` pour suivre l'utilisateur connecté
- Fichiers de traduction : `src/i18n/locales/{fr,en,es,pt,ar}.json`

Périmètre traduit (priorité) : Header, Sidebar, Dashboard, ShopManager, ShopEditor (onglets principaux), Auth. Le contenu user-generated (produits, commandes) n'est PAS retraduit ici — c'est le chantier 3.

## Chantier 3 — Traduction auto des boutiques & fiches produits

Deux modes combinés :

**a) Pré-traduction à la création (marchand)**
- Bouton "Traduire en…" dans `ProductEditor` (multi-select langues)
- Edge function `translate-product` (Lovable AI — google/gemini-3-flash-preview pour internationales, google/gemini-2.5-pro pour langues ivoiriennes plus exigeantes)
- Nouvelle table `product_translations` (product_id, language_code, name, description, short_description, meta, source: 'manual'|'ai', created_at)
- Idem pour la boutique : table `shop_translations` (nom, tagline, description, announcement)

**b) Traduction à la volée pour le visiteur (fallback)**
- Sélecteur de langue dans le header de `ShopView` / `ProductView` (drapeaux)
- Si traduction pré-générée existe → l'utiliser
- Sinon : appel edge function `translate-product` avec mise en cache instantanée dans `product_translations` (source: 'ai_auto')
- Langue détectée du navigateur en première visite, persistée en cookie/localStorage

**Langues supportées** : EN, ES, PT, AR, Dioula, Baoulé, Bété, Attié (note : qualité IA limitée sur les langues ivoiriennes, mention affichée au marchand)

---

## Détails techniques transverses

- **Edge function `translate-product`** : prend `{texts: {field: value}, target_lang, source_lang}`, retourne `{translations: {field: value}}`. Cache 90j dans `product_translations` ou nouvelle table `translation_cache` keyée sur hash(text+lang).
- **Cache** : éviter de re-traduire ce qui n'a pas changé (hash sur le contenu source stocké à côté de la traduction).
- **RLS** : `product_translations` & `shop_translations` lisibles publiquement si boutique publiée ; écriture réservée au propriétaire + service role (pour fallback à la volée via edge).
- **RTL pour arabe** : `dir="rtl"` sur `<html>` quand la langue est `ar`.

---

## Découpage par messages

Je propose de livrer **Chantier 1 maintenant** (le plus petit, indépendant), puis tu valides, puis on enchaîne 2 puis 3. Confirme et je commence.
