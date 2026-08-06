import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Scale } from "lucide-react";

const LegalNotice = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />
      
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <Scale className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Mentions Légales
          </h1>
          <p className="text-muted-foreground">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

        <Card className="p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Éditeur du site</h2>
            <div className="space-y-2 text-muted-foreground">
              <p><strong>Raison sociale :</strong> Ecomfy</p>
              <p><strong>Forme juridique :</strong> SARL (Société à Responsabilité Limitée)</p>
              <p><strong>Siège social :</strong> Abidjan, Côte d'Ivoire</p>
              <p><strong>Email :</strong> contact@ecomfy.cloud</p>
              <p><strong>Téléphone :</strong> +225 XX XX XX XX XX</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Directeur de la publication</h2>
            <p className="text-muted-foreground">
              <strong>Ulrich DJATÉ</strong><br />
              Fondateur & CEO de Ecomfy<br />
              Email : ulrich@ecomfy.cloud
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Hébergement</h2>
            <div className="space-y-2 text-muted-foreground">
              <p><strong>Hébergeur :</strong> Vercel Inc.</p>
              <p><strong>Adresse :</strong> 340 S Lemon Ave #4133, Walnut, CA 91789, USA</p>
              <p><strong>Site web :</strong> vercel.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Propriété intellectuelle</h2>
            <p className="text-muted-foreground mb-4">
              L'ensemble du contenu de ce site (textes, images, logos, vidéos, design, structure) 
              est la propriété exclusive de Ecomfy ou de ses partenaires. Toute reproduction, 
              distribution, modification, adaptation, retransmission ou publication de ces 
              différents éléments est strictement interdite sans l'accord exprès par écrit de Ecomfy.
            </p>
            <p className="text-muted-foreground">
              La marque Ecomfy, son logo et tous les éléments graphiques associés sont des 
              marques déposées. Toute utilisation non autorisée constitue une contrefaçon 
              passible de sanctions civiles et pénales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Données personnelles</h2>
            <p className="text-muted-foreground mb-4">
              Ecomfy accorde une grande importance à la protection des données personnelles 
              de ses utilisateurs. Les informations collectées font l'objet d'un traitement 
              informatique destiné à :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>La gestion de votre compte utilisateur</li>
              <li>La fourniture de nos services</li>
              <li>L'amélioration de notre plateforme</li>
              <li>L'envoi de communications pertinentes (avec votre consentement)</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Pour plus d'informations, consultez notre{" "}
              <a href="/privacy-policy" className="text-primary hover:underline">
                Politique de Confidentialité
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Cookies</h2>
            <p className="text-muted-foreground mb-4">
              Le site Ecomfy utilise des cookies pour améliorer l'expérience utilisateur, 
              analyser le trafic et personnaliser le contenu. En utilisant notre site, vous 
              acceptez l'utilisation de cookies conformément à notre{" "}
              <a href="/cookies-policy" className="text-primary hover:underline">
                Politique de Cookies
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Limitation de responsabilité</h2>
            <p className="text-muted-foreground mb-4">
              Ecomfy s'efforce d'assurer l'exactitude et la mise à jour des informations 
              diffusées sur ce site. Toutefois, Ecomfy ne peut garantir l'exactitude, 
              la précision ou l'exhaustivité des informations disponibles sur le site.
            </p>
            <p className="text-muted-foreground">
              En conséquence, Ecomfy décline toute responsabilité pour :
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4 mt-2">
              <li>Les inexactitudes ou omissions portant sur des informations disponibles sur le site</li>
              <li>Les dommages résultant d'une intrusion frauduleuse d'un tiers</li>
              <li>L'utilisation du site et de son contenu</li>
              <li>L'impossibilité temporaire d'accès au site</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. Liens hypertextes</h2>
            <p className="text-muted-foreground">
              Le site Ecomfy peut contenir des liens vers d'autres sites. Ecomfy n'exerce 
              aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu 
              ou à leur politique de confidentialité.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">9. Droit applicable et juridiction</h2>
            <p className="text-muted-foreground">
              Les présentes mentions légales sont régies par le droit ivoirien. En cas de litige 
              et à défaut d'accord amiable, le différend sera porté devant les tribunaux 
              compétents d'Abidjan, Côte d'Ivoire.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">10. Modification des mentions légales</h2>
            <p className="text-muted-foreground">
              Ecomfy se réserve le droit de modifier les présentes mentions légales à tout 
              moment. Les modifications prendront effet dès leur publication sur le site. 
              Nous vous encourageons à consulter régulièrement cette page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">11. Contact</h2>
            <p className="text-muted-foreground mb-4">
              Pour toute question concernant ces mentions légales, vous pouvez nous contacter :
            </p>
            <ul className="space-y-2 text-muted-foreground ml-4">
              <li>📧 Email : legal@ecomfy.cloud</li>
              <li>📞 Téléphone : +225 XX XX XX XX XX</li>
              <li>📍 Adresse : Abidjan, Côte d'Ivoire</li>
            </ul>
          </section>
        </Card>
      </div>
    </div>
  );
};

export default LegalNotice;
