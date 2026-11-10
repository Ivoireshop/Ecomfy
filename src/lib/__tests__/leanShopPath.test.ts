import { describe, it, expect } from "vitest";
import { getLeanShopKind, isCustomShopHostname } from "../leanShopPath";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { heroImageWidth, HERO_IMAGE_QUALITY } from "../imageUrl";

describe("getLeanShopKind", () => {
  const host = "ecomfy.cloud";

  it("reconnaît la fiche produit", () => {
    expect(getLeanShopKind("/shop/ma-boutique/p/mon-produit", host)).toBe("product");
    expect(getLeanShopKind("/shop/ma-boutique/p/mon-produit/", host)).toBe("product");
    expect(getLeanShopKind("/shop/ma-boutique/product", host)).toBe("product");
  });

  it("reconnaît la vitrine et la confirmation de commande", () => {
    expect(getLeanShopKind("/shop/ma-boutique", host)).toBe("shop");
    expect(getLeanShopKind("/order-confirmed", host)).toBe("order");
  });

  it("laisse le site complet pour tout le reste", () => {
    for (const p of ["/", "/auth", "/dashboard", "/shop-preview/abc", "/shop-preview/abc/p/x", "/shop/ma-boutique/zzz", "/shop/", "/shop"]) {
      expect(getLeanShopKind(p, host)).toBeNull();
    }
  });

  it("sert la vitrine sur la racine d'un domaine personnalisé seulement", () => {
    expect(getLeanShopKind("/", "maboutique.com")).toBe("shop");
    expect(getLeanShopKind("/", "www.maboutique.com")).toBe("shop");
    expect(getLeanShopKind("/", "ecomfy.cloud")).toBeNull();
    expect(getLeanShopKind("/", "ecomfy-git-x.vercel.app")).toBeNull();
    expect(getLeanShopKind("/", "maboutique.com", true)).toBeNull(); // développement
  });
});

describe("isCustomShopHostname", () => {
  it("exclut les domaines d'Ecomfy et d'hébergement", () => {
    for (const h of ["ecomfy.cloud", "www.ecomfy.cloud", "localhost", "127.0.0.1", "x.vercel.app", "x.netlify.app", "x.pages.dev", "x.onrender.com", ""]) {
      expect(isCustomShopHostname(h)).toBe(false);
    }
    expect(isCustomShopHostname("maboutique.ci")).toBe(true);
  });
});

describe("heroImageWidth", () => {
  it("adapte la largeur demandée à l'écran (mêmes seuils que index.html)", () => {
    expect(heroImageWidth(390)).toBe(800);
    expect(heroImageWidth(640)).toBe(800);
    expect(heroImageWidth(641)).toBe(1000);
    expect(heroImageWidth(1024)).toBe(1000);
    expect(heroImageWidth(1025)).toBe(1200);
  });

  it("index.html précharge exactement la même URL que la page (mêmes seuils, même qualité)", () => {
    // Si l'URL préchargée diffère de celle de l'<img>, le navigateur télécharge l'image deux fois.
    const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
    expect(html).toContain(`u.searchParams.set("quality", "${HERO_IMAGE_QUALITY}")`);
    expect(html).toContain("return w <= 640 ? 800 : w <= 1024 ? 1000 : 1200;");
  });
});
