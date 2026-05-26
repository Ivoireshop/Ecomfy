import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Sparkles, Volume2, Lock } from "lucide-react";

interface Props { shopId: string; isActivated: boolean }

const PERSONALITIES = [
  { value: "friendly", label: "Amical & chaleureux" },
  { value: "professional", label: "Professionnel" },
  { value: "energetic", label: "Énergique" },
  { value: "luxury", label: "Luxe & raffiné" },
];

const GREETING_LANGS = [
  { code: "fr", label: "Français 🇫🇷" },
  { code: "en", label: "English 🇬🇧" },
  { code: "es", label: "Español 🇪🇸" },
  { code: "pt", label: "Português 🇵🇹" },
  { code: "ar", label: "العربية 🇸🇦" },
  { code: "dioula", label: "Dioula 🇨🇮" },
  { code: "baoule", label: "Baoulé 🇨🇮" },
];

const CONV_LANGS = [
  { value: "auto", label: "Auto (détection de la langue du visiteur)" },
  { value: "fr", label: "Français uniquement" },
  { value: "en", label: "English only" },
  { value: "es", label: "Español solamente" },
  { value: "pt", label: "Apenas Português" },
];

const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — Féminine douce" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda — Féminine claire" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura — Féminine énergique" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — Masculine pro" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam — Masculine jeune" },
];

