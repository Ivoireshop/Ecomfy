import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Conditions Générales d'Utilisation
          </h1>
          <p className="text-muted-foreground">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

        <Card className="p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Acceptation des conditions</h2>
            <p className="text-muted-foreground mb-4">
              En utilisant Visual Pro, vous acceptez d'être lié par ces conditions générales 
              d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser 
              notre service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Description du service</h2>
            <p className="text-muted-foreground mb-4">
              Visual Pro est une plateforme de création visuelle propulsée par l'intelligence 
              artificielle qui permet de :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Générer des visuels publicitaires professionnels</li>
              <li>Créer des vidéos animées</li>
              <li>Construire des sites vitrine</li>
              <li>Utiliser des templates personnalisables</li>
              <li>Accéder à des fonctionnalités via API</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Inscription et compte</h2>
            <p className="text-muted-foreground mb-4">
              Pour utiliser Visual Pro, vous devez :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Créer un compte avec des informations exactes et complètes</li>
              <li>Maintenir la confidentialité de vos identifiants</li>
              <li>Être responsable de toute activité sur votre compte</li>
              <li>Avoir au moins 18 ans ou le consentement parental</li>
              <li>Nous notifier immédiatement de tout accès non autorisé</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Utilisation du service</h2>
            <p className="text-muted-foreground mb-4">
              Vous vous engagez à :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Utiliser le service de manière légale et éthique</li>
              <li>Ne pas créer de contenu illégal, diffamatoire ou offensant</li>
              <li>Respecter les droits de propriété intellectuelle</li>
              <li>Ne pas tenter de contourner les limitations du service</li>
              <li>Ne pas utiliser le service pour du spam ou du phishing</li>
              <li>Ne pas reverse-engineer ou copier notre technologie</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Propriété intellectuelle</h2>
            <p className="text-muted-foreground mb-4">
              <strong>Contenu créé :</strong> Vous conservez tous les droits sur le contenu que vous 
              créez avec Visual Pro. Nous vous accordons une licence non-exclusive pour utiliser, 
              modifier, distribuer et commercialiser ce contenu.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>Plateforme :</strong> Visual Pro, son code, ses algorithmes et son design 
              restent notre propriété exclusive. Toute reproduction non autorisée est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Tarification et paiements</h2>
            <p className="text-muted-foreground mb-4">
              Nos services sont proposés selon différents plans :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Plan Gratuit : accès limité aux fonctionnalités de base</li>
              <li>Plan Pro : abonnement mensuel avec fonctionnalités étendues</li>
              <li>Plan Business : accès illimité et API</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Les paiements sont traités de manière sécurisée. Les abonnements se renouvellent 
              automatiquement sauf annulation. Aucun remboursement pour les périodes partielles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Crédits et usage</h2>
            <p className="text-muted-foreground mb-4">
              Selon votre plan, vous disposez d'un nombre défini de crédits pour créer du contenu. 
              Les crédits non utilisés peuvent expirer selon les conditions de votre abonnement. 
              L'achat de crédits supplémentaires est possible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. Résiliation</h2>
            <p className="text-muted-foreground mb-4">
              Vous pouvez résilier votre compte à tout moment depuis les paramètres. Nous nous 
              réservons le droit de suspendre ou résilier votre compte en cas de :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Violation de ces conditions</li>
              <li>Activité frauduleuse ou illégale</li>
              <li>Non-paiement des frais dus</li>
              <li>Abus du service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">9. Garanties et limitations</h2>
            <p className="text-muted-foreground mb-4">
              Le service est fourni "tel quel". Nous nous efforçons d'assurer une disponibilité 
              maximale mais ne garantissons pas un service ininterrompu. Nous ne sommes pas 
              responsables des pertes de données ou dommages indirects.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">10. Modifications</h2>
            <p className="text-muted-foreground mb-4">
              Nous pouvons modifier ces conditions à tout moment. Les modifications importantes 
              seront notifiées par email. L'utilisation continue du service après modification 
              constitue votre acceptation des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">11. Droit applicable</h2>
            <p className="text-muted-foreground mb-4">
              Ces conditions sont régies par le droit ivoirien. Tout litige sera soumis aux 
              tribunaux compétents d'Abidjan, Côte d'Ivoire.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">12. Contact</h2>
            <p className="text-muted-foreground mb-4">
              Pour toute question concernant ces conditions :
            </p>
            <ul className="space-y-2 text-muted-foreground ml-4">
              <li>Email : legal@ecomfy.cloud</li>
              <li>Support : support@ecomfy.cloud</li>
            </ul>
          </section>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;
