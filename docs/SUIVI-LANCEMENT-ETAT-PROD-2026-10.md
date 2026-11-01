# Suivi du lancement : état réel en production

**Date :** 30 octobre 2026 · **Projet prod :** `yfggrceynzcwklbxhgix` · **Source des tâches :** site « Ecomfy — Suivi du lancement » (dev-flow-sight.lovable.app, lu le 29/10/2026)

Le site est une liste cochée à la main : il ne sait pas ce qui est déployé. Ce document compare ses 112 tâches au code (`origin/main`, qui déploie le front par Vercel), aux journaux de déploiement (13/10, 27/10, 29/10) et aux contrôles faits en production le 30/10.

✅ en prod · ⚠️ en prod mais incomplet ou non testé · ❓ à confirmer · n/a sans objet

**Le site affiche 24/112 (21 %). D'après ce document, environ 53 tâches sont en prod** (24 cochées + 29 de la Phase 1 non cochées).

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
| H4 : authentifier et échapper les fonctions d'e-mail | Terminé | ⚠️ voir §4 : `verify-domain-dns` ouverte | à surveiller |
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

## 3. Phases 2 à 4 : aucune tâche terminée (57)

Aucun code ni journal ne montre un déploiement, sauf mention.

**Phase 2 (23 tâches).** Wave : initiation et statuts · Wave : webhooks signés, erreurs, timeout · Orange Money : initiation et statuts · Orange Money : webhooks, erreurs, annulation · Rapprochement ledger / rapports opérateurs · Revue hebdomadaire · Studio IA : cause de l'erreur 4001 et message propre · Studio IA : résultats persistés après refresh · Abonnements : plan actif et commission 50 FCFA · Boutique : réparer l'assistant IA de la boutique · Studio IA : retry contrôlé, suivi des coûts et quotas · Quota 240 commandes / 12 000 FCFA, préavis 3 jours, verrouillage · Fiche produit : en-tête de l'éditeur toujours visible au défilement · Studio IA : UGC et fiche produit IA testés · Meta CAPI : audit en lecture seule · Boutique : ajout et modification fiables des termes · Logistique : flux commande → affectation → livraison, statuts · Meta : Purchase fiable (order_id, event_id, déduplication) · Fiche produit : affichage en 1 seconde depuis les publicités Facebook, TikTok, Google · Logistique : KYC/KYB, permis A/B, audit log, notifications · Démonstration au fondateur : paiement, IA, livraison · Revue hebdomadaire · Collaborateurs boutique : pouvoir tout cocher et donner l'accès total.

- « Abonnements : plan actif et commission 50 FCFA » est probablement couvert par M1 (en prod), à vérifier avant de cocher.
- « Quota 240 commandes… verrouillage » est en partie couvert par la tâche des échéances de paiement.
- « Logistique : KYC/KYB » attend le module livraison (`delivery_companies` absent en prod).

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

## 6. Modifications du dépôt de cette session, non commitées

- `supabase/migrations/20261030100000_delivery_providers_verification_guard.sql` : garde de `delivery_providers` (déjà appliqué en prod).
- Suppression de `supabase/functions/test-openai-image/` (indexée par `git rm`) : sans elle, un redéploiement complet remettrait la fonction en ligne.
- `eslint-suppressions.json` : entrée de `test-openai-image` retirée.
- Ce document.
