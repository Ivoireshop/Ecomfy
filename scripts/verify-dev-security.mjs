// Tests HTTP de bout en bout des correctifs de sécurité (C1, C2, C3, C7, H2) avec de vrais JWT.
// À lancer sur le projet DEV uniquement, avec des COMPTES JETABLES. Voir docs/DEPLOIEMENT-DEV-2026-10.md.
//
//   SUPABASE_URL=https://xfpbpxncserliskrbaim.supabase.co \
//   SUPABASE_ANON_KEY=<clé anon> \
//   MERCHANT_EMAIL=... MERCHANT_PASSWORD=... \
//   FOUNDER_EMAIL=... FOUNDER_PASSWORD=...        (facultatif : compte avec le rôle founder ou co_founder)
//   node scripts/verify-dev-security.mjs
//
// Aucune donnée réelle n'est touchée : tous les appels utilisent un UUID de boutique inexistant.
// Les mots de passe ne sont jamais affichés. Code de sortie 1 si au moins un contrôle échoue.

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const FAKE = "eeeeeeee-0000-4000-8000-00000000000e";

if (!URL_ || !ANON) { console.error("SUPABASE_URL et SUPABASE_ANON_KEY sont requis."); process.exit(2); }
if (/yfggrceynzcwklbxhgix/.test(URL_)) { console.error("Refus : ce script ne doit pas viser la production."); process.exit(2); }

const results = [];
const check = (name, ok, detail = "") => { results.push({ ok, name, detail }); };

async function signIn(email, password) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`connexion refusée pour ${email} (${r.status})`);
  return j.access_token;
}

async function http(method, path, token, body, extra = {}) {
  const r = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, "Content-Type": "application/json", ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json, text: text.slice(0, 160) };
}
const rpc = (fn, token, args) => http("POST", `/rest/v1/rpc/${fn}`, token, args);
const denied = (r) => r.status === 401 || r.status === 403 || (r.json && (r.json.code === "42501" || r.json.code === "PGRST202"));
const isPermDenied = (r) => r.json && r.json.code === "42501";

const BILLING = {
  apply_commission_payment: { p_shop_id: FAKE, p_amount: 1, p_transaction_reference: "verify-dev" },
  apply_shop_subscription: { p_shop_id: FAKE, p_user_id: FAKE, p_plan: "starter", p_amount: 0, p_transaction_reference: "verify-dev" },
  apply_shop_activation: { p_shop_id: FAKE, p_user_id: FAKE, p_amount: 1, p_transaction_reference: "verify-dev", p_payment_method: "x" },
  prepare_shop_activation_payment: { p_shop_id: FAKE, p_user_id: FAKE },
  get_shop_orders_secure: { _shop_id: FAKE },
};

async function sectionRoles(label, token, { isFounder }) {
  // C2 : fonctions réservées à service_role, y compris pour un fondateur connecté
  for (const [fn, args] of Object.entries(BILLING)) {
    if (fn === "get_shop_orders_secure") continue;
    const r = await rpc(fn, token, args);
    check(`C2 ${label} : ${fn} refusé (42501)`, isPermDenied(r), `${r.status} ${r.text}`);
  }
  // C3 : contrôle de propriété
  const o = await rpc("get_shop_orders_secure", token, BILLING.get_shop_orders_secure);
  if (!token) check(`C3 ${label} : get_shop_orders_secure refusé`, isPermDenied(o), `${o.status} ${o.text}`);
  else if (isFounder) check(`C3 ${label} : get_shop_orders_secure autorisé (liste vide, boutique inexistante)`, o.status === 200 && Array.isArray(o.json), `${o.status} ${o.text}`);
  else check(`C3 ${label} : get_shop_orders_secure refusé (forbidden)`, o.status >= 400 && /forbidden|42501/.test(o.text), `${o.status} ${o.text}`);

  // H2 : gouvernance
  for (const t of ["corporate_shareholders", "corporate_companies", "corporate_share_allocations", "corporate_audit_logs"]) {
    const r = await http("GET", `/rest/v1/${t}?select=id&limit=1`, token);
    if (isFounder) check(`H2 ${label} : lecture ${t} autorisée`, r.status === 200, `${r.status} ${r.text}`);
    else check(`H2 ${label} : lecture ${t} vide ou refusée`, (r.status === 200 && Array.isArray(r.json) && r.json.length === 0) || r.status >= 400, `${r.status} ${r.text}`);
  }
  if (!isFounder && token) {
    const w = await http("PATCH", "/rest/v1/corporate_companies?id=not.is.null", token, { name: "HACKED" }, { Prefer: "return=representation" });
    check(`H2 ${label} : écriture corporate_companies sans effet`, (w.status === 200 && Array.isArray(w.json) && w.json.length === 0) || w.status >= 400, `${w.status} ${w.text}`);
  }
}

