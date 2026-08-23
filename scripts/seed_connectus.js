/**
 * Script de Seed (Peuplement de la Base de Données) pour ConnectUs (Connect As)
 * Génère un volume important de publications de démonstration (100+ posts)
 * avec des utilisateurs fictifs, images HD, vidéos courtes (10-15s F1, Football, Tech, Docs),
 * likes et commentaires pré-existants.
 *
 * Utilisation : npm run seed:connectus
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

console.log(`🔗 Connexion Supabase URL: ${SUPABASE_URL}`);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FICTIVE_USERS = [
  {
    id: "user-seed-1",
    full_name: "Oumar Fofana",
    username: "oumar_fofana",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    bio: "Passionné de Formule 1 & Mécanique de précision 🏎️🏁"
  },
  {
    id: "user-seed-2",
    full_name: "Fatou Traoré",
    username: "fatou_sports",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    bio: "Analyste Football & Sport Africain ⚽🏆"
  },
  {
    id: "user-seed-3",
    full_name: "Dr. Ousmane Diop",
    username: "ousmane_ai",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
    bio: "Chercheur IA & Fondateur Tech Hub 💡🤖"
  },
  {
    id: "user-seed-4",
    full_name: "Aïcha Bamba",
    username: "aicha_fashion",
    avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
    bio: "Mode & E-Commerce Ecomfy 👗✨"
  },
  {
    id: "user-seed-5",
    full_name: "Koffi N'Guessan",
    username: "koffi_docs",
    avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
    bio: "Réalisateur de documentaires courts & Voyageur 🎥🌍"
  }
];

const SAMPLE_POST_CONTENTS = [
  "🏎️ **QUALIFICATIONS F1** : Un tour d'anthologie sur le circuit de Monaco ! Quel pilotage incroyable dans le virage de la Rascasse. Votre pronostic pour la course ?",
  "⚽ **DÉMONSTRATION FOOTBALL** : Enchaînement drible-crochet parfait ! La précision de cette passe décisive est tout simplement magistrale 🏆🔥",
  "🤖 **TECH & IA** : L'automatisation IA révolutionne la gestion de stock et du service client WhatsApp pour nos boutiques Ecomfy ce mois-ci !",
  "📚 **DOCUMENTAIRE COURT (15s)** : Histoire et origines des textiles traditionnels tissés à la main en Afrique de l'Ouest 🌍✨",
  "🚀 **E-COMMERCE GROWTH** : Comment nous avons dépassé les 500 commandes hebdomadaires grâce aux fiches produits interactives !",
  "✨ **LIFESTYLE & DESIGN** : Nouveau studio photo prêt pour le lancement des collections de la saison. Qu'en pensez-vous ?"
];

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80"
];

const SHORT_VIDEOS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
];

async function seedConnectUsData() {
  console.log("🌱 [SEED CONNECTUS] Début du peuplement de la base de données...");

  const totalPostsToGenerate = 100;
  let insertedCount = 0;

  for (let i = 0; i < totalPostsToGenerate; i++) {
    const user = FICTIVE_USERS[i % FICTIVE_USERS.length];
    const content = SAMPLE_POST_CONTENTS[i % SAMPLE_POST_CONTENTS.length];
    const hasImage = i % 2 === 0;
    const hasVideo = i % 4 === 1;

    const postPayload = {
      connectus_type: "post",
      id: `seed-post-${Date.now()}-${i}`,
      user_id: user.id,
      author: user,
      content: `${content} (Publication de démonstration #${i + 1})`,
      media_urls: hasImage ? [SAMPLE_IMAGES[i % SAMPLE_IMAGES.length]] : [],
      video_url: hasVideo ? SHORT_VIDEOS[i % SHORT_VIDEOS.length] : null,
      visibility: "public",
      likes_count: Math.floor(Math.random() * 250) + 10,
      comments_count: Math.floor(Math.random() * 45) + 2,
      shares_count: Math.floor(Math.random() * 30) + 1,
      created_at: new Date(Date.now() - (i * 1800000)).toISOString()
    };

    try {
      const { error } = await supabase.from("community_messages").insert([
        {
          user_id: "00000000-0000-0000-0000-000000000000",
          body: JSON.stringify(postPayload)
        }
      ]);
      if (error) {
        if (i === 0) console.warn("Supabase insert error details:", error);
      } else {
        insertedCount++;
      }
    } catch (e) {
      console.warn("Erreur insertion seed post:", e);
    }
  }

  console.log(`✅ [SEED CONNECTUS] Terminé ! ${insertedCount} / ${totalPostsToGenerate} publications festives créées.`);
}

seedConnectUsData();
