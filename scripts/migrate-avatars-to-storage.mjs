#!/usr/bin/env node
// Sort les photos de profil stockées en base64 (profiles.avatar_url = "data:image/...;base64,...") vers le bucket public
// `shop-images` (variable AVATAR_BUCKET pour en changer).
//
// Pour chaque profil dont avatar_url commence par "data:" :
//   1. décode l'image ;
//   2. la dépose dans shop-images/avatars/<user_id>/avatar-<empreinte>.<ext> (nom dérivé du contenu : relancer ne crée pas de doublon) ;
//   3. remplace avatar_url par l'URL publique, seulement si la valeur est toujours en base64 (un utilisateur qui
//      aurait changé sa photo entre-temps n'est pas écrasé).
// Le fichier déposé contient exactement les octets de l'image d'origine : il sert aussi de sauvegarde (la valeur
// base64 se reconstruit à partir de lui).
//
// Par défaut : simulation, rien n'est écrit. --apply pour exécuter.
// Types acceptés : ceux du bucket (jpeg, png, webp, gif, 10 Mo max). Les autres sont listés et laissés tels quels.
//
// Usage (PowerShell) :
//   $env:SUPABASE_URL = "https://<ref>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Clé service_role"
//   node scripts/migrate-avatars-to-storage.mjs            # simulation
//   node scripts/migrate-avatars-to-storage.mjs --apply    # exécution
//   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
// La clé service_role ne se met jamais dans le dépôt ni dans un .env versionné.

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

// Bucket public existant en production (ni `avatars` ni `shop-assets` n'y existent) ; dossier dédié avatars/<user_id>/
const BUCKET = process.env.AVATAR_BUCKET || "shop-images";
const MAX_BYTES = 10 * 1024 * 1024;
const PAGE = 20;
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

const apply = process.argv.includes("--apply");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

// Avec une clé anon, la RLS renvoie 0 ligne sans erreur : on refuse toute clé qui n'est pas service_role.
function keyRole(value) {
  if (value.startsWith("sb_secret_")) return "service_role";
  if (value.startsWith("sb_publishable_")) return "anon";
  try {
    return JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8")).role ?? "inconnu";
  } catch {
    return "inconnu";
  }
}
const role = keyRole(key.trim());
if (role !== "service_role") {
  console.error(`La clé fournie a le rôle « ${role} » : il faut la clé service_role (Project Settings > API Keys).`);
  process.exit(1);
}

const supabase = createClient(url, key.trim(), { auth: { persistSession: false } });
const kb = (n) => `${Math.round(n / 1024)} Ko`;

console.log(`Projet : ${new URL(url).hostname}`);
console.log(apply ? "MODE : exécution (--apply)" : "MODE : simulation (ajoutez --apply pour écrire)");

// Contrôle de cohérence : un compte qui ne voit aucun profil n'a pas les droits attendus (clé erronée, mauvais projet)
const { count: visibles, error: countError } = await supabase.from("profiles").select("id", { count: "exact", head: true });
if (countError || !visibles) {
  console.error(`Aucun profil visible avec cette clé${countError ? ` (${countError.message})` : ""} : clé ou projet incorrect.`);
  process.exit(1);
}
console.log(`Profils visibles : ${visibles}`);

// Les profils concernés : identifiants d'abord (léger), puis une image à la fois (jusqu'à plusieurs Mo chacune)
const ids = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .like("avatar_url", "data:%")
    .order("id")
    .range(from, from + 999);
  if (error) {
    console.error("Lecture de profiles impossible :", error.message);
    process.exit(1);
  }
  ids.push(...data.map((r) => r.id));
  if (data.length < 1000) break;
}
console.log(`Profils avec une photo en base64 : ${ids.length}`);

let moved = 0;
let skipped = 0;
let failed = 0;
let freed = 0;

for (let i = 0; i < ids.length; i += PAGE) {
  const batch = ids.slice(i, i + PAGE);
  const { data: rows, error } = await supabase.from("profiles").select("id, avatar_url").in("id", batch);
  if (error) {
    console.error(`Lecture du lot ${i / PAGE + 1} impossible : ${error.message}`);
    failed += batch.length;
    continue;
  }

  for (const row of rows) {
    const value = row.avatar_url ?? "";
    const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.*)$/is.exec(value);
    if (!m) {
      console.log(`${row.id}: ignoré (format « data: » non reconnu)`);
      skipped++;
      continue;
    }
    const mime = m[1].toLowerCase();
    const ext = EXTENSIONS[mime];
    const bytes = Buffer.from(m[2], "base64");
    if (!ext) {
      console.log(`${row.id}: ignoré (type ${mime} non accepté par le bucket)`);
      skipped++;
      continue;
    }
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      console.log(`${row.id}: ignoré (taille ${kb(bytes.length)} hors limites)`);
      skipped++;
      continue;
    }

    const path = `avatars/${row.id}/avatar-${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
    console.log(`${row.id}: ${mime} ${kb(bytes.length)} -> ${BUCKET}/${path}`);
    if (!apply) continue;

    try {
      const { error: upError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (upError) throw new Error(`dépôt : ${upError.message}`);

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const { data: updated, error: dbError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", row.id)
        .like("avatar_url", "data:%")
        .select("id");
      if (dbError) throw new Error(`mise à jour du profil : ${dbError.message}`);
      if (!updated || updated.length === 0) {
        console.log("  photo modifiée entre-temps : profil laissé tel quel (le fichier déposé reste dans le bucket)");
        skipped++;
        continue;
      }
      moved++;
      freed += value.length;
    } catch (e) {
      failed++;
      console.error(`  ÉCHEC : ${e.message}`);
    }
  }
}

console.log(`Terminé. Déplacés : ${moved}, ignorés : ${skipped}, échecs : ${failed}.${apply ? ` Base allégée de ${kb(freed)}.` : ""}`);
process.exit(failed > 0 ? 1 : 0);
