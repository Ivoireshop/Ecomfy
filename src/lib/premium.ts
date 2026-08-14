export function isPremiumShop(shop: any): boolean {
  if (!shop) return false;
  
  // Dans le futur, nous pourrions vérifier subscription_plan === 'premium' ou le montant de l'abonnement.
  // Pour le moment, on vérifie si `subscription_plan` est défini et n'est pas 'free'
  const plan = shop.subscription_plan?.toLowerCase() || '';
  
  if (plan === 'premium' || plan === 'pro' || plan === 'vip' || plan.includes('12000')) {
    return true;
  }
  
  // Par défaut, si un utilisateur a un plan payant (tout ce qui n'est pas free), on le considère premium.
  if (plan && plan !== 'free') {
    return true;
  }

  // Si aucun forfait payant n'est détecté, on retourne false.
  return false;
}
