#!/usr/bin/env node
// Audit H1 : déplace les pièces KYC du bucket public shop-images vers le bucket privé kyc-documents.
//
// Pour chaque dossier merchant_kyc dont recto / verso / selfie est une URL publique shop-images :
//   1. télécharge le fichier (clé service_role) ;
//   2. le dépose dans kyc-documents sous <user_id>/<champ>_<nom d'origine> ;
//   3. remplace l'URL par ce chemin dans merchant_kyc ;
//   4. supprime l'original de shop-images (seulement si 1 à 3 ont réussi pour ce champ).
// Le statut du dossier n'est pas modifié (service_role n'est pas soumis au trigger de remise en PENDING).
//
// Par défaut : simulation, rien n'est écrit. --apply pour exécuter.
// --purge-orphans (avec --apply) supprime aussi les fichiers de shop-images/kyc/ qu'aucun dossier ne référence.
//
// Prérequis : migration 20261015140000 appliquée (bucket kyc-documents).
// Usage :
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clé> node scripts/migrate-kyc-to-private-bucket.mjs [--apply] [--purge-orphans]
// La clé service_role ne se met jamais dans le dépôt ni dans .env versionné.

import { createClient } from "@supabase/supabase-js";

const SOURCE = "shop-images";
const TARGET = "kyc-documents";
const FIELDS = [
  ["document_front_url", "front"],
  ["document_back_url", "back"],
  ["selfie_url", "selfie"],
];

const apply = process.argv.includes("--apply");
const purgeOrphans = process.argv.includes("--purge-orphans");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const marker = `/storage/v1/object/public/${SOURCE}/`;

// Chemin dans shop-images d'une URL publique, ou null (valeur déjà migrée, vide ou étrangère)
function sourcePath(value) {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  const i = value.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(value.slice(i + marker.length).split("?")[0]);
}

console.log(apply ? "MODE : exécution (--apply)" : "MODE : simulation (ajoutez --apply pour écrire)");

const { data: rows, error } = await supabase
  .from("merchant_kyc")
  .select("user_id, document_front_url, document_back_url, selfie_url");
if (error) {
  console.error("Lecture de merchant_kyc impossible :", error.message);
  process.exit(1);
}

let moved = 0;
let failed = 0;
const referenced = new Set();

for (const row of rows) {
  for (const [column, label] of FIELDS) {
    const src = sourcePath(row[column]);
    if (!src) continue;
    referenced.add(src);
    const destination = `${row.user_id}/${label}_${src.split("/").pop()}`;
    console.log(`${row.user_id} ${column}: ${SOURCE}/${src} -> ${TARGET}/${destination}`);
    if (!apply) continue;

    try {
      const { data: blob, error: dlError } = await supabase.storage.from(SOURCE).download(src);
      if (dlError) throw new Error(`téléchargement : ${dlError.message}`);

      const { error: upError } = await supabase.storage
        .from(TARGET)
        .upload(destination, blob, { contentType: blob.type || "image/jpeg", upsert: true });
      if (upError) throw new Error(`dépôt : ${upError.message}`);

      const { error: dbError } = await supabase
        .from("merchant_kyc")
        .update({ [column]: destination })
        .eq("user_id", row.user_id);
      if (dbError) throw new Error(`mise à jour du dossier : ${dbError.message}`);

      const { error: rmError } = await supabase.storage.from(SOURCE).remove([src]);
      if (rmError) throw new Error(`suppression de l'original : ${rmError.message}`);
      moved++;
    } catch (e) {
      failed++;
      console.error(`  ÉCHEC : ${e.message}`);
    }
  }
}

// Fichiers restants dans shop-images/kyc/ (dépôts abandonnés, dossiers non soumis)
const { data: leftovers, error: listError } = await supabase.storage.from(SOURCE).list("kyc", { limit: 1000 });
if (listError) {
  console.error("Liste de shop-images/kyc impossible :", listError.message);
} else {
  const remaining = (leftovers ?? []).filter((f) => f.id).map((f) => `kyc/${f.name}`);
  // Un fichier encore référencé (déplacement échoué) n'est jamais purgé
  const orphans = remaining.filter((p) => !referenced.has(p));
  console.log(`Fichiers restants dans ${SOURCE}/kyc : ${remaining.length}${remaining.length >= 1000 ? " (liste tronquée à 1000, relancer)" : ""}`);
  if (purgeOrphans && apply && orphans.length > 0) {
    const { error: purgeError } = await supabase.storage.from(SOURCE).remove(orphans);
    console.log(purgeError ? `Purge échouée : ${purgeError.message}` : `Purgés : ${orphans.length}`);
  } else if (orphans.length > 0) {
    console.log("Pour les supprimer : relancer avec --apply --purge-orphans.");
  }
}

console.log(`Terminé. Déplacés : ${moved}, échecs : ${failed}.`);
process.exit(failed > 0 ? 1 : 0);
