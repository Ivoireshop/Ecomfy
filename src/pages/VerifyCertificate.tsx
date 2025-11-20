import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Shield, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Certificate {
  student_name: string;
  course_title: string;
  certificate_number: string;
  completion_date: string;
  certificate_url: string;
}

const VerifyCertificate = () => {
  const { certificateNumber } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searchNumber, setSearchNumber] = useState("");

  const verifyCertificate = async (number: string) => {
    if (!number || number.trim() === "") {
      toast.error("Veuillez entrer un numéro de certificat");
      return;
    }

    setLoading(true);
    setNotFound(false);
    setCertificate(null);

    try {
      const { data, error } = await supabase
        .from("course_certificates")
        .select("*")
        .eq("certificate_number", number.toUpperCase().trim())
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setCertificate(data);
      }
    } catch (err) {
      console.error("Error verifying certificate:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (certificateNumber) {
      setSearchNumber(certificateNumber);
      verifyCertificate(certificateNumber);
    }
  }, [certificateNumber]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchNumber) {
      navigate(`/verify-certificate/${searchNumber.toUpperCase().trim()}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-primary/5 py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Vérification de Certificat
          </h1>
          <p className="text-muted-foreground">
            Validez l'authenticité d'un certificat de formation
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Rechercher un certificat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="certificate-number" className="sr-only">
                  Numéro de certificat
                </Label>
                <Input
                  id="certificate-number"
                  placeholder="Ex: CERT-20250120-ABCDE"
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  className="text-lg"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Vérifier"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Vérification en cours...</p>
            </CardContent>
          </Card>
        )}

        {certificate && !loading && (
          <Card className="border-2 border-primary shadow-lg">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center justify-center gap-3 mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
                <div>
                  <CardTitle className="text-2xl text-green-700">
                    Certificat Valide
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Ce certificat est authentique et vérifié
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-8">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Numéro de certificat
                    </Label>
                    <p className="text-lg font-bold text-primary mt-1">
                      {certificate.certificate_number}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Date de complétion
                    </Label>
                    <p className="text-lg font-semibold mt-1">
                      {formatDate(certificate.completion_date)}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <Label className="text-sm text-muted-foreground">
                    Étudiant
                  </Label>
                  <p className="text-2xl font-bold mt-1">
                    {certificate.student_name}
                  </p>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">
                    Formation complétée
                  </Label>
                  <p className="text-xl font-semibold mt-1 text-primary">
                    {certificate.course_title}
                  </p>
                </div>

                <div className="flex justify-center pt-6">
                  <Button
                    onClick={() => window.open(certificate.certificate_url, "_blank")}
                    size="lg"
                    className="w-full md:w-auto"
                  >
                    Voir le certificat complet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {notFound && !loading && (
          <Card className="border-2 border-destructive">
            <CardContent className="py-12 text-center">
              <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h3 className="text-2xl font-bold text-destructive mb-2">
                Certificat non trouvé
              </h3>
              <p className="text-muted-foreground mb-6">
                Le numéro de certificat saisi ne correspond à aucun certificat
                valide dans notre système.
              </p>
              <p className="text-sm text-muted-foreground">
                Vérifiez que vous avez correctement saisi le numéro complet du
                certificat.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Cette page permet de vérifier l'authenticité des certificats émis par
            notre plateforme. Tous les certificats sont enregistrés de manière
            sécurisée et peuvent être vérifiés à tout moment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyCertificate;
