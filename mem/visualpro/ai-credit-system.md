---
name: AI Credit System
description: Free trial + paid credit deduction model for AI features (optimizer, voice, product sheet, images)
type: feature
---
Packs (FCFA → credits): 2 000=20, 2 500=30, 3 000=40.

Deduction per use:
- Product sheet generation (`generate-product-sheet`): 1.5 credit
- Optimizer IA (`product-ai-optimizer`): 1.5 credit
- Voice assistant TTS (`shop-ai-assistant-tts`): 2 credits per message (charged to shop owner)
- Image generation: 1 credit (legacy `free_generations_remaining` for free trial)

Free trial = 1 free attempt per feature, tracked on `profiles`:
`free_optimizer_used`, `free_voice_used`, `free_product_sheet_used` (booleans, default false).

Centralised via SQL function `public.consume_ai_credit(_user_id, _feature, _amount)`:
1. Founder / co-founder → exempt
2. Active subscription → unlimited
3. Free trial flag for the feature still false → flip true, allow
4. Else deduct `_amount` from `profiles.purchased_credits` (numeric(10,2))
5. If insufficient → `{ success:false, error:'credits_required' }`

Edge fn helpers: `consumeAiCredit`, `consumeShopOwnerCredit`, `creditsRequiredResponse` in `supabase/functions/_shared/credits-gate.ts`.

Frontend: edge functions returning `{ error:'credits_required' }` are caught with `handleCreditsRequired()` from `src/lib/creditsDialog.ts`, which shows a sonner toast with an "Acheter du crédit" action that dispatches `open-credits-dialog`. The `AICreditsBadge` listens for that event and opens the purchase dialog.