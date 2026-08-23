/**
 * Script d'Audit Supabase — Étape 0 & Étape 1
 * Audit complet de la base de données Supabase, RLS policies, tables et profils réels
 * (Ulrich Djaté / Diaté / Yapi / Japi, Connect As / ConnectUs, et tous les utilisateurs réels).
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function getEnvVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        const [k, ...v] = line.split("=");
        if (k && k.trim() === name) {
          return v.join("=").trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (e) {}
  return "";
}

const SUPABASE_URL = getEnvVar("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnvVar("VITE_SUPABASE_PUBLISHABLE_KEY") || getEnvVar("VITE_SUPABASE_ANON_KEY");

console.log("=========================================================================");
console.log("  AUDIT TECHNIQUE COMPLET ÉTAPE 0 & ÉTAPE 1 — SCHÉMA & POSTS RÉELS  ");
console.log("=========================================================================");
console.log(`📌 Supabase URL: ${SUPABASE_URL}`);
console.log(`📌 Key Prefix: ${SUPABASE_ANON_KEY.slice(0, 20)}...\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runFullAudit() {
  // 1. Audit Table profiles (Comptes réels inscrits)
  console.log("🔍 [1. TABLE profiles - COMPTES UTILISATEURS RÉELS]");
  const { data: profiles, error: profError } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, created_at");

  if (profError) {
    console.error("❌ Erreur lecture table profiles:", profError.message);
  } else {
    console.log(`✅ Total profils utilisateurs réels inscrits en DB : ${profiles ? profiles.length : 0}`);
    if (profiles && profiles.length > 0) {
      profiles.forEach((p, idx) => {
        console.log(`   [#${idx + 1}] ID: ${p.id} | Nom: "${p.full_name}" | Email: "${p.email}" | Inscription: ${p.created_at}`);
      });
    }
  }

  // 2. Audit Table shops (Boutiques associées aux vendeurs)
  console.log("\n🔍 [2. TABLE shops - BOUTIQUES MARCHANDS]");
  const { data: shops, error: shopError } = await supabase
    .from("shops")
    .select("id, user_id, business_name, slug, created_at");

  if (shopError) {
    console.warn("⚠️ Erreur lecture shops:", shopError.message);
  } else {
    console.log(`✅ Total boutiques trouvées : ${shops ? shops.length : 0}`);
    if (shops && shops.length > 0) {
      shops.forEach((s, idx) => {
        console.log(`   [#${idx + 1}] ID: ${s.id} | Nom: "${s.business_name}" | Slug: "${s.slug}" | User ID: ${s.user_id}`);
      });
    }
  }

  // 3. Audit Table community_messages (Messages et Posts du Fil ConnectUs)
  console.log("\n🔍 [3. TABLE community_messages - POSTS DU FIL CONNECTUS]");
  const { data: messages, error: msgError } = await supabase
    .from("community_messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("❌ Erreur lecture community_messages:", msgError.message, "| Code:", msgError.code);
  } else {
    console.log(`✅ Total messages/posts en DB (Anon Client) : ${messages ? messages.length : 0}`);
    if (messages && messages.length > 0) {
      messages.forEach((msg, idx) => {
        let parsed = null;
        try {
          parsed = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
        } catch (e) {
          parsed = { content: msg.body };
        }

        const authorName = parsed?.author?.full_name || parsed?.author?.username || parsed?.authorName || `User ID: ${msg.user_id}`;
        const content = parsed?.content || parsed?.text || (typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        const connectusType = parsed?.connectus_type || "text_raw";

        console.log(`\n   [#${idx + 1}] ID: ${msg.id}`);
        console.log(`       - User ID: ${msg.user_id}`);
        console.log(`       - Auteur déduit: "${authorName}"`);
        console.log(`       - Type: ${connectusType}`);
        console.log(`       - Date: ${msg.created_at}`);
        console.log(`       - Contenu: "${String(content).slice(0, 100)}..."`);
      });
    }
  }

  // 4. Recherche ciblée dans profiles & shops pour "Ulrich" (Djaté, Diaté, Yapi, Japi) & "Connect"
  console.log("\n🔍 [4. RECHERCHE CIBLÉE DES COMPTES ULRICH ET CONNECT AS]");
  const searchTerms = ["ulrich", "japi", "yapi", "djaté", "diaté", "connect", "djate", "diate"];
  
  if (profiles && profiles.length > 0) {
    const matchingProfiles = profiles.filter(p => {
      const name = (p.full_name || "").toLowerCase();
      const email = (p.email || "").toLowerCase();
      return searchTerms.some(term => name.includes(term) || email.includes(term));
    });
    console.log(`🎯 Profils correspondants trouvés dans 'profiles' (${matchingProfiles.length}) :`);
    matchingProfiles.forEach(p => {
      console.log(`   👉 ID: ${p.id} | Nom: "${p.full_name}" | Email: "${p.email}"`);
    });
  }

  if (shops && shops.length > 0) {
    const matchingShops = shops.filter(s => {
      const name = (s.business_name || "").toLowerCase();
      const slug = (s.slug || "").toLowerCase();
      return searchTerms.some(term => name.includes(term) || slug.includes(term));
    });
    console.log(`🎯 Boutiques correspondantes trouvées dans 'shops' (${matchingShops.length}) :`);
    matchingShops.forEach(s => {
      console.log(`   👉 ID: ${s.id} | Nom: "${s.business_name}" | Slug: "${s.slug}" | User ID: ${s.user_id}`);
    });
  }
}

runFullAudit();
