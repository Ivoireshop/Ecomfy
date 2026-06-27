import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, Edit, Trash2, Copy, Package, Image as ImageIcon, Upload, ExternalLink, Link2, MoreVertical, SlidersHorizontal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  slug?: string | null;
  name: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string;
  stock_quantity: number;
  is_published: boolean;
  is_digital: boolean;
  is_featured: boolean;
  display_order: number;
  currency: string | null;
  sku: string | null;
  weight: number | null;
  created_at?: string;
  product_images?: { id: string; image_url: string; is_primary: boolean; display_order: number }[];
}

interface ProductsTableProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onUploadImage: (productId: string, file: File) => void;
  onPreviewProduct?: (product: Product) => void;
  primaryColor: string;
  orders: { order_items?: { product_id: string; quantity: number }[] }[];
  shopSlug?: string;
}

export function ProductsTable({
  products, searchQuery, onSearchChange, onAddProduct,
  onEditProduct, onDeleteProduct, onUploadImage, onPreviewProduct, primaryColor, orders, shopSlug,
}: ProductsTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");

  // Count distinct orders per product (1 order = 1, even if multiple units)
  const orderCounts: Record<string, number> = {};
  orders.forEach(o => {
    const seen = new Set<string>();
    o.order_items?.forEach(item => {
      if (!seen.has(item.product_id)) {
        seen.add(item.product_id);
        orderCounts[item.product_id] = (orderCounts[item.product_id] || 0) + 1;
      }
    });
  });

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const filtered = products
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(p => statusFilter === "all"
      || (statusFilter === "published" && p.is_published)
      || (statusFilter === "draft" && !p.is_published)
      || (statusFilter === "out_of_stock" && p.stock_quantity <= 0))
    .filter(p => categoryFilter === "all" || p.category === categoryFilter)
    .sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "orders_desc") return (orderCounts[b.id] || 0) - (orderCounts[a.id] || 0);
      if (sortBy === "stock_asc") return a.stock_quantity - b.stock_quantity;
      return (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime());
    });

  const formatPrice = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <h2 className="text-xl font-bold">Produits</h2>
        <Button className="gap-2" onClick={onAddProduct}>
          <Plus className="h-4 w-4" /> Nouveau produit
        </Button>
      </div>

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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <Select value={sortBy} onValueChange={setSortBy}>
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

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">{searchQuery ? "Aucun résultat" : "Aucun produit"}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery ? "Essayez un autre terme" : "Ajoutez votre premier produit pour démarrer"}
          </p>
          {!searchQuery && (
            <Button onClick={onAddProduct} className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter un produit
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Mobile card list */}
          <div className="md:hidden divide-y">
            {filtered.map((product) => {
              const img = product.product_images?.[0]?.image_url;
              const prodOrders = orderCounts[product.id] || 0;
              return (
                <div key={product.id} className="p-3 flex gap-3 items-start">
                  <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                    {img ? (
                      <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
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
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-sm font-semibold whitespace-nowrap">{formatPrice(product.price)}</span>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="text-[11px] text-muted-foreground line-through">{formatPrice(product.compare_at_price)}</span>
                      )}
                      {product.is_published ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px] px-1.5 py-0">Visible</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Brouillon</Badge>
                      )}
                      <span className={`text-[11px] ${product.stock_quantity <= 0 ? "text-destructive font-semibold" : product.stock_quantity < 5 ? "text-orange-500" : "text-muted-foreground"}`}>
                        Stock: {product.stock_quantity <= 0 ? "Rupture" : product.stock_quantity}
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
                      {onPreviewProduct && (
                        <DropdownMenuItem onClick={() => onPreviewProduct(product)}>
                          <ExternalLink className="h-4 w-4 mr-2" /> Voir en magasin
                        </DropdownMenuItem>
                      )}
                      {shopSlug && product.slug && (
                        <DropdownMenuItem
                          onClick={() => {
                            const url = `https://visuelpro.cloud/shop/${shopSlug}/p/${product.slug}`;
                            navigator.clipboard.writeText(url);
                            toast({ title: "Lien copié ✓", description: url });
                          }}
                        >
                          <Link2 className="h-4 w-4 mr-2" /> Copier le lien
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteProduct(product.id)}
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
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12 whitespace-nowrap text-xs"></TableHead>
                  <TableHead className="whitespace-nowrap text-xs">Nom</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs">Prix</TableHead>
                  <TableHead className="text-center whitespace-nowrap text-xs">Inventaire</TableHead>
                  <TableHead className="text-center whitespace-nowrap text-xs">Commandes</TableHead>
                  <TableHead className="text-center whitespace-nowrap text-xs">Visibilité</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">Date de création</TableHead>
                  <TableHead className="text-center whitespace-nowrap text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => {
                  const img = product.product_images?.[0]?.image_url;
                  const prodOrders = orderCounts[product.id] || 0;
                  return (
                    <TableRow key={product.id} className="group hover:bg-muted/20">
                      <TableCell>
                        <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                          {img ? (
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[180px]">
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
                        <span className={`text-sm ${product.stock_quantity <= 0 ? "text-destructive font-semibold" : product.stock_quantity < 5 ? "text-orange-500" : "text-muted-foreground"}`}>
                          {product.stock_quantity <= 0 ? "Rupture" : product.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {prodOrders}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {product.is_published ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs whitespace-nowrap">
                            Visible
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">Brouillon</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
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
                              onClick={() => {
                                const url = `https://visuelpro.cloud/shop/${shopSlug}/p/${product.slug}`;
                                navigator.clipboard.writeText(url);
                                toast({ title: "Lien copié ✓", description: url });
                              }}
                            >
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier" onClick={() => onEditProduct(product)}>
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Supprimer" onClick={() => onDeleteProduct(product.id)}>
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
          <div className="px-4 py-3 border-t text-xs text-muted-foreground">
            Afficher 1 - {filtered.length} de {filtered.length} résultats
          </div>
        </Card>
      )}
    </div>
  );
}
