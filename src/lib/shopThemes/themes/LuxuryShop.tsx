import type { ShopThemeProps } from "../types";
import { formatPrice, getPrimaryImage } from "../dataAdapter";

export default function LuxuryShop({ data }: ShopThemeProps) {
  const { shop, products, primaryColor, currency, productHref } = data;
  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo_url && <img src={shop.logo_url} alt="" className="h-10 w-10 rounded object-cover" />}
            <div className="font-serif text-2xl tracking-wider">{shop.business_name}</div>
          </div>
          <nav className="hidden md:flex gap-8 text-xs tracking-[0.3em] uppercase text-neutral-400">
            <a href="#all">Maison</a><a href="#all">Collection</a><a href="#all">Contact</a>
          </nav>
        </div>
      </header>
      <section className="relative">
        <div className="aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden">
          {products[0] && <img src={getPrimaryImage(products[0])} alt="" className="w-full h-full object-cover opacity-90" />}
        </div>
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto px-6 pb-12 w-full">
            <div className="text-xs tracking-[0.4em] uppercase text-neutral-300">Maison</div>
            <h1 className="font-serif text-4xl md:text-6xl mt-2">{shop.business_name}</h1>
            <p className="mt-3 text-neutral-300 max-w-xl">{shop.business_description}</p>
            <a href="#all" className="inline-block mt-6 px-8 py-3 text-xs uppercase tracking-[0.3em] border border-white text-white hover:bg-white hover:text-black transition">Découvrir</a>
          </div>
        </div>
      </section>
      <section id="all" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-xs tracking-[0.4em] uppercase text-neutral-500">Sélection</div>
          <h2 className="font-serif text-3xl mt-2">Pièces d'exception</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {products.map((p) => (
            <a key={p.id} href={productHref(p)} className="group block">
              <div className="aspect-[3/4] overflow-hidden bg-neutral-900">
                <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" loading="lazy" />
              </div>
              <div className="pt-4 text-center">
                <div className="text-sm tracking-widest uppercase">{p.name}</div>
                <div className="text-xs mt-1 tracking-[0.2em]" style={{ color: primaryColor }}>{formatPrice(p.price, currency)}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
      <footer className="border-t border-white/10 py-8 text-center text-xs tracking-[0.4em] uppercase text-neutral-500">© {new Date().getFullYear()} {shop.business_name}</footer>
    </div>
  );
}