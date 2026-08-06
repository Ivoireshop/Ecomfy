import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Politique de Confidentialité
          </h1>
          <p className="text-muted-foreground">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

        <Card className="p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground mb-4">
              Chez Visual Pro, nous prenons très au sérieux la protection de vos données personnelles. 
              Cette politique de confidentialité explique comment nous collectons, utilisons, stockons 
              et protégeons vos informations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Données collectées</h2>
            <p className="text-muted-foreground mb-4">
              Nous collectons les informations suivantes :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Informations d'identification : nom, prénom, email</li>
              <li>Informations de compte : mot de passe chiffré, préférences</li>
              <li>Données d'utilisation : historique de créations, statistiques</li>
              <li>Données techniques : adresse IP, type de navigateur, système d'exploitation</li>
              <li>Contenus créés : visuels, vidéos, sites vitrine</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Utilisation des données</h2>
            <p className="text-muted-foreground mb-4">
              Vos données sont utilisées pour :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Fournir et améliorer nos services</li>
              <li>Personnaliser votre expérience utilisateur</li>
              <li>Traiter vos paiements et gérer votre abonnement</li>
              <li>Vous envoyer des notifications importantes</li>
              <li>Analyser l'utilisation de la plateforme</li>
              <li>Assurer la sécurité de nos services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Partage des données</h2>
            <p className="text-muted-foreground mb-4">
              Nous ne vendons jamais vos données personnelles. Nous pouvons partager vos informations 
              uniquement dans les cas suivants :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Avec votre consentement explicite</li>
              <li>Avec nos prestataires de services (hébergement, paiement)</li>
              <li>Pour répondre à des obligations légales</li>
              <li>Pour protéger nos droits et notre sécurité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Sécurité des données</h2>
            <p className="text-muted-foreground mb-4">
              Nous mettons en place des mesures de sécurité strictes :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Chiffrement des données sensibles (SSL/TLS)</li>
              <li>Authentification sécurisée</li>
              <li>Sauvegardes régulières</li>
              <li>Surveillance continue des accès</li>
              <li>Conformité aux standards de sécurité internationaux</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Vos droits</h2>
            <p className="text-muted-foreground mb-4">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement</li>
              <li>Droit à la portabilité</li>
              <li>Droit d'opposition au traitement</li>
              <li>Droit de limitation du traitement</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Pour exercer ces droits, contactez-nous à : privacy@ecomfy.cloud
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Cookies</h2>
            <p className="text-muted-foreground mb-4">
              Nous utilisons des cookies pour améliorer votre expérience. Consultez notre 
              <a href="/cookies-policy" className="text-primary hover:underline ml-1">
                politique de cookies
              </a> pour plus d'informations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. Conservation des données</h2>
            <p className="text-muted-foreground mb-4">
              Nous conservons vos données personnelles aussi longtemps que nécessaire pour 
              fournir nos services et respecter nos obligations légales. Vous pouvez demander 
              la suppression de votre compte à tout moment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">9. Modifications</h2>
            <p className="text-muted-foreground mb-4">
              Nous pouvons modifier cette politique de confidentialité à tout moment. 
              Les modifications importantes vous seront notifiées par email.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">10. Contact</h2>
            <p className="text-muted-foreground mb-4">
              Pour toute question concernant cette politique de confidentialité :
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

export default PrivacyPolicy;
