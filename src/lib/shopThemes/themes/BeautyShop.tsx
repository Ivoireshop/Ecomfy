import type { ShopThemeProps } from "../types";
import { formatPrice, getPrimaryImage } from "../dataAdapter";

export default function BeautyShop({ data }: ShopThemeProps) {
  const { shop, products, primaryColor, currency, productHref } = data;
  return (
    <div className="min-h-screen text-neutral-800" style={{ background: "linear-gradient(180deg, #fff5f3 0%, #ffffff 60%)" }}>
      <header className="bg-white/80 backdrop-blur sticky top-0 z-30 border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo_url && <img src={shop.logo_url} alt="" className="max-h-10 w-auto max-w-[200px] object-contain flex-shrink-0" />}
            <div className="font-semibold text-lg">{shop.business_name}</div>
          </div>
          <a href="#all" className="text-sm font-medium" style={{ color: primaryColor }}>Découvrir →</a>
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold" style={{ background: primaryColor + "20", color: primaryColor }}>✨ Beauté & Bien-être</div>
          <h1 className="text-4xl md:text-5xl font-bold mt-4 leading-tight">{shop.business_name}</h1>
          <p className="mt-4 text-neutral-600 text-lg">{shop.business_description}</p>
          <a href="#all" className="inline-block mt-6 px-7 py-3 rounded-full text-white font-semibold shadow-lg" style={{ backgroundColor: primaryColor }}>Voir les produits</a>
        </div>
        <div className="aspect-square rounded-[3rem] overflow-hidden shadow-xl" style={{ background: primaryColor + "10" }}>
          {products[0] && <img src={getPrimaryImage(products[0])} alt="" className="w-full h-full object-cover" />}
        </div>
      </section>
      <section id="all" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-center mb-10">Notre sélection beauté</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {products.map((p) => (
            <a key={p.id} href={productHref(p)} className="group block rounded-3xl bg-white shadow-sm hover:shadow-xl transition overflow-hidden">
              <div className="aspect-square bg-rose-50 overflow-hidden">
                <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
              </div>
              <div className="p-4 text-center">
                <div className="text-sm font-medium line-clamp-2">{p.name}</div>
                <div className="mt-2 font-bold" style={{ color: primaryColor }}>{formatPrice(p.price, currency)}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
      <footer className="text-center py-8 text-sm text-neutral-500">© {new Date().getFullYear()} {shop.business_name}</footer>
    </div>
  );
}