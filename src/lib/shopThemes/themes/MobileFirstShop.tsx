import type { ShopThemeProps } from "../types";
import { formatPrice, getPrimaryImage } from "../dataAdapter";

export default function MobileFirstShop({ data }: ShopThemeProps) {
  const { shop, products, primaryColor, currency, productHref } = data;
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-30 bg-white border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {shop.logo_url && <img src={shop.logo_url} alt="" className="max-h-8 w-auto max-w-[180px] object-contain flex-shrink-0" />}
            <div className="font-bold truncate">{shop.business_name}</div>
          </div>
          <a href="#all" className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: primaryColor }}>Acheter</a>
        </div>
      </header>
      <section className="px-4 py-6">
        <div className="rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="aspect-[16/9] bg-gray-100">
            {products[0] && <img src={getPrimaryImage(products[0])} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="p-4">
            <h1 className="text-xl font-extrabold leading-tight">{shop.business_name}</h1>
            <p className="text-sm text-gray-600 mt-1">{shop.business_description}</p>
            <a href="#all" className="mt-3 block text-center py-3 rounded-xl text-white font-semibold" style={{ backgroundColor: primaryColor }}>Voir les produits</a>
          </div>
        </div>
      </section>
      <section id="all" className="px-4 pb-24">
        <h2 className="text-lg font-bold mb-3">Produits</h2>
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <a key={p.id} href={productHref(p)} className="block rounded-2xl bg-white overflow-hidden shadow-sm active:scale-[0.98] transition">
              <div className="aspect-square bg-gray-100">
                <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                <div className="text-sm font-medium line-clamp-2">{p.name}</div>
                <div className="mt-1 font-bold text-sm" style={{ color: primaryColor }}>{formatPrice(p.price, currency)}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}