async function sectionEdge(label, token, { isFounder }) {
  const rec = await http("POST", "/functions/v1/founder-record-commission-payment", token, { shop_id: FAKE, amount: 1, transaction_reference: "verify-dev" });
  const act = await http("POST", "/functions/v1/founder-activate-shop", token, { shop_id: FAKE, amount: 1 });
  const mgr = await http("POST", "/functions/v1/manage-founder-roles", token, { action: "list" });
  if (isFounder) {
    check(`C2 ${label} : founder-record-commission-payment -> shop_not_found`, rec.status === 400 && /shop_not_found/.test(rec.text), `${rec.status} ${rec.text}`);
    check(`C2 ${label} : founder-activate-shop -> boutique introuvable`, act.status === 404, `${act.status} ${act.text}`);
    check(`C7 ${label} : manage-founder-roles list autorisé`, mgr.status === 200 && mgr.json?.success === true, `${mgr.status} ${mgr.text}`);
  } else if (token === undefined) {
    check(`C2 sans JWT : founder-record-commission-payment -> 401`, rec.status === 401, `${rec.status} ${rec.text}`);
    check(`C2 sans JWT : founder-activate-shop -> 401`, act.status === 401, `${act.status} ${act.text}`);
    check(`C7 sans JWT : manage-founder-roles -> 401`, mgr.status === 401, `${mgr.status} ${mgr.text}`);
  } else {
    check(`C2 ${label} : founder-record-commission-payment -> 403`, rec.status === 403, `${rec.status} ${rec.text}`);
    check(`C2 ${label} : founder-activate-shop -> 403`, act.status === 403, `${act.status} ${act.text}`);
    check(`C7 ${label} : manage-founder-roles -> 403`, mgr.status === 403, `${mgr.status} ${mgr.text}`);
    // C7 : un marchand ne doit pas pouvoir nommer
    const add = await http("POST", "/functions/v1/manage-founder-roles", token, { action: "add", email: "nobody@example.invalid", role: "co_founder" });
    check(`C7 ${label} : manage-founder-roles add -> 403`, add.status === 403, `${add.status} ${add.text}`);
  }
}

async function sectionWallet(label, token) {
  // C1 : fonctions de portefeuille fermées aux utilisateurs connectés (sauf le retrait, lié à auth.uid())
  const calls = [
    ["get_or_create_merchant_wallet", { p_merchant_id: FAKE }],
    ["credit_merchant_wallet_pending", { p_merchant_id: FAKE, p_payment_id: FAKE, p_gross_amount: 1, p_net_amount: 1, p_currency: "XOF", p_settlement_hours: 1, p_reference: "verify-dev" }],
    ["process_wallet_settlements", {}],
  ];
  for (const [fn, args] of calls) {
    const r = await rpc(fn, token, args);
    check(`C1 ${label} : ${fn} refusé (42501)`, isPermDenied(r), `${r.status} ${r.text}`);
  }
  // L'ancienne signature (avec p_merchant_id) ne doit plus exister
  const old = await rpc("request_wallet_withdrawal_atomic", token, { p_merchant_id: FAKE, p_amount: 1, p_payout_method: "mobile_money" });
  check(`C1 ${label} : retrait avec p_merchant_id impossible`, old.status === 404 || denied(old), `${old.status} ${old.text}`);
}

async function main() {
  console.log(`Projet : ${URL_}\n`);
  await sectionRoles("anon", undefined, { isFounder: false });
  await sectionWallet("anon", undefined);
  await sectionEdge("sans JWT", undefined, { isFounder: false });

  if (process.env.MERCHANT_EMAIL) {
    const t = await signIn(process.env.MERCHANT_EMAIL, process.env.MERCHANT_PASSWORD);
    await sectionRoles("marchand", t, { isFounder: false });
    await sectionWallet("marchand", t);
    await sectionEdge("marchand", t, { isFounder: false });
    // C7 : écriture directe de user_roles (RLS). Aucun succès n'est acceptable.
    const me = await http("GET", "/auth/v1/user", t);
    const ins = await http("POST", "/rest/v1/user_roles", t, { user_id: me.json?.id, role: "admin" }, { Prefer: "return=representation" });
    check("C7 marchand : INSERT user_roles (admin) refusé", ins.status >= 400, `${ins.status} ${ins.text}`);
    if (ins.status < 400) console.log("!! Le marchand de test a obtenu un rôle : le supprimer (DELETE FROM user_roles WHERE user_id = ...).");
  } else console.log("(MERCHANT_EMAIL non fourni : tests marchand ignorés)");

  if (process.env.FOUNDER_EMAIL) {
    const t = await signIn(process.env.FOUNDER_EMAIL, process.env.FOUNDER_PASSWORD);
    await sectionRoles("fondateur", t, { isFounder: true });
    await sectionEdge("fondateur", t, { isFounder: true });
    const direct = await rpc("apply_commission_payment", t, BILLING.apply_commission_payment);
    check("C2 fondateur : RPC apply_commission_payment directe refusée (42501)", isPermDenied(direct), `${direct.status} ${direct.text}`);
  } else console.log("(FOUNDER_EMAIL non fourni : tests fondateur ignorés)");

  let fail = 0;
  for (const r of results) { if (!r.ok) fail++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `   -> ${r.detail}`}`); }
  console.log(`\n${results.length - fail} réussis, ${fail} échecs`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("Erreur :", e.message); process.exit(2); });
