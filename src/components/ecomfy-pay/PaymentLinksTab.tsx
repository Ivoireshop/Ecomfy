import React, { useState, useEffect } from "react";
import { PaymentLink } from "@/types/ecomfyPay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link, Copy, Plus, Check, QrCode, Truck, Share2, Download, Smartphone, SlidersHorizontal, Store, Sparkles } from "lucide-react";
import { ecomfyPayApi } from "@/lib/ecomfyPay";
import { PaymentMethodLogo } from "./PaymentMethodLogo";

interface PaymentLinksTabProps {
  paymentLinks: PaymentLink[];
  shopId?: string;
  shops?: { id: string; name: string }[];
  onRefresh: () => void;
  formatPrice: (amount: number) => string;
}

export const PaymentLinksTab: React.FC<PaymentLinksTabProps> = ({
  paymentLinks,
  shopId: initialShopId,
  shops = [],
  onRefresh,
  formatPrice,
}) => {
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [qrModalLink, setQrModalLink] = useState<PaymentLink | null>(null);

  const [selectedShopId, setSelectedShopId] = useState<string>(initialShopId || (shops[0]?.id || ""));
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [allowCustomAmount, setAllowCustomAmount] = useState(true);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync selected shop ID when initialShopId or shops prop updates
  useEffect(() => {
    if (initialShopId) {
      setSelectedShopId(initialShopId);
    } else if (shops.length > 0 && !selectedShopId) {
      setSelectedShopId(shops[0].id);
    }
  }, [initialShopId, shops]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetShopId = selectedShopId || initialShopId || (shops[0]?.id || "");

    // Fallback: If no shop is found, get or create default shop for session user
    if (!targetShopId) {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: existingShops } = await supabase
            .from("shops")
            .select("id")
            .eq("user_id", session.user.id)
            .limit(1);

          if (existingShops && existingShops.length > 0) {
            targetShopId = existingShops[0].id;
          } else {
            // Auto create main shop for merchant
            const { data: newShop } = await supabase
              .from("shops")
              .insert({
                user_id: session.user.id,
                name: "Ma Boutique Ecomfy",
                business_name: "Ma Boutique Ecomfy",
              })
              .select("id")
              .single();

            if (newShop) targetShopId = newShop.id;
          }
        }
      } catch (err) {
        console.error("[PaymentLinks] Shop resolve fallback error", err);
      } finally {
        setLoading(false);
      }
    }

    if (!targetShopId) {
      toast({
        title: "Boutique requise",
        description: "Impossible d'identifier votre boutique. Veuillez réessayer.",
        variant: "destructive",
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: "Montant invalide", description: "Veuillez entrer un montant valide.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const res = await ecomfyPayApi.createPaymentLink({
      shop_id: targetShopId,
      title,
      description,
      amount: numAmount,
      allow_custom_amount: allowCustomAmount,
    });
    setLoading(false);

    if (res.success) {
      toast({ title: "Payment Link créé ✓", description: "Votre lien de paiement est prêt." });
      setOpenCreateModal(false);
      setTitle("");
      setAmount("");
      setDescription("");
      setAllowCustomAmount(true);
      onRefresh();
    } else {
      toast({ title: "Erreur", description: res.error || "Impossible de créer le lien.", variant: "destructive" });
    }
  };

  const copyToClipboard = (linkKey: string, id: string) => {
    const url = `${window.location.origin}/pay/${linkKey}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: "Lien copié !", description: url });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareOnWhatsapp = (link: PaymentLink) => {
    const url = `${window.location.origin}/pay/${link.link_key}`;
    const text = `Bonjour, voici votre lien de paiement Ecomfy Pay pour "${link.title}": ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 text-base">Ecomfy Pay Payment Links &amp; QR Codes Livreur</h4>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Générez facilement vos liens de paiement directs et vos QR Codes pour le paiement en ligne ou à la livraison.
          </p>
        </div>

        <Button
          className="bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-extrabold rounded-xl text-xs gap-2 shadow-md shrink-0 h-10 px-4"
          onClick={() => setOpenCreateModal(true)}
        >
          <Plus className="w-4 h-4" /> Créer un Payment Link
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentLinks.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
            <Link className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">Aucun Payment Link créé</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Créez un lien de paiement direct pour vos produits ou services en 1 clic.
            </p>
            <Button
              className="bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-bold rounded-xl text-xs"
              onClick={() => setOpenCreateModal(true)}
            >
              Générer mon premier lien
            </Button>
          </div>
        ) : (
          paymentLinks.map((link) => {
            const url = `${window.location.origin}/pay/${link.link_key}`;
            const isCopied = copiedId === link.id;

            return (
              <div
                key={link.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-900 text-base">{link.title}</h5>
                        {link.allow_custom_amount && (
                          <Badge className="bg-amber-100 text-amber-900 text-[10px] font-extrabold border-0">
                            ⚡ Montant Ajustable
                          </Badge>
                        )}
                      </div>
                      {link.products?.name && (
                        <span className="text-xs text-slate-500 block mt-0.5">
                          Produit lié : {link.products.name}
                        </span>
                      )}
                    </div>
                    <span className="font-extrabold text-base text-[#0E7C66] shrink-0 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                      {formatPrice(link.amount)} FCFA
                    </span>
                  </div>
                  {link.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {link.description}
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={url}
                      className="text-xs h-9 font-mono bg-slate-50 text-slate-600 rounded-xl"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 text-xs font-semibold rounded-xl shrink-0 gap-1"
                      onClick={() => copyToClipboard(link.link_key, link.id)}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? "Copié !" : "Copier"}</span>
                    </Button>
                  </div>

                  {/* Boutons d'Action Livreur & QR Code */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 text-xs font-extrabold rounded-xl h-9 gap-1.5"
                      onClick={() => setQrModalLink(link)}
                    >
                      <QrCode className="w-4 h-4 text-amber-600" />
                      <span>QR Code Livreur (COD)</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-xl shrink-0 gap-1.5"
                      onClick={() => shareOnWhatsapp(link)}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Création Payment Link avec Sélecteur de Boutique Intégré */}
      <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Créer un Payment Link Ecomfy Pay
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Renseignez les informations de votre lien de paiement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 text-xs font-medium pt-2">
            {/* Sélecteur de Boutique s'il y a des boutiques disponibles */}
            {shops.length > 0 && (
              <div>
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#0E7C66]" />
                  <span>Boutique rattachée</span>
                </Label>
                <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                  <SelectTrigger className="mt-1.5 font-bold h-10">
                    <SelectValue placeholder="Sélectionnez votre boutique" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="font-semibold">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-bold text-slate-700">Titre du lien de paiement</Label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Produit X ou Acompte Commande"
                className="mt-1.5 font-semibold h-10"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Prix unitaire indicatif (FCFA)</Label>
              <Input
                required
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 7500"
                className="mt-1.5 font-bold text-sm h-10"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Description (Optionnelle)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Livraison directe à Abidjan"
                className="mt-1.5 font-medium h-10"
              />
            </div>

            {/* Toggle Montant Ajustable / Quantités Multiples */}
            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                  <span>Autoriser le montant flexible / ajustable</span>
                </Label>
                <p className="text-[10px] text-amber-800">
                  Permet d'ajuster la quantité (1, 2, 3...) ou le montant exact lors du paiement sur le terrain.
                </p>
              </div>
              <Switch
                checked={allowCustomAmount}
                onCheckedChange={setAllowCustomAmount}
                className="data-[state=checked]:bg-amber-600 shrink-0"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-extrabold rounded-2xl h-11 text-sm mt-2 shadow-md"
            >
              {loading ? "Création en cours..." : "Générer le Payment Link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal QR Code Livreur & Cash on Delivery */}
      {qrModalLink && (
        <Dialog open={!!qrModalLink} onOpenChange={() => setQrModalLink(null)}>
          <DialogContent className="max-w-sm rounded-3xl p-6 text-center space-y-4">
            <DialogHeader>
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-1 border border-amber-200">
                <Truck className="w-6 h-6" />
              </div>
              <DialogTitle className="text-base font-extrabold text-slate-900">
                QR Code de Paiement Livreur (COD)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Le livreur présente ce QR Code au client sur le lieu de livraison pour régler directement.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-white p-4 rounded-3xl border-2 border-slate-200 shadow-md inline-block mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                  `${window.location.origin}/pay/${qrModalLink.link_key}`
                )}`}
                alt="QR Code Paiement Livreur"
                className="w-52 h-52 mx-auto"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 block font-semibold">{qrModalLink.title}</span>
              <span className="text-lg font-extrabold text-[#0E7C66] block">
                {formatPrice(qrModalLink.amount)} FCFA {qrModalLink.allow_custom_amount && "(Ajustable)"}
              </span>
              <div className="flex justify-center gap-1.5 pt-1">
                <PaymentMethodLogo id="wave" size={22} />
                <PaymentMethodLogo id="orange" size={22} />
                <PaymentMethodLogo id="mtn" size={22} />
                <PaymentMethodLogo id="moov" size={22} />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => shareOnWhatsapp(qrModalLink)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-10 rounded-xl gap-2 shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>Envoyer au client sur WhatsApp</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => setQrModalLink(null)}
                className="text-xs font-bold rounded-xl h-9"
              >
                Fermer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
