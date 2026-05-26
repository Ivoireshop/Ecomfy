# Assistant IA Vocal & Textuel pour Boutiques

## Objectif
Ajouter un assistant IA premium (vocal + texte) sur chaque fiche produit des boutiques en ligne. L'assistant accueille les visiteurs automatiquement, parle plusieurs langues (Français, Anglais, Dioula, Baoulé), et est configurable par le propriétaire de la boutique.

## Fonctionnalités clés

### 1. Configuration par le propriétaire (dans ShopEditor)
Nouvel onglet **"Assistant IA"** dans le ShopSidebar :
- **Activer/désactiver** l'assistant (réservé aux boutiques activées/payées)
- **Nom de l'assistant** (ex: "Ramina")
- **Personnalité / ton** (Amical, Professionnel, Énergique, Luxe)
- **Source des informations** :
  - ☐ Saisie manuelle (textarea : présentation, offres recommandées, best-sellers, FAQ)
  - ☑ S'inspirer automatiquement des fiches produits (par défaut)
- **Langues d'accueil multi-salutation** (cases à cocher) :
  - 🇫🇷 Français, 🇬🇧 Anglais, 🇨🇮 Dioula, 🇨🇮 Baoulé
- **Langue de conversation** :
  - Auto (laisse l'IA détecter selon le visiteur)
  - Ou langue fixe imposée
- **Voix de l'agent vocal** (preview) : Féminine douce / Féminine énergique / Masculine pro
- **Déclenchement** : Auto à l'ouverture / Au clic sur le bouton flottant
- **Message d'accueil personnalisé** (optionnel, sinon généré par IA)

### 2. Affichage sur la fiche produit (ShopView / ProductView)
- Bouton flottant premium en bas à droite (avatar animé + halo pulsant)
- Bulle d'accueil multilingue auto au bout de 2s : "Bonjour 👋 Good morning · Anni sɔrɔma · Akwaba"
- Modal/Drawer élégant à l'ouverture avec :
  - Avatar animé (pulse quand parle)
  - **Mode Vocal** : bouton micro pour parler à l'agent, l'agent répond en voix
  - **Mode Texte** : chat classique avec markdown
  - Toggle vocal/texte
  - Indicateur "en train de parler" / "en écoute"
- Design haut de gamme : glassmorphism, animations Framer Motion, gradient adapté au thème de la boutique

### 3. Backend

**Tables (migration)** :
- `shop_ai_assistants` : `shop_id`, `enabled`, `name`, `personality`, `source_mode` ('manual' | 'auto_products' | 'hybrid'), `manual_context`, `greeting_languages[]`, `conversation_language`, `voice_id`, `auto_open`, `custom_greeting`

**Edge functions** :
- `shop-ai-assistant-chat` (existante `shop-chatbot` à étendre) :
  - Charge la config + les produits de la boutique
  - Construit un system prompt riche multilingue
  - Streaming SSE via Lovable AI (`google/gemini-3-flash-preview`)
  - Détecte la langue du visiteur si "auto"
- `shop-ai-assistant-tts` : Text-to-speech via ElevenLabs (multilingual v2 supporte FR/EN, fallback texte pour Dioula/Baoulé)
- `shop-ai-assistant-stt` : Speech-to-text (Web Speech API côté client en priorité, fallback edge function si besoin)

**Sécurité** : RLS — propriétaire/collaborateurs gèrent la config, lecture publique de la config quand `enabled=true` (pour la fiche produit publique).

### 4. Tarification
- L'assistant IA vocal est **réservé aux boutiques avec activation payée** (cohérent avec la mémoire e-commerce existante)
- Si non-payée : afficher un teaser "Activez votre boutique pour débloquer l'Assistant IA Vocal"

## Détails techniques

**Stack** :
- Frontend : nouveau composant `ShopAIAssistant.tsx` (widget flottant) + `ShopAssistantSettings.tsx` (onglet config)
- TTS : ElevenLabs (clé via secret `ELEVENLABS_API_KEY` à demander si non présente) — voix recommandée : Sarah (EXAVITQu4vr4xnSDxMaL) féminine douce, multilingual_v2
- STT : Web Speech API navigateur (gratuit, instantané) avec fallback
- LLM : Lovable AI Gateway (déjà configuré, `LOVABLE_API_KEY`)
- Streaming chat : SSE pattern déjà utilisé dans `ShowcaseAIChat`

**Intégration** :
- Widget monté dans `ShopView.tsx` (page boutique) ET `ProductView.tsx` (fiche produit)
- Charge la config via une RPC publique, n'affiche rien si désactivé

**Fallback langues locales** (Dioula/Baoulé) : ElevenLabs ne supporte pas nativement, donc :
- Salutations pré-enregistrées (audio statique court) en Dioula/Baoulé
- Conversation continue en FR/EN avec TTS pleine voix

## Étapes
1. Migration DB : table `shop_ai_assistants` + RLS + RPC publique de lecture
2. Edge function `shop-ai-assistant-chat` (streaming + multilingue + contexte produits)
3. Edge function `shop-ai-assistant-tts` (ElevenLabs)
4. Composant `ShopAIAssistant.tsx` (widget flottant premium vocal+texte)
5. Composant `ShopAssistantSettings.tsx` + ajout dans `ShopSidebar` et `ShopEditor`
6. Intégration du widget dans `ShopView.tsx` et `ProductView.tsx` (conditionné à `enabled` et boutique payée)
7. Audio statique des salutations Dioula/Baoulé (upload storage)

## Question préalable
**Avez-vous une clé ElevenLabs** (pour la voix premium TTS) ? Sinon je vous guiderai pour l'obtenir avant de poursuivre. Sans voix, on peut démarrer avec la Web Speech API du navigateur (qualité standard, gratuite) et ajouter ElevenLabs ensuite.
