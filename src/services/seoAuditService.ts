// src/services/seoAuditService.ts
// Audit technique ECOMFY SEO INTELLIGENCE.
// Analyse les données réelles de la boutique (balises, statut de publication, domaine, produits,
// images) et les mesures PageSpeed quand elles existent. Aucun indicateur n'est inventé :
// une catégorie non mesurée vaut null et sort du calcul du score global.

import {
  PageSpeedResult,
  SeoAuditResult,
  SeoAuditWeights,
  SeoIssue,
  StructuredDataPreview,
} from "@/types/seoIntelligence";
import {
  SEO_LIMITS,
  getEffectiveShopDescription,
  getEffectiveShopTitle,
  getProductUrl,
  getShopDomain,
  getShopHomeUrl,
  getShopName,
  isDomainActive,
  productImages,
} from "@/lib/seoShop";

export const DEFAULT_SEO_WEIGHTS: SeoAuditWeights = {
  technical: 25,
  performance: 20,
  content: 20,
  indexability: 15,
  metadata: 10,
  mobile: 10,
};

export interface PageSpeedSnapshot {
  mobile: PageSpeedResult | null;
  desktop: PageSpeedResult | null;
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Coupe un texte à `max` caractères sur une frontière de mot, sans points de suspension. */
function truncateAtWord(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : clean.slice(0, max);
  return base.replace(/[\s,;:|\-–]+$/, "");
}

export class SeoAuditService {
  /** Titre SEO proposé : le titre actuel (ou le nom) ramené dans la fourchette recommandée. */
  public static suggestTitle(shop: any): string {
    const name = getShopName(shop);
    const current = String(shop?.seo_title || "").trim();
    let title = current || name;

    if (title.length < SEO_LIMITS.titleMin) {
      for (const suffix of [" | Ecomfy", " | Boutique en ligne sur Ecomfy"]) {
        if (title.length >= SEO_LIMITS.titleMin) break;
        title = `${current || name}${suffix}`;
      }
    }
    return truncateAtWord(title, SEO_LIMITS.titleMax);
  }

  /** Description SEO proposée : description commerciale raccourcie, sinon un texte type. */
  public static suggestDescription(shop: any): string {
    const name = getShopName(shop);
    const existing = getEffectiveShopDescription(shop);
    if (existing.length >= SEO_LIMITS.descMin) return truncateAtWord(existing, SEO_LIMITS.descMax);
    return truncateAtWord(
      `Découvrez la boutique ${name} sur Ecomfy. Commandez vos articles en ligne avec paiement sécurisé et livraison rapide.`,
      SEO_LIMITS.descMax
    );
  }

