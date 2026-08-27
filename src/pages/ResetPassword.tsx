import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Mail, Lock, CheckCircle2, Eye, EyeOff, KeyRound, AlertCircle, ShieldCheck } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState((location.state as any)?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessSent, setIsSuccessSent] = useState(false);
  const [isResetComplete, setIsResetComplete] = useState(false);

  const [step, setStep] = useState<"request" | "reset">("request");

  useEffect(() => {
    // 1. Inspect URL parameters (hash & query string) for recovery token
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);

    const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
    const type = hashParams.get("type") || searchParams.get("type");
    const code = searchParams.get("code");

    if ((accessToken && type === "recovery") || code || type === "recovery") {
      setStep("reset");
    }

    // 2. Listen to Supabase Auth State Change for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth recovery event detected:", event, !!session);
      if (event === "PASSWORD_RECOVERY" || (session && (type === "recovery" || window.location.hash.includes("type=recovery")))) {
        setStep("reset");
      }
    });

    // 3. Check existing active session for recovery
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && (type === "recovery" || window.location.hash.includes("type=recovery"))) {
        setStep("reset");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const validatePassword = (pwd: string): { valid: boolean; message?: string } => {
    if (pwd.length < 8) {
      return { valid: false, message: "Le mot de passe doit contenir au moins 8 caractères" };
    }
    if (!/[A-Z]/.test(pwd)) {
      return { valid: false, message: "Le mot de passe doit contenir au moins une majuscule (A-Z)" };
    }
    if (!/[a-z]/.test(pwd)) {
      return { valid: false, message: "Le mot de passe doit contenir au moins une minuscule (a-z)" };
    }
    if (!/[0-9]/.test(pwd)) {
      return { valid: false, message: "Le mot de passe doit contenir au moins un chiffre (0-9)" };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      return { valid: false, message: "Le mot de passe doit contenir au moins un caractère spécial (!@#$%...)" };
    }
    return { valid: true };
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast({
        title: "Email requis",
        description: "Veuillez saisir votre adresse email.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setIsSuccessSent(true);
      toast({
        title: "Email de réinitialisation envoyé ! 📧",
        description: "Veuillez consulter votre boîte de réception pour créer votre nouveau mot de passe.",
      });
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      toast({
        title: "Erreur lors de l'envoi",
        description: error.message || "Impossible d'envoyer l'email de réinitialisation. Veuillez vérifier votre adresse.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir les deux champs de mot de passe.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Mots de passe non identiques",
        description: "Le mot de passe et sa confirmation ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    const check = validatePassword(password);
    if (!check.valid) {
      toast({
        title: "Mot de passe insuffisant",
        description: check.message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setIsResetComplete(true);
      toast({
        title: "Mot de passe réinitialisé ! 🎉",
        description: "Votre nouveau mot de passe est enregistré. Vous allez être redirigé vers la page de connexion.",
      });

      setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 2500);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        title: "Erreur de réinitialisation",
        description: error.message || "Une erreur est survenue lors de l'enregistrement de votre nouveau mot de passe.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Indicateurs visuels des exigences du mot de passe
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isMatch = password.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        
        {/* Navigation retour */}
        <Button
          variant="ghost"
          onClick={() => navigate("/auth")}
          className="text-slate-600 hover:text-slate-900 font-semibold"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la page de connexion
        </Button>

        {step === "request" ? (
          <Card className="border border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#0E7C66] text-white p-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto border border-white/20">
                <KeyRound className="h-6 w-6 text-emerald-400" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Mot de passe oublié ?
              </CardTitle>
              <CardDescription className="text-slate-200 text-xs sm:text-sm">
                Pas de souci ! Saisissez votre adresse email pour recevoir un lien sécurisé de réinitialisation.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6">
              {isSuccessSent ? (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-900">Email envoyé avec succès ! 📧</h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Un lien de réinitialisation a été transmis à <strong className="text-slate-900">{email}</strong>. 
                      Veuillez consulter votre boîte de réception (et vos dossiers spams/courriers indésirables).
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsSuccessSent(false)} 
                      className="w-full text-xs font-semibold"
                    >
                      Renvoyer avec une autre adresse
                    </Button>
                    <Button 
                      onClick={() => navigate("/auth")} 
                      className="w-full bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-bold text-xs"
                    >
                      Retour à la connexion
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRequestReset} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Votre Adresse Email *
                    </Label>
                    <div className="relative">
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="exemple@domaine.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="pl-10 h-11 rounded-xl border-slate-200 focus:border-[#0E7C66] focus:ring-[#0E7C66]"
                      />
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-bold text-sm shadow-md"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Envoi du lien en cours...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Envoyer le lien de réinitialisation
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#0E7C66] text-white p-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto border border-white/20">
                <ShieldCheck className="h-6 w-6 text-amber-400" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Nouveau mot de passe 🔒
              </CardTitle>
              <CardDescription className="text-slate-200 text-xs sm:text-sm">
                Définissez votre nouveau mot de passe sécurisé pour votre compte Ecomfy.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6">
              {isResetComplete ? (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 animate-bounce" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-900">Mot de passe réinitialisé ! 🎉</h3>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Votre nouveau mot de passe a été enregistré avec succès. Vous allez être redirigé vers la page de connexion.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  
                  {/* Nouveau mot de passe */}
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Nouveau mot de passe *
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="pl-10 pr-10 h-11 rounded-xl border-slate-200 focus:border-[#0E7C66]"
                      />
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmer le mot de passe */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Confirmer le mot de passe *
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="pl-10 pr-10 h-11 rounded-xl border-slate-200 focus:border-[#0E7C66]"
                      />
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Règles de sécurité interactives */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                    <p className="font-semibold text-slate-700">Exigences de sécurité :</p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <span className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                        {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        8+ caractères
                      </span>
                      <span className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                        {hasUpper ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        1 majuscule (A-Z)
                      </span>
                      <span className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                        {hasLower ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        1 minuscule (a-z)
                      </span>
                      <span className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                        {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        1 chiffre (0-9)
                      </span>
                      <span className={`flex items-center gap-1.5 col-span-2 ${hasSpecial ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                        {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        1 caractère spécial (!@#$%...)
                      </span>
                    </div>

                    {confirmPassword && (
                      <div className="pt-1 border-t border-slate-200 mt-2">
                        <span className={`flex items-center gap-1.5 text-[11px] font-bold ${isMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          {isMatch ? 'Mots de passe identiques' : 'Mots de passe différents'}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-bold text-sm shadow-md"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      "Enregistrer mon nouveau mot de passe"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
};

export default ResetPassword;

