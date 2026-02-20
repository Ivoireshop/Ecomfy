import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Key, Zap, Plus, Trash2, Copy, Eye, EyeOff, Globe, Webhook, Link2, BookOpen, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadApiKeys();
    });
  }, []);

  const loadApiKeys = async () => {
    const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
    if (data) setApiKeys(data as ApiKey[]);
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
      loadApiKeys();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setIsCreating(false);
    }
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    toast.success("Clé supprimée");
    loadApiKeys();
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="text-center mb-12">
          <Code className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Documentation API VisualPro</h1>
          <p className="text-muted-foreground text-lg">Intégrez la puissance de l'IA visuelle dans vos applications</p>
        </div>

        <Tabs defaultValue="api-keys" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
            <TabsTrigger value="api-keys">🔑 Clés API</TabsTrigger>
            <TabsTrigger value="getting-started">🚀 Démarrage</TabsTrigger>
            <TabsTrigger value="endpoints">📡 Endpoints</TabsTrigger>
            <TabsTrigger value="integrations">🔗 Intégrations</TabsTrigger>
            <TabsTrigger value="webhooks">⚡ Webhooks</TabsTrigger>
            <TabsTrigger value="examples">💻 Exemples</TabsTrigger>
          </TabsList>

          {/* API KEYS TAB */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Key className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-bold">Vos Clés API</h2>
                <Badge variant="secondary">Gratuit</Badge>
              </div>
              <p className="text-muted-foreground mb-6">Créez et gérez vos clés API pour accéder aux services VisualPro depuis vos applications.</p>

              {user ? (
                <>
                  <div className="flex gap-3 mb-6">
                    <Input placeholder="Nom de la clé (ex: Mon App)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="max-w-xs" />
                    <Button onClick={createApiKey} disabled={isCreating}>
                      <Plus className="h-4 w-4 mr-2" /> Créer une clé
                    </Button>
                  </div>

                  {apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Aucune clé API créée. Créez votre première clé pour commencer.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apiKeys.map((k) => (
                        <div key={k.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{k.key_name}</span>
                              <Badge variant={k.is_active ? "default" : "secondary"}>{k.is_active ? "Active" : "Inactive"}</Badge>
                            </div>
                            <code className="text-sm text-muted-foreground">{visibleKeys.has(k.id) ? k.api_key : k.api_key.slice(0, 8) + "••••••••••••••••"}</code>
                            <p className="text-xs text-muted-foreground">{k.request_count} requêtes • Créée le {new Date(k.created_at).toLocaleDateString("fr")}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => toggleKeyVisibility(k.id)}>{visibleKeys.has(k.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                            <Button variant="ghost" size="icon" onClick={() => copyKey(k.api_key)}><Copy className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteApiKey(k.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Connectez-vous pour créer et gérer vos clés API.</p>
                  <Button onClick={() => (window.location.href = "/auth")}>Se connecter</Button>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* GETTING STARTED */}
          <TabsContent value="getting-started" className="space-y-6">
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-4">Premiers pas avec l'API VisualPro</h2>
              <p className="text-muted-foreground mb-6">L'API VisualPro vous permet de générer des visuels publicitaires et des vidéos depuis vos applications. Disponible pour tous les utilisateurs, y compris le plan gratuit.</p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">1. Créez une clé API</h3>
                  <p className="text-muted-foreground">Rendez-vous dans l'onglet "Clés API" ci-dessus pour générer votre première clé.</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">2. URL de base</h3>
                  <code className="block bg-muted p-4 rounded-lg text-sm">{baseUrl}</code>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">3. Authentification</h3>
                  <code className="block bg-muted p-4 rounded-lg text-sm overflow-x-auto">{`Authorization: Bearer VOTRE_CLE_API`}</code>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">4. Limites</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>Plan Gratuit : 100 requêtes/jour</li>
                    <li>Plan Pro : 1 000 requêtes/jour</li>
                    <li>Plan Business : 10 000 requêtes/jour</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ENDPOINTS */}
          <TabsContent value="endpoints" className="space-y-6">
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-6">Endpoints disponibles</h2>
              <div className="space-y-8">
                {[
                  { method: "POST", path: "/generate-ai-image", desc: "Génère un visuel publicitaire IA", params: `{ "prompt": "string", "platform": "instagram|facebook|tiktok", "style": "modern|elegant|bold" }` },
                  { method: "POST", path: "/generate-video", desc: "Génère une vidéo publicitaire (5-15s)", params: `{ "description": "string", "duration": 10, "style": "moderne|luxueux|dynamique", "referenceImages": ["url1"] }` },
                  { method: "POST", path: "/generate-ad-visual", desc: "Génère un visuel pub avec template", params: `{ "productName": "string", "niche": "string", "platform": "string" }` },
                  { method: "POST", path: "/extract-brand", desc: "Extrait l'identité visuelle d'une marque", params: `{ "imageUrl": "string" }` },
                  { method: "POST", path: "/correct-text", desc: "Corrige le texte publicitaire", params: `{ "text": "string", "language": "fr" }` },
                ].map((ep, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={ep.method === "POST" ? "default" : "secondary"} className="bg-green-500/20 text-green-700">{ep.method}</Badge>
                      <code className="text-lg font-mono">{ep.path}</code>
                    </div>
                    <p className="text-muted-foreground mb-3">{ep.desc}</p>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{ep.params}</code></pre>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* INTEGRATIONS */}
          <TabsContent value="integrations" className="space-y-6">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Link2 className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-bold">Intégrations</h2>
              </div>

              <div className="space-y-8">
                {/* N8N */}
                <div className="border rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Globe className="h-6 w-6 text-orange-500" />
                    <h3 className="text-xl font-bold">N8N</h3>
                    <Badge variant="secondary">Workflow Automation</Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">Automatisez la génération de visuels avec N8N en utilisant le nœud HTTP Request.</p>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{`// Configuration N8N - HTTP Request Node
{
  "method": "POST",
  "url": "${baseUrl}/generate-ai-image",
  "headers": {
    "Authorization": "Bearer {{ $credentials.visualProApiKey }}",
    "Content-Type": "application/json"
  },
  "body": {
    "prompt": "{{ $json.description }}",
    "platform": "instagram",
    "style": "modern"
  }
}`}</code></pre>
                </div>

                {/* MCP */}
                <div className="border rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="h-6 w-6 text-blue-500" />
                    <h3 className="text-xl font-bold">MCP (Model Context Protocol)</h3>
                    <Badge variant="secondary">AI Integration</Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">Connectez VisualPro comme serveur MCP pour permettre aux assistants IA de générer des visuels.</p>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{`// Configuration MCP Server
{
  "mcpServers": {
    "visualpro": {
      "url": "${baseUrl}/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer VOTRE_CLE_API"
      }
    }
  }
}

// Outils MCP disponibles :
// - generate_image: Génère un visuel publicitaire
// - generate_video: Crée une vidéo publicitaire
// - extract_brand: Analyse l'identité de marque`}</code></pre>
                </div>

                {/* Zapier */}
                <div className="border rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Zap className="h-6 w-6 text-yellow-500" />
                    <h3 className="text-xl font-bold">Zapier / Make</h3>
                    <Badge variant="secondary">No-Code</Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">Utilisez les webhooks VisualPro avec Zapier ou Make pour créer des automatisations sans code.</p>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Créez un Zap avec un déclencheur (ex: nouveau fichier Google Drive)</li>
                    <li>Ajoutez une action "Webhooks by Zapier" → "POST"</li>
                    <li>URL : <code className="bg-muted px-2 py-1 rounded">{baseUrl}/generate-ai-image</code></li>
                    <li>Headers : <code className="bg-muted px-2 py-1 rounded">Authorization: Bearer VOTRE_CLE_API</code></li>
                    <li>Body : JSON avec votre prompt et paramètres</li>
                  </ol>
                </div>

                {/* WordPress */}
                <div className="border rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <BookOpen className="h-6 w-6 text-indigo-500" />
                    <h3 className="text-xl font-bold">WordPress / WooCommerce</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">Générez automatiquement des visuels pour vos produits WooCommerce.</p>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{`// functions.php - Hook WooCommerce
add_action('woocommerce_new_product', function($product_id) {
  $product = wc_get_product($product_id);
  
  $response = wp_remote_post('${baseUrl}/generate-ai-image', [
    'headers' => [
      'Authorization' => 'Bearer ' . VISUALPRO_API_KEY,
      'Content-Type' => 'application/json',
    ],
    'body' => json_encode([
      'prompt' => $product->get_name() . ' - ' . $product->get_short_description(),
      'platform' => 'facebook',
      'style' => 'modern',
    ]),
  ]);
});`}</code></pre>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* WEBHOOKS */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Webhook className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-bold">Webhooks</h2>
              </div>
              <p className="text-muted-foreground mb-6">Recevez des notifications en temps réel lorsque vos générations sont terminées.</p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3">Événements disponibles</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { event: "image.generated", desc: "Un visuel a été généré avec succès" },
                      { event: "video.generated", desc: "Une vidéo publicitaire est prête" },
                      { event: "video.failed", desc: "La génération de vidéo a échoué" },
                      { event: "credits.low", desc: "Vos crédits sont presque épuisés" },
                    ].map((ev, i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <code className="text-primary font-mono text-sm">{ev.event}</code>
                        <p className="text-sm text-muted-foreground mt-1">{ev.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">Format du payload</h3>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{`{
  "event": "image.generated",
  "timestamp": "2026-02-14T12:00:00Z",
  "data": {
    "id": "uuid",
    "url": "https://...",
    "prompt": "Description du visuel",
    "platform": "instagram",
    "processing_time_ms": 3200
  }
}`}</code></pre>
                </div>

                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                  <p className="text-sm"><strong>🔒 Sécurité :</strong> Chaque webhook inclut un header <code>X-VisualPro-Signature</code> que vous pouvez vérifier avec votre clé secrète.</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* EXAMPLES */}
          <TabsContent value="examples" className="space-y-6">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-bold">Exemples de code</h2>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold mb-3">JavaScript / Node.js</h3>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`const response = await fetch('${baseUrl}/generate-ai-image', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer VOTRE_CLE_API',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'Publicité moderne pour smartphone premium',
    platform: 'instagram',
    style: 'modern'
  })
});

const result = await response.json();
console.log('Image:', result.imageUrl);`}</code></pre>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">Python</h3>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`import requests

response = requests.post(
    '${baseUrl}/generate-ai-image',
    headers={
        'Authorization': 'Bearer VOTRE_CLE_API',
        'Content-Type': 'application/json'
    },
    json={
        'prompt': 'Publicité pour cosmétique africaine',
        'platform': 'facebook',
        'style': 'elegant'
    }
)

print(response.json()['imageUrl'])`}</code></pre>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">cURL</h3>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`curl -X POST ${baseUrl}/generate-ai-image \\
  -H "Authorization: Bearer VOTRE_CLE_API" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Visuel pub mode africaine","platform":"tiktok","style":"bold"}'`}</code></pre>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">PHP</h3>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`$response = file_get_contents('${baseUrl}/generate-ai-image', false, 
  stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => "Authorization: Bearer VOTRE_CLE_API\\r\\nContent-Type: application/json",
      'content' => json_encode([
        'prompt' => 'Publicité restaurant africain',
        'platform' => 'instagram',
        'style' => 'modern'
      ])
    ]
  ])
);

$result = json_decode($response, true);
echo $result['imageUrl'];`}</code></pre>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="p-8 mt-8 bg-primary/5">
          <h2 className="text-2xl font-bold mb-4">Besoin d'aide ?</h2>
          <p className="text-muted-foreground mb-4">Notre équipe est disponible pour vous aider avec l'intégration de l'API.</p>
          <div className="space-y-2">
            <p>📧 Email : api@visualpro.africa</p>
            <p>💬 WhatsApp : <a href="https://wa.me/2250758152761" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">+225 07 58 15 27 61</a></p>
            <p>📚 Clés API : Rendez-vous dans <strong>Paramètres → Espace Développeur</strong> pour gérer vos clés API.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ApiDocumentation;