export function ShopAssistantSettings({ shopId, isActivated }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [cfg, setCfg] = useState<any>({
    enabled: false,
    name: "Ramina",
    personality: "friendly",
    source_mode: "auto_products",
    manual_context: "",
    greeting_languages: ["fr", "en", "dioula", "baoule"],
    conversation_language: "auto",
    voice_id: "EXAVITQu4vr4xnSDxMaL",
    auto_open: true,
    custom_greeting: "",
    welcome_bubble: "",
    voice_enabled: true,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shop_ai_assistants").select("*").eq("shop_id", shopId).maybeSingle();
      if (data) setCfg(data);
      setLoading(false);
    })();
  }, [shopId]);

  const save = async () => {
    setSaving(true);
    const payload = { ...cfg, shop_id: shopId };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    const { error } = await supabase
      .from("shop_ai_assistants")
      .upsert(payload, { onConflict: "shop_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assistant enregistré", description: "Les modifications sont en ligne." });
    }
  };

  const previewVoice = async () => {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("shop-ai-assistant-tts", {
        body: {
          text: `Bonjour, je suis ${cfg.name}, votre assistante. C'est un plaisir de vous accueillir aujourd'hui.`,
          voiceId: cfg.voice_id,
        },
      });
      if (error || !data?.audioBase64) throw new Error(error?.message || "Échec");
      const audio = new Audio(`data:${data.mime || "audio/mpeg"};base64,${data.audioBase64}`);
      await audio.play();
    } catch (e: any) {
      toast({ title: "Aperçu indisponible", description: e?.message || "Réessayez", variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  const toggleLang = (code: string) => {
    setCfg((c: any) => ({
      ...c,
      greeting_languages: c.greeting_languages.includes(code)
        ? c.greeting_languages.filter((l: string) => l !== code)
        : [...c.greeting_languages, code],
    }));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Assistant IA Vocal
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Un assistant IA premium qui accueille vos visiteurs en plusieurs langues, leur parle à la voix, et les guide vers l'achat.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      {!isActivated && (
        <Card className="p-5 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Activez votre boutique pour mettre l'assistant en ligne</p>
              <p className="text-sm text-amber-800 mt-1">Vous pouvez configurer l'assistant dès maintenant. Il deviendra visible pour vos visiteurs après activation.</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Activer l'assistant</p>
            <p className="text-sm text-muted-foreground">Affiche le widget flottant sur votre boutique et vos fiches produits.</p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Nom de l'assistant</Label>
            <Input value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} placeholder="Ramina" />
          </div>
          <div>
            <Label>Personnalité</Label>
            <Select value={cfg.personality} onValueChange={(v) => setCfg({ ...cfg, personality: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONALITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <p className="font-semibold">Source des informations</p>
        <div className="space-y-3">
          {[
            { v: "auto_products", l: "S'inspirer automatiquement de mes fiches produits", d: "L'assistant lit votre catalogue et recommande vos produits." },
            { v: "manual", l: "Saisie manuelle uniquement", d: "Vous écrivez vous-même ce que l'assistant doit savoir." },
            { v: "hybrid", l: "Les deux (recommandé)", d: "Combine vos fiches produits et vos informations personnalisées." },
          ].map((o) => (
            <label key={o.v} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${cfg.source_mode === o.v ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" name="source_mode" checked={cfg.source_mode === o.v} onChange={() => setCfg({ ...cfg, source_mode: o.v })} className="mt-1" />
              <div>
                <p className="font-medium text-sm">{o.l}</p>
                <p className="text-xs text-muted-foreground">{o.d}</p>
              </div>
            </label>
          ))}
        </div>
        {(cfg.source_mode === "manual" || cfg.source_mode === "hybrid") && (
          <div>
            <Label>Informations à transmettre</Label>
            <Textarea
              rows={6}
              value={cfg.manual_context || ""}
              onChange={(e) => setCfg({ ...cfg, manual_context: e.target.value })}
              placeholder="Ex: Notre offre la plus recommandée est le Pack Découverte à 15 000 FCFA. Best-seller: la Crème Coco. Livraison gratuite à Abidjan dès 20 000 FCFA. FAQ courantes..."
            />
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <p className="font-semibold">Langues de salutation</p>
        <p className="text-sm text-muted-foreground">L'assistant saluera dans toutes les langues cochées au moment de l'accueil.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {GREETING_LANGS.map((l) => (
            <label key={l.code} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={cfg.greeting_languages?.includes(l.code)} onCheckedChange={() => toggleLang(l.code)} />
              <span className="text-sm">{l.label}</span>
            </label>
          ))}
        </div>
        <div>
          <Label>Langue de la conversation</Label>
          <Select value={cfg.conversation_language} onValueChange={(v) => setCfg({ ...cfg, conversation_language: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONV_LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">En mode Auto, l'assistant détecte la langue du visiteur et lui répond dans cette langue.</p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Voix de l'agent</p>
            <p className="text-sm text-muted-foreground">Choisissez une voix pour le mode vocal.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={cfg.voice_enabled} onCheckedChange={(v) => setCfg({ ...cfg, voice_enabled: v })} />
            <span className="text-sm">Vocal</span>
          </div>
        </div>
        {cfg.voice_enabled && (
          <div className="flex gap-2">
            <Select value={cfg.voice_id} onValueChange={(v) => setCfg({ ...cfg, voice_id: v })}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={previewVoice} disabled={previewing} className="gap-2">
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              Aperçu
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <p className="font-semibold">Comportement & accueil</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Ouverture automatique</p>
            <p className="text-xs text-muted-foreground">La fenêtre s'ouvre toute seule après quelques secondes.</p>
          </div>
          <Switch checked={cfg.auto_open} onCheckedChange={(v) => setCfg({ ...cfg, auto_open: v })} />
        </div>
        <div>
          <Label>Bulle d'accueil (visible avant ouverture)</Label>
          <Input value={cfg.welcome_bubble || ""} onChange={(e) => setCfg({ ...cfg, welcome_bubble: e.target.value })} placeholder="Ex: Besoin d'aide pour choisir ? 💬" />
        </div>
        <div>
          <Label>Message d'accueil personnalisé (optionnel)</Label>
          <Textarea
            rows={3}
            value={cfg.custom_greeting || ""}
            onChange={(e) => setCfg({ ...cfg, custom_greeting: e.target.value })}
            placeholder="Ex: Bienvenue chez Terminus Coco ! Notre best-seller est la Crème Coco. Tapez votre question 👇"
          />
          <p className="text-xs text-muted-foreground mt-1.5">Si vide, un message sera généré automatiquement.</p>
        </div>
      </Card>
    </div>
  );
}

export default ShopAssistantSettings;