# Académie et espace étudiant : correctifs et déploiement (21 octobre 2026)

**Projet de production :** `yfggrceynzcwklbxhgix` · **Dev :** `xfpbpxncserliskrbaim`
**Contexte :** audit de l'Académie (`/academy`) et du parcours étudiant (inscription, accès, progression, certificat). Guides liés : [`DEPLOIEMENT-COMPLET-2026-10.md`](DEPLOIEMENT-COMPLET-2026-10.md), [`DEPLOIEMENT-PROD-2026-10.md`](DEPLOIEMENT-PROD-2026-10.md).

---

## 1. À déployer en production

| # | Élément | Type | Action | Bloquant ? |
|---|---|---|---|---|
| 1 | `generate-certificate` | Edge Function | Déployer (commande en 2) | **Oui** : sans cela aucun certificat ne peut être délivré |
| 2 | `manage-student-access` | Edge Function | Déployer (commande en 2) | Non (message d'erreur clair seulement) |
| 3 | Application web (`src/`) | Frontend | Déployer la branche `jeanmarc` comme d'habitude | **Oui** pour les correctifs 2 à 5 de la section 3 |
| 4 | Migration SQL | — | **Aucune** | — |

Aucun secret à créer : `generate-certificate` utilise `SUPABASE_SERVICE_ROLE_KEY` (fourni automatiquement aux fonctions) et `APP_URL` (déjà utilisé par les autres fonctions, défaut `https://ecomfy.cloud`). Vérifier seulement que `APP_URL` pointe bien sur le domaine public de la production : il sert à construire le lien de vérification du certificat.

**Ordre conseillé :** fonctions d'abord (elles restent compatibles avec l'ancien frontend), puis frontend.

## 2. Commandes

```powershell
$P = "yfggrceynzcwklbxhgix"   # PRODUCTION
npx supabase@latest functions deploy generate-certificate  --project-ref $P --use-api
npx supabase@latest functions deploy manage-student-access --project-ref $P --use-api
```

Les deux ont été déployées sur **dev** le 21/10/2026 (`xfpbpxncserliskrbaim`) et testées de bout en bout.

## 3. Ce qui a été corrigé

| # | Défaut constaté | Correctif | Fichiers |
|---|---|---|---|
| 1 | **Aucun certificat ne pouvait être généré.** La fonction répondait toujours 401 (`getUser()` sans jeton sur `supabase-js@2.7.1`), puis les écritures étaient refusées par la RLS (dossier `certificates/` du bucket hors du dossier de l'utilisateur, aucune politique d'insertion sur `course_certificates`) | Jeton passé explicitement, `supabase-js@2.45.0`, upload et insertion faits avec le client service-role **après** vérification de l'accès et de la complétion | `supabase/functions/generate-certificate` |
| 2 | La complétion était calculée sur les seules lignes de progression déjà créées : cocher **une** leçon sur 20 suffisait pour obtenir le certificat | Complétion = contenus **obligatoires** des modules publiés ; accès actif et non expiré exigé | `supabase/functions/generate-certificate` |
| 3 | Le certificat s'affichait en **code source** (le stockage Supabase sert le HTML en `text/plain`) ; lien de vérification pointant vers l'URL Supabase | Nouvelle page publique et imprimable `/certificate/:numéro` (QR code, bouton Imprimer / PDF, sans barre latérale) ; lien de vérification basé sur `APP_URL` ; les boutons « Voir » y mènent | `src/pages/CertificateView.tsx`, `src/App.tsx`, `StudentCourse`, `StudentCertificates`, `VerifyCertificate` |
| 4 | **`/student` était une maquette** : trois cours en dur (identifiants inexistants en base), progression inventée, sélecteur « démo » visible de tous | Réécrit sur les données réelles (accès, progression, certificats, catalogue d'achat) | `src/pages/StudentDashboard.tsx` |
| 5 | **Inscription impossible pour un étudiant sans compte** : l'insertion était suivie d'une relecture interdite par la RLS (401) ; page de succès annonçant « Paiement confirmé » | Identifiant généré côté client, pas de relecture ; page de succès corrigée | `src/pages/EnrollmentCheckout.tsx`, `src/pages/PaymentSuccess.tsx` |
| 6 | Page du cours : requêtes non filtrées par utilisateur (un formateur voyait la progression de tous), expiration d'accès ignorée, liens `youtu.be`/shorts/Vimeo non lus, erreur 406 sans certificat, message d'erreur de la fonction masqué | Filtres par utilisateur, expiration vérifiée, helper d'intégration vidéo sécurisé, vrai message d'erreur | `src/pages/StudentCourse.tsx`, `src/lib/videoEmbed.ts` |
| 7 | « Formations en cours » masqué tant qu'aucun certificat n'existait ; boutons « Voir » et « Télécharger » identiques | Section toujours affichée, « Télécharger » remplacé par « Vérifier » | `src/pages/StudentCertificates.tsx` |
| 8 | Académie : 7 vidéos sur 9 réutilisaient le même identifiant YouTube ; double bouton de fermeture ; description manquante (accessibilité) ; durée et prix en dur ; progression faussée par d'anciens identifiants | Vidéos non tournées marquées « Bientôt disponible » (`comingSoon`), un seul bouton de fermeture, prix lus dans `pricingPlans`, progression bornée | `src/pages/Academy.tsx` |
| 9 | Survol illisible (texte blanc sur fond vert clair) sur « Voir mon certificat » et sur le bouton d'action de l'Académie | Couleur de texte explicite au survol, en clair et en sombre | `StudentCourse.tsx`, `Academy.tsx` |
| 10 | « Réactiver l'accès » sur un étudiant sans compte : erreur générique (le trigger `grant_student_access` échoue sur `user_id` NULL) | Message clair : utiliser « Renvoyer » pour créer le compte | `supabase/functions/manage-student-access` |

## 4. Ce qui a été testé

**Sur dev, dans le navigateur, le 21/10/2026 :** catalogue Académie et lecteur vidéo ; création d'un cours, d'un module et de contenus (obligatoire et facultatif) ; publication ; inscription depuis `/enroll/…` ; inscription **anonyme** par l'API publique (ancienne méthode refusée, nouvelle acceptée) ; validation côté formateur ; `/student` avec le vrai cours ; progression à 100 % avec la seule leçon obligatoire ; génération du certificat ; `/student/certificates` ; `/verify-certificate/…` (« Certificat Valide ») ; `/certificate/…` ; nom du certificat tiré des métadonnées du compte ; message d'erreur pour un étudiant sans compte.

**Non testé :** la boîte d'impression native (seules les règles CSS d'impression ont été contrôlées) ; l'envoi des e-mails d'accès (« Renvoyer ») ; la lecture d'un certificat par un visiteur **non connecté** en navigateur (la fonction `verify_certificate_by_number` est ouverte à `anon` d'après sa migration).

