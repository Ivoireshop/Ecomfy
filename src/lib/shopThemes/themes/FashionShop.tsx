import type { ShopThemeProps } from "../types";
import { formatPrice, getPrimaryImage } from "../dataAdapter";

export default function FashionShop({ data }: ShopThemeProps) {
  const { shop, products, primaryColor, currency, productHref } = data;
  const hero = products[0];
  return (
    <div className="min-h-screen bg-[#faf7f2] text-neutral-900 font-serif">
      <header className="bg-white">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo_url && <img src={shop.logo_url} alt="" className="max-h-9 w-auto max-w-[200px] object-contain flex-shrink-0" />}
            <div className="font-bold tracking-[0.25em] uppercase text-sm">{shop.business_name}</div>
          </div>
          <nav className="hidden md:flex gap-8 text-xs tracking-[0.2em] uppercase text-neutral-700">
            <a href="#new">Nouveautés</a>
            <a href="#all">Collection</a>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="aspect-[16/7] md:aspect-[21/9] w-full overflow-hidden bg-neutral-200">
          {hero && <img src={getPrimaryImage(hero)} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <div className="bg-white/90 backdrop-blur p-6 md:p-10 max-w-md">
              <div className="text-xs tracking-[0.3em] uppercase text-neutral-500">Nouvelle saison</div>
              <h1 className="text-3xl md:text-5xl font-bold mt-3 leading-tight">{shop.business_name}</h1>
              <p className="mt-3 text-neutral-700">{shop.business_description}</p>
              <a href="#all" className="inline-block mt-5 px-6 py-3 text-xs uppercase tracking-[0.3em] text-white" style={{ backgroundColor: primaryColor }}>
                Explorer
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="all" className="max-w-7xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <div className="text-xs tracking-[0.3em] uppercase text-neutral-500">La Collection</div>
          <h2 className="text-3xl font-bold mt-2">Pièces sélectionnées</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((p) => (
            <a key={p.id} href={productHref(p)} className="group block">
              <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
              </div>
              <div className="pt-3 text-center">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs mt-1 tracking-[0.2em] uppercase" style={{ color: primaryColor }}>{formatPrice(p.price, currency)}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-xs tracking-[0.3em] uppercase text-neutral-500">
          © {new Date().getFullYear()} {shop.business_name}
        </div>
      </footer>
    </div>
  );
}