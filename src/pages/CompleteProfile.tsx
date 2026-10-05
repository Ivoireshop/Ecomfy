import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { profileCompletionService } from "@/services/profileCompletionService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, CheckCircle2, PhoneCall, ShieldCheck, UserCheck, MessageSquare } from "lucide-react";
import { SEO } from "@/components/seo/SEO";

const AFRICAN_COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire", prefix: "+225", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", prefix: "+221", flag: "🇸🇳" },
  { code: "CM", name: "Cameroun", prefix: "+237", flag: "🇨🇲" },
  { code: "ML", name: "Mali", prefix: "+223", flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso", prefix: "+226", flag: "🇧🇫" },
  { code: "TG", name: "Togo", prefix: "+228", flag: "🇹🇬" },
  { code: "BJ", name: "Bénin", prefix: "+229", flag: "🇧🇯" },
  { code: "GA", name: "Gabon", prefix: "+241", flag: "🇬🇦" },
  { code: "CG", name: "Congo", prefix: "+242", flag: "🇨🇬" },
  { code: "CD", name: "RDC", prefix: "+243", flag: "🇨🇩" },
  { code: "GN", name: "Guinée", prefix: "+224", flag: "🇬🇳" },
  { code: "MA", name: "Maroc", prefix: "+212", flag: "🇲🇦" },
  { code: "TN", name: "Tunisie", prefix: "+216", flag: "🇹🇳" },
  { code: "FR", name: "France", prefix: "+33", flag: "🇫🇷" },
];

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { session, user, isReady } = useAuthReady();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryPrefix, setCountryPrefix] = useState("+225");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(true);

  const redirectPath = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    if (!isReady) return;

    if (!session || !user) {
      navigate("/auth", { replace: true });
      return;
    }

    loadProfileData(user);
  }, [isReady, session, user]);

  const loadProfileData = async (currentUser: any) => {
    setLoading(true);
    try {
      setEmail(currentUser.email || "");

      // Fetch existing DB profile
      const dbProfile = await profileCompletionService.getUserProfile(currentUser.id);

      // If already complete, skip directly to dashboard!
      if (dbProfile && profileCompletionService.isProfileComplete(dbProfile)) {
        navigate(redirectPath, { replace: true });
        return;
      }

      // Pre-fill from DB profile or Google metadata
      const rawMeta = currentUser.user_metadata || {};
      const fullMetaName = rawMeta.full_name || rawMeta.name || dbProfile?.full_name || "";
      let gFirst = rawMeta.given_name || dbProfile?.first_name || "";
      let gLast = rawMeta.family_name || dbProfile?.last_name || "";

      if (!gFirst && fullMetaName) {
        const parts = fullMetaName.trim().split(" ");
        gFirst = parts[0] || "";
        gLast = parts.slice(1).join(" ") || "";
      }

      setFirstName(gFirst);
      setLastName(gLast);

      if (dbProfile?.phone) {
        // If phone has prefix e.g. +225 0708091011
        const matchedCountry = AFRICAN_COUNTRIES.find((c) => dbProfile.phone?.startsWith(c.prefix));
        if (matchedCountry) {
          setCountryPrefix(matchedCountry.prefix);
          setPhoneNumber(dbProfile.phone.replace(matchedCountry.prefix, "").trim());
        } else {
          setPhoneNumber(dbProfile.phone);
        }
      }
    } catch (err) {
      console.error("Error loading profile completion data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Prénom et Nom requis",
        description: "Veuillez renseigner votre prénom et votre nom.",
        variant: "destructive",
      });
      return;
    }

    const cleanPhoneDigits = phoneNumber.replace(/\D/g, "");
    if (!cleanPhoneDigits || cleanPhoneDigits.length < 8) {
      toast({
        title: "Numéro WhatsApp invalide",
        description: "Veuillez saisir un numéro de téléphone valide (au moins 8 chiffres).",
        variant: "destructive",
      });
      return;
    }

    const fullInternationalPhone = `${countryPrefix} ${cleanPhoneDigits}`;

    setIsSubmitting(true);
    const result = await profileCompletionService.completeProfile({
      userId: user.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: fullInternationalPhone,
      whatsappConsent: whatsappConsent,
    });

    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Profil finalisé avec succès ! 🎉",
        description: "Bienvenue sur Ecomfy. Votre compte est désormais prêt.",
      });
      navigate(redirectPath, { replace: true });
    } else {
      toast({
        title: "Erreur d'enregistrement",
        description: result.error || "Impossible d'enregistrer vos informations. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0E7C66]" />
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Finalisez votre profil — Ecomfy"
        description="Complétez vos informations pour accéder à Ecomfy."
        path="/complete-profile"
      />
      <div className="min-h-screen w-full bg-gradient-to-br from-emerald-900/5 via-slate-50 to-teal-900/10 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full border-emerald-100 shadow-xl bg-white rounded-2xl overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#0E7C66] via-emerald-600 to-teal-700 p-6 text-white text-center relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Une dernière étape
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Complétez votre profil Ecomfy
            </h1>
            <p className="text-emerald-100/90 text-xs sm:text-sm mt-1">
              Quelques informations rapides pour configurer votre compte et votre accompagnement.
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email badge (read only) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Compte Google :</span>
                <span className="font-bold text-slate-800 font-mono truncate max-w-[200px]">
                  {email}
                </span>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Prénom *</Label>
                  <Input
                    placeholder="ex: Ulrich"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="h-10 text-xs sm:text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nom *</Label>
                  <Input
                    placeholder="ex: Djaté"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="h-10 text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* WhatsApp Phone Number */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" /> Numéro de téléphone WhatsApp *
                </Label>
                <div className="flex gap-2">
                  <Select value={countryPrefix} onValueChange={setCountryPrefix}>
                    <SelectTrigger className="w-[125px] h-10 text-xs font-bold shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AFRICAN_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.prefix} className="text-xs">
                          {c.flag} {c.prefix} ({c.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="tel"
                    placeholder="ex: 07 08 09 10 11"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    className="h-10 text-xs sm:text-sm font-mono flex-1"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Ce numéro servira à l'accompagnement de votre boutique et aux notifications importantes.
                </p>
              </div>

              {/* WhatsApp Communications Consent */}
              <div className="pt-2">
                <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                  <Checkbox
                    id="whatsappConsent"
                    checked={whatsappConsent}
                    onCheckedChange={(checked) => setWhatsappConsent(!!checked)}
                    className="mt-0.5 border-emerald-600 data-[state=checked]:bg-[#0E7C66]"
                  />
                  <label
                    htmlFor="whatsappConsent"
                    className="text-xs text-slate-700 leading-relaxed cursor-pointer select-none"
                  >
                    J’accepte de recevoir les communications Ecomfy sur WhatsApp concernant ma boutique, mon accompagnement, mes commandes et les nouveautés.
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl shadow-lg shadow-[#0E7C66]/20 flex items-center justify-center gap-2 mt-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...
                  </>
                ) : (
                  <>
                    Continuer sur Ecomfy <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 border-t pt-4">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Vos informations sont strictement confidentielles et sécurisées.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
