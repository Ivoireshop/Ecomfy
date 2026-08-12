import { ShopThemeData } from "../types";
import { formatPrice, getPrimaryImage } from "../dataAdapter";

export default function DynamicShop({ data }: { data: ShopThemeData }) {
  const layout = data.settings.layout;
  const blocks = layout?.blocks || [];

  if (!blocks.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Aucun layout configuré pour cet éditeur visuel.
      </div>
    );
  }

  const renderBlock = (block: any) => {
    switch (block.type) {
      case "hero":
        return (
          <div key={block.id} className="w-full bg-blue-50 py-20 text-center">
            <h1 className="text-4xl font-bold mb-4">{data.shopName}</h1>
            <p className="text-lg text-gray-600">{data.shopDescription || "Bienvenue sur notre boutique"}</p>
          </div>
        );
      case "header":
        return (
          <header key={block.id} className="w-full bg-white border-b py-4 px-6 flex justify-between items-center sticky top-0 z-50 shadow-sm">
            <div className="font-bold text-xl">{data.shopName}</div>
            <nav className="hidden md:flex gap-4">
              <a href="#" className="text-sm font-medium hover:text-primary">Accueil</a>
              <a href="#products" className="text-sm font-medium hover:text-primary">Produits</a>
            </nav>
          </header>
        );
      case "product_grid":
        return (
          <div key={block.id} id="products" className="max-w-7xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold mb-8 text-center">Nos Produits</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.products.map(p => (
                <a key={p.id} href={data.productHref(p)} className="group block rounded-xl border bg-white hover:shadow-md transition overflow-hidden">
                  <div className="aspect-square bg-gray-50 overflow-hidden flex items-center justify-center">
                    <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-medium line-clamp-2">{p.name}</div>
                    <div className="mt-1 font-bold" style={{ color: data.primaryColor }}>{formatPrice(p.price, data.currency)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      case "features":
        return (
          <div key={block.id} className="w-full bg-gray-50 py-12 border-y">
            <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <h3 className="font-bold text-lg mb-2">Livraison Rapide</h3>
                <p className="text-gray-600 text-sm">Partout dans le monde</p>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Paiement Sécurisé</h3>
                <p className="text-gray-600 text-sm">100% protégé</p>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Service Client</h3>
                <p className="text-gray-600 text-sm">À votre écoute 7j/7</p>
              </div>
            </div>
          </div>
        );
      case "text_image":
        return (
          <div key={block.id} className="max-w-7xl mx-auto px-4 py-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4">
              <h2 className="text-2xl font-bold">À propos de nous</h2>
              <p className="text-gray-600">Découvrez notre histoire et notre passion pour des produits de qualité. Nous mettons un point d'honneur à satisfaire nos clients.</p>
            </div>
            <div className="flex-1 bg-gray-200 aspect-video rounded-lg flex items-center justify-center text-gray-500">
              Image
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {blocks.map(renderBlock)}
    </div>
  );
}
