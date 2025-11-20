import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Clock, Users, ArrowLeft, CreditCard, MessageCircle, ExternalLink, ShoppingCart } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string | null;
  short_description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  category: string;
  duration: string | null;
  level: string | null;
  max_participants: number | null;
}

interface PaymentLink {
  id: string;
  provider: string;
  payment_url: string;
}

interface ModuleContent {
  id: string;
  title: string;
  content_type: string;
  duration_minutes: number | null;
}

interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  module_order: number;
  module_contents: ModuleContent[];
}

interface ShowcaseCourseDetailProps {
  courseId: string;
  showcaseSiteId: string;
  onBack: () => void;
  primaryColor?: string;
  textColor?: string;
}

export function ShowcaseCourseDetail({
  courseId,
  showcaseSiteId,
  onBack,
  primaryColor = "#2563eb",
  textColor = "#000000",
}: ShowcaseCourseDetailProps) {
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [inquiryForm, setInquiryForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const loadCourse = async () => {
    try {
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      const { data: linksData, error: linksError } = await supabase
        .from("payment_links")
        .select("*")
        .eq("course_id", courseId)
        .eq("is_active", true);

      if (linksError) throw linksError;
      setPaymentLinks(linksData || []);

      // Load course modules with their contents
      const { data: modulesData, error: modulesError } = await supabase
        .from("course_modules")
        .select(`
          id,
          title,
          description,
          duration_minutes,
          module_order,
          module_contents (
            id,
            title,
            content_type,
            duration_minutes
          )
        `)
        .eq("course_id", courseId)
        .eq("is_published", true)
        .order("module_order", { ascending: true });

      if (modulesError) throw modulesError;
      setModules(modulesData || []);
    } catch (error) {
      console.error("Error loading course:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase.from("course_inquiries").insert([
        {
          course_id: courseId,
          showcase_site_id: showcaseSiteId,
          ...inquiryForm,
        },
      ]);

      if (error) throw error;

      toast.success("Votre demande a été envoyée avec succès !");
      setInquiryForm({ name: "", email: "", phone: "", message: "" });
      setDialogOpen(false);
    } catch (error) {
      console.error("Error submitting inquiry:", error);
      toast.error("Erreur lors de l'envoi de votre demande");
    } finally {
      setSubmitting(false);
    }
  };

  const getProviderLabel = (provider: string) => {
    const labels: Record<string, string> = {
      mtn: "MTN Mobile Money",
      orange: "Orange Money",
      wave: "Wave",
      moov: "Moov Money",
      stripe: "Stripe",
      paypal: "PayPal",
      visa: "Visa/Mastercard",
      other: "Autre",
    };
    return labels[provider] || provider;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Formation introuvable</p>
        <Button onClick={onBack} className="mt-4">
          Retour au catalogue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-12">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour au catalogue
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {course.image_url && (
            <img
              src={course.image_url}
              alt={course.title}
              className="w-full h-96 object-cover rounded-lg"
            />
          )}

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Badge className="capitalize">{course.category}</Badge>
              {course.level && <Badge variant="outline">{course.level}</Badge>}
            </div>
            <h1 className="text-4xl font-bold mb-4" style={{ color: textColor }}>
              {course.title}
            </h1>
            {course.short_description && (
              <p className="text-xl text-muted-foreground mb-4">
                {course.short_description}
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Description détaillée</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">
                {course.description || "Aucune description disponible."}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {course.duration && (
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <Clock className="h-8 w-8" style={{ color: primaryColor }} />
                  <div>
                    <div className="text-sm text-muted-foreground">Durée</div>
                    <div className="font-semibold">{course.duration}</div>
                  </div>
                </CardContent>
              </Card>
            )}
            {course.max_participants && (
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <Users className="h-8 w-8" style={{ color: primaryColor }} />
                  <div>
                    <div className="text-sm text-muted-foreground">Max participants</div>
                    <div className="font-semibold">{course.max_participants}</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {modules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Programme de la formation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {modules.map((module, index) => (
                  <div key={module.id} className="border-b last:border-0 pb-4 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div 
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-1">{module.title}</h4>
                        {module.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {module.description}
                          </p>
                        )}
                        {module.duration_minutes && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                            <Clock className="h-4 w-4" />
                            <span>{module.duration_minutes} minutes</span>
                          </div>
                        )}
                        {module.module_contents && module.module_contents.length > 0 && (
                          <ul className="space-y-1 mt-2">
                            {module.module_contents.map((content: ModuleContent) => (
                              <li key={content.id} className="text-sm flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                <span>{content.title}</span>
                                {content.duration_minutes && (
                                  <span className="text-muted-foreground">
                                    ({content.duration_minutes} min)
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>S'inscrire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4 border-b">
                <div className="text-4xl font-bold" style={{ color: primaryColor }}>
                  {course.price.toLocaleString()} {course.currency}
                </div>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" variant="outline">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Réserver / Demander info
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Demander des informations</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleInquirySubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom complet *</Label>
                      <Input
                        id="name"
                        value={inquiryForm.name}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inquiryForm.email}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, email: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input
                        id="phone"
                        value={inquiryForm.phone}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        rows={4}
                        value={inquiryForm.message}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, message: e.target.value })
                        }
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        "Envoyer la demande"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Button
                className="w-full"
                size="lg"
                style={{ backgroundColor: primaryColor }}
                onClick={() => navigate(`/enroll/${courseId}`)}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                S'inscrire à cette formation
              </Button>

              {paymentLinks.length > 0 && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">ou paiement direct</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {paymentLinks.map((link) => (
                      <Button
                        key={link.id}
                        className="w-full"
                        variant="outline"
                        asChild
                      >
                        <a
                          href={link.payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Payer via {getProviderLabel(link.provider)}
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