  /**
   * Audit technique d'une boutique et de ses produits.
   * `products` doit contenir `product_images` (image_url, alt_text) pour que le contrôle des images soit fiable.
   */
  public static async runRealTechnicalAudit(
    shop: any,
    products: any[] = [],
    customWeights: SeoAuditWeights = DEFAULT_SEO_WEIGHTS,
    pageSpeed: PageSpeedSnapshot = { mobile: null, desktop: null }
  ): Promise<SeoAuditResult> {
    const domain = getShopDomain(shop);
    const homeUrl = getShopHomeUrl(shop);

    const issues: SeoIssue[] = [];
    let technicalPoints = 100;
    let contentPoints = 100;
    let indexabilityPoints = 100;
    let metadataPoints = 100;

    // 1. Technique : HTTPS et domaine personnalisé
    if (!homeUrl.startsWith("https://")) {
      technicalPoints -= 40;
      issues.push({
        id: "tech-https-missing",
        category: "technical",
        severity: "critical",
        title: "Connexion HTTPS non sécurisée",
        description: "Le site web ne force pas l'utilisation du protocole SSL/HTTPS.",
        impact: "Pénalité sévère sur Google et affichage d'un avertissement de sécurité aux acheteurs.",
        recommendation: "Activez le certificat SSL sur le nom de domaine de votre boutique Ecomfy.",
        canAutoFix: false,
      });
    }

    if (shop?.custom_domain && !isDomainActive(shop)) {
      technicalPoints -= 15;
      issues.push({
        id: "tech-custom-domain-unverified",
        category: "technical",
        severity: "important",
        title: "Domaine personnalisé non vérifié",
        description: `Le domaine ${shop.custom_domain} est configuré mais sa vérification DNS n'est pas terminée.`,
        impact: "Le domaine ne sert pas encore votre boutique : Google continue d'indexer l'adresse ecomfy.cloud.",
        recommendation: "Terminez la configuration DNS dans les paramètres de la boutique (onglet Domaine).",
        canAutoFix: false,
      });
    }

    // 2. Indexabilité : la boutique doit être publiée et activée
    if (shop?.is_published === false) {
      indexabilityPoints -= 60;
      issues.push({
        id: "index-shop-unpublished",
        category: "indexability",
        severity: "critical",
        title: "Boutique non publiée",
        description: "La boutique n'est pas publiée : ses pages ne sont pas accessibles aux moteurs de recherche.",
        impact: "Aucune page de la boutique ne peut apparaître dans Google.",
        recommendation: "Publiez la boutique depuis l'éditeur de boutique.",
        canAutoFix: false,
      });
    }

    if (shop?.is_activated === false) {
      indexabilityPoints -= 30;
      issues.push({
        id: "index-shop-not-activated",
        category: "indexability",
        severity: "important",
        title: "Boutique non activée",
        description: "L'activation de la boutique n'est pas terminée.",
        impact: "Une boutique non activée n'est pas servie publiquement et ne peut pas être indexée.",
        recommendation: "Finalisez l'activation de la boutique.",
        canAutoFix: false,
      });
    }

    // 3. Métadonnées de la page d'accueil (valeurs réellement servies par la boutique)
    const shopMetaTitle = getEffectiveShopTitle(shop);
    const shopMetaDesc = getEffectiveShopDescription(shop);

    if (!shopMetaTitle) {
      metadataPoints -= 35;
      issues.push({
        id: "meta-title-missing",
        category: "metadata",
        severity: "critical",
        title: "Titre SEO (Meta Title) principal manquant",
        description: "La page d'accueil de la boutique n'a pas de balise Meta Title définie.",
        impact: "Google ne peut pas afficher un titre pertinent dans les résultats de recherche.",
        recommendation: `Définissez un titre de ${SEO_LIMITS.titleMin} à ${SEO_LIMITS.titleMax} caractères incluant le nom de votre marque.`,
        canAutoFix: true,
        fixActionKey: "generate_meta_title",
        beforeSnippet: `<title></title>`,
        afterSnippet: `<title>${this.suggestTitle(shop)}</title>`,
      });
    } else if (shopMetaTitle.length < SEO_LIMITS.titleMin || shopMetaTitle.length > SEO_LIMITS.titleMax) {
      metadataPoints -= 15;
      issues.push({
        id: "meta-title-length",
        category: "metadata",
        severity: "optimization",
        title: "Longueur du Meta Title non optimale",
        description: `Le titre actuel fait ${shopMetaTitle.length} caractères (recommandé : ${SEO_LIMITS.titleMin}-${SEO_LIMITS.titleMax} caractères).`,
        impact: "Risque de troncature dans les résultats de recherche Google.",
        recommendation: "Ajustez la longueur du titre pour éviter qu'il soit trop court ou coupé.",
        canAutoFix: true,
        fixActionKey: "optimize_meta_title_length",
        beforeSnippet: `<title>${shopMetaTitle}</title>`,
        afterSnippet: `<title>${this.suggestTitle(shop)}</title>`,
      });
    }

    if (!shopMetaDesc) {
      metadataPoints -= 35;
      issues.push({
        id: "meta-desc-missing",
        category: "metadata",
        severity: "important",
        title: "Description SEO (Meta Description) manquante",
        description: "Aucun résumé n'a été rédigé pour inciter aux clics depuis Google.",
        impact: "CTR faible car Google génère un extrait aléatoire issu de la page.",
        recommendation: `Rédigez une description attrayante entre ${SEO_LIMITS.descMin} et ${SEO_LIMITS.descMax} caractères.`,
        canAutoFix: true,
        fixActionKey: "generate_meta_desc",
        beforeSnippet: `<meta name="description" content="" />`,
        afterSnippet: `<meta name="description" content="${this.suggestDescription(shop)}" />`,
      });
    } else if (shopMetaDesc.length > SEO_LIMITS.descMax) {
      metadataPoints -= 10;
      issues.push({
        id: "meta-desc-too-long",
        category: "metadata",
        severity: "optimization",
        title: "Meta Description trop longue",
        description: `La description actuelle fait ${shopMetaDesc.length} caractères (recommandé : ${SEO_LIMITS.descMin}-${SEO_LIMITS.descMax}).`,
        impact: "Google coupe la description dans les résultats de recherche.",
        recommendation: "Raccourcissez la description pour qu'elle s'affiche en entier.",
        canAutoFix: true,
        fixActionKey: "optimize_meta_desc_length",
        beforeSnippet: `<meta name="description" content="${shopMetaDesc}" />`,
        afterSnippet: `<meta name="description" content="${truncateAtWord(shopMetaDesc, SEO_LIMITS.descMax)}" />`,
      });
    } else if (shopMetaDesc.length < SEO_LIMITS.descMin) {
      metadataPoints -= 10;
      issues.push({
        id: "meta-desc-too-short",
        category: "metadata",
        severity: "optimization",
        title: "Meta Description trop courte",
        description: `La description actuelle fait ${shopMetaDesc.length} caractères (recommandé : ${SEO_LIMITS.descMin}-${SEO_LIMITS.descMax}).`,
        impact: "Une description courte exploite mal l'espace disponible dans les résultats Google.",
        recommendation: "Développez la description avec vos produits phares et vos avantages (livraison, paiement).",
        canAutoFix: false,
      });
    }

    // 4. Produits publiés : description, images, textes alternatifs
    const publishedProducts = products.filter((p) => p?.is_published !== false);
    const productsMissingDesc = publishedProducts.filter(
      (p) => String(p.description || p.short_description || "").trim().length < SEO_LIMITS.productDescMin
    );
    const productsWithoutImage = publishedProducts.filter((p) => productImages(p).length === 0);
    const productsMissingAlt = publishedProducts.filter((p) =>
      productImages(p).some((img) => !String(img.alt_text || "").trim())
    );
    const imagesMissingAlt = productsMissingAlt.reduce(
      (acc, p) => acc + productImages(p).filter((img) => !String(img.alt_text || "").trim()).length,
      0
    );

    if (productsMissingDesc.length > 0) {
      contentPoints -= Math.min(30, productsMissingDesc.length * 10);
      issues.push({
        id: "content-product-desc-short",
        category: "content",
        severity: "important",
        title: `${productsMissingDesc.length} produit(s) avec description trop courte ou manquante`,
        description: `Descriptions de moins de ${SEO_LIMITS.productDescMin} caractères : ${productsMissingDesc
          .slice(0, 3)
          .map((p) => p.name)
          .join(", ")}${productsMissingDesc.length > 3 ? "…" : ""}.`,
        impact: "Les fiches produits courtes ont du mal à positionner les requêtes de longue traîne.",
        recommendation: "Utilisez l'Assistant IA Ecomfy dans l'éditeur de produit pour enrichir ces descriptions.",
        affectedUrl: getProductUrl(shop, productsMissingDesc[0]),
        canAutoFix: false,
      });
    }

    if (productsWithoutImage.length > 0) {
      contentPoints -= Math.min(30, productsWithoutImage.length * 10);
      issues.push({
        id: "content-product-no-image",
        category: "content",
        severity: "important",
        title: `${productsWithoutImage.length} produit(s) sans image`,
        description: `Fiches sans visuel : ${productsWithoutImage
          .slice(0, 3)
          .map((p) => p.name)
          .join(", ")}${productsWithoutImage.length > 3 ? "…" : ""}.`,
        impact: "Pas d'image dans les résultats enrichis ni dans Google Images, et un taux de conversion plus faible.",
        recommendation: "Ajoutez au moins une photo à chaque produit publié.",
        affectedUrl: getProductUrl(shop, productsWithoutImage[0]),
        canAutoFix: false,
      });
    }

    if (imagesMissingAlt > 0) {
      contentPoints -= Math.min(25, productsMissingAlt.length * 5);
      issues.push({
        id: "content-images-alt-missing",
        category: "content",
        severity: "optimization",
        title: `${imagesMissingAlt} image(s) sans texte alternatif (ALT) sur ${productsMissingAlt.length} produit(s)`,
        description: "Certaines images n'ont pas d'attribut ALT descriptif pour l'indexation Google Images.",
        impact: "Perte de visibilité dans Google Images et accessibilité restreinte.",
        recommendation: "Ajoutez un texte alternatif descriptif sur chaque image produit.",
        canAutoFix: true,
        fixActionKey: "generate_all_alt_texts",
        beforeSnippet: `<img src="…" alt="" />`,
        afterSnippet: `<img src="…" alt="${productsMissingAlt[0]?.name || "Nom du produit"}" />`,
      });
    }

    // 5. Performance et mobile : uniquement à partir des mesures PageSpeed
    const { mobile, desktop } = pageSpeed;
    const perfValues = [mobile?.performanceScore, desktop?.performanceScore].filter(
      (v): v is number => typeof v === "number"
    );
    const performanceScore = perfValues.length > 0 ? clampScore(perfValues.reduce((a, b) => a + b, 0) / perfValues.length) : null;
    // Le score « Mobile » reprend la catégorie SEO de Lighthouse en mode mobile (viewport, lisibilité, zones tactiles).
    const mobileScore = typeof mobile?.seoScore === "number" ? clampScore(mobile.seoScore) : null;

    if (performanceScore === null) {
      issues.push({
        id: "perf-not-measured",
        category: "performance",
        severity: "optimization",
        title: "Performance et compatibilité mobile non mesurées",
        description: "Aucune analyse PageSpeed Insights n'a été lancée : ces deux catégories sont exclues du score global.",
        impact: "Le score SEO n'intègre pas la vitesse de chargement, un facteur de classement Google.",
        recommendation: "Lancez l'analyse depuis l'onglet Performance, puis relancez l'audit.",
        canAutoFix: false,
      });
    } else if (performanceScore < 50) {
      issues.push({
        id: "perf-score-low",
        category: "performance",
        severity: "important",
        title: `Performance faible (${performanceScore}/100)`,
        description: "Les pages de la boutique se chargent lentement d'après PageSpeed Insights.",
        impact: "La lenteur pénalise le classement Google et fait fuir les visiteurs mobiles.",
        recommendation: "Compressez les images produit et réduisez le nombre de sections sur la page d'accueil.",
        canAutoFix: false,
      });
    } else if (performanceScore < 90) {
      issues.push({
        id: "perf-score-medium",
        category: "performance",
        severity: "optimization",
        title: `Performance améliorable (${performanceScore}/100)`,
        description: "Les temps de chargement peuvent être réduits d'après PageSpeed Insights.",
        impact: "Chaque seconde gagnée améliore le taux de conversion et le classement.",
        recommendation: "Optimisez le poids des images produit.",
        canAutoFix: false,
      });
    }

    // Scores finaux
    const technicalScore = clampScore(technicalPoints);
    const contentScore = clampScore(contentPoints);
    const indexabilityScore = clampScore(indexabilityPoints);
    const metadataScore = clampScore(metadataPoints);

    // Score global pondéré, calculé uniquement sur les catégories mesurées
    const w = customWeights;
    const parts: [number | null, number][] = [
      [technicalScore, w.technical],
      [performanceScore, w.performance],
      [contentScore, w.content],
      [indexabilityScore, w.indexability],
      [metadataScore, w.metadata],
      [mobileScore, w.mobile],
    ];
    const measured = parts.filter((p): p is [number, number] => p[0] !== null);
    const totalWeight = measured.reduce((acc, [, weight]) => acc + weight, 0);
    const overallScore = totalWeight > 0
      ? clampScore(measured.reduce((acc, [score, weight]) => acc + score * weight, 0) / totalWeight)
      : 0;

    return {
      shopId: shop?.id || "",
      scannedDomain: domain,
      overallScore,
      technicalScore,
      performanceScore,
      contentScore,
      indexabilityScore,
      metadataScore,
      mobileScore,
      issuesCriticalCount: issues.filter((i) => i.severity === "critical").length,
      issuesImportantCount: issues.filter((i) => i.severity === "important").length,
      issuesOptimizationCount: issues.filter((i) => i.severity === "optimization").length,
      issues,
      auditedAt: new Date().toISOString(),
      source: "Algorithme Ecomfy",
    };
  }

