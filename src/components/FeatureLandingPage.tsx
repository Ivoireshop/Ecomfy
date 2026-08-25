import { Helmet } from "react-helmet";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, type LucideIcon } from "lucide-react";

interface FeatureLandingPageProps {
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonical: string;
  hero: {
    eyebrow: string;
    heading: string;
    subheading: string;
    ctaPrimary: { label: string; to: string };
    ctaSecondary?: { label: string; to: string };
  };
  benefits: { icon: LucideIcon; title: string; description: string }[];
  steps: { title: string; description: string }[];
  faq: { question: string; answer: string }[];
  schemaType?: "Service" | "Product";
}

export function FeatureLandingPage({
  title,
  metaTitle,
  metaDescription,
  canonical,
  hero,
  benefits,
  steps,
  faq,
  schemaType = "Service",
}: FeatureLandingPageProps) {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: title,
    description: metaDescription,
    url: canonical,
    provider: { "@type": "Organization", name: "Ecomfy", url: "https://ecomfy.cloud" },
    areaServed: "Africa",
  };

  const path = canonical.replace(/^https?:\/\/[^/]+/, "");
  const segLabel = path
    .replace(/^\//, "")
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://ecomfy.cloud/" },
      { "@type": "ListItem", position: 2, name: segLabel || title, item: canonical },
    ],
  };

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ecomfy" />
        <meta property="og:image" content="https://ecomfy.cloud/og-ecomfy.jpg?v=3" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content="https://ecomfy.cloud/og-default.jpg" />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(serviceLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main>
          {/* Hero */}
          <section className="container mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-24">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs md:text-sm uppercase tracking-widest text-primary font-semibold mb-4 animate-fade-in-up stagger-1">
                {hero.eyebrow}
              </span>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 leading-tight animate-fade-in-up stagger-2">
                {hero.heading}
              </h1>
              <p className="text-base md:text-lg text-muted-foreground mb-8 animate-fade-in-up stagger-3">
                {hero.subheading}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in-up stagger-4">
                {hero.ctaSecondary && (
                  <Button asChild variant="outline" size="lg" className="btn-interactive">
                    <Link to={hero.ctaSecondary.to}>{hero.ctaSecondary.label}</Link>
                  </Button>
                )}
                <Button asChild size="lg" className="btn-interactive shadow-lg hover:shadow-emerald-500/25">
                  <Link to={hero.ctaPrimary.to}>
                    {hero.ctaPrimary.label} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Benefits */}
          <section className="container mx-auto px-4 py-12 md:py-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
              Pourquoi choisir Ecomfy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {benefits.map((b, i) => (
                <Card key={i} className="p-6 card-interactive">
                  <b.icon className="h-8 w-8 text-primary mb-4 transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.description}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* Steps */}
          <section className="container mx-auto px-4 py-12 md:py-16 bg-muted/30 rounded-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
              Comment ça marche
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {steps.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mx-auto mb-4">
                    {i + 1}
                  </div>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
              Questions fréquentes
            </h2>
            <div className="space-y-4">
              {faq.map((f, i) => (
                <Card key={i} className="p-5">
                  <h3 className="font-semibold mb-2 flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    {f.question}
                  </h3>
                  <p className="text-sm text-muted-foreground pl-7">{f.answer}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="container mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Prêt à essayer ?</h2>
            <p className="text-muted-foreground mb-6">Créez votre compte et commencez gratuitement.</p>
            <Button asChild size="lg">
              <Link to={hero.ctaPrimary.to}>
                {hero.ctaPrimary.label} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
