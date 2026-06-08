---
name: AI Daily Quota
description: Toute requête IA (optimiseur produit, génération image/vidéo, expert comptable, etc.) limitée à 2/jour/utilisateur
type: feature
---
Limite globale plateforme : **2 requêtes IA par jour par utilisateur connecté**.

- Compteur centralisé : table `public.ai_daily_usage` + RPC `public.consume_ai_quota(_user_id, _feature, _limit=2)`.
- Helper edge function : `supabase/functions/_shared/ai-quota.ts` (`enforceAiQuota`).
- Appelé en tête de toutes les fonctions IA owner-facing :
  product-ai-optimizer, generate-product-sheet, generate-ai-image, generate-feature-image,
  generate-ad-visual, generate-shop-content, generate-showcase-site, generate-video,
  create-video-from-image, generate-voiceover, correct-text, extract-brand,
  finance-advisor, translate-product.
- Quand dépassé : HTTP 200 + `{ success:false, error:"daily_quota_exceeded", message, resets_at }`.
- Fondateurs / co-fondateurs (`user_roles`) exemptés.
- Reset à 00h UTC.
- Les chatbots visiteurs publics (shop-chatbot, shop-ai-assistant-*, showcase-chat) ne sont PAS soumis à cette limite.