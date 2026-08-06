import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Cookie } from "lucide-react";

const CookiesPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <Cookie className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Politique des Cookies
          </h1>
          <p className="text-muted-foreground">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

        <Card className="p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Qu'est-ce qu'un cookie ?</h2>
            <p className="text-muted-foreground mb-4">
              Un cookie est un petit fichier texte stocké sur votre appareil lorsque vous visitez 
              un site web. Les cookies permettent au site de mémoriser vos actions et préférences 
              pendant une période donnée.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Comment utilisons-nous les cookies ?</h2>
            <p className="text-muted-foreground mb-4">
              Visual Pro utilise des cookies pour :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Maintenir votre session utilisateur active</li>
              <li>Mémoriser vos préférences (langue, thème)</li>
              <li>Analyser l'utilisation du site</li>
              <li>Améliorer nos services</li>
              <li>Personnaliser votre expérience</li>
              <li>Mesurer l'efficacité de nos campagnes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Types de cookies utilisés</h2>
            
            <div className="space-y-6 mt-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-primary">Cookies essentiels</h3>
                <p className="text-muted-foreground">
                  Ces cookies sont nécessaires au fonctionnement du site. Ils vous permettent de 
                  naviguer sur le site et d'utiliser ses fonctionnalités. Sans ces cookies, nos 
                  services ne peuvent pas fonctionner correctement.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Exemples : session utilisateur, authentification, panier
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2 text-secondary">Cookies de performance</h3>
                <p className="text-muted-foreground">
                  Ces cookies collectent des informations sur la façon dont vous utilisez notre site. 
                  Ils nous aident à améliorer le fonctionnement du site en comprenant quelles pages 
                  sont les plus visitées et où les utilisateurs rencontrent des erreurs.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Exemples : Google Analytics, temps de chargement, erreurs
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2 text-purple-600">Cookies de fonctionnalité</h3>
                <p className="text-muted-foreground">
                  Ces cookies permettent au site de se souvenir de vos choix (nom d'utilisateur, 
                  langue, région) et de fournir des fonctionnalités améliorées et personnalisées.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Exemples : préférences de langue, paramètres d'affichage
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2 text-orange-600">Cookies publicitaires</h3>
                <p className="text-muted-foreground">
                  Ces cookies sont utilisés pour afficher des publicités pertinentes pour vous et 
                  vos intérêts. Ils limitent aussi le nombre de fois où vous voyez une publicité 
                  et aident à mesurer l'efficacité des campagnes publicitaires.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Exemples : publicités ciblées, remarketing
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Cookies tiers</h2>
            <p className="text-muted-foreground mb-4">
              Nous utilisons également des cookies de partenaires tiers pour :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Google Analytics :</strong> analyse du trafic et du comportement utilisateur</li>
              <li><strong>Stripe :</strong> traitement sécurisé des paiements</li>
              <li><strong>Cloudflare :</strong> sécurité et performances du site</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Durée de conservation</h2>
            <p className="text-muted-foreground mb-4">
              Les cookies ont différentes durées de vie :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Cookies de session :</strong> supprimés à la fermeture du navigateur</li>
              <li><strong>Cookies persistants :</strong> conservés pour une durée définie (généralement 1 an maximum)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Gérer vos cookies</h2>
            <p className="text-muted-foreground mb-4">
              Vous pouvez contrôler et gérer les cookies de plusieurs façons :
            </p>
            
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold mb-2">Paramètres du navigateur</h3>
                <p className="text-muted-foreground">
                  Tous les navigateurs permettent de bloquer ou supprimer les cookies. Les méthodes 
                  varient selon le navigateur. Consultez la section d'aide de votre navigateur pour 
                  plus d'informations.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Conséquences du refus</h3>
                <p className="text-muted-foreground">
                  Le blocage de certains cookies peut affecter votre expérience sur Visual Pro. 
                  Certaines fonctionnalités peuvent ne plus être disponibles et vous devrez peut-être 
                  vous reconnecter à chaque visite.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Outils de gestion</h3>
                <p className="text-muted-foreground mb-4">
                  Vous pouvez également utiliser des outils tiers pour gérer les cookies :
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><a href="https://www.youronlinechoices.com/fr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Your Online Choices</a></li>
                  <li><a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Analytics Opt-out</a></li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Modifications</h2>
            <p className="text-muted-foreground mb-4">
              Nous pouvons mettre à jour cette politique de cookies pour refléter les changements 
              dans nos pratiques ou pour des raisons légales. Consultez régulièrement cette page 
              pour rester informé.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. Contact</h2>
            <p className="text-muted-foreground mb-4">
              Pour toute question concernant notre utilisation des cookies :
            </p>
            <ul className="space-y-2 text-muted-foreground ml-4">
              <li>Email : privacy@ecomfy.cloud</li>
              <li>Support : support@ecomfy.cloud</li>
            </ul>
          </section>
        </Card>
      </div>
    </div>
  );
};

export default CookiesPolicy;