## 5. Vérifications après déploiement en production

1. Sur un compte étudiant réel ayant tout terminé : **Obtenir mon certificat** → toast « Certificat généré avec succès », puis `/student/certificates` affiche la carte et « Voir » ouvre `/certificate/CERT-…` avec le bon nom.
2. Le lien de vérification affiché sur le certificat commence par le domaine de production, pas par `localhost` ni `supabase.co`.
3. `/student` d'un compte sans formation : état vide propre, catalogue des formations publiées.
4. Si l'un de ces points échoue : Dashboard Supabase > Edge Functions > `generate-certificate` > Logs.

**Points à contrôler en production avant de conclure** (non consignés dans les docs) :
- le trigger `grant_access_on_payment_validation` existe sur `public.enrollments` (migration `20251120132158`) ;
- la politique `Students can view their own access` existe sur `public.student_access` ;
- la fonction `verify_certificate_by_number` existe et est exécutable par `anon`.

```sql
select tgname from pg_trigger where tgrelid = 'public.enrollments'::regclass and not tgisinternal;
select polname from pg_policy where polrelid = 'public.student_access'::regclass;
select has_function_privilege('anon', 'public.verify_certificate_by_number(text)', 'execute');
```

## 6. Retour arrière

- Fonctions : redéployer la version précédente (`git show aa1e19c:supabase/functions/<nom>/index.ts`). Attention : l'ancienne `generate-certificate` ne fonctionnait pas du tout.
- Frontend : redéployer le commit précédent ; les certificats déjà générés restent valables (la page `/certificate/…` lit la table, pas le fichier).

## 7. Reste ouvert

- **Vidéos de l'Académie** : fournir de vrais identifiants YouTube pour les 7 vidéos « Bientôt disponible » (champ `youtubeId` et suppression de `comingSoon` dans `Academy.tsx`).
- **Survol des boutons `outline`** : la variante force un texte blanc au survol (`hover:text-accent-foreground`), ce qui est illisible dès qu'un composant impose un fond clair. Le même motif existe dans une dizaine d'autres composants (`PaymentLinksTab`, `ProductEditor`, `OrdersList`, `SectionControls`…). Un correctif central dans `button.tsx` toucherait toute l'application : décision à prendre.
- **`ProtectedRoute`** : « Error loading profile / subscription » en console pour un compte sans ligne de profil ou d'abonnement (réponse 406 d'un `.single()`). Repli volontaire (3 générations gratuites) ; non modifié.
- **Inscription en attente** : un étudiant inscrit sans compte ne peut pas être validé par « Réactiver l'accès » ; le formateur doit utiliser « Renvoyer » (création du compte et envoi des accès), qui ne passe pas l'inscription en « payée ».

## 8. Nettoyage de la dev

Données de test laissées sur dev par ces essais : cours `[TEST] Formation de test Académie` (`d2cd11d6-1c5e-4a4f-89df-ecb7e7b98315`) et `[TEST] Formation 2 (nom certificat)` (`1efceb62-7e40-4285-b635-214249fc6cf9`), leurs modules, contenus, inscriptions (dont `anon-nouveau@example.com`) et deux certificats (`CERT-20261021-B36F4`, `CERT-20261021-DF202`). Suppression : depuis `/courses-manager` (corbeille des cours) ; les certificats et les fichiers du bucket `generated-content/certificates/` sont à supprimer à part.
