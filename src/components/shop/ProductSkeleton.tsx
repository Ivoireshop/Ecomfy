/**
 * Squelette de la fiche produit, affiché pendant le chargement du code et de la fiche.
 *
 * Volontairement sans aucune dépendance : il est importé par `ShopApp` (donc dans le tout premier fichier de la
 * boutique) et doit rester minuscule. Sa forme est répétée en CSS pur dans `index.html` (`html.vp-product #root:empty`),
 * qui s'affiche avant même que React soit chargé : si vous changez les dimensions ici, changez-les là aussi.
 */
export function ProductSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header skeleton */}
      <div className="border-b sticky top-0 z-40 bg-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="h-9 w-20 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
      {/* Product hero skeleton */}
      <section className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          <div className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
          <div className="space-y-4">
            <div className="h-7 w-3/4 rounded bg-gray-200 animate-pulse" />
            <div className="h-5 w-1/2 rounded bg-gray-200 animate-pulse" />
            <div className="h-10 w-40 rounded bg-gray-200 animate-pulse" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-11/12 rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-10/12 rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="h-12 w-full rounded-xl bg-gray-200 animate-pulse mt-4" />
          </div>
        </div>
      </section>
    </div>
  );
}
