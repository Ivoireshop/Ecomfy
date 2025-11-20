import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Code, Key, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ApiDocumentation = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="text-center mb-12">
          <Code className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Documentation API VisualPro
          </h1>
          <p className="text-muted-foreground text-lg">
            Intégrez la puissance de l'IA visuelle dans vos applications
          </p>
        </div>

        <Tabs defaultValue="getting-started" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="getting-started">Démarrage</TabsTrigger>
            <TabsTrigger value="authentication">Authentification</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="examples">Exemples</TabsTrigger>
          </TabsList>

          <TabsContent value="getting-started" className="space-y-6">
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-4">Premiers pas avec l'API VisualPro</h2>
              <p className="text-muted-foreground mb-6">
                L'API VisualPro vous permet de générer des visuels publicitaires et des vidéos 
                directement depuis vos applications. Accès disponible avec le plan Business.
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">URL de base</h3>
                  <code className="block bg-muted p-4 rounded-lg">
                    https://api.visualpro.africa/v1
                  </code>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-2">Format de réponse</h3>
                  <p className="text-muted-foreground">
                    Toutes les réponses sont au format JSON avec encodage UTF-8.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-2">Limites de taux</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Plan Business : 1000 requêtes/heure</li>
                    <li>Plan Enterprise : Illimité</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="authentication" className="space-y-6">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <Key className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-bold">Authentification</h2>
              </div>
              
              <p className="text-muted-foreground mb-6">
                Utilisez votre clé API pour authentifier vos requêtes. La clé doit être incluse 
                dans l'en-tête de chaque requête.
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Obtenir votre clé API</h3>
                  <p className="text-muted-foreground mb-4">
                    Connectez-vous à votre compte VisualPro et accédez à la section 
                    "Paramètres &gt; API" pour générer votre clé.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-2">Utilisation</h3>
                  <code className="block bg-muted p-4 rounded-lg overflow-x-auto">
{`curl -X POST https://api.visualpro.africa/v1/generate \\
  -H "Authorization: Bearer VOTRE_CLE_API" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Votre description"}'`}
                  </code>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>⚠️ Important :</strong> Gardez votre clé API secrète. Ne la partagez 
                    jamais publiquement et ne la commitez pas dans votre code source.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-6">
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-6">Endpoints disponibles</h2>

              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-green-500/20 text-green-600 px-3 py-1 rounded text-sm font-semibold">
                      POST
                    </span>
                    <code className="text-lg">/generate/image</code>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Génère un visuel publicitaire à partir d'une description.
                  </p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-semibold mb-2">Paramètres :</p>
                    <code className="block text-sm">
{`{
  "prompt": "string (requis)",
  "platform": "facebook|instagram|twitter|linkedin",
  "style": "modern|elegant|bold|minimal"
}`}
                    </code>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-green-500/20 text-green-600 px-3 py-1 rounded text-sm font-semibold">
                      POST
                    </span>
                    <code className="text-lg">/generate/video</code>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Génère une vidéo publicitaire animée.
                  </p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-semibold mb-2">Paramètres :</p>
                    <code className="block text-sm">
{`{
  "prompt": "string (requis)",
  "duration": "number (secondes, 5-30)",
  "voiceover": "boolean"
}`}
                    </code>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-500/20 text-blue-600 px-3 py-1 rounded text-sm font-semibold">
                      GET
                    </span>
                    <code className="text-lg">/status/:id</code>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Vérifie le statut d'une génération en cours.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-500/20 text-blue-600 px-3 py-1 rounded text-sm font-semibold">
                      GET
                    </span>
                    <code className="text-lg">/library</code>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Récupère la liste de vos créations.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="examples" className="space-y-6">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-bold">Exemples de code</h2>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold mb-3">JavaScript / Node.js</h3>
                  <code className="block bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`const axios = require('axios');

const generateImage = async () => {
  try {
    const response = await axios.post(
      'https://api.visualpro.africa/v1/generate/image',
      {
        prompt: 'Publicité moderne pour smartphone',
        platform: 'instagram',
        style: 'modern'
      },
      {
        headers: {
          'Authorization': 'Bearer VOTRE_CLE_API',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Image générée:', response.data.url);
  } catch (error) {
    console.error('Erreur:', error.response.data);
  }
};

generateImage();`}
                  </code>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">Python</h3>
                  <code className="block bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import requests

url = "https://api.visualpro.africa/v1/generate/image"
headers = {
    "Authorization": "Bearer VOTRE_CLE_API",
    "Content-Type": "application/json"
}
data = {
    "prompt": "Publicité moderne pour smartphone",
    "platform": "instagram",
    "style": "modern"
}

response = requests.post(url, json=data, headers=headers)
result = response.json()

print(f"Image générée: {result['url']}")`}
                  </code>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">PHP</h3>
                  <code className="block bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`<?php
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => "https://api.visualpro.africa/v1/generate/image",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer VOTRE_CLE_API",
        "Content-Type: application/json"
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "prompt" => "Publicité moderne pour smartphone",
        "platform" => "instagram",
        "style" => "modern"
    ])
]);

$response = curl_exec($curl);
$result = json_decode($response, true);

echo "Image générée: " . $result['url'];
curl_close($curl);
?>`}
                  </code>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="p-8 mt-8 bg-primary/5">
          <h2 className="text-2xl font-bold mb-4">Besoin d'aide ?</h2>
          <p className="text-muted-foreground mb-4">
            Notre équipe est disponible pour vous aider avec l'intégration de l'API.
          </p>
          <div className="space-y-2">
            <p>📧 Email : api@visualpro.africa</p>
            <p>💬 Support : support@visualpro.africa</p>
            <p>📚 Documentation complète : docs.visualpro.africa</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ApiDocumentation;
