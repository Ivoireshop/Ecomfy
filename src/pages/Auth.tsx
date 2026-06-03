import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Gift, Eye, EyeOff } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import authHeroV5 from "@/assets/auth-hero-v5.jpg";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { session, isReady } = useAuthReady();
  const handledSessionRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpCountry, setSignUpCountry] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const redirectPath = searchParams.get("redirect") || "";
  const prefillEmail = searchParams.get("email") || "";
  const isInvite = searchParams.get("invite") === "1";
  const [activeTab, setActiveTab] = useState<string>("signin");

  useEffect(() => {
    if (prefillEmail) {
      setSignInEmail(prefillEmail);
      setSignUpEmail(prefillEmail);
    }
    if (isInvite) {
      // Default to signup so the invitee can quickly create their account if needed
      setActiveTab("signup");
    }
  }, [prefillEmail, isInvite]);

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      setReferralCode(refCode.toUpperCase());
    }
  }, [searchParams]);

  const handleAuthenticatedSession = useCallback(async (currentSession: Session) => {
    const sessionKey = currentSession.access_token ?? currentSession.user.id;
    if (handledSessionRef.current === sessionKey) {
      return;
    }

    handledSessionRef.current = sessionKey;

    const urlParams = new URLSearchParams(window.location.search);
    const isEmailConfirmed = urlParams.get("type") === "signup";

    if (isEmailConfirmed) {
      const referralKey = `referral_${currentSession.user.email}`;
      const storedReferralCode = localStorage.getItem(referralKey);

      if (storedReferralCode) {
        try {
          const { data: refResult, error: refError } = await supabase.rpc("process_referral_signup", {
            referred_user_id: currentSession.user.id,
            referral_code_input: storedReferralCode,
          });

          if (!refError && refResult) {
            toast({
              title: "Félicitations ! 🎉",
              description: "Votre compte a été créé avec succès et vous avez reçu 5 générations gratuites (3 + 2 bonus de bienvenue) ! Bienvenue sur VisualPro !",
            });
          } else {
            toast({
              title: "Félicitations ! 🎉",
              description: "Votre compte a été créé avec succès. Bienvenue sur VisualPro !",
            });
          }
        } catch (error) {
          console.error("Erreur lors du traitement du parrainage:", error);
          toast({
            title: "Félicitations ! 🎉",
            description: "Votre compte a été créé avec succès. Bienvenue sur VisualPro !",
          });
        } finally {
          localStorage.removeItem(referralKey);
        }
      } else {
        toast({
          title: "Félicitations ! 🎉",
          description: "Votre compte a été créé avec succès. Bienvenue sur VisualPro !",
        });
      }
    }

    if (redirectPath && redirectPath.startsWith("/")) {
      navigate(redirectPath, { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, toast, redirectPath]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!session) {
      handledSessionRef.current = null;
      return;
    }

    void handleAuthenticatedSession(session);
  }, [handleAuthenticatedSession, isReady, session]);

  const validatePassword = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return { valid: false, message: "Le mot de passe doit contenir au moins 8 caractères" };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: "Le mot de passe doit contenir au moins une lettre minuscule" };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: "Le mot de passe doit contenir au moins une lettre majuscule" };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: "Le mot de passe doit contenir au moins un chiffre" };
    }
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
      return { valid: false, message: "Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)" };
    }
    return { valid: true };
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signUpEmail || !signUpPassword || !signUpFullName || !signUpPhone || !signUpCountry) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    const passwordCheck = validatePassword(signUpPassword);
    if (!passwordCheck.valid) {
      toast({
        title: "Mot de passe faible",
        description: passwordCheck.message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      const trimmedEmail = signUpEmail.trim().toLowerCase();

      if (referralCode && referralCode.trim()) {
        localStorage.setItem(`referral_${trimmedEmail}`, referralCode.trim().toUpperCase());
      }

      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: signUpPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: signUpFullName,
            phone: signUpPhone,
            country: signUpCountry,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Compte créé avec succès ! 🎉",
        description: "Un email de confirmation contenant un lien d'activation vous a été envoyé. Veuillez cliquer dessus pour activer votre compte.",
      });

      setSignUpEmail("");
      setSignUpPassword("");
      setSignUpFullName("");
      setSignUpPhone("");
      setSignUpCountry("");
      setReferralCode("");
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de l'inscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = signInEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      toast({
        title: "Email requis",
        description: "Veuillez entrer votre email pour réinitialiser votre mot de passe",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Email envoyé ! 📧",
        description: "Un email contenant un lien de réinitialisation vous a été envoyé. Cliquez sur ce lien pour créer un nouveau mot de passe.",
      });
    } catch (error) {
      console.error("Erreur réinitialisation:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signInEmail || !signInPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const trimmedEmail = signInEmail.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: signInPassword,
      });

      if (error) throw error;

      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        toast({
          title: "Email non vérifié",
          description: "Veuillez vérifier votre boîte mail et cliquer sur le lien de confirmation avant de vous connecter.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Connexion réussie",
        description: "Redirection vers votre espace…",
      });
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      const errorMessage = error instanceof Error ? error.message : "";

      if (errorMessage.toLowerCase().includes("email not confirmed")) {
        toast({
          title: "Email non vérifié",
          description: "Veuillez vérifier votre boîte mail et cliquer sur le lien de confirmation avant de vous connecter.",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("credentials")) {
        toast({
          title: "Connexion refusée",
          description: "Le serveur n'a pas pu valider ces identifiants. Vérifiez l'email exact, la casse du mot de passe et l'absence d'espaces cachés.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: errorMessage || "Une erreur est survenue lors de la connexion",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setIsLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error) {
      console.error(`Erreur connexion ${provider}:`, error);
      toast({
        title: "Erreur",
        description: `Impossible de se connecter avec ${provider === "google" ? "Google" : "Apple"}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-background md:grid md:min-h-screen md:grid-cols-2">
      <div className="absolute inset-0 hidden md:block">
        <img
          src={authHeroV5}
          alt="Créateur africain utilisant VisualPro"
          className="h-full w-full object-cover object-[68%_center]"
          width={1024}
          height={1024}
        />
      </div>

      {/* Left: form column */}
      <div className="relative z-10 flex min-h-svh flex-col justify-center px-4 py-6 sm:px-8 md:min-h-screen md:px-10 lg:px-16 auth-glass-bg">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              VisualPro
            </h1>
            <Badge variant="secondary" className="rounded-full border border-primary/30 bg-background/80 text-primary text-[10px] font-semibold tracking-wider backdrop-blur-md md:border-white/40 md:bg-white/15 md:text-white">
              V5 · Nouvelle version
            </Badge>
          </div>

          <div className="mb-6">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-foreground md:text-white">Bienvenue</h2>
            <div className="mb-4 space-y-2 rounded-2xl border border-primary/20 bg-background/70 p-4 shadow-lg backdrop-blur-md md:hidden">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  VisualPro V5
                </span>
              </div>
              <p className="text-lg font-bold leading-tight text-foreground">
                Créez des visuels publicitaires et vendez. Lancez votre boutique.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Créez des vidéos publicitaires en quelques secondes grâce à l'intelligence artificielle.
              </p>
            </div>
            <p className="text-muted-foreground md:text-white/80">
              Créez un compte ou connectez-vous pour commencer
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 backdrop-blur-md md:border md:border-white/30 md:bg-white/15 md:backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-primary md:text-white" />
              <span className="text-xs font-medium text-primary md:text-white">
                🎁 {referralCode ? '5' : '3'} générations gratuites à l'inscription
              </span>
            </div>
          </div>

        <Card className="border-primary-foreground/25 bg-background/88 shadow-2xl backdrop-blur-xl md:border-white/20 md:bg-white/90 md:shadow-2xl">
          <CardHeader>
            <CardTitle>Bienvenue</CardTitle>
            <CardDescription>
              Créez un compte ou connectez-vous pour commencer
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isInvite && prefillEmail && (
              <div className="mb-4 rounded-md border bg-primary/5 p-3 text-sm">
                Vous êtes invité(e) à rejoindre une boutique avec <strong>{prefillEmail}</strong>. Connectez-vous ou créez votre compte pour y accéder.
              </div>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      required
                    />
                  </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showSignInPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          required
                          className="pr-10"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignInPassword((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showSignInPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        >
                          {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      "Se connecter"
                    )}
                  </Button>
                  <div className="mt-4 text-center">
                    <Button 
                      type="button"
                      variant="link" 
                      className="text-sm"
                      onClick={handleForgotPassword}
                    >
                      Mot de passe oublié ?
                    </Button>
                  </div>

                  <div className="relative my-4">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent px-2 text-xs text-muted-foreground">
                      ou continuer avec
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSocialLogin("google")}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continuer avec Google
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nom complet *</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={signUpFullName}
                      onChange={(e) => setSignUpFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Numéro de téléphone *</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+225 XX XX XX XX XX"
                      value={signUpPhone}
                      onChange={(e) => setSignUpPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-country">Pays *</Label>
                    <select
                      id="signup-country"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={signUpCountry}
                      onChange={(e) => setSignUpCountry(e.target.value)}
                      required
                    >
                      <option value="">Sélectionnez votre pays</option>
                      <option value="benin">Bénin</option>
                      <option value="burkina">Burkina Faso</option>
                      <option value="cameroun">Cameroun</option>
                      <option value="cote_ivoire">Côte d'Ivoire</option>
                      <option value="gabon">Gabon</option>
                      <option value="guinee">Guinée</option>
                      <option value="mali">Mali</option>
                      <option value="niger">Niger</option>
                      <option value="senegal">Sénégal</option>
                      <option value="togo">Togo</option>
                      <option value="rdc">République Démocratique du Congo</option>
                      <option value="congo">République du Congo</option>
                      <option value="tchad">Tchad</option>
                      <option value="autre">Autre</option>
                    </select>
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="signup-password">Mot de passe *</Label>
                     <div className="relative">
                       <Input
                         id="signup-password"
                         type={showSignUpPassword ? "text" : "password"}
                         placeholder="••••••••"
                         value={signUpPassword}
                         onChange={(e) => setSignUpPassword(e.target.value)}
                         required
                         minLength={8}
                         className="pr-10"
                         autoComplete="new-password"
                       />
                       <button
                         type="button"
                         onClick={() => setShowSignUpPassword((s) => !s)}
                         className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                         aria-label={showSignUpPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                       >
                         {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                       </button>
                     </div>
                     <p className="text-xs text-muted-foreground">
                       Min. 8 caractères avec majuscules, minuscules, chiffres et caractères spéciaux
                     </p>
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="referral-code">Code de parrainage (optionnel)</Label>
                     <div className="relative">
                       <Input
                         id="referral-code"
                         type="text"
                         placeholder="Entrez un code"
                         value={referralCode}
                         onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                         className="pr-10"
                       />
                       {referralCode && (
                         <Gift className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                       )}
                     </div>
                     {referralCode && (
                       <Badge variant="secondary" className="gap-1 text-xs">
                         <Gift className="h-3 w-3" />
                         +5 générations gratuites au total
                       </Badge>
                     )}
                   </div>
                   <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création du compte...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Créer mon compte
                      </>
                    )}
                  </Button>

                  <div className="relative my-4">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent px-2 text-xs text-muted-foreground">
                      ou s'inscrire avec
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSocialLogin("google")}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSocialLogin("apple")}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      Apple
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate("/")}>
              ← Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>

      {/* Right: hero image column */}
      <div className="relative hidden overflow-hidden md:block md:min-h-screen">
        <img
          src={authHeroV5}
          alt="Créateur africain utilisant VisualPro"
          className="absolute inset-0 h-full w-full object-cover object-[70%_center] md:object-center"
          width={1024}
          height={1024}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <div className="rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-medium text-white">
            ✨ Propulsé par l'IA · 100% africain
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 md:p-10 text-white">
          <div className="mb-2 md:mb-3 flex items-center gap-3">
            <span className="h-px w-8 md:w-10 bg-primary" />
            <span className="text-[10px] md:text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              VisualPro V5
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-bold leading-tight mb-2 md:mb-4">
            Créez des visuels publicitaires.<br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Vendez, lancez votre boutique.
            </span>
          </h2>
          <p className="text-sm md:text-base xl:text-lg text-white/80 max-w-md">
            Créez des vidéos publicitaires en quelques secondes grâce à l'intelligence artificielle.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;