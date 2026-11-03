// Test C6 (montants décidés par le serveur) : sans effet de bord si le correctif est en place.
// Envoie des paiements falsifiés à process-payment et un INSERT direct sur orders ; tout doit être refusé.
// Compte jetable uniquement. Si un test échoue, un paiement « pending » peut avoir été créé : le supprimer.
//
//   $env:SUPABASE_URL="https://yfggrceynzcwklbxhgix.supabase.co"
//   $env:SUPABASE_ANON_KEY="<clé anon de la production>"
//   $env:EMAIL="<marchand_jetable>"; $env:PASSWORD="..."
//   $env:SHOP_ID="<uuid d'une boutique du compte jetable>"   # optionnel (commission, activation, abonnement boutique)
//   node scripts/verify-c6-prod.mjs

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const { EMAIL, PASSWORD, SHOP_ID } = process.env;
const OTHER = "eeeeeeee-0000-4000-8000-00000000000e";

if (!URL_ || !ANON || !EMAIL || !PASSWORD) { console.error("SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL et PASSWORD sont requis."); process.exit(2); }

const results = [];
const check = (name, ok, detail = "") => results.push({ ok, name, detail });

async function http(method, path, token, body) {
  const r = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, text, json };
}

const auth = await http("POST", "/auth/v1/token?grant_type=password", null, { email: EMAIL, password: PASSWORD });
if (!auth.json?.access_token) { console.error(`Connexion refusée (${auth.status}).`); process.exit(2); }
const token = auth.json.access_token;
const uid = auth.json.user.id;

// Un refus applicatif renvoie 200 + success:false ; un refus d'authentification, 401/403.
const pay = (label, body, expectedError) =>
  http("POST", "/functions/v1/process-payment", token, { payment_method: "mobile_money", provider: "wave", phone: "0700000000", user_id: uid, ...body })
    .then((r) => {
      const refused = (r.status === 200 && r.json?.success === false) || r.status >= 400;
      const reason = r.json?.error ?? r.text;
      const ok = refused && (!expectedError || new RegExp(expectedError, "i").test(String(reason)));
      check(`C6 ${label}`, ok, `${r.status} ${String(reason).slice(0, 140)}`);
    });

await pay("abonnement à 1 FCFA refusé", { payment_type: "subscription", plan: "pro", billing_cycle: "monthly", amount: 1 }, "montant|plan");
await pay("abonnement à montant négatif refusé", { payment_type: "subscription", plan: "pro", billing_cycle: "monthly", amount: -5000 }, "montant|plan|invalide");
await pay("pack de crédits à 1 FCFA refusé", { payment_type: "credits", amount: 1, credits_pack: { size: 100000, price: 1 } }, "pack|montant");
await pay("pack de crédits inconnu refusé", { payment_type: "credits", amount: 500, credits_pack: { size: 99999, price: 500 } }, "pack|montant");
if (SHOP_ID) {
  await pay("activation à 1 FCFA refusée", { payment_type: "shop_activation", shop_id: SHOP_ID, amount: 1 }, "montant|activation");
  await pay("abonnement boutique à 1 FCFA refusé", { payment_type: "shop_subscription", shop_id: SHOP_ID, plan: "pro", billing_cycle: "monthly", amount: 1 }, "montant|plan");
  await pay("commission à 1 FCFA refusée", { payment_type: "commission_payment", shop_id: SHOP_ID, amount: 1 }, "montant|commission");
}
// user_id d'un autre compte : refus d'authentification
{
  const r = await http("POST", "/functions/v1/process-payment", token, { payment_method: "mobile_money", provider: "wave", phone: "0700000000", payment_type: "credits", amount: 1, user_id: OTHER, credits_pack: { size: 100, price: 1 } });
  check("C6 user_id d'un autre compte refusé", r.status >= 400 || r.json?.success === false, `${r.status} ${r.text.slice(0, 140)}`);
}
// Sans connexion
{
  const r = await http("POST", "/functions/v1/process-payment", null, { payment_type: "credits", amount: 1, user_id: uid, credits_pack: { size: 100, price: 1 } });
  check("C6 appel sans connexion refusé", r.status === 401 || r.status === 403, `${r.status} ${r.text.slice(0, 100)}`);
}
// H10 : plus d'insertion directe de commande
if (SHOP_ID) {
  const r = await http("POST", "/rest/v1/orders", token, { shop_id: SHOP_ID, customer_name: "test c6", customer_phone: "0700000000", total_amount: 1, status: "delivered" });
  check("C6/H10 INSERT direct sur orders refusé", r.status === 401 || r.status === 403, `${r.status} ${r.text.slice(0, 140)}`);
}

let failed = 0;
for (const r of results) { console.log(`${r.ok ? "OK  " : "ECHEC"}  ${r.name}${r.ok ? "" : `  -> ${r.detail}`}`); if (!r.ok) failed++; }
console.log(`\n${results.length - failed}/${results.length} réussis`);
if (failed) console.log("Vérifier dans payments les lignes 'pending' créées par les tests en échec.");
process.exit(failed ? 1 : 0);
