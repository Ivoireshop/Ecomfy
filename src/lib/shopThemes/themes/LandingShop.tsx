import type { ShopThemeProps } from "../types";
import { formatPrice, getPrimaryImage } from "../dataAdapter";

export default function LandingShop({ data }: ShopThemeProps) {
  const { shop, products, primaryColor, currency, productHref } = data;
  const hero = products[0];
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="text-white text-center text-sm py-2 font-semibold" style={{ backgroundColor: primaryColor }}>🔥 OFFRE LIMITÉE — Profitez-en maintenant</div>
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {shop.logo_url && <img src={shop.logo_url} alt="" className="max-h-8 w-auto max-w-[180px] object-contain flex-shrink-0" />}
            <div className="font-bold">{shop.business_name}</div>
          </div>
          <a href="#cta" className="text-xs font-bold px-4 py-2 rounded-full text-white" style={{ backgroundColor: primaryColor }}>Commander</a>
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="inline-block text-xs font-bold uppercase px-3 py-1 rounded-full" style={{ background: primaryColor + "20", color: primaryColor }}>⭐ Bestseller</div>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mt-3">{shop.business_name}</h1>
          <p className="mt-3 text-gray-700 text-lg">{shop.business_description}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>✅ Livraison rapide partout</li>
            <li>✅ Paiement à la livraison</li>
            <li>✅ Satisfaction garantie</li>
          </ul>
          <a id="cta" href={hero ? productHref(hero) : "#all"} className="mt-6 inline-block px-8 py-4 rounded-xl text-white font-extrabold text-lg shadow-xl" style={{ backgroundColor: primaryColor }}>🛒 Commander maintenant</a>
        </div>
        <div className="aspect-square rounded-2xl overflow-hidden border bg-gray-100">
          {hero && <img src={getPrimaryImage(hero)} alt="" className="w-full h-full object-cover" />}
        </div>
      </section>
      <section id="all" className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-center mb-6">Nos meilleures offres</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {products.map((p) => (
            <a key={p.id} href={productHref(p)} className="block rounded-xl border bg-white hover:shadow-lg transition overflow-hidden">
              <div className="aspect-square bg-gray-100">
                <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
                <div className="mt-1 font-extrabold" style={{ color: primaryColor }}>{formatPrice(p.price, currency)}</div>
                <div className="mt-2 text-center py-2 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: primaryColor }}>Commander</div>
              </div>
            </a>
          ))}
        </div>
      </section>
      <footer className="text-center py-6 text-xs text-gray-500 border-t">© {new Date().getFullYear()} {shop.business_name}</footer>
    </div>
  );
}