  /**
   * Génère le JSON-LD Schema.org Product d'une fiche produit.
   */
  public static generateProductJsonLd(product: any, shop: any): StructuredDataPreview {
    const currency = shop?.currency || product?.currency || "XOF";
    const images = productImages(product).map((i) => i.image_url).filter(Boolean);
    const description =
      String(product?.short_description || product?.description || "").replace(/<[^>]*>?/gm, "").trim() ||
      `Acheter ${product?.name} sur ${getShopName(shop)}.`;
    const inStock = product?.stock_quantity == null || product.stock_quantity > 0;

    const schemaObj: any = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product?.name || "Produit",
      "image": images,
      "description": description,
      "offers": {
        "@type": "Offer",
        "url": getProductUrl(shop, product),
        "priceCurrency": currency === "FCFA" ? "XOF" : currency,
        "price": product?.price ?? 0,
        "itemCondition": "https://schema.org/NewCondition",
        "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    };

    if (product?.sku) schemaObj["sku"] = product.sku;
    schemaObj["brand"] = { "@type": "Brand", "name": getShopName(shop) };

    const detectedFields = ["name", "description", "offers.price", "offers.priceCurrency", "offers.availability"];
    const missingFields: string[] = [];
    if (images.length > 0) detectedFields.push("image");
    else missingFields.push("image");
    if (!product?.sku) missingFields.push("sku");

    return {
      type: "Product",
      isValid: missingFields.indexOf("image") === -1,
      jsonLdSnippet: JSON.stringify(schemaObj, null, 2),
      detectedFields,
      missingFields,
    };
  }
}
