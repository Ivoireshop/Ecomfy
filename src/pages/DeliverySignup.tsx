import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";

export default function DeliverySignup() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  const [form, setForm] = useState({
    company_name: "",
    contact_phone: "",
    contact_email: "",
    whatsapp_number: "",
    city: "",
    coverage_areas: "",
    description: "",
    base_price: 0,
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth?redirect=/delivery-signup"); return; }
      setUserId(user.id);
      const { data } = await supabase.from("delivery_providers").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setExisting(data);
        setForm({
          company_name: data.company_name || "",
          contact_phone: data.contact_phone || "",
          contact_email: data.contact_email || user.email || "",
          whatsapp_number: data.whatsapp_number || "",
          city: data.city || "",
          coverage_areas: (data.coverage_areas || []).join(", "),
          description: data.description || "",
          base_price: Number(data.base_price) || 0,
        });
      } else {
        setForm(f => ({ ...f, contact_email: user.email || "" }));
      }
      setLoading(false);
    })();
  }, [navigate]);

  const save = async () => {
    if (!userId) return;
    if (!form.company_name.trim() || !form.contact_phone.trim()) {
      toast.error("Nom de l'entreprise et téléphone sont requis"); return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      company_name: form.company_name.trim(),
      contact_phone: form.contact_phone.trim(),
      contact_email: form.contact_email.trim() || null,
      whatsapp_number: form.whatsapp_number.trim() || null,
      city: form.city.trim() || null,
      coverage_areas: form.coverage_areas.split(",").map(s => s.trim()).filter(Boolean),
      description: form.description.trim() || null,
      base_price: Number(form.base_price) || 0,
      is_active: true,
    };
    const { error } = existing
      ? await supabase.from("delivery_providers").update(payload).eq("id", existing.id)
      : await supabase.from("delivery_providers").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(existing ? "Fiche mise à jour ✓" : "Compte livreur créé ✓");
    navigate("/delivery-dashboard");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Truck className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{existing ? "Ma fiche livreur" : "Devenir partenaire livreur"}</h1>
          <p className="text-sm text-muted-foreground">Soyez visible auprès de toutes les boutiques VisualPro.</p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-1.5"><Label>Nom de l'entreprise *</Label>
          <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Ex : DLK Services" /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Téléphone *</Label>
            <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+225 07 …" /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label>
            <Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+225 07 …" /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Email</Label>
            <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Ville principale</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Abidjan" /></div>
        </div>
        <div className="space-y-1.5"><Label>Zones couvertes (séparées par des virgules)</Label>
          <Input value={form.coverage_areas} onChange={(e) => setForm({ ...form, coverage_areas: e.target.value })} placeholder="Cocody, Yopougon, Marcory…" /></div>
        <div className="space-y-1.5"><Label>Tarif de base (FCFA)</Label>
          <Input type="number" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label>Description</Label>
          <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Présentez votre service de livraison" /></div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {existing ? "Mettre à jour" : "Créer mon compte livreur"}
        </Button>
      </Card>
    </div>
  );
}