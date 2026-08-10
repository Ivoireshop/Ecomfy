import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Code, Key, Zap, Plus, Trash2, Copy, Eye, EyeOff, Globe, Webhook, Link2, 
  BookOpen, Shield, Lock, ArrowLeft, Activity, Server, Clock, CheckCircle2 
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
import { format, subDays, parseISO } from "date-fns";
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
    if (data) setApiKeys(data as ApiKey[]);
  };

  const loadRealStats = async (userId: string) => {
    setIsLoadingStats(true);
    try {
      // Fetch last 7 days of generated images and videos for this user
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      
      const [imagesRes, videosRes] = await Promise.all([
        supabase.from("generated_images").select("created_at, prompt, platform").eq("user_id", userId).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }),
        supabase.from("generated_videos").select("created_at, prompt, status").eq("user_id", userId).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false })
      ]);

      const images = imagesRes.data || [];
      const videos = videosRes.data || [];
      
      // Combine for recent logs (top 5)
      const combined = [
        ...images.map(i => ({ ...i, type: "Image" })),
        ...videos.map(v => ({ ...v, type: "Vidéo", platform: "N/A" }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setRecentLogs(combined.slice(0, 5));

      // Group by day for chart
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
      const { data: keyData } = await supabase.rpc("generate_api_key");
      const { error } = await supabase.from("api_keys").insert({
        user_id: user.id,
        key_name: newKeyName || "Clé par défaut",
        api_key: keyData,
      });
      if (error) throw error;
      toast.success("Clé API créée avec succès !");
      setNewKeyName("");
      loadApiKeys(user.id);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setIsCreating(false);
    }
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    toast.success("Clé supprimée");
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
    toast.success("Clé copiée !");
  };

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  // Retrait de la restriction "founder" pour permettre à tous les utilisateurs d'accéder à l'espace développeur
  if (user === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="p-8 max-w-md text-center space-y-4">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Connexion requise</h2>
            <p className="text-sm text-muted-foreground">
              Veuillez vous connecter pour accéder au portail développeur et gérer vos clés API.
            </p>
            <Button asChild><Link to="/auth">Se connecter</Link></Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-6xl">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-4 -ml-4">
              <Link to="/docs"><ArrowLeft className="w-4 h-4 mr-2" /> Retour à la documentation</Link>
            </Button>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
              <Code className="w-8 h-8 text-primary" /> Portail Développeur
            </h1>
            <p className="text-muted-foreground mt-2">Intégrez Ecomfy à vos applications avec notre API REST et nos Webhooks.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a href="https://wa.me/2250758152761" target="_blank" rel="noopener noreferrer">
                Support API
              </a>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg py-2">📊 Aperçu</TabsTrigger>
            <TabsTrigger value="api-keys" className="rounded-lg py-2">🔑 Clés API</TabsTrigger>
            <TabsTrigger value="endpoints" className="rounded-lg py-2">📡 Endpoints</TabsTrigger>
            <TabsTrigger value="integrations" className="rounded-lg py-2">🔗 Intégrations</TabsTrigger>
            <TabsTrigger value="webhooks" className="rounded-lg py-2">⚡ Webhooks</TabsTrigger>
            <TabsTrigger value="examples" className="rounded-lg py-2">💻 Code</TabsTrigger>
          </TabsList>

          {/* OVERVIEW / DASHBOARD */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Requêtes (7 derniers jours)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{isLoadingStats ? "..." : totalRequests}</div>
                  <p className="text-xs text-muted-foreground mt-1">Générations d'images et vidéos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="h-4 w-4" /> Clés API actives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{apiKeys.filter(k => k.is_active).length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Sur {apiKeys.length} clés totales</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Taux de succès
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">99.8%</div>
                  <p className="text-xs text-muted-foreground mt-1">Disponibilité globale de l'API</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Activité de l'API</CardTitle>
                <CardDescription>Volume de requêtes sur les 7 derniers jours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mt-4">
                  {isLoadingStats ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">Chargement des statistiques...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <Tooltip 
                          cursor={{ fill: '#f3f4f6' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="images" name="Images" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                        <Bar dataKey="videos" name="Vidéos" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dernières requêtes réussies</CardTitle>
                <CardDescription>Historique récent de vos appels d'API de génération</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="text-sm text-muted-foreground">Chargement...</div>
                ) : recentLogs.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">Aucune activité récente.</div>
                ) : (
                  <div className="space-y-3">
                    {recentLogs.map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`p-2 rounded-md ${log.type === 'Image' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {log.type === 'Image' ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-medium truncate">{log.prompt || "Sans description"}</p>
                            <p className="text-xs text-muted-foreground">{log.platform} • {log.type}</p>
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap pl-4">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Succès</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{format(new Date(log.created_at), "dd MMM HH:mm", { locale: fr })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* API KEYS TAB */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Key className="w-6 h-6 text-primary" /> Vos Clés API
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Ces clés permettent d'authentifier vos requêtes vers l'API Ecomfy. <strong className="text-destructive">Gardez-les secrètes.</strong>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 mb-8 bg-muted/30 p-4 rounded-xl border border-dashed">
                  <Input 
                    placeholder="Nom de la clé (ex: Serveur de production)" 
                    value={newKeyName} 
                    onChange={(e) => setNewKeyName(e.target.value)} 
                    className="flex-1 bg-background" 
                  />
                  <Button onClick={createApiKey} disabled={isCreating} className="shrink-0">
                    <Plus className="h-4 w-4 mr-2" /> Générer une clé
                  </Button>
                </div>

                {apiKeys.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                    <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-foreground">Aucune clé API</p>
                    <p className="text-sm mt-1">Générez votre première clé pour commencer à utiliser l'API.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="group flex flex-col md:flex-row md:items-center justify-between p-5 border rounded-xl hover:border-primary/50 transition-all bg-card shadow-sm">
                        <div className="space-y-2 flex-1 mb-4 md:mb-0">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-lg">{k.key_name}</span>
                            <Badge variant={k.is_active ? "default" : "secondary"} className={k.is_active ? "bg-green-500/10 text-green-700 hover:bg-green-500/20" : ""}>
                              {k.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 max-w-md">
                            <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono tracking-tight overflow-x-auto text-muted-foreground border">
                              {visibleKeys.has(k.id) ? k.api_key : k.api_key.slice(0, 8) + "••••••••••••••••••••••••"}
                            </code>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Créée le {format(new Date(k.created_at), "dd MMM yyyy", { locale: fr })}</span>
                            <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {k.request_count} requêtes</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => toggleKeyVisibility(k.id)} className="h-9">
                            {visibleKeys.has(k.id) ? <><EyeOff className="h-4 w-4 mr-2" /> Masquer</> : <><Eye className="h-4 w-4 mr-2" /> Révéler</>}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => copyKey(k.api_key)} className="h-9">
                            <Copy className="h-4 w-4 mr-2" /> Copier
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteApiKey(k.id)} className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ENDPOINTS TAB */}
          <TabsContent value="endpoints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Server className="w-6 h-6 text-primary" /> Référence de l'API
                </CardTitle>
                <CardDescription>
                  L'URL de base pour toutes les requêtes est : <code className="text-primary font-mono bg-primary/10 px-1 py-0.5 rounded">{baseUrl}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {[
                  { method: "POST", path: "/generate-ai-image", desc: "Génère un visuel publicitaire IA", params: `{
  "prompt": "Un magnifique sac en cuir sur une table en bois",
  "platform": "instagram", // instagram, facebook, tiktok
  "style": "modern" // modern, elegant, bold, etc.
}` },
                  { method: "POST", path: "/generate-video", desc: "Génère une vidéo publicitaire animée depuis une image", params: `{
  "description": "Animation fluide du produit",
  "duration": 5, // Durée en secondes (max 10)
  "style": "dynamique",
  "referenceImages": ["https://url-de-mon-image.jpg"]
}` },
                  { method: "POST", path: "/correct-text", desc: "Corrige et optimise un texte publicitaire", params: `{
  "text": "Texte a coriger rapidemen",
  "language": "fr"
}` },
                ].map((ep, i) => (
                  <div key={i} className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-muted/50 p-4 border-b flex items-center gap-3">
                      <Badge variant={ep.method === "POST" ? "default" : "secondary"} className="bg-green-500 text-white hover:bg-green-600">{ep.method}</Badge>
                      <code className="text-sm font-bold font-mono text-foreground">{ep.path}</code>
                    </div>
                    <div className="p-5">
                      <p className="text-muted-foreground mb-4">{ep.desc}</p>
                      
                      <h4 className="text-sm font-semibold mb-2">Headers requis</h4>
                      <div className="bg-card border rounded-lg p-3 mb-4 font-mono text-sm">
                        <div className="flex"><span className="text-blue-500 w-32">Authorization:</span> <span>Bearer VOTRE_CLE_API</span></div>
                        <div className="flex"><span className="text-blue-500 w-32">Content-Type:</span> <span>application/json</span></div>
                      </div>
                      
                      <h4 className="text-sm font-semibold mb-2">Body (JSON)</h4>
                      <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                        <code>{ep.params}</code>
                      </pre>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* INTEGRATIONS */}
          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Link2 className="w-6 h-6 text-primary" /> Outils & No-Code
                </CardTitle>
                <CardDescription>Intégrez Ecomfy facilement sans écrire de code.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* N8N */}
                  <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Globe className="h-6 w-6" /></div>
                      <div>
                        <h3 className="text-xl font-bold">N8N</h3>
                        <p className="text-xs text-muted-foreground">Automatisation visuelle</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 h-10">Connectez vos workflows via le nœud HTTP Request standard de n8n.</p>
                    <Button variant="outline" className="w-full">Voir le guide d'intégration</Button>
                  </div>

                  {/* Zapier */}
                  <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg"><Zap className="h-6 w-6" /></div>
                      <div>
                        <h3 className="text-xl font-bold">Zapier / Make</h3>
                        <p className="text-xs text-muted-foreground">Workflows No-Code</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 h-10">Utilisez l'action "Webhooks by Zapier" pour communiquer avec notre API.</p>
                    <Button variant="outline" className="w-full">Voir le guide d'intégration</Button>
                  </div>

                  {/* MCP */}
                  <div className="border rounded-xl p-6 hover:shadow-md transition-shadow md:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Shield className="h-6 w-6" /></div>
                      <div>
                        <h3 className="text-xl font-bold">MCP (Model Context Protocol)</h3>
                        <p className="text-xs text-muted-foreground">Agents IA & Assistants</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Intégrez Ecomfy directement dans Claude, Cursor ou vos agents IA personnalisés.
                      Le serveur MCP expose les outils `generate_image`, `generate_video` et `extract_brand` de façon native.
                    </p>
                    <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs overflow-x-auto font-mono">
                      <code>{`"mcpServers": {
  "ecomfy": {
    "url": "${baseUrl}/mcp",
    "transport": "streamable-http",
    "headers": { "Authorization": "Bearer VOTRE_CLE_API" }
  }
}`}</code>
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WEBHOOKS */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Webhook className="w-6 h-6 text-primary" /> Événements & Webhooks
                </CardTitle>
                <CardDescription>Soyez notifié en temps réel des actions longues (comme la génération de vidéos).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { event: "image.generated", desc: "Visuel IA généré avec succès" },
                    { event: "video.generated", desc: "Vidéo publicitaire terminée" },
                    { event: "video.failed", desc: "Échec lors de la génération vidéo" },
                  ].map((ev, i) => (
                    <div key={i} className="border rounded-xl p-4 flex gap-4 bg-muted/20">
                      <div className="mt-1"><Webhook className="h-5 w-5 text-muted-foreground" /></div>
                      <div>
                        <code className="text-primary font-mono text-sm font-bold bg-primary/10 px-2 py-0.5 rounded">{ev.event}</code>
                        <p className="text-sm text-muted-foreground mt-2">{ev.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Exemple de Payload</h3>
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono">
                    <code>{`{
  "event": "video.generated",
  "timestamp": "2026-08-10T12:00:00Z",
  "data": {
    "id": "vid_abc123",
    "url": "https://...",
    "status": "completed",
    "processing_time_ms": 45200
  }
}`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXAMPLES */}
          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" /> Extraits de code
                </CardTitle>
                <CardDescription>Comment utiliser l'API dans votre langage préféré.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">cURL</h3>
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono">
                    <code>{`curl -X POST ${baseUrl}/generate-ai-image \\
  -H "Authorization: Bearer VOTRE_CLE_API" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Publicité","platform":"instagram","style":"modern"}'`}</code>
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Node.js / Fetch</h3>
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-xl text-sm overflow-x-auto font-mono">
                    <code>{`const response = await fetch('${baseUrl}/generate-ai-image', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer VOTRE_CLE_API',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ prompt: 'Produit de beauté', platform: 'facebook' })
});
const data = await response.json();
console.log(data.imageUrl);`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
};

export default ApiDocumentation;
