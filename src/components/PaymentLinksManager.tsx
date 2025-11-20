import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ExternalLink } from "lucide-react";

interface PaymentLink {
  id: string;
  course_id: string;
  provider: string;
  payment_url: string;
  is_active: boolean;
}

interface Course {
  id: string;
  title: string;
}

interface PaymentLinksManagerProps {
  showcaseSiteId: string;
}

const PAYMENT_PROVIDERS = [
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "orange", label: "Orange Money" },
  { value: "wave", label: "Wave" },
  { value: "moov", label: "Moov Money" },
  { value: "stripe", label: "Stripe" },
  { value: "paypal", label: "PayPal" },
  { value: "visa", label: "Visa/Mastercard" },
  { value: "other", label: "Autre" },
];

export function PaymentLinksManager({ showcaseSiteId }: PaymentLinksManagerProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [formData, setFormData] = useState({
    provider: "mtn",
    payment_url: "",
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [showcaseSiteId]);

  const loadData = async () => {
    try {
      // Load courses
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("id, title")
        .eq("showcase_site_id", showcaseSiteId)
        .order("title");

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Load payment links
      const { data: linksData, error: linksError } = await supabase
        .from("payment_links")
        .select("*")
        .in(
          "course_id",
          coursesData?.map((c) => c.id) || []
        );

      if (linksError) throw linksError;
      setPaymentLinks(linksData || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourse) {
      toast.error("Veuillez sélectionner une formation");
      return;
    }

    try {
      const { error } = await supabase.from("payment_links").insert([
        {
          course_id: selectedCourse,
          ...formData,
        },
      ]);

      if (error) throw error;

      toast.success("Lien de paiement ajouté avec succès");
      setFormData({ provider: "mtn", payment_url: "", is_active: true });
      setSelectedCourse("");
      loadData();
    } catch (error: any) {
      toast.error("Erreur lors de l'ajout");
      console.error(error);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("payment_links")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "Lien activé" : "Lien désactivé");
      loadData();
    } catch (error: any) {
      toast.error("Erreur lors de la modification");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce lien de paiement ?")) return;

    try {
      const { error } = await supabase.from("payment_links").delete().eq("id", id);
      if (error) throw error;
      toast.success("Lien supprimé");
      loadData();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  const getCourseTitle = (courseId: string) => {
    return courses.find((c) => c.id === courseId)?.title || "Formation inconnue";
  };

  const getProviderLabel = (provider: string) => {
    return PAYMENT_PROVIDERS.find((p) => p.value === provider)?.label || provider;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Créez d'abord des formations avant d'ajouter des liens de paiement
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un lien de paiement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course">Formation *</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une formation" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Fournisseur de paiement *</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) => setFormData({ ...formData, provider: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_url">Lien de paiement *</Label>
              <Input
                id="payment_url"
                type="url"
                placeholder="https://..."
                value={formData.payment_url}
                onChange={(e) => setFormData({ ...formData, payment_url: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Collez ici le lien vers votre page de paiement (MTN Money, Orange Money, Wave,
                Stripe, etc.)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Actif</Label>
            </div>

            <Button type="submit">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter le lien
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Liens de paiement configurés</h3>
        {paymentLinks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun lien de paiement configuré
            </CardContent>
          </Card>
        ) : (
          paymentLinks.map((link) => (
            <Card key={link.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{getCourseTitle(link.course_id)}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{getProviderLabel(link.provider)}</span>
                      <a
                        href={link.payment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Voir le lien
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={link.is_active}
                      onCheckedChange={(checked) => handleToggle(link.id, checked)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
