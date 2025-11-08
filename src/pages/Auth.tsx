import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Gift, Eye, EyeOff } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Form states
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

  useEffect(() => {
    // Check for referral code in URL
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode.toUpperCase());
    }

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // Check if coming from email confirmation
        const urlParams = new URLSearchParams(window.location.search);
        const isEmailConfirmed = urlParams.get('type') === 'signup';
        
        if (isEmailConfirmed) {
          toast({
            title: "Félicitations ! 🎉",
            description: "Votre compte a été créé avec succès. Bienvenue sur VisualPro !",
          });
        }
        
        navigate("/generator");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
          // Show welcome message for new sign ups
          if (event === 'SIGNED_IN') {
            const urlParams = new URLSearchParams(window.location.search);
            const isEmailConfirmed = urlParams.get('type') === 'signup';
            
            if (isEmailConfirmed) {
              toast({
                title: "Félicitations ! 🎉",
                description: "Votre compte a été créé avec succès. Bienvenue sur VisualPro !",
              });
            }
          }
          navigate("/generator");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

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
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
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

    // Validate password strength
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
      
      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
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

      // Process referral code if provided
      if (referralCode && referralCode.length > 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: refResult, error: refError } = await supabase.rpc('process_referral_signup', {
              referred_user_id: user.id,
              referral_code_input: referralCode
            });

            if (refError) {
              console.error("Erreur lors du traitement du parrainage:", refError);
            } else if (refResult) {
              toast({
                title: "Bonus de parrainage ! 🎁",
                description: "Vous avez reçu 5 générations gratuites (3 + 2 bonus de bienvenue) !",
              });
            }
          }
        } catch (refError) {
          console.error("Erreur référence:", refError);
        }
      }

      toast({
        title: "Vérifiez votre email ! 📧",
        description: "Nous vous avons envoyé un email de confirmation. Veuillez cliquer sur le lien dans l'email pour activer votre compte.",
      });
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
    if (!signInEmail) {
      toast({
        title: "Email requis",
        description: "Veuillez entrer votre email pour réinitialiser votre mot de passe",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(signInEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Email envoyé",
        description: "Un lien de réinitialisation a été envoyé à votre email. Veuillez vérifier votre boîte de réception.",
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });

      if (error) throw error;

      // Vérifier si l'email est confirmé
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
        title: "Connecté !",
        description: "Vous êtes maintenant connecté.",
      });
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      const errorMessage = error instanceof Error ? error.message : "";
      
      // Gérer spécifiquement l'erreur d'email non confirmé
      if (errorMessage.toLowerCase().includes("email not confirmed")) {
        toast({
          title: "Email non vérifié",
          description: "Veuillez vérifier votre boîte mail et cliquer sur le lien de confirmation avant de vous connecter.",
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            VisualPro
          </h1>
          <p className="text-muted-foreground">
            Créez vos visuels publicitaires avec l'IA
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              🎁 {referralCode ? '5' : '3'} générations gratuites à l'inscription
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bienvenue</CardTitle>
            <CardDescription>
              Créez un compte ou connectez-vous pour commencer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
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
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <Button variant="link" onClick={() => navigate("/")}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;