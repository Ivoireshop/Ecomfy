import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";

const Blog = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Blog — Ecomfy</title>
        <meta name="description" content="Guides, tutoriels et conseils pour tirer le meilleur de Ecomfy." />
        <link rel="canonical" href="https://ecomfy.cloud/blog" />
        <meta property="og:title" content="Blog — Ecomfy" />
        <meta property="og:description" content="Guides, tutoriels et conseils pour tirer le meilleur de Ecomfy." />
        <meta property="og:url" content="https://ecomfy.cloud/blog" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "Blog Ecomfy",
          "description": "Guides, tutoriels et conseils pour tirer le meilleur de Ecomfy.",
          "url": "https://ecomfy.cloud/blog",
          "publisher": {
            "@type": "Organization",
            "name": "Ecomfy",
            "url": "https://ecomfy.cloud"
          }
        })}</script>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />

      <div className="container mx-auto px-4 py-24 max-w-2xl">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 blur-2xl rounded-full" />
            <div className="relative bg-gradient-to-br from-primary to-secondary p-6 rounded-3xl shadow-xl">
              <BookOpen className="w-16 h-16 text-primary-foreground" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Clock className="w-4 h-4" />
            En préparation
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Bientôt disponible
          </h1>

          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Notre blog arrive très prochainement avec des guides, tutoriels et conseils
            pour vous aider à tirer le meilleur de Ecomfy. Revenez bientôt !
          </p>

          <Button size="lg" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 w-4 h-4" />
            Retour à l'accueil
          </Button>
        </div>
      </div>
    </div>
    </>
  );
};

export default Blog;
