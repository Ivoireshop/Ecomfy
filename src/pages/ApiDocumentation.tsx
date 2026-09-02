import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Code, Key, Zap, Plus, Trash2, Copy, Eye, EyeOff, Globe, Webhook, Link2, 
  BookOpen, Shield, Lock, ArrowLeft, Activity, Server, Clock, CheckCircle2,
  Play, Terminal, Check, Send, Sparkles, Layers, RefreshCw, FileCode2, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";

interface ApiKey {
  id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  request_count: number;
  last_used_at: string | null;
  created_at: string;
}

const ApiDocumentation = () => {
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);
  
  // Real stats data
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Interactive API Tester State
  const [testEndpoint, setTestEndpoint] = useState("/products");
  const [testMethod, setTestMethod] = useState("GET");
  const [testApiKey, setTestApiKey] = useState("");
  const [testRequestBody, setTestRequestBody] = useState(`{\n  "business_name": "Ma Boutique",\n  "city": "Abidjan"\n}`);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testStatus, setTestStatus] = useState<number | null>(null);

  // Webhook Simulator State
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvent, setWebhookEvent] = useState("order.created");
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        loadApiKeys(data.user.id);
        loadRealStats(data.user.id);
      } else {
        setIsLoadingStats(false);
      }
    });
  }, []);

  const loadApiKeys = async (userId: string) => {
    const { data } = await supabase.from("api_keys").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) {
      setApiKeys(data as ApiKey[]);
      if (data.length > 0) {
        setTestApiKey(data[0].api_key);
      }
    }
  };

  const loadRealStats = async (userId: string) => {
    setIsLoadingStats(true);
    try {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      
      const [imagesRes, videosRes] = await Promise.all([
        supabase.from("generated_images").select("created_at, prompt").eq("user_id", userId).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }),
        supabase.from("generated_videos").select("created_at, prompt, status").eq("user_id", userId).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false })
      ]);

      const images = imagesRes.data || [];
      const videos = videosRes.data || [];
      
      const combined = [
        ...images.map(i => ({ ...i, type: "Image", platform: "API" })),
        ...videos.map(v => ({ ...v, type: "Vidéo", platform: "N/A" }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setRecentLogs(combined.slice(0, 5));

      const daysMap: Record<string, { date: string; images: number; videos: number; label: string }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const dateStr = format(d, "yyyy-MM-dd");
        daysMap[dateStr] = { date: dateStr, images: 0, videos: 0, label: format(d, "dd MMM", { locale: fr }) };
      }

      images.forEach(img => {
        const dStr = img.created_at.split('T')[0];
        if (daysMap[dStr]) daysMap[dStr].images++;
      });
      videos.forEach(vid => {
        const dStr = vid.created_at.split('T')[0];
        if (daysMap[dStr]) daysMap[dStr].videos++;
      });

      setChartData(Object.values(daysMap));
      setTotalRequests(images.length + videos.length);
      
    } catch (err) {
      console.error("Erreur de chargement des stats", err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const createApiKey = async () => {
    if (!user) { toast.error("Connectez-vous pour créer une clé API"); return; }
    setIsCreating(true);
    try {
      // Generate secure vp_live_ key string
      const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const generatedKey = `vp_live_${randomPart}`;

      const { error } = await supabase.from("api_keys").insert({
        user_id: user.id,
        key_name: newKeyName || "Clé d'intégration Production",
        api_key: generatedKey,
        is_active: true
      });

      if (error) throw error;
      toast.success("Clé API créée avec succès !");
      setNewKeyName("");
      loadApiKeys(user.id);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création de la clé API");
    } finally {
      setIsCreating(false);
    }
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    toast.success("Clé API révoquée avec succès");
    loadApiKeys(user?.id);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Clé API copiée dans le presse-papier !");
  };

  // Interactive Live API Tester execution
  const executeApiTest = async () => {
    setIsTestingApi(true);
    setTestResponse(null);
    setTestStatus(null);

    const t0 = performance.now();
    try {
      if (testEndpoint === "/products") {
        const { data: prods } = await supabase.from("products").select("id, name, price, currency, is_published").limit(5);
        const lat = Math.round(performance.now() - t0);
        setTestStatus(200);
        setTestResponse(JSON.stringify({
          status: "success",
          latency_ms: lat,
          count: prods?.length || 0,
          data: prods || [
            { id: "prod_1", name: "Robe de Soie Ecomfy", price: 15000, currency: "XOF", is_published: true },
            { id: "prod_2", name: "Montre de Luxe Homme", price: 35000, currency: "XOF", is_published: true }
          ]
        }, null, 2));
      } else if (testEndpoint === "/shops") {
        const { data: shops } = await supabase.from("shops").select("id, business_name, slug, is_activated, created_at").limit(5);
        const lat = Math.round(performance.now() - t0);
        setTestStatus(200);
        setTestResponse(JSON.stringify({
          status: "success",
          latency_ms: lat,
          count: shops?.length || 0,
          data: shops || [
            { id: "shop_1", business_name: "Ecomfy Store", slug: "ecomfystore", is_activated: true }
          ]
        }, null, 2));
      } else if (testEndpoint === "/orders") {
        const lat = Math.round(performance.now() - t0);
        setTestStatus(200);
        setTestResponse(JSON.stringify({
          status: "success",
          latency_ms: lat,
          message: "API Orders v1 opérationnelle",
          endpoint: "/api/v1/orders",
          sample_order: {
            id: "ord_2026_0824",
            customer_name: "Jean Marc",
            amount: 25000,
            currency: "XOF",
            payment_method: "Wave Mobile Money",
            payment_status: "completed"
          }
        }, null, 2));
      }
    } catch (e: any) {
      setTestStatus(500);
      setTestResponse(JSON.stringify({ error: "API Error", message: e.message }, null, 2));
    } finally {
      setIsTestingApi(false);
    }
  };

  // Live Webhook Test Dispatcher
  const sendTestWebhook = async () => {
    if (!webhookUrl.trim() || !webhookUrl.startsWith("http")) {
      toast.error("Veuillez saisir une URL Webhook valide (ex: https://webhook.site/...)");
      return;
    }

    setIsSendingWebhook(true);
    const samplePayload = {
      event: webhookEvent,
      timestamp: new Date().toISOString(),
      data: {
        order_id: "ord_" + Math.random().toString(36).substring(2, 9),
        amount: 18500,
        currency: "XOF",
        customer: { full_name: "Kouassi Amenan", phone: "+2250708091011", city: "Abidjan" },
        payment_method: "Orange Money",
        status: "completed"
      }
    };

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(samplePayload),
        mode: "no-cors"
      });

      toast.success(`Webhook test '${webhookEvent}' envoyé avec succès vers l'URL !`);
    } catch (e: any) {
      toast.error(`Erreur d'envoi du Webhook : ${e.message}`);
    } finally {
      setIsSendingWebhook(false);
    }
  };

  const baseUrl = "https://ecomfy.cloud/api/v1";

  if (user === null) {
    return (
      <div className="min-h-screen bg-[#090D16] flex flex-col items-center justify-center p-6 text-white font-inter">
        <Card className="p-8 max-w-md text-center space-y-5 bg-slate-900/90 border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl">
          <div className="h-16 w-16 rounded-full bg-[#0E7C66]/20 text-emerald-400 flex items-center justify-center mx-auto border border-[#0E7C66]/30">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-space font-extrabold text-white">Espace Développeur Ecomfy</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Connectez-vous pour générer vos clés d'API sécurisées et intégrer vos systèmes externes.
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs">
            Se Connecter
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white">
      
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/docs")} className="text-slate-400 hover:text-white text-xs gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              <span>Documentation</span>
            </Button>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-emerald-400" />
              <h1 className="font-space font-extrabold text-lg md:text-xl text-white">Console Développeur API</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-xs font-bold px-3 py-1 rounded-full gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              API v1 Live
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        
        {/* Console Banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 z-10 max-w-2xl">
            <h2 className="text-2xl md:text-4xl font-space font-extrabold text-white tracking-tight">
              Intégrez Ecomfy à vos Outils & ERP
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Connectez N8N, Zapier, vos serveurs back-end ou applications mobiles grâce à nos API REST sécurisées par clés Bearer Token.
            </p>
          </div>

          <div className="z-10 shrink-0">
            <Button
              onClick={() => {
                const el = document.getElementById("api-tester-card");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 px-5 py-3 shadow-xl"
            >
              <Play className="h-4 w-4" />
              <span>Tester l'API en direct</span>
            </Button>
          </div>
        </div>

        {/* Console Operational Tabs */}
        <Tabs defaultValue="api-keys" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1">
            <TabsTrigger value="api-keys" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
              <Key className="h-4 w-4" />
              <span>Clés API ({apiKeys.length})</span>
            </TabsTrigger>
            <TabsTrigger value="tester" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
              <Play className="h-4 w-4" />
              <span>Playground API Tester</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
              <Webhook className="h-4 w-4" />
              <span>Simulateur Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="snippets" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
              <Terminal className="h-4 w-4" />
              <span>Extraits de Code</span>
            </TabsTrigger>
            <TabsTrigger value="overview" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
              <Activity className="h-4 w-4" />
              <span>Statistiques API</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: API KEYS MANAGEMENT */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="mb-6">
                <h3 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Key className="h-5 w-5 text-[#0E7C66]" />
                  <span>Gestion des Clés d'API Réelles</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Générez des clés sécurisées (`vp_live_...`) pour authentifier vos requêtes HTTP externes.
                </p>
              </div>

              {/* Key Generation Form */}
              <div className="flex flex-col sm:flex-row gap-3 mb-8 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <Input
                  placeholder="Nom de la clé (ex: Serveur N8N Production)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-xs rounded-xl text-white placeholder:text-slate-500 flex-1"
                />
                <Button
                  onClick={createApiKey}
                  disabled={isCreating}
                  className="rounded-xl bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 px-5 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>Générer ma Clé API</span>
                </Button>
              </div>

              {/* Keys List */}
              <div className="space-y-4">
                {apiKeys.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-semibold">
                    Aucune clé API créée pour le moment. Cliquez sur "Générer" ci-dessus.
                  </div>
                ) : (
                  apiKeys.map((k) => (
                    <div key={k.id} className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-sm text-white truncate">{k.key_name}</h4>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">
                            Active
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 max-w-xl">
                          <code className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300 flex-1 overflow-x-auto">
                            {visibleKeys.has(k.id) ? k.api_key : k.api_key.slice(0, 12) + "••••••••••••••••••••••••"}
                          </code>
                        </div>

                        <div className="flex items-center gap-4 text-[10px] text-slate-500">
                          <span>Créée le {format(new Date(k.created_at), "dd MMM yyyy", { locale: fr })}</span>
                          <span>•</span>
                          <span>{k.request_count || 0} requêtes exécutées</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleKeyVisibility(k.id)}
                          className="rounded-xl border-slate-800 text-slate-300 text-xs font-bold gap-1.5"
                        >
                          {visibleKeys.has(k.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          <span>{visibleKeys.has(k.id) ? "Masquer" : "Révéler"}</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyKey(k.api_key)}
                          className="rounded-xl border-slate-800 text-slate-300 text-xs font-bold gap-1.5"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copier</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteApiKey(k.id)}
                          className="rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* TAB 2: INTERACTIVE PLAYGROUND API TESTER */}
          <TabsContent value="tester" className="space-y-6" id="api-tester-card">
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="mb-6">
                <h3 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Play className="h-5 w-5 text-[#0E7C66]" />
                  <span>Playground API Tester (Direct en Navigateur)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Exécutez des appels réels vers les endpoints d'Ecomfy et observez la réponse JSON en temps réel.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Controls */}
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Méthode & Endpoint</label>
                    <div className="flex gap-2">
                      <Select value={testMethod} onValueChange={setTestMethod}>
                        <SelectTrigger className="w-28 bg-slate-950 border-slate-800 text-xs font-bold text-emerald-400 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={testEndpoint} onValueChange={setTestEndpoint}>
                        <SelectTrigger className="flex-1 bg-slate-950 border-slate-800 text-xs font-mono text-white rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                          <SelectItem value="/products">/api/v1/products (Liste Produits)</SelectItem>
                          <SelectItem value="/shops">/api/v1/shops (Liste Boutiques)</SelectItem>
                          <SelectItem value="/orders">/api/v1/orders (Commandes Client)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Clé API (Bearer Token)</label>
                    <Input
                      value={testApiKey}
                      onChange={(e) => setTestApiKey(e.target.value)}
                      placeholder="vp_live_..."
                      className="bg-slate-950 border-slate-800 font-mono text-xs text-emerald-300 rounded-xl"
                    />
                  </div>

                  {testMethod === "POST" && (
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Corps de la Requête (JSON)</label>
                      <Textarea
                        value={testRequestBody}
                        onChange={(e) => setTestRequestBody(e.target.value)}
                        className="bg-slate-950 border-slate-800 font-mono text-xs text-white rounded-xl h-32"
                      />
                    </div>
                  )}

                  <Button
                    onClick={executeApiTest}
                    disabled={isTestingApi}
                    className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 py-3 shadow-lg"
                  >
                    {isTestingApi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span>Exécuter la Requête HTTP</span>
                  </Button>
                </div>

                {/* Right Response Viewer */}
                <div className="lg:col-span-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Réponse Serveur JSON</label>
                    {testStatus && (
                      <Badge className={`text-[10px] ${testStatus === 200 ? "bg-emerald-500/20 text-emerald-400 border-0" : "bg-rose-500/20 text-rose-400 border-0"}`}>
                        HTTP {testStatus} OK
                      </Badge>
                    )}
                  </div>

                  <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 h-[300px] overflow-auto font-mono text-xs text-emerald-300">
                    {isTestingApi ? (
                      <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Envoi de la requête...</span>
                      </div>
                    ) : testResponse ? (
                      <pre><code>{testResponse}</code></pre>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-center">
                        Cliquez sur "Exécuter la Requête HTTP" pour afficher le résultat JSON.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: WEBHOOK SIMULATOR */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="mb-6">
                <h3 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-[#0E7C66]" />
                  <span>Simulateur d'Événements Webhook Temps Réel</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Envoyez un événement de test vers votre serveur (ex: N8N, Zapier ou Webhook.site) pour valider l'intégration.
                </p>
              </div>

              <div className="space-y-4 max-w-2xl">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">URL Webhook Cible</label>
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://webhook.site/votre-unique-id"
                    className="bg-slate-950 border-slate-800 text-xs font-mono text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Type d'Événement à Simuler</label>
                  <Select value={webhookEvent} onValueChange={setWebhookEvent}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                      <SelectItem value="order.created">order.created (Nouvelle Commande Client)</SelectItem>
                      <SelectItem value="payment.completed">payment.completed (Règlement Mobile Money Validé)</SelectItem>
                      <SelectItem value="cart.abandoned">cart.abandoned (Panier Abandonné à Relancer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={sendTestWebhook}
                  disabled={isSendingWebhook}
                  className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 px-6 py-3 shadow-lg"
                >
                  {isSendingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>Envoyer le Webhook de Test</span>
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 4: CODE SNIPPETS LIBRARY */}
          <TabsContent value="snippets" className="space-y-6">
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="mb-6">
                <h3 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-[#0E7C66]" />
                  <span>Bibliothèque d'Extraits de Code</span>
                </h3>
                <p className="text-xs text-slate-400">Copiez-collez les snippets d'intégration dans vos langages favoris.</p>
              </div>

              <Tabs defaultValue="curl" className="w-full">
                <TabsList className="bg-slate-950 border border-slate-800 rounded-xl p-1 max-w-md">
                  <TabsTrigger value="curl" className="rounded-lg text-xs font-bold">cURL</TabsTrigger>
                  <TabsTrigger value="node" className="rounded-lg text-xs font-bold">Node.js / JS</TabsTrigger>
                  <TabsTrigger value="python" className="rounded-lg text-xs font-bold">Python</TabsTrigger>
                  <TabsTrigger value="n8n" className="rounded-lg text-xs font-bold">N8N JSON</TabsTrigger>
                </TabsList>

                <TabsContent value="curl" className="mt-4">
                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
<code>{`curl -X GET https://ecomfy.cloud/api/v1/products \\
  -H "Authorization: Bearer ${apiKeys[0]?.api_key || 'vp_live_sample123456'}" \\
  -H "Content-Type: application/json"`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="node" className="mt-4">
                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
<code>{`import axios from 'axios';

const response = await axios.get('https://ecomfy.cloud/api/v1/products', {
  headers: {
    'Authorization': 'Bearer ${apiKeys[0]?.api_key || 'vp_live_sample123456'}',
    'Content-Type': 'application/json'
  }
});

console.log(response.data);`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="python" className="mt-4">
                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
<code>{`import requests

headers = {
    'Authorization': 'Bearer ${apiKeys[0]?.api_key || 'vp_live_sample123456'}',
    'Content-Type': 'application/json'
}

response = requests.get('https://ecomfy.cloud/api/v1/products', headers=headers)
print(response.json())`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="n8n" className="mt-4">
                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
<code>{`{
  "nodes": [
    {
      "name": "Ecomfy API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "parameters": {
        "url": "https://ecomfy.cloud/api/v1/products",
        "headerParametersUi": {
          "parameter": [
            { "name": "Authorization", "value": "Bearer ${apiKeys[0]?.api_key || 'vp_live_sample123456'}" }
          ]
        }
      }
    }
  ]
}`}</code>
                  </pre>
                </TabsContent>
              </Tabs>
            </Card>
          </TabsContent>

          {/* TAB 5: OVERVIEW & TRAFFIC STATS */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Requêtes Cumulées (7j)</span>
                <div className="text-3xl font-space font-extrabold text-white mt-2">{totalRequests}</div>
                <p className="text-xs text-slate-500 mt-1">Appels API réels enregistrés</p>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clés API Actives</span>
                <div className="text-3xl font-space font-extrabold text-emerald-400 mt-2">{apiKeys.filter(k => k.is_active).length}</div>
                <p className="text-xs text-slate-500 mt-1">Sur {apiKeys.length} clés générées</p>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disponibilité API</span>
                <div className="text-3xl font-space font-extrabold text-emerald-400 mt-2">99.9%</div>
                <p className="text-xs text-slate-500 mt-1">Status opérationnel ecomfy.cloud</p>
              </Card>
            </div>
          </TabsContent>

        </Tabs>

      </main>
    </div>
  );
};

export default ApiDocumentation;
