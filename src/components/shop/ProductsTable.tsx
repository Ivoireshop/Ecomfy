import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, Edit, Trash2, Copy, Package, Image as ImageIcon, Upload, ExternalLink } from "lucide-react";

interface Product {
  id: string;
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
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-10"
            />
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead className="text-center">Inventaire</TableHead>
                  <TableHead className="text-center">Commandes</TableHead>
                  <TableHead className="text-center">Visibilité</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
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
                      <TableCell className="text-center">
                        {product.is_published ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
                            Visible
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Brouillon</Badge>
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
