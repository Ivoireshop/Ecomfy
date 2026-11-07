# Suivi du lancement : état réel en production

> **Mise à jour du 07/11/2026 :** depuis le 03/11, la prod a reçu deux déploiements (05/11 : Meta CAPI, Purchase fiable, logistique ; 07/11 : collaborateurs, module Ecomfy Livraison, buckets durcis, correctif GeniusPay d'`ecomfy-pay-initiate`). Les constats « module `delivery_companies` absent en prod » (lignes H5 et §« Constats ») sont **périmés** ; seules les deux lignes de tâches « Logistique » et « Collaborateurs » ont été recalées ci-dessous. Voir [`DEPLOIEMENT-PROD-2026-11-07.md`](DEPLOIEMENT-PROD-2026-11-07.md) et [`DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md`](DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md).

**Date :** 3 novembre 2026 (première version : 30/10) · **Projet prod :** `yfggrceynzcwklbxhgix` · **Source des tâches :** site « Ecomfy — Suivi du lancement » (dev-flow-sight.lovable.app, statuts lus le 29/10/2026 ; le 03/11 le site s'affichait sans session, donc sans statuts)

Le site est une liste cochée à la main : il ne sait pas ce qui est déployé. Ce document compare ses 112 tâches au code (`origin/main`, qui déploie le front par Vercel, et la branche `jeanmarc`), aux journaux de déploiement (13/10, 27/10, 29/10) et aux contrôles faits en production les 30/10 et 03/11.

✅ en prod · ⚠️ en prod mais incomplet ou non testé · 🟡 code fait sur `jeanmarc`, **non déployé en prod** · ❌ aucun code trouvé · ❓ à confirmer · n/a sans objet

**Le site affichait 24/112 (21 %) le 29/10. D'après ce document, environ 53 tâches sont en prod** (24 cochées + 29 de la Phase 1 non cochées). **Six tâches de la Phase 2 sont codées mais pas en prod** (§3).

**État de Git au 03/11 :** `origin/main` est resté au 27/10 (`27e7092`). `jeanmarc` a 22 commits d'avance, dont ceux du 30/10 au 03/11. Tant qu'ils ne sont pas fusionnés dans `main`, le front correspondant n'est pas en prod.

---

## 1. Phase 0 : Urgence sécurité (12/13 sur le site)

| Tâche (nom du site) | Site | Prod |
|---|---|---|
| Lancer les requêtes SQL de l'annexe B sur la base réelle | Terminé | ✅ |
| Exporter les journaux Supabase (appels anonymes suspects) | Terminé | ⚠️ 7 jours consultés, rien exporté (l'avant 12/10 n'est pas vérifiable) |
| Clarifier les 2 projets Supabase mélangés (H11) | Terminé | ✅ (variables Vercel Preview restantes) |
| C1 : REVOKE sur les fonctions de portefeuille, retrait via auth.uid() | Terminé | ✅ vérifié le 29/10 |
| C2 : réserver confirm_invoice_payment, apply_commission_payment, apply_shop_subscription à service_role | Terminé | ✅ vérifié le 29/10 |
| C3 : contrôle de propriété sur get_shop_orders_secure | Terminé | ✅ vérifié le 29/10 |
| C7 : manage-founder-roles (user_roles + liste blanche, plus d'e-mail en dur) | Terminé | ⚠️ nomination/révocation non testées ; e-mails encore en dur dans l'interface |
| C8 : tracking.ts n'accepte que G-XXXX | Terminé | ⚠️ vitrine avec pixels non testée |
| C4 : retirer l'auto-validation KYC, suspendre les retraits | Terminé | ✅ 0 KYC validé, retraits suspendus ; première revue KYC à faire |
| C5 : signature HMAC sur ecomfy-pay-webhook | Terminé | ⚠️ jamais testé avec un paiement signé réel |
| C6 : tarifs serveur et recalcul des montants (version minimale) | Terminé | ⚠️ `scripts/verify-c6-prod.mjs` pas encore lancé |
| Rapport d'exploitation (C1–C8) remis au fondateur | Terminé | ✅ document |
| Fondateur : décisions GeniusPay, périmètre, API tierce, accès opérateurs | À faire | n/a |

## 2. Phase 1 : Fondations (12/42 sur le site)

« **Cocher** » : la tâche est en prod mais pas cochée sur le site.

| Tâche (nom du site) | Site | Prod | Sur le site |
|---|---|---|---|
| H3 : isAuthorizedCron strict | Terminé | ✅ déployée le 27/10, 401 vérifié le 30/10 | rien |
| H7 : corriger la ReferenceError de geniuspay-webhook | Terminé | ✅ redéployée le 27/10 | rien |
| Bugs Accueil : corriger toutes les anomalies | À faire | ✅ selon le responsable ; un seul commit lié (`624465c`, 21/10) | **cocher** |
| Bugs Affiliation : corriger toutes les anomalies | À faire | ✅ M2, recette non jouée | **cocher** |
| H1 : bucket privé kyc-documents + URL signées | Terminé | ✅ | rien |
| H2 : fermer les 8 tables de gouvernance | Terminé | ✅ 4 politiques attendues en place, RLS actif sur les 14 tables `corporate_*`, droits `anon` retirés le 30/10 | rien |
| Bugs SEO intelligent : corriger toutes les anomalies | À faire | ⚠️ migrations posées, OAuth/synchro Google à construire | à discuter |
| Bugs Ecomfy Academy : corriger toutes les anomalies | À faire | ✅ fonctions déployées le 27/10, recette non jouée | **cocher** |
| H4 : authentifier et échapper les fonctions d'e-mail | Terminé | ⚠️ 3 fonctions sur 4 protégées. 🟡 `verify-domain-dns` corrigée dans le code (`a522603`, 01/11), **pas déployée en prod au 03/11** (§5, point 1) | à surveiller |
| H5 : verify-delivery-identity réservé aux admins | Terminé | ⚠️ fonction protégée (401), mais module `delivery_companies` absent en prod | rien |
| Revue hebdomadaire avec le fondateur | À faire | n/a | rien |
| Bugs Ecomfy Communauté : corriger toutes les anomalies | À faire | ✅ M12, recette non jouée | **cocher** |
| Bugs Tarif : corriger toutes les anomalies | Terminé | ✅ M1 le 27/10 | rien |
| H6 : corriger RLS et RPC d'affiliation | Terminé | ✅ | rien |
| H10 : création de commande par RPC, prix recalculés serveur | Terminé | ✅ | rien |
| Bugs Bibliothèque (liée au Studio IA) | À faire | ✅ M13, recette non jouée | **cocher** |
| Boutique : bugs Tableau de bord | À faire | ✅ commit `739799b` (22/10) | **cocher** |
| Boutique : bugs Commandes | À faire | ✅ M11 | **cocher** |
| H9 : quota IA effectif, authentifier correct-text, retirer test-openai-image | Terminé | ✅ `correct-text`, `generate-ai-image`, `generate-ad-visual` refusent sans session ; `test-openai-image` supprimée en prod le 30/10 | rien |
| H8 : en-têtes de sécurité dans vercel.json | Terminé | ✅ | rien |
| Boutique : bugs Panier abandonné | À faire | ✅ M10, testée le 27/10 | **cocher** |
| Boutique : bugs Clients fidèles | À faire | ✅ avec M9 | **cocher** |
| Boutique : bugs Codes promo | À faire | ✅ M9, testée le 27/10 | **cocher** |
| H11 : retirer .env de Git, ajouter .env.example | Terminé | ✅ | rien |
| Ledger Ecomfy Pay : schéma complet (référence, montant, devise, opérateur, boutique, commande) | À faire | ✅ M17 | **cocher** |
| Boutique : bugs Produits | À faire | ✅ M6, édition non testée en session marchand | **cocher** |
| Boutique : bugs Statistiques | À faire | ✅ front ; réconciliation Meta non affichée | **cocher** |
| Transaction unique paiement → commande → crédit, rejouable | À faire | ✅ M17 | **cocher** |
| Références avec crypto.randomUUID (M4) | À faire | ✅ M17 | **cocher** |
| Boutique : bugs Finance | À faire | ⚠️ M15 appliquée, e-mail du lundi bloqué (file sans travailleur) | à discuter |
| Boutique : bugs Optimiseur IA | À faire | ✅ `product-ai-optimizer` déployée, recette non jouée | **cocher** |
| Interface commune des connecteurs opérateurs | À faire | ✅ fonctions `ecomfy-pay-*` déployées | **cocher** |
| Idempotence testée (callback répété) | À faire | ⚠️ testée hors prod, webhook signé jamais joué en prod | à discuter |
| Revue hebdomadaire avec le fondateur | À faire | n/a | rien |
| Boutique : bugs Termes et Apparence | À faire | ✅ | **cocher** |
| Boutique : bugs Facturation | À faire | ✅ M3, M4, M16, tests du 27/10 | **cocher** |
| Boutique : bugs Avis | À faire | ✅ M5, testée le 27/10 | **cocher** |
| vitest + CI (lint, typecheck, tests, npm audit) | À faire | ✅ CI GitHub verte (lint, typecheck, test, audit) | **cocher** |
| Tests SQL de RLS sur les flux d'argent | À faire | ✅ M16, tests du 27/10 | **cocher** |
| Procédure de rollback documentée | À faire | ⚠️ document fait, restauration jamais répétée | **cocher** (document) |
| Boutique : bugs Paramètres | À faire | ✅ M7 | **cocher** |
| Revue de sécurité interne, validation du fondateur pour la Phase 2 | À faire | n/a | rien |

## 3. Phases 2 à 4 : aucune tâche terminée sur le site (57)

### Phase 2 (23 tâches), état au 03/11/2026

| Tâche (nom du site) | Code (`jeanmarc`) | Prod |
|---|---|---|
| Studio IA : cause de l'erreur 4001 et message propre | `d0297bd` : échecs vidéo et voix classés, messages lisibles. Le code « 4001 » n'est pas cité dans le commit : à confirmer | 🟡 |
| Studio IA : résultats persistés après refresh | `31e5347` : localStorage, 24 h, par utilisateur | 🟡 front seul |
| Abonnements : plan actif et commission 50 FCFA | `c210ae4` : plan affiché d'après `subscription_active_until`. La commission passe par M1 | 🟡 affichage (`/pricing`), ✅ commission |
| Boutique : réparer l'assistant IA de la boutique | `88212e8` : chat via OpenRouter, voix débitée après coup | 🟡 2 fonctions et le front |
| Studio IA : retry contrôlé, suivi des coûts et quotas | `9eda467` + migration `20261103100000` | 🟡 dev seulement ; prix vidéo (3 crédits) à confirmer |
| Fiche produit : en-tête de l'éditeur toujours visible au défilement | `fceb805` | 🟡 front seul |
| Studio IA : UGC et fiche produit IA testés | code des 5 fonctions IA fait, aucun test de bout en bout | 🟡 non testé |
| Quota 240 commandes / 12 000 FCFA, préavis 3 jours, verrouillage | en partie couvert par les tâches d'échéances (en prod) | ⚠️ à vérifier avant de cocher |
| Boutique : ajout et modification fiables des termes | aucun commit sur des « termes » (`01dabda` traite les thèmes) | ❓ |
| Wave : initiation et statuts · Wave : webhooks signés, erreurs, timeout · Orange Money : initiation et statuts · Orange Money : webhooks, erreurs, annulation | aucun commit dédié | ❌ |
| Rapprochement ledger / rapports opérateurs | aucun commit dédié ; 20 paiements `PENDING` non rapprochés | ❌ |
| Meta CAPI : audit en lecture seule · Meta : Purchase fiable (order_id, event_id, déduplication) | aucun commit dédié | ❌ |
| Logistique : flux commande → affectation → livraison, statuts · Logistique : KYC/KYB, permis A/B, audit log, notifications | **mis à jour le 07/11 :** flux commande → livraison déployé le 05/11 ; KYC/KYB, permis A/B, audit, notifications déployés le 07/11 (`DEPLOIEMENT-PROD-2026-11-07.md`) ; recette navigateur en prod non faite | ⚠️ |
| Fiche produit : affichage en 1 seconde depuis les publicités Facebook, TikTok, Google | aucun commit dédié (`624465c` du 21/10 : retour vers l'accueil seulement) | ❌ |
| Collaborateurs boutique : pouvoir tout cocher et donner l'accès total | **mis à jour le 07/11 :** commit `f30e663`, migration `20261106100000` appliquée en prod le 07/11 (6 collaborateurs, 10 rôles conservés) | ✅ |
| Revue hebdomadaire (×2) · Démonstration au fondateur : paiement, IA, livraison | | n/a |

**Ne pas cocher les lignes 🟡 tant que la PR vers `main` n'est pas fusionnée et que la migration `20261103100000` n'est pas appliquée en prod.**

### Phases 3 et 4

Aucun commit dédié. Rien n'indique un travail démarré.

**Phase 3 (24 tâches).** MTN Mobile Money : initiation et statuts · Dashboard : KPI réels · Page d'accueil boutique : corriger les bugs et la rendre plus smart · MTN : webhooks, erreurs, annulation · Revenus et activations, audit et gouvernance sur données réelles · Fiche produit : mesure de vitesse sur mobile · Moov Money : initiation et statuts · RBAC/RLS, collaborateurs, invitations e-mail, retrait des e-mails en dur (M7) · Moov : webhooks, erreurs, annulation · Page 404 propre, CORS et codes HTTP (M3) · Produits digitaux · API Ecomfy Pay documentée + sandbox · supabase db pull et SET search_path (M1, M11) · Revue hebdomadaire · Stock QR : activation par boutique, QR produit · Connect Ads : Business Manager et OAuth sécurisé · Stock : scan livreur et décrémentation · Connect Ads : dépenses et conversions Meta · Stock : historique et retours · Dépendances : npm audit fix, Capacitor ≥ 8.5.1 (M10) · Tests paiement : succès, échec, doublon, callback répété, timeout, paiement tardif · GEL DES FONCTIONNALITÉS · Décision sur les opérateurs sans accès production · Revue hebdomadaire.

**Phase 4 (10 tâches).** Recette : Ecomfy Pay et Studio IA · Recette : Logistique, boutique et checkout · Recette : tracking, abonnement, stock, administration · Tentatives d'attaque internes sur C1–C8 et H1–H11 · Tests de régression complets · Répétition du déploiement et du rollback en préproduction · Comparaison chiffrée commandes Ecomfy vs Purchase Meta · Corrections finales · Réunion GO / NO-GO · Déploiement du lancement officiel.

---

## 4. Contrôles faits en production le 30/10/2026

| Contrôle | Résultat |
|---|---|
| Politiques de `corporate_audit_logs` et `corporate_document_acceptances` | 4 lignes attendues : lecture réservée, insertion au nom de l'appelant, pas de `UPDATE` ni `DELETE` (`20261015150000` appliquée) |
| Politiques `corporate_*` ouvertes (`true`, `anon`, `public`) | 0 ligne |
| RLS sur les 14 tables `corporate_*` | `true` partout |
| Droits `anon` sur les tables `corporate_*` | présents à l'origine (tous droits), retirés par `REVOKE` le 30/10 ; RLS bloquait déjà `anon`, durcissement de défense en profondeur |
| Versions des fonctions (`functions list`) | `seo-auto-index`, `generate-ai-image` mises à jour le 27/10 ; fonctions d'e-mail et IA redéployées le 19/10 (après les correctifs du 15 au 18/10) |
| Appels sans session | `seo-auto-index`, `send-corporate-invite`, `send-domain-ready-notification`, `send-subscription-email`, `verify-delivery-identity`, `generate-ad-visual`, `generate-ai-image` : 401. `correct-text` : 200 `not_authenticated`. `verify-domain-dns` : 400 (validation, pas d'authentification). `translate-ui` et `shop-ai-assistant-chat` : validation des paramètres, ne prouve rien |
| `test-openai-image` (OPTIONS) | 200 : fonction encore active (v11, 31/08), sans authentification. **Supprimée en prod le 30/10** |
| `delivery_companies` | n'existe pas en prod (existent : `delivery_providers`, `delivery_providers_public`, `delivery_company_members`, `delivery_vehicles`, `delivery_zones`, `delivery_fees`, `delivery_payments`, `delivery_driver_*`) |
| `delivery_providers` | un propriétaire pouvait modifier `is_verified` ; une seule fiche vérifiée (DLK Services, `user_id` nul, fiche de la plateforme), aucun abus. Garde appliqué, trigger `trg_guard_delivery_provider_verification` actif (`tgenabled = 'O'`) |

## 5. Points ouverts

1. **`verify-domain-dns` (H4) : accepte des écritures de n'importe qui.** Fonction déclarée `verify_jwt = false`, client en clé de service, `resourceId`, `domain` et `verificationCode` pris dans le corps de la requête, sans contrôle de propriétaire. Un inconnu peut fixer `domain_status`, `ssl_status`, `dns_propagation_percentage` de la boutique ou vitrine d'un autre (en fournissant un domaine à lui qui valide), ou la repasser en `pending`. Il ne peut ni changer le domaine ni lire de données. Gravité moyenne. **Correctif écrit et commité (`a522603`, 01/11), à déployer et tester (voir `DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md` §4) :** exiger un JWT, vérifier que l'appelant possède la ressource (ou est admin/fondateur/collaborateur), relire `custom_domain` et `domain_verification_code` en base, puis redéployer avec `--use-api --project-ref yfggrceynzcwklbxhgix` et refaire l'appel sans connexion (401 attendu). Seul appelant légitime : `src/components/DnsConfigurationAssistant.tsx`.
2. **H5 : module « sociétés de livraison » absent en prod.** La migration `20261016120000` (garde sur `delivery_companies`) n'est pas applicable ; `verify-delivery-identity` interroge `delivery_companies` et `delivery_drivers`, qui n'existent pas. À traiter avec la tâche « Logistique : KYC/KYB » de la Phase 2.
3. **C5 / C6 / C7 / C8 : tests applicatifs en prod à jouer** (paiement signé GeniusPay, `verify-c6-prod.mjs`, nomination et révocation de fondateur, vitrine avec pixels).
4. **File d'e-mails sans travailleur :** aucune tâche planifiée n'appelle `process-email-queue`. Le résumé finance du lundi 02/11 à 08 h UTC ne partira pas.
5. **Paiements Ecomfy Pay `PENDING` :** 12 paiements (21 au 26/10), aucun crédité, aucun rejeu automatique. L'aiguillage du webhook (`9a19c6a`) n'est pas dans `origin/main`.
6. **Recettes non jouées** (journal du 27/10) : éditeur de produit en session marchand, abonnement par paiement réel, activation et paiement manuel fondateur, affiliation, suivi de livraison, bibliothèque, Académie, `/seo`, optimiseur IA, webhook Ecomfy Pay signé, console sur les pages autres que l'accueil.
7. **Journaux de l'API Supabase :** rétention limitée, rien n'a été exporté dans un fichier.

## 5 bis. Mise à jour du 03/11/2026 (contrôle de la prod en lecture seule)

Détail complet et ordre d'exécution : [`DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md`](DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md), section « Mise à jour du 03/11/2026 ». Ce qui change pour le suivi :

- **Aucun déploiement en prod depuis le 27/10** (fonctions) : les points 1, 4 et 5 ci-dessus sont toujours ouverts, aucun n'a avancé.
- Point 4 (file d'e-mails) : **62 messages**, dont un `shop-activation` du 02/11 à 13 h 14 jamais envoyé ; le résumé finance du 02/11 n'est pas parti.
- Point 5 : toujours **20 paiements `PENDING`**, tous de plus de 24 h, aucun nouveau depuis le 30/10.
- Nouveau : la migration `20261103100000_studio_ai_generation_log` et 8 fonctions (Studio IA, voix, assistant boutique) sont prêtes sur `jeanmarc` mais **absentes de la prod** ; le front correspondant n'est pas dans `main`. Tâches concernées du site : « Studio IA : retry contrôlé, suivi des coûts et quotas », « Studio IA : résultats persistés après refresh » (front seul), « Boutique : réparer l'assistant IA de la boutique », « Fiche produit : en-tête de l'éditeur toujours visible » (front seul), « Abonnements : plan actif et commission 50 FCFA » (`/pricing`). **Ne pas les cocher tant que la PR vers `main` n'est pas fusionnée et la migration appliquée.**
- Nouveau point ouvert : `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` absents des secrets de la prod (les fonctions `gsc-*` sont déployées).
- `expire-stale-pending-payments` : 3 échecs `job startup timeout` (31/10 et 02/11), à surveiller.

## 6. Modifications du dépôt du 30/10/2026 (commitées et poussées sur `origin/jeanmarc`, absentes de `main`)

- `594941b` : migration `20261030100000_delivery_providers_verification_guard.sql` (garde de `delivery_providers`, déjà appliqué en prod) ; suppression de `supabase/functions/test-openai-image/` (sans elle, un redéploiement complet remettrait la fonction en ligne) ; entrée de `test-openai-image` retirée de `eslint-suppressions.json` ; première version de ce document.
- `b7ef294` : plan de mise en production de H5, [`H5-LIVRAISON-MISE-EN-PROD-2026-10.md`](H5-LIVRAISON-MISE-EN-PROD-2026-10.md).

## 7. Commits de `jeanmarc` du 01/11 au 03/11/2026, non déployés

| Commit | Sujet |
|---|---|
| `a522603` (01/11) | `verify-domain-dns` authentifié ; aiguillage des webhooks de retrait dans `geniuspay-webhook` |
| `9eda467` (03/11) | Retry borné, suivi des coûts et quotas sur 5 fonctions IA (migration `20261103100000`) |
| `d0297bd` (03/11) | Échecs vidéo et voix classés, messages lisibles |
| `31e5347` (03/11) | Studio IA : résultat, prompt, réglages et images persistés après refresh |
| `c210ae4` (03/11) | `/pricing` : une seule formule « plan actuel », la date de fin fait foi |
| `88212e8` (03/11) | Assistant IA de la boutique réparé (chat via OpenRouter, voix débitée après coup) |
| `fceb805` (03/11) | Fiche produit : barre d'outils de la description toujours visible au défilement |
| `e5496de` (03/11) | VisuelPro/VisualPro remplacé par Ecomfy dans les mails, paiements et fonctions |
| `0f477ab` (03/11) | Erreurs ESLint de la CI sur le Studio IA |
