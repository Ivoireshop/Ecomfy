import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ShieldCheck } from "lucide-react";

interface CertificateData {
  certificate_number: string;
  student_name: string;
  course_title: string;
  completion_date: string;
}

/**
 * Certificat affiché dans l'application. Le fichier HTML stocké par `generate-certificate` ne peut pas
 * servir de page : le stockage Supabase renvoie le HTML en text/plain (le navigateur en montre le code).
 */
export default function CertificateView() {
  const { certificateNumber } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!certificateNumber) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc("verify_certificate_by_number", {
          _certificate_number: certificateNumber.toUpperCase().trim(),
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        setCertificate((row as CertificateData) || null);
      } catch (error) {
        console.error("Error loading certificate:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [certificateNumber]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-muted-foreground">Certificat introuvable.</p>
        <Button onClick={() => navigate("/verify-certificate")}>Vérifier un certificat</Button>
      </div>
    );
  }

  const completionDate = new Date(certificate.completion_date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const verificationUrl = `${window.location.origin}/verify-certificate/${certificate.certificate_number}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
      <style>{`@page { size: A4 landscape; margin: 0; }`}</style>

      <div className="max-w-5xl mx-auto mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => navigate(`/verify-certificate/${certificate.certificate_number}`)}>
          <ShieldCheck className="h-4 w-4 mr-2" />
          Vérifier
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimer / PDF
        </Button>
      </div>

      <div className="max-w-5xl mx-auto bg-white shadow-xl print:shadow-none aspect-[297/210] border-[8px] border-double border-blue-600 p-6 md:p-10 relative">
        <div className="h-full border-[3px] border-blue-600 p-4 md:p-8 flex flex-col justify-between text-center relative font-serif">
          <img
            src={qrCodeUrl}
            alt="QR code de vérification"
            className="absolute top-3 right-3 w-16 h-16 md:w-24 md:h-24 border-2 border-blue-600 p-1 bg-white"
          />

          <div className="pt-4 md:pt-8 [&_h1]:text-center [&_p]:text-center">
            <h1 className="text-2xl md:text-5xl font-bold text-blue-600 uppercase tracking-[0.2em]">Certificat</h1>
            <p className="mt-2 text-sm md:text-lg italic text-violet-600">Attestation Officielle de Complétion</p>
            <div className="mx-auto mt-3 h-1 w-48 md:w-64 bg-gradient-to-r from-transparent via-blue-600 to-transparent" />
          </div>

          <div className="space-y-3 md:space-y-5 [&_p]:text-center">
            <p className="text-sm md:text-xl text-slate-600">Ce certificat atteste officiellement que</p>
            <p className="block w-fit mx-auto border-b-[3px] border-blue-600 px-6 md:px-14 py-1 md:py-2 text-xl md:text-4xl font-bold text-slate-800 capitalize">
              {certificate.student_name}
            </p>
            <p className="text-sm md:text-xl text-slate-600">a complété avec succès la formation</p>
            <p className="text-lg md:text-3xl font-bold italic text-blue-600">« {certificate.course_title} »</p>
          </div>

          <div className="flex items-end justify-between text-left text-xs md:text-sm text-slate-600">
            <div className="space-y-1">
              <p className="font-semibold">Certificat N° {certificate.certificate_number}</p>
              <p>Délivré le {completionDate}</p>
            </div>
            <p className="text-right">
              Vérifiable sur
              <br />
              <span className="break-all">{verificationUrl}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
