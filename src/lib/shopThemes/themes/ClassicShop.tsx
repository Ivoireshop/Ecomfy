import type { ShopThemeProps } from "../types";
import { formatPrice, getPrimaryImage } from "../dataAdapter";

export default function ClassicShop({ data }: ShopThemeProps) {
  const { shop, products, primaryColor, currency, productHref } = data;
  const featured = products.filter((p) => p.is_featured);
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b sticky top-0 bg-white z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo_url && <img src={shop.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />}
            <div className="font-bold text-lg">{shop.business_name}</div>
          </div>
          <nav className="hidden md:flex gap-6 text-sm text-gray-600">
            <a href="#featured" className="hover:text-gray-900">Vedettes</a>
            <a href="#all" className="hover:text-gray-900">Tous les produits</a>
          </nav>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 py-14 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">{shop.business_name}</h1>
          <p className="mt-4 text-gray-600 text-lg">{shop.business_description}</p>
          <a href="#all" className="inline-block mt-6 px-6 py-3 rounded-lg text-white font-semibold" style={{ backgroundColor: primaryColor }}>
            Découvrir la boutique
          </a>
        </div>
        <div className="aspect-[4/3] rounded-2xl overflow-hidden border" style={{ background: primaryColor + "15" }}>
          {products[0] && (
            <img src={getPrimaryImage(products[0])} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      </section>

      {featured.length > 0 && (
        <section id="featured" className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-6">⭐ Produits en vedette</h2>
          <Grid products={featured.slice(0, 8)} primaryColor={primaryColor} currency={currency} productHref={productHref} />
        </section>
      )}

      <section id="all" className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold mb-6">Tous les produits</h2>
        <Grid products={products} primaryColor={primaryColor} currency={currency} productHref={productHref} />
      </section>

      <footer className="border-t mt-10">
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-500 flex flex-wrap justify-between gap-4">
          <div>© {new Date().getFullYear()} {shop.business_name}</div>
          <div className="opacity-70">Propulsé par VisualPro</div>
        </div>
      </footer>
    </div>
  );
}

function Grid({ products, primaryColor, currency, productHref }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {products.map((p: any) => (
        <a key={p.id} href={productHref(p)} className="group block rounded-xl border bg-white hover:shadow-md transition overflow-hidden">
          <div className="aspect-square bg-gray-50 overflow-hidden">
            <img src={getPrimaryImage(p)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
          </div>
          <div className="p-3">
            <div className="text-sm font-medium line-clamp-2">{p.name}</div>
            <div className="mt-1 font-bold" style={{ color: primaryColor }}>{formatPrice(p.price, currency)}</div>
          </div>
        </a>
      ))}
    </div>
  );
}