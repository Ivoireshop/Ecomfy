import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, Edit, Trash2, Copy, Package, ExternalLink, Link2, MoreVertical, SlidersHorizontal, Power, QrCode, ScanLine, History, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ProductStockQrDialog } from "./ProductStockQrDialog";
import { ProductThumb } from "./ProductThumb";
import { StockQrScanner } from "./StockQrScanner";
import { StockHistoryDialog } from "./StockHistoryDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPagination } from "@/components/ListPagination";
import { usePagedList } from "@/hooks/usePagedList";
import { fetchShopProductsPage, type ProductSort, type ProductStatusFilter, type ShopProduct as Product } from "@/lib/shopProducts";

const PRODUCTS_PAGE_SIZE = 20;

interface ProductsTableProps {
  shopId: string;
  /** Change après chaque écriture sur les produits : la page affichée est relue. */
  revision: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  /** Renvoie false si la visibilité n'a pas changé. */
  onToggleStatus: (product: Product) => Promise<boolean>;
  onPreviewProduct?: (product: Product) => void;
  shopSlug?: string;
  /** Stock par QR code activé pour cette boutique (Paramètres). */
  stockQrEnabled?: boolean;
  onStockChanged?: () => void;
}

export function ProductsTable({
  shopId, revision, searchQuery, onSearchChange, onAddProduct,
  onEditProduct, onDeleteProduct, onToggleStatus, onPreviewProduct, shopSlug, stockQrEnabled, onStockChanged,
}: ProductsTableProps) {
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<{ id: string; name: string } | null>(null);
  const openHistory = (p: { id: string; name: string } | null) => { setHistoryProduct(p); setHistoryOpen(true); };
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<ProductSort>("recent");
  const [categories, setCategories] = useState<string[]>([]);

  const list = usePagedList({
    pageSize: PRODUCTS_PAGE_SIZE,
    search: searchQuery,
    filterKey: JSON.stringify([shopId, statusFilter, categoryFilter, sortBy]),
    refreshKey: revision,
    fetchPage: async ({ page, pageSize, search }) => {
      const result = await fetchShopProductsPage({
        shopId, page, pageSize, search, sort: sortBy, status: statusFilter,
        category: categoryFilter === "all" ? null : categoryFilter,
      });
      setCategories(result.categories);
      return result;
    },
  });

  // Visibilité affichée dès le clic, avant la réponse du serveur ; oubliée dès que la page est relue.
  const [pendingVisibility, setPendingVisibility] = useState<Record<string, boolean>>({});
  useEffect(() => { setPendingVisibility({}); }, [list.rows]);
  const rows = list.rows.map((p) => (p.id in pendingVisibility ? { ...p, is_published: pendingVisibility[p.id] } : p));

  const toggleStatus = async (product: Product) => {
    if (product.id in pendingVisibility) return;
    setPendingVisibility((prev) => ({ ...prev, [product.id]: !product.is_published }));
    if (!(await onToggleStatus(product))) {
      setPendingVisibility((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    }
  };

  // Stock vide (null) = illimité, comme sur la fiche publique : ce n'est pas une rupture.
  const hasStock = (p: Product) => p.stock_quantity !== null && p.stock_quantity !== undefined;
  const isOutOfStock = (p: Product) => hasStock(p) && p.stock_quantity <= 0;
  const stockLabel = (p: Product) => !hasStock(p) ? "Illimité" : p.stock_quantity <= 0 ? "Rupture" : p.stock_quantity;
  const stockTone = (p: Product) => isOutOfStock(p) ? "text-destructive font-semibold" : hasStock(p) && p.stock_quantity < 5 ? "text-orange-500" : "text-muted-foreground";

  const hasActiveFilter = !!searchQuery.trim() || statusFilter !== "all" || categoryFilter !== "all";

  const copyProductLink = async (slug: string) => {
    const url = `https://ecomfy.cloud/shop/${shopSlug}/p/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Lien copié ✓", description: url });
    } catch {
      toast({ title: "Copie impossible", description: url, variant: "destructive" });
    }
  };

  const formatPrice = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
  const formatDateTime = (d?: string) => d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <h2 className="text-xl font-bold">Produits</h2>
        <div className="flex gap-2">
          {stockQrEnabled && (
            <Button variant="outline" className="gap-2" onClick={() => setScannerOpen(true)}>
              <ScanLine className="h-4 w-4" /> Scanner le stock
            </Button>
          )}
          {stockQrEnabled && (
            <Button variant="outline" className="gap-2" onClick={() => openHistory(null)}>
              <History className="h-4 w-4" /> Historique du stock
            </Button>
          )}
          <Button className="gap-2" onClick={onAddProduct}>
            <Plus className="h-4 w-4" /> Nouveau produit
          </Button>
        </div>
      </div>
      {stockQrEnabled && (
        <StockQrScanner open={scannerOpen} shopId={shopId} onClose={() => setScannerOpen(false)} onStockChanged={onStockChanged} />
      )}
      {stockQrEnabled && (
        <StockHistoryDialog open={historyOpen} shopId={shopId} product={historyProduct} onClose={() => setHistoryOpen(false)} />
      )}
      <ProductStockQrDialog product={qrProduct} onClose={() => setQrProduct(null)} />

      {/* Search & Filters */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-3 md:flex md:flex-row gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProductStatusFilter)}>
              <SelectTrigger className="h-9 md:w-[140px] text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="published">Visibles</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="out_of_stock">En rupture</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 md:w-[160px] text-xs"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as ProductSort)}>
              <SelectTrigger className="h-9 md:w-[170px] text-xs"><SelectValue placeholder="Trier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récents</SelectItem>
                <SelectItem value="name_asc">Nom (A→Z)</SelectItem>
                <SelectItem value="name_desc">Nom (Z→A)</SelectItem>
                <SelectItem value="price_asc">Prix croissant</SelectItem>
                <SelectItem value="price_desc">Prix décroissant</SelectItem>
                <SelectItem value="orders_desc">Plus commandés</SelectItem>
                <SelectItem value="stock_asc">Stock faible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {list.loading ? (
        <Card className="p-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Chargement des produits" />
        </Card>
      ) : list.error ? (
        <Card className="p-12 text-center space-y-3">
          <p className="text-sm text-destructive">Les produits n'ont pas pu être chargés.</p>
          <Button variant="outline" onClick={list.reload}>Réessayer</Button>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">{hasActiveFilter ? "Aucun résultat" : "Aucun produit"}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {hasActiveFilter ? "Essayez un autre terme ou retirez un filtre" : "Ajoutez votre premier produit pour démarrer"}
          </p>
          {hasActiveFilter ? (
            <Button
              variant="outline"
              onClick={() => { onSearchChange(""); setStatusFilter("all"); setCategoryFilter("all"); }}
            >
              Réinitialiser les filtres
            </Button>
          ) : (
            <Button onClick={onAddProduct} className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter un produit
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Mobile card list */}
          <div className="md:hidden divide-y">
            {rows.map((product) => {
              const img = product.product_images?.[0]?.image_url;
              const prodOrders = product.order_count;
              return (
                <div key={product.id} className="p-3 flex gap-3 items-start">
                  <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                    <ProductThumb src={img} lazy />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onEditProduct(product)}
                      className="text-left w-full"
                    >
                      <p className="font-medium text-sm line-clamp-2">{product.name || "Sans nom"}</p>
                      {product.category && (
                        <p className="text-[11px] text-muted-foreground">{product.category}</p>
                      )}
                    </button>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-sm font-semibold whitespace-nowrap">{formatPrice(product.price)}</span>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="text-[11px] text-muted-foreground line-through">{formatPrice(product.compare_at_price)}</span>
                      )}
                      
                      <div className="flex items-center gap-1.5 ml-auto sm:ml-0 bg-muted/40 px-2 py-0.5 rounded-full border">
                        <Switch
                          checked={product.is_published}
                          onCheckedChange={() => toggleStatus(product)}
                        />
                        <span className={`text-[10px] font-bold ${product.is_published ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                          {product.is_published ? "Actif" : "Masqué"}
                        </span>
                      </div>

                      <span className={`text-[11px] ${stockTone(product)}`}>
                        Stock: {stockLabel(product)}
                      </span>
                      {prodOrders > 0 && (
                        <span className="text-[11px] text-muted-foreground">· {prodOrders} cmd</span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Options">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onEditProduct(product)}>
                        <Edit className="h-4 w-4 mr-2" /> Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(product)}>
                        <Power className="h-4 w-4 mr-2" /> {product.is_published ? "Désactiver" : "Activer"}
                      </DropdownMenuItem>
                      {onPreviewProduct && (
                        <DropdownMenuItem onClick={() => onPreviewProduct(product)}>
                          <ExternalLink className="h-4 w-4 mr-2" /> Voir en magasin
                        </DropdownMenuItem>
                      )}
                      {stockQrEnabled && (
                        <DropdownMenuItem onClick={() => setQrProduct(product)}>
                          <QrCode className="h-4 w-4 mr-2" /> QR code stock
                        </DropdownMenuItem>
                      )}
                      {stockQrEnabled && (
                        <DropdownMenuItem onClick={() => openHistory({ id: product.id, name: product.name })}>
                          <History className="h-4 w-4 mr-2" /> Historique du stock
                        </DropdownMenuItem>
                      )}
                      {shopSlug && product.slug && (
                        <DropdownMenuItem onClick={() => copyProductLink(product.slug!)}>
                          <Link2 className="h-4 w-4 mr-2" /> Copier le lien
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteProduct(product)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="[&_th]:px-2 [&_td]:px-2">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12 whitespace-nowrap text-xs"></TableHead>
                  <TableHead className="whitespace-nowrap text-xs">Nom</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs">Prix</TableHead>
                  <TableHead className="text-center whitespace-nowrap text-xs">Inventaire</TableHead>
                  <TableHead className="text-center whitespace-nowrap text-xs">Commandes</TableHead>
                  <TableHead className="text-center whitespace-nowrap text-xs">Visibilité</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">Créé le</TableHead>
                  <TableHead className="text-center whitespace-nowrap text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((product) => {
                  const img = product.product_images?.[0]?.image_url;
                  const prodOrders = product.order_count;
                  return (
                    <TableRow key={product.id} className="group hover:bg-muted/20">
                      <TableCell>
                        <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                          <ProductThumb src={img} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[140px]">
                          <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                          {product.category && (
                            <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm whitespace-nowrap">
                        {formatPrice(product.price)}
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-xs text-muted-foreground line-through ml-1.5 font-normal">
                            {formatPrice(product.compare_at_price)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm ${stockTone(product)}`}>
                          {stockLabel(product)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {prodOrders}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={product.is_published}
                            onCheckedChange={() => toggleStatus(product)}
                          />
                          <span className={`text-xs font-bold ${product.is_published ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                            {product.is_published ? "Actif" : "Masqué"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap" title={formatDateTime(product.created_at)}>
                        {formatDate(product.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {onPreviewProduct && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Voir en magasin" onClick={() => onPreviewProduct(product)}>
                              <ExternalLink className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {shopSlug && product.slug && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Copier le lien produit"
                              onClick={() => copyProductLink(product.slug!)}
                            >
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          {stockQrEnabled && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="QR code stock" onClick={() => setQrProduct(product)}>
                              <QrCode className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          {stockQrEnabled && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Historique du stock" onClick={() => openHistory({ id: product.id, name: product.name })}>
                              <History className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier" onClick={() => onEditProduct(product)}>
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Supprimer" onClick={() => onDeleteProduct(product)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {list.total > list.pageSize ? (
            <ListPagination className="px-4 py-3 border-t" page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={list.setPage} />
          ) : (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              {list.total} résultat{list.total > 1 ? "s" : ""}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
