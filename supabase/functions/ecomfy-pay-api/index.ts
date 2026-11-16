// API publique Ecomfy Pay (paiements marchands + sandbox). Documentation : docs/API-ECOMFY-PAY.md et public/openapi/ecomfy-pay.v1.yaml.
// Le routeur et la validation sont dans _shared/pay-api (testés sous Node) ; ce fichier ne fait que brancher l'environnement.
import { serveCors } from "../_shared/http.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getDefaultConnector } from "../_shared/operators/index.ts";
import { isAuthorizedCron } from "../_shared/cron-auth.ts";
import { getClientIp, takeRateLimit } from "../_shared/rate-limit.ts";
import { createApiHandler } from "../_shared/pay-api/handler.ts";
import { deliverDue } from "../_shared/pay-api/webhook-out.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- globaux Deno / EdgeRuntime absents des types du projet (code exécuté sous Deno)
declare const Deno: any;
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
declare const EdgeRuntime: any;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Garde SSRF renforcée : toutes les adresses du nom de domaine du marchand doivent être publiques. Si le runtime n'offre pas de
// résolveur DNS, on s'en passe : le contrôle statique de l'URL et le refus des redirections restent actifs.
async function resolve(host: string): Promise<string[]> {
  const out: string[] = [];
  for (const type of ["A", "AAAA"]) {
    try { out.push(...(await Deno.resolveDns(host, type))); } catch { /* pas d'enregistrement de ce type */ }
  }
  return out;
}

const deliver = () => deliverDue({ db: admin, resolve: typeof Deno?.resolveDns === "function" ? resolve : undefined });

const APP_URL = (Deno.env.get("APP_URL") || "https://ecomfy.cloud").replace(/\/+$/, "");

const handler = createApiHandler({
  db: admin,
  connector: getDefaultConnector,
  rateLimit: takeRateLimit,
  checkoutBase: `${APP_URL}/pay/sandbox`,
  isCron: isAuthorizedCron,
  clientIp: getClientIp,
  deliver,
  runInBackground: (p) => {
    // La réponse part sans attendre l'envoi des webhooks ; l'exécution continue en arrière-plan quand le runtime le permet.
    const safe = p.catch((e) => console.error("[ecomfy-pay-api] background:", e));
    if (typeof EdgeRuntime?.waitUntil === "function") EdgeRuntime.waitUntil(safe);
  },
});

// Niveau « public » : la page de paiement sandbox est appelée depuis le navigateur ; l'accès aux autres routes repose sur la
// clé secrète (en-tête Authorization), jamais sur un cookie ni sur l'origine.
serveCors("public", handler);
