import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, Store, ShieldCheck, ArrowRight, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function AcceptShopInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expectedEmail, setExpectedEmail] = useState<string | null>(null);
  const [acceptedShopId, setAcceptedShopId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkAuthAndProcess();
  }, [token]);

  const checkAuthAndProcess = async () => {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);

    if (!token) {
      setErrorStatus("invalid_token");
      setErrorMessage("Aucun jeton d'invitation fourni dans ce lien.");
      setLoading(false);
      return;
    }

    // Save token to sessionStorage so after login/signup user returns here
    try {
      sessionStorage.setItem("ecomfy_pending_invite_token", token);
    } catch (_) {}

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Attempt acceptance RPC call
    await executeAcceptance(token, currentUser);
  };

  const executeAcceptance = async (inviteToken: string, currentUser: any) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("accept_shop_invitation" as any, {
        _token: inviteToken,
      });

      if (error) throw error;

      if (!data?.success) {
        const errType = data?.error || "failed";
        setErrorStatus(errType);
        if (errType === "email_mismatch") {
          setExpectedEmail(data?.expected_email || null);
          setErrorMessage(`Cette invitation est réservée à l'adresse e-mail "${data?.expected_email || "invitée"}", mais vous êtes actuellement connecté avec "${currentUser.email}".`);
        } else if (errType === "revoked") {
          setErrorMessage("Cette invitation a été révoquée par le propriétaire de la boutique.");
        } else if (errType === "invalid_token") {
          setErrorMessage("Ce lien d'invitation est invalide ou expiré.");
        } else {
          setErrorMessage("Impossible d'accepter cette invitation pour le moment.");
        }
        setProcessing(false);
        setLoading(false);
        return;
      }

      // Clear pending token session storage
      try {
        sessionStorage.removeItem("ecomfy_pending_invite_token");
      } catch (_) {}

      setAcceptedShopId(data.shop_id || null);
      toast.success("Invitation acceptée avec succès ! 🎉", {
        description: "Vous avez désormais accès à cette boutique.",
      });
      setProcessing(false);
      setLoading(false);
    } catch (err: any) {
      console.error("Accept invite error:", err);
      setErrorStatus("unexpected");
      setErrorMessage(err?.message || "Une erreur est survenue lors du traitement de l'invitation.");
      setProcessing(false);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    checkAuthAndProcess();
  };

  if (loading || processing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-8 h-8 animate-pulse" />
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400 absolute -top-1 -right-1" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Vérification de l'invitation Ecomfy...</h2>
            <p className="text-sm text-slate-400">Veuillez patienter pendant la validation de vos accès.</p>
          </div>
        </div>
      </div>
    );
  }

  // Case 1: Successfully Accepted
  if (acceptedShopId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <Card className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-emerald-500/30 text-white text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>

          <div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 text-xs font-extrabold uppercase mb-3">
              Accès Activé
            </Badge>
            <h1 className="text-2xl font-black text-white">Félicitations ! 🎉</h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              Vous avez rejoint la boutique en tant que collaborateur actif. Vous disposez désormais des permissions accordées par le propriétaire.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => navigate(`/dashboard`)}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-base gap-2 shadow-lg"
            >
              <span>Accéder à mon espace de travail</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Case 2: Error Status
  if (errorStatus) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <Card className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-red-500/30 text-white text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white mb-2">Invitation non disponible</h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              {errorMessage || "Une erreur est survenue lors de l'accès à l'invitation."}
            </p>
          </div>

          {errorStatus === "email_mismatch" && user && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 text-xs">
              <p className="text-slate-400">Compte actuel connecté : <strong className="text-white">{user.email}</strong></p>
              {expectedEmail && <p className="text-slate-400">Compte invité : <strong className="text-emerald-400">{expectedEmail}</strong></p>}
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full mt-2 border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Se déconnecter pour changer de compte
              </Button>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-xl"
            >
              Retour à mon tableau de bord
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Case 3: User Not Logged In
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <Card className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-emerald-500/30 text-white text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 blur-[90px] rounded-full pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
          <Store className="w-8 h-8 text-emerald-400" />
        </div>

        <div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 text-xs font-extrabold uppercase mb-3">
            Invitation reçue
          </Badge>
          <h1 className="text-2xl font-black text-white">Rejoindre une boutique Ecomfy</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Pour valider votre invitation et activer vos rôles de collaborateur, connectez-vous ou créez votre compte avec l'adresse e-mail invitée.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link to={`/auth?mode=signup&redirect=${encodeURIComponent(`/accept-shop-invite?token=${token}`)}`}>
            <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-base gap-2 shadow-lg mb-2">
              <UserPlus className="w-5 h-5" />
              <span>Créer mon compte Ecomfy</span>
            </Button>
          </Link>

          <Link to={`/auth?mode=login&redirect=${encodeURIComponent(`/accept-shop-invite?token=${token}`)}`}>
            <Button variant="outline" className="w-full h-12 border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-white font-semibold rounded-xl text-base gap-2">
              <LogIn className="w-5 h-5" />
              <span>Se connecter avec un compte existant</span>
            </Button>
          </Link>
        </div>

        <p className="text-xs text-slate-500 pt-2">
          Une fois connecté(e), votre invitation sera validée automatiquement.
        </p>
      </Card>
    </div>
  );
}