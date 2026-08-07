import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { 
  Loader2, Save, Sparkles, Volume2, Lock, 
  Package, Layers, Type, Check, Bot, Languages, MessageSquare, Settings2
} from "lucide-react";

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
  { value: "auto", label: "Auto (détection du visiteur)" },
  { value: "fr", label: "Français uniquement" },
  { value: "en", label: "English only" },
  { value: "es", label: "Español seulement" },
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
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header & Status Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-card border shadow-sm p-6 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0 mt-1 md:mt-0">
            <Sparkles className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Assistant IA Vocal</h2>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base leading-relaxed">
              Un agent intelligent ultra-performant pour accueillir vos visiteurs, répondre à leurs questions vocalement, et stimuler vos ventes.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <label className="flex items-center gap-3 px-5 py-2.5 bg-muted/30 border rounded-full shadow-sm cursor-pointer hover:bg-muted/50 transition">
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
            <span className={`text-sm font-semibold ${cfg.enabled ? "text-primary" : "text-muted-foreground"}`}>
              {cfg.enabled ? "Assistant Actif" : "Désactivé"}
            </span>
          </label>
          <Button onClick={save} disabled={saving} className="gap-2 shadow-sm rounded-full px-6 flex-1 md:flex-none">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {!isActivated && (
        <div className="flex items-start gap-3 p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <Lock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">Activez votre boutique pour mettre l'assistant en ligne</p>
            <p className="text-sm text-amber-800 mt-1">Vous pouvez configurer l'assistant dès maintenant. Il deviendra visible pour vos visiteurs après l'activation de votre boutique.</p>
          </div>
        </div>
      )}

      {/* Grid Layout for settings */}
      <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left Column: Core Identity & Behavior */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Identity */}
          <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-500 rounded-lg"><Bot className="h-5 w-5" /></div>
              <h3 className="text-lg font-bold">Identité de l'agent</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Nom de l'assistant</Label>
                <Input value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} placeholder="Ex: Ramina" className="h-11" />
              </div>
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Personnalité & Ton</Label>
                <Select value={cfg.personality} onValueChange={(v) => setCfg({ ...cfg, personality: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERSONALITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Source des infos */}
          <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg"><Settings2 className="h-5 w-5" /></div>
              <div>
                <h3 className="text-lg font-bold">Source des connaissances</h3>
                <p className="text-sm text-muted-foreground mt-1">D'où l'IA tire-t-elle ses réponses ?</p>
              </div>
            </div>
            
            <div className="grid gap-3">
              {[
                { v: "auto_products", l: "Catalogue produits uniquement", d: "Recommandé si vous avez beaucoup d'articles.", icon: <Package className="h-5 w-5"/> },
                { v: "hybrid", l: "Hybride (Catalogue + Manuel)", d: "La meilleure option. Produits + vos consignes.", icon: <Layers className="h-5 w-5"/> },
                { v: "manual", l: "Saisie manuelle stricte", d: "Contrôle total, ignore les fiches produits.", icon: <Type className="h-5 w-5"/> },
              ].map(o => (
                <div 
                  key={o.v} 
                  onClick={() => setCfg({...cfg, source_mode: o.v})}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    cfg.source_mode === o.v 
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10" 
                      : "border-border/60 hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <div className={`p-2.5 rounded-lg shrink-0 ${cfg.source_mode === o.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {o.icon}
                  </div>
                  <div className="flex-1 mt-0.5">
                    <p className={`font-semibold ${cfg.source_mode === o.v ? "text-primary" : ""}`}>{o.l}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{o.d}</p>
                  </div>
                  <div className="shrink-0 mt-1">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${cfg.source_mode === o.v ? "border-primary" : "border-muted-foreground/30"}`}>
                      {cfg.source_mode === o.v && <div className="h-2.5 w-2.5 bg-primary rounded-full" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(cfg.source_mode === "manual" || cfg.source_mode === "hybrid") && (
              <div className="mt-6 space-y-2.5 animate-in fade-in slide-in-from-top-2">
                <Label className="text-sm font-semibold">Consignes personnalisées pour l'IA</Label>
                <Textarea
                  rows={5}
                  value={cfg.manual_context || ""}
                  onChange={(e) => setCfg({ ...cfg, manual_context: e.target.value })}
                  placeholder="Ex: Pousse la Crème Coco pour les peaux sèches. Livraison gratuite à Abidjan. Ton de voix très enthousiaste..."
                  className="resize-none bg-muted/20"
                />
              </div>
            )}
          </Card>
          
          {/* Comportement */}
          <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-50 text-violet-500 rounded-lg"><MessageSquare className="h-5 w-5" /></div>
              <h3 className="text-lg font-bold">Comportement & Accueil</h3>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/10">
                <div>
                  <p className="text-sm font-semibold">Ouverture automatique</p>
                  <p className="text-sm text-muted-foreground mt-0.5">La fenêtre de chat s'ouvre d'elle-même après 5s.</p>
                </div>
                <Switch checked={cfg.auto_open} onCheckedChange={(v) => setCfg({ ...cfg, auto_open: v })} />
              </div>
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Bulle d'accroche (Widget fermé)</Label>
                <Input value={cfg.welcome_bubble || ""} onChange={(e) => setCfg({ ...cfg, welcome_bubble: e.target.value })} placeholder="Ex: Besoin d'aide pour choisir ? 💬" className="h-11" />
              </div>
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Premier message (Widget ouvert)</Label>
                <Textarea
                  rows={3}
                  value={cfg.custom_greeting || ""}
                  onChange={(e) => setCfg({ ...cfg, custom_greeting: e.target.value })}
                  placeholder="Ex: Bienvenue ! Que recherchez-vous aujourd'hui ?"
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">Laissez vide pour que l'IA génère une phrase d'accueil selon sa personnalité.</p>
              </div>
            </div>
          </Card>

        </div>

        {/* Right Column: Voice & Languages */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Voix */}
          <Card className="p-6 rounded-2xl shadow-sm border-border/50 overflow-hidden relative">
            {/* Background decoration */}
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-50 text-pink-500 rounded-lg"><Volume2 className="h-5 w-5" /></div>
                <h3 className="text-lg font-bold">Voix & Audio</h3>
              </div>
              <Switch checked={cfg.voice_enabled} onCheckedChange={(v) => setCfg({ ...cfg, voice_enabled: v })} />
            </div>

            <div className={`space-y-5 transition-opacity duration-300 relative z-10 ${!cfg.voice_enabled ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Timbre vocal</Label>
                <Select value={cfg.voice_id} onValueChange={(v) => setCfg({ ...cfg, voice_id: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={previewVoice} disabled={previewing || !cfg.voice_enabled} className="w-full gap-2 h-11 bg-primary/10 text-primary hover:bg-primary/20 border-none font-semibold">
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                Écouter un extrait vocal
              </Button>
            </div>
          </Card>

          {/* Languages */}
          <Card className="p-6 rounded-2xl shadow-sm border-border/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-50 text-orange-500 rounded-lg"><Languages className="h-5 w-5" /></div>
              <div>
                <h3 className="text-lg font-bold">Multilinguisme</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Gérez les langues de l'IA</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <Label className="text-sm font-semibold block mb-3">Langues d'accroche vocale</Label>
                <div className="flex flex-wrap gap-2">
                  {GREETING_LANGS.map(l => {
                    const active = cfg.greeting_languages?.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => toggleLang(l.code)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          active 
                            ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                            : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t">
                <Label className="text-sm font-semibold">Langue principale de discussion</Label>
                <Select value={cfg.conversation_language} onValueChange={(v) => setCfg({ ...cfg, conversation_language: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONV_LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
                  En mode Auto, l'IA détecte la langue tapée/parlée par le visiteur et s'adapte instantanément.
                </p>
              </div>
            </div>
          </Card>
          
        </div>
      </div>
    </div>
  );
}

export default ShopAssistantSettings;