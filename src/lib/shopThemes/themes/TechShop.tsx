import type { ShopThemeProps } from "../types";
import { formatPrice, getPrimaryImage } from "../dataAdapter";

export default function TechShop({ data }: ShopThemeProps) {
  const { shop, products, primaryColor, currency, productHref } = data;
  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <header className="border-b border-white/10 bg-[#0b1020]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo_url && <img src={shop.logo_url} alt="" className="max-h-9 w-auto max-w-[200px] object-contain flex-shrink-0" />}
            <div className="font-bold tracking-wide">{shop.business_name}</div>
          </div>
          <a href="#all" className="text-sm px-4 py-2 rounded-md font-semibold text-white" style={{ backgroundColor: primaryColor }}>Boutique</a>
        </div>
      </header>
      <section className="max-w-7xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-400">High-Tech · Officiel</div>
          <h1 className="text-4xl md:text-6xl font-extrabold mt-3 leading-tight">{shop.business_name}</h1>
          <p className="mt-4 text-slate-400 text-lg">{shop.business_description}</p>
          <div className="mt-6 flex gap-3">
            <a href="#all" className="px-6 py-3 rounded-md font-semibold text-white" style={{ backgroundColor: primaryColor }}>Explorer</a>
            <a href="#all" className="px-6 py-3 rounded-md font-semibold border border-white/20 text-white">Nouveautés</a>
          </div>
        </div>
        <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10">
          {products[0] && <img src={getPrimaryImage(products[0])} alt="" className="w-full h-full object-cover" />}
        </div>
      </section>
      <section id="all" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Produits disponibles</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <a key={p.id} href={productHref(p)} className="group block rounded-xl bg-white/5 border border-white/10 hover:border-white/30 transition overflow-hidden">
              <div className="aspect-square bg-black/30 overflow-hidden">
                <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
              </div>
              <div className="p-3">
                <div className="text-sm font-medium line-clamp-2">{p.name}</div>
                <div className="mt-1 font-bold" style={{ color: primaryColor }}>{formatPrice(p.price, currency)}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
      <footer className="border-t border-white/10 mt-10 text-center py-6 text-sm text-slate-500">© {new Date().getFullYear()} {shop.business_name}</footer>
    </div>
  );
}