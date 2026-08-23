/**
 * Script Étape 0 & Étape 1 : Sauvegarde Complète et Audit d'Identification Fictif vs Réel
 * 
 * 1. Exécute une sauvegarde complète de community_messages, profiles, et shops dans scratch/connectus_backup_full.json.
 * 2. Analyse et catégorise l'ensemble des comptes et des publications (Fictif vs Réel vs Ambigu).
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
console.log("  ÉTAPE 0 — SAUVEGARDE COMPLÈTE & ÉTAPE 1 — IDENTIFICATION FICTIF / RÉEL  ");
console.log("=========================================================================");
console.log(`📌 Supabase URL: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runBackupAndAudit() {
  // ------------------------------------------------------------------------
  // ÉTAPE 0 : SAUVEGARDE COMPLÈTE
  // ------------------------------------------------------------------------
  console.log("\n💾 [ÉTAPE 0] Exportation et Sauvegarde des Tables Supabase...");

  const backupData = {
    timestamp: new Date().toISOString(),
    tables: {
      community_messages: [],
      profiles: [],
      shops: []
    }
  };

  try {
    const { data: messages } = await supabase.from("community_messages").select("*");
    backupData.tables.community_messages = messages || [];
  } catch (e) {
    console.warn("⚠️ Warning fetching community_messages:", e);
  }

  try {
    const { data: profiles } = await supabase.from("profiles").select("*");
    backupData.tables.profiles = profiles || [];
  } catch (e) {
    console.warn("⚠️ Warning fetching profiles:", e);
  }

  try {
    const { data: shops } = await supabase.from("shops").select("*");
    backupData.tables.shops = shops || [];
  } catch (e) {
    console.warn("⚠️ Warning fetching shops:", e);
  }

  const backupDir = path.resolve(process.cwd(), "scratch");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, "connectus_backup_full.json");
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), "utf-8");

  console.log(`✅ SAUVEGARDE RÉUSSIE !`);
  console.log(`📁 Fichier de sauvegarde sauvegardé dans : ${backupFilePath}`);
  console.log(`   - Messages/Posts sauvegardés : ${backupData.tables.community_messages.length}`);
  console.log(`   - Profils utilisateurs sauvegardés : ${backupData.tables.profiles.length}`);
  console.log(`   - Boutiques sauvegardées : ${backupData.tables.shops.length}\n`);

  // ------------------------------------------------------------------------
  // ÉTAPE 1 : IDENTIFICATION PRECISE (FICTIF VS RÉEL VS AMBIGU)
  // ------------------------------------------------------------------------
  console.log("🔍 [ÉTAPE 1] Analyse & Catégorisation des Comptes et Publications...");

  const allMessages = backupData.tables.community_messages;
  const allProfiles = backupData.tables.profiles;

  const fictivePosts = [];
  const realPosts = [];
  const ambiguousPosts = [];

  const fictiveAccountsMap = new Map();
  const realAccountsMap = new Map();
  const ambiguousAccountsMap = new Map();

  allMessages.forEach((msg) => {
    let parsed = null;
    try {
      parsed = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
    } catch (e) {
      parsed = { content: msg.body };
    }

    const msgId = String(msg.id || "");
    const authorName = parsed?.author?.full_name || parsed?.author?.username || parsed?.authorName || `User ID: ${msg.user_id}`;
    const authorId = parsed?.author?.id || parsed?.author?.user_id || msg.user_id || "inconnu";
    const isSeedId = msgId.startsWith("seed-post-") || msgId.startsWith("demo-post-");
    const isDemoUser = String(authorId).startsWith("demo-user-") || String(authorId).startsWith("user-seed-");

    const postInfo = {
      id: msgId,
      user_id: msg.user_id,
      authorName,
      created_at: msg.created_at,
      contentSnippet: String(parsed?.content || parsed?.text || msg.body || "").slice(0, 80)
    };

    if (isSeedId || isDemoUser) {
      fictivePosts.push(postInfo);
      fictiveAccountsMap.set(authorId, { id: authorId, name: authorName });
    } else {
      // Vérification si le compte est clairement réel (ex: Ulrich Djaté/Yapi/Japi/Diaté, Connect As, ou email valide)
      const nameLower = authorName.toLowerCase();
      if (
        nameLower.includes("ulrich") ||
        nameLower.includes("japi") ||
        nameLower.includes("yapi") ||
        nameLower.includes("djaté") ||
        nameLower.includes("diaté") ||
        nameLower.includes("connect")
      ) {
        realPosts.push(postInfo);
        realAccountsMap.set(authorId, { id: authorId, name: authorName });
      } else {
        // En cas de doute, placer en ambigu !
        ambiguousPosts.push(postInfo);
        ambiguousAccountsMap.set(authorId, { id: authorId, name: authorName });
      }
    }
  });

  console.log("\n---------------------------------------------------------");
  console.log("📊 BILAN D'IDENTIFICATION ÉTAPE 1 :");
  console.log("---------------------------------------------------------");
  console.log(`🤖 Publications Fictives Identifiées (Seed/Démo) : ${fictivePosts.length}`);
  console.log(`👤 Publications Réelles Identifiées (Ulrich Djaté, Connect As, etc.) : ${realPosts.length}`);
  console.log(`❓ Publications Ambigües (À vérifier manuellement) : ${ambiguousPosts.length}`);

  console.log(`\n📋 Détail des Comptes Fictifs (${fictiveAccountsMap.size}) :`);
  fictiveAccountsMap.forEach((acc) => {
    console.log(`   • ${acc.name} (ID: ${acc.id})`);
  });

  console.log(`\n👑 Détail des Comptes Réels Validés (${realAccountsMap.size}) :`);
  realAccountsMap.forEach((acc) => {
    console.log(`   • ${acc.name} (ID: ${acc.id})`);
  });

  if (ambiguousAccountsMap.size > 0) {
    console.log(`\n❓ Détail des Comptes Ambigus à Valider (${ambiguousAccountsMap.size}) :`);
    ambiguousAccountsMap.forEach((acc) => {
      console.log(`   • ${acc.name} (ID: ${acc.id})`);
    });
  }
}

runBackupAndAudit();
