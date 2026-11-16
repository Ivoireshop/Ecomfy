import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/lib/ecomfyPayDevApi";
import { Code2, FlaskConical, ExternalLink } from "lucide-react";

// Documentation publique de l'API Ecomfy Pay. Source de vérité du contrat : public/openapi/ecomfy-pay.v1.yaml
// (les deux doivent évoluer ensemble).
const BASE = `${API_BASE_URL}/v1`;

const Code: React.FC<{ children: string; lang?: string }> = ({ children, lang }) => (
  <div className="relative">
    {lang && <span className="absolute top-2 right-3 text-[10px] uppercase tracking-wide text-slate-400">{lang}</span>}
    <pre className="rounded-xl bg-slate-900 text-slate-100 text-xs leading-relaxed p-4 overflow-x-auto"><code>{children}</code></pre>
  </div>
);

const H2: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <h2 id={id} className="scroll-mt-20 text-xl font-extrabold text-slate-900 mt-12 mb-3">{children}</h2>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-sm text-slate-700 leading-relaxed my-2">{children}</p>;
const C: React.FC<{ children: React.ReactNode }> = ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px] font-mono text-slate-800">{children}</code>;

const Table: React.FC<{ head: string[]; rows: React.ReactNode[][] }> = ({ head, rows }) => (
  <div className="overflow-x-auto border border-slate-200 rounded-xl my-3">
    <table className="w-full text-xs">
      <thead className="bg-slate-50 text-slate-500"><tr>{head.map((h) => <th key={h} className="text-left px-3 py-2 font-bold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top text-slate-700">{c}</td>)}</tr>)}
      </tbody>
    </table>
  </div>
);

const SECTIONS = [
  ["demarrage", "Démarrage rapide"], ["auth", "Authentification et modes"], ["paiements", "Créer un paiement"], ["lecture", "Relire et lister"],
  ["statuts", "Statuts"], ["idempotence", "Idempotence"], ["webhooks", "Webhooks"], ["sandbox", "Sandbox"], ["erreurs", "Erreurs"],
  ["limites", "Limites"], ["absent", "Ce qui n'existe pas encore"],
] as const;

const CREATE_CURL = `curl ${BASE}/payments \\
  -H "Authorization: Bearer ecm_sk_test_…" \\
  -H "Idempotency-Key: commande-1042" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "payment_method": "wave",
    "description": "Commande 1042",
    "customer": { "name": "Awa Koné", "phone": "+2250700000001" },
    "success_url": "https://votre-site.com/merci",
    "client_reference": "CMD-1042",
    "metadata": { "order_id": "1042" }
  }'`;

const CREATE_NODE = `const res = await fetch("${BASE}/payments", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.ECOMFY_SECRET_KEY}\`,
    "Idempotency-Key": \`commande-\${order.id}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: order.total,            // entier, en francs CFA
    payment_method: "wave",
    success_url: "https://votre-site.com/merci",
    client_reference: String(order.id),
  }),
});
const payment = await res.json();
if (!res.ok) throw new Error(payment.error.message);
redirect(payment.checkout_url);     // envoyez le client sur la page de paiement`;

const PAYMENT_JSON = `{
  "id": "pay_test_3f9c1d2e8a7b4c5d6e7f8a9b",
  "object": "payment",
  "livemode": false,
  "status": "pending",
  "amount": 5000,
  "currency": "XOF",
  "fee_amount": 125,
  "net_amount": 4875,
  "payment_method": "wave",
  "description": "Commande 1042",
  "customer": { "name": "Awa Koné", "phone": "+2250700000001" },
  "client_reference": "CMD-1042",
  "metadata": { "order_id": "1042" },
  "checkout_url": "https://ecomfy.cloud/pay/sandbox/pay_test_3f9c1d2e8a7b4c5d6e7f8a9b",
  "success_url": "https://votre-site.com/merci",
  "cancel_url": null,
  "reference": null,
  "failure": null,
  "created_at": "2026-11-14T10:02:12Z",
  "updated_at": "2026-11-14T10:02:12Z",
  "completed_at": null
}`;

const EVENT_JSON = `{
  "id": "evt_5b1e0c9a7d3f42a6b8c1d0e2",
  "object": "event",
  "type": "payment.succeeded",
  "livemode": false,
  "created_at": "2026-11-14T10:03:41Z",
  "data": { "object": { "id": "pay_test_3f9c…", "status": "succeeded", "amount": 5000, "…": "…" } }
}`;

const VERIFY_NODE = `import crypto from "node:crypto";

// rawBody : le corps BRUT de la requête (avant tout JSON.parse), sinon la signature ne correspond pas.
export function verifyEcomfyWebhook(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.trim().split("=")));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;      // rejeu
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express : app.post("/webhooks/ecomfy", express.raw({ type: "application/json" }), (req, res) => {
//   if (!verifyEcomfyWebhook(req.body.toString("utf8"), req.get("Ecomfy-Signature"), process.env.ECOMFY_WEBHOOK_SECRET)) return res.sendStatus(400);
//   const event = JSON.parse(req.body.toString("utf8"));
//   …traiter l'événement (idempotent, voir event.id)…
//   res.sendStatus(200);
// });`;

const VERIFY_PHP = `<?php
$secret = getenv('ECOMFY_WEBHOOK_SECRET');
$raw    = file_get_contents('php://input');                       // corps brut
parse_str(str_replace(',', '&', $_SERVER['HTTP_ECOMFY_SIGNATURE'] ?? ''), $p);   // t=…, v1=…
$expected = hash_hmac('sha256', ($p['t'] ?? '') . '.' . $raw, $secret);
if (!isset($p['t'], $p['v1']) || !hash_equals($expected, $p['v1']) || abs(time() - (int)$p['t']) > 300) {
    http_response_code(400); exit;
}
$event = json_decode($raw, true);
// …traiter l'événement (idempotent, voir $event['id'])…
http_response_code(200);`;

const VERIFY_PY = `import hmac, hashlib, time

def verify_ecomfy_webhook(raw_body: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    parts = dict(p.strip().split("=", 1) for p in (header or "").split(",") if "=" in p)
    try:
        t = int(parts["t"])
    except (KeyError, ValueError):
        return False
    if abs(time.time() - t) > tolerance:                      # rejeu
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))`;

const SIMULATE_CURL = `curl -X POST ${BASE}/sandbox/payments/pay_test_3f9c…/simulate \\
  -H "Authorization: Bearer ecm_sk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{"scenario": "success"}'`;

export default function EcomfyPayApiDocs() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Helmet>
        <title>API Ecomfy Pay — Documentation développeurs</title>
        <meta name="description" content="Encaissez par API avec Ecomfy Pay : paiements, webhooks signés et sandbox pour tester sans argent réel." />
      </Helmet>

      <header className="border-b border-slate-200 sticky top-0 bg-white/95 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-extrabold"><Code2 className="w-5 h-5 text-[#0E7C66]" /> API Ecomfy Pay <span className="text-xs font-semibold text-slate-400">v1</span></div>
          <div className="flex items-center gap-4 text-sm">
            <a href="/openapi/ecomfy-pay.v1.yaml" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">OpenAPI <ExternalLink className="w-3.5 h-3.5" /></a>
            <Link to="/ecomfy-pay?tab=developers" className="font-semibold text-[#0E7C66] hover:underline">Mes clés</Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 grid lg:grid-cols-[200px_1fr] gap-10">
        <nav className="hidden lg:block sticky top-20 self-start text-sm space-y-1">
          {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="block text-slate-600 hover:text-slate-900 py-0.5">{label}</a>)}
        </nav>

        <main className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight">Encaissez par API</h1>
          <P>
            Votre serveur crée un paiement, redirige le client vers la page de paiement, puis reçoit le résultat par webhook.
            Ecomfy Pay gère Wave, Orange Money, MTN, Moov et la carte. Montants en <strong>francs CFA (XOF)</strong>, entiers.
          </P>
          <P>URL de base : <C>{BASE}</C></P>

          <H2 id="demarrage">Démarrage rapide</H2>
          <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1.5">
            <li>Dans <Link className="text-[#0E7C66] font-semibold" to="/ecomfy-pay?tab=developers">Ecomfy Pay → Développeurs</Link>, créez une <strong>clé de test</strong> (<C>ecm_sk_test_…</C>).</li>
            <li>Créez un paiement avec votre clé (ci-dessous). Ouvrez le <C>checkout_url</C> reçu : la page sandbox vous laisse choisir le résultat.</li>
            <li>Ajoutez une destination de webhook, relisez le paiement (<C>GET /v1/payments/{"{id}"}</C>) et vérifiez que votre serveur traite <C>payment.succeeded</C>.</li>
            <li>Quand tout fonctionne, créez une <strong>clé de production</strong> (après validation de votre KYC) et remplacez la clé : rien d'autre ne change.</li>
          </ol>
          <Code lang="curl">{CREATE_CURL}</Code>

          <H2 id="auth">Authentification et modes</H2>
          <P>Envoyez votre clé secrète dans l'en-tête <C>Authorization: Bearer ecm_sk_…</C>. Les clés sont secrètes : gardez-les côté serveur, jamais dans une page web ou une application mobile. Une clé n'est affichée qu'une fois ; si elle fuit, révoquez-la.</P>
          <Table
            head={["", "Clé de test", "Clé de production"]}
            rows={[
              ["Préfixe", <C key="a">ecm_sk_test_</C>, <C key="b">ecm_sk_live_</C>],
              ["Argent", "Aucun : tout est simulé", "Réel : opérateurs de paiement, portefeuille Ecomfy Pay"],
              ["Identifiants", <C key="c">pay_test_…</C>, <C key="d">pay_live_…</C>],
              ["Disponibilité", "Immédiate", "Après validation du KYC"],
              ["Données", "Isolées : une clé de test ne voit jamais la production, et inversement", "—"],
            ]}
          />

          <H2 id="paiements">Créer un paiement</H2>
          <P><C>POST /v1/payments</C></P>
          <Table
            head={["Champ", "Type", "Description"]}
            rows={[
              [<C key="1">amount</C>, "entier, requis", "Montant en XOF, de 200 à 10 000 000."],
              [<C key="2">payment_method</C>, "texte, requis", <>L'un de : <C>wave</C>, <C>orange_money</C>, <C>mtn</C>, <C>moov</C>, <C>card</C>.</>],
              [<C key="3">success_url</C>, "URL, requise", <>Où renvoyer le client après le paiement. <C>https://</C> obligatoire (en test, <C>http://localhost</C> est accepté). Ecomfy ajoute <C>?payment_id=…</C>.</>],
              [<C key="4">cancel_url</C>, "URL", "Où renvoyer le client s'il abandonne ou si le paiement échoue (par défaut : success_url)."],
              [<C key="5">currency</C>, "texte", <>Seul <C>XOF</C> est disponible.</>],
              [<C key="6">description</C>, "texte ≤ 200", "Libellé montré au client."],
              [<C key="7">customer</C>, "objet", <><C>name</C>, <C>phone</C> (8 à 15 chiffres, + accepté), <C>email</C>.</>],
              [<C key="8">client_reference</C>, "texte ≤ 100", "Votre numéro de commande : retrouvé dans les réponses et les webhooks."],
              [<C key="9">metadata</C>, "objet", "Jusqu'à 20 clés (≤ 40 caractères), valeurs en texte (≤ 500)."],
            ]}
          />
          <P>Les champs inconnus sont refusés (400, <C>param</C> indique lequel) : une faute de frappe ne passe pas inaperçue. Réponse <strong>201</strong> :</P>
          <Code lang="json">{PAYMENT_JSON}</Code>
          <P>Redirigez le client vers <C>checkout_url</C>. <strong>Ne considérez jamais le paiement comme réussi parce que le client est revenu sur <C>success_url</C></strong> : seul le webhook <C>payment.succeeded</C> (ou une relecture <C>GET</C>) fait foi.</P>
          <Code lang="node">{CREATE_NODE}</Code>
          <P><C>fee_amount</C> est la commission Ecomfy (2,5 %), <C>net_amount</C> ce qui est crédité sur votre portefeuille.</P>

          <H2 id="lecture">Relire et lister</H2>
          <P><C>GET /v1/payments/{"{id}"}</C> renvoie le paiement. <C>GET /v1/payments</C> renvoie <C>{`{"object":"list","data":[…],"has_more":true}`}</C>, du plus récent au plus ancien.</P>
          <Table
            head={["Paramètre", "Description"]}
            rows={[
              [<C key="1">limit</C>, "1 à 100 (défaut 20)."],
              [<C key="2">starting_after</C>, "L'id du dernier paiement reçu : renvoie la page suivante."],
              [<C key="3">status</C>, <>Filtre : <C>pending</C>, <C>succeeded</C>, <C>failed</C>, <C>cancelled</C>, <C>expired</C>, <C>refunded</C>.</>],
            ]}
          />

          <H2 id="statuts">Statuts</H2>
          <Table
            head={["status", "Sens"]}
            rows={[
              [<C key="1">pending</C>, "Créé, en attente du client ou de l'opérateur."],
              [<C key="2">succeeded</C>, "Encaissé. Définitif."],
              [<C key="3">failed</C>, <>Refusé ou non abouti ; <C>failure.code</C> précise (en test : <C>insufficient_funds</C>, <C>payment_declined</C>).</>],
              [<C key="4">cancelled</C>, "Annulé par le client."],
              [<C key="5">expired</C>, "Délai dépassé."],
              [<C key="6">refunded</C>, "Remboursé."],
            ]}
          />

          <H2 id="idempotence">Idempotence</H2>
          <P>Ajoutez l'en-tête <C>Idempotency-Key</C> (1 à 255 caractères visibles, par exemple <C>commande-1042</C>) à vos créations de paiement. Si votre appel échoue en route (réseau coupé), renvoyez-le avec la même clé : vous recevez le même paiement (<C>200</C> et en-tête <C>Idempotent-Replayed: true</C>), jamais un doublon.</P>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li>Même clé avec un corps différent : <C>409 idempotency_key_reuse</C>.</li>
            <li>Même clé pendant que la première requête s'exécute encore : <C>409 request_in_progress</C> (réessayez dans 2 secondes).</li>
            <li>Les clés sont conservées 24 h et sont propres à chaque clé d'API.</li>
          </ul>

          <H2 id="webhooks">Webhooks</H2>
          <P>Déclarez une destination (URL <C>https</C> publique) dans l'onglet Développeurs, en mode test ou production. Ecomfy y envoie un <C>POST</C> JSON à chaque résultat, <strong>en général dans la minute</strong>.</P>
          <Table
            head={["Événement", "Quand"]}
            rows={[
              [<C key="1">payment.succeeded</C>, "Le paiement est encaissé."],
              [<C key="2">payment.failed</C>, "Le paiement a échoué."],
              [<C key="3">payment.cancelled</C>, "Le client a annulé."],
              [<C key="4">payment.expired</C>, "Le paiement a expiré."],
              [<C key="5">payment.refunded</C>, "Le paiement a été remboursé."],
            ]}
          />
          <Code lang="json">{EVENT_JSON}</Code>
          <P>En-têtes : <C>Ecomfy-Signature</C>, <C>Ecomfy-Event-Id</C>, <C>Ecomfy-Event-Type</C>, <C>Ecomfy-Delivery-Attempt</C>.</P>
          <h3 className="font-bold text-sm mt-4">Vérifier la signature</h3>
          <P>
            <C>Ecomfy-Signature: t=1763114621,v1=ab12…</C> où <C>v1</C> est le HMAC-SHA256, en hexadécimal, de <C>{"{t}.{corps brut}"}</C> avec le secret de la destination (<C>whsec_…</C>).
            Calculez-la sur le <strong>corps brut</strong>, comparez en temps constant et refusez un <C>t</C> vieux de plus de 5 minutes.
          </P>
          <Code lang="node">{VERIFY_NODE}</Code>
          <Code lang="php">{VERIFY_PHP}</Code>
          <Code lang="python">{VERIFY_PY}</Code>
          <h3 className="font-bold text-sm mt-4">Bonnes pratiques</h3>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li>Répondez <strong>2xx</strong> en moins de 8 secondes, puis traitez en arrière-plan. Toute autre réponse (ou un délai dépassé) est un échec.</li>
            <li>Un même événement peut arriver plusieurs fois : dédupliquez sur <C>event.id</C>.</li>
            <li>Les échecs sont repris après 1 min, 5 min, 30 min, 2 h, 6 h, 12 h et 24 h, puis abandonnés (visibles dans « Derniers envois »).</li>
            <li>Les redirections (3xx) ne sont pas suivies. Les adresses internes et les adresses IP littérales sont refusées.</li>
            <li>L'ordre d'arrivée n'est pas garanti : en cas de doute, relisez le paiement avec <C>GET /v1/payments/{"{id}"}</C>.</li>
          </ul>

          <H2 id="sandbox">Sandbox</H2>
          <P><FlaskConical className="inline w-4 h-4 text-amber-600 mr-1 -mt-0.5" />Le sandbox est le mode de votre clé de test : même API, même format de réponses, mêmes webhooks, <strong>sans aucun argent réel</strong>. Un paiement de test ne touche ni votre portefeuille, ni vos commandes, ni vos statistiques.</P>
          <P>Un paiement de test reste <C>pending</C> jusqu'à ce que vous choisissiez son résultat, de deux façons :</P>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li><strong>Page de paiement sandbox</strong> : ouvrez le <C>checkout_url</C> et cliquez sur le scénario voulu ; le client est ensuite redirigé comme en production.</li>
            <li><strong>Par API</strong>, pour vos tests automatisés :</li>
          </ul>
          <Code lang="curl">{SIMULATE_CURL}</Code>
          <Table
            head={["scenario", "Résultat", "Webhook"]}
            rows={[
              [<C key="1">success</C>, <>statut <C>succeeded</C></>, <C key="a">payment.succeeded</C>],
              [<C key="2">insufficient_funds</C>, <>statut <C>failed</C>, <C>failure.code = insufficient_funds</C></>, <C key="b">payment.failed</C>],
              [<C key="3">declined</C>, <>statut <C>failed</C>, <C>failure.code = payment_declined</C></>, <C key="c">payment.failed</C>],
              [<C key="4">cancelled</C>, <>statut <C>cancelled</C></>, <C key="d">payment.cancelled</C>],
              [<C key="5">expired</C>, <>statut <C>expired</C></>, <C key="e">payment.expired</C>],
            ]}
          />
          <P>Un paiement déjà terminé ne peut plus être simulé (<C>409 payment_not_pending</C>). La simulation n'existe qu'avec une clé de test (<C>403</C> avec une clé de production).</P>
          <h3 className="font-bold text-sm mt-4">Différences avec la production</h3>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li>Aucun opérateur n'est appelé : pas de vérification du numéro de téléphone, pas de délai réel, pas de page Wave / Orange / MTN / Moov.</li>
            <li>Les paiements de test n'expirent pas tout seuls : simulez <C>expired</C> pour tester ce cas.</li>
            <li>Les frais (<C>fee_amount</C>) sont calculés comme en production, mais rien n'est crédité.</li>
            <li>Les webhooks de test sont envoyés à vos destinations « Test » uniquement, signés avec leur secret.</li>
            <li>Les mêmes contrôles de validation, d'idempotence et de limite de débit s'appliquent.</li>
          </ul>

          <H2 id="erreurs">Erreurs</H2>
          <P>Les erreurs ont toujours la même forme, et le code HTTP reflète leur nature :</P>
          <Code lang="json">{`{ "error": { "type": "invalid_request_error", "code": "invalid_request", "message": "amount minimum : 200 XOF.", "param": "amount", "request_id": "req_8c1f…" } }`}</Code>
          <P>Communiquez le <C>request_id</C> (aussi dans l'en-tête <C>Request-Id</C>) au support en cas de problème.</P>
          <Table
            head={["HTTP", "code", "Sens"]}
            rows={[
              ["400", <C key="1">invalid_request</C>, <>Paramètre invalide ; <C>param</C> l'indique.</>],
              ["400", <C key="2">invalid_json</C>, "Corps vide ou JSON illisible."],
              ["401", <C key="3">missing_api_key</C>, "En-tête Authorization absent."],
              ["401", <C key="4">invalid_api_key</C>, "Clé inconnue, mal formée ou révoquée."],
              ["403", <C key="5">kyc_required</C>, "Clé de production : KYC pas encore validé."],
              ["403", <C key="6">live_mode_not_simulable</C>, "Simulation avec une clé de production."],
              ["404", <C key="7">payment_not_found</C>, "Paiement inconnu ou d'un autre mode."],
              ["409", <C key="8">idempotency_key_reuse · request_in_progress · payment_not_pending</C>, "Voir Idempotence et Sandbox."],
              ["413", <C key="9">body_too_large</C>, "Corps de plus de 20 Ko."],
              ["429", <C key="10">rate_limited</C>, <>Trop de requêtes ; attendez <C>Retry-After</C> secondes.</>],
              ["502 / 503", <C key="11">provider_error · provider_unavailable</C>, "L'opérateur de paiement a refusé ou ne répond pas. Aucun paiement n'a été créé : réessayez."],
              ["500", <C key="12">internal_error</C>, "Erreur d'Ecomfy. Réessayez avec la même Idempotency-Key."],
            ]}
          />

          <H2 id="limites">Limites</H2>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li><strong>120 requêtes par minute</strong> et par clé d'API.</li>
            <li>Montant : 200 XOF minimum (minimum de l'opérateur), 10 000 000 XOF maximum.</li>
            <li>Corps de requête : 20 Ko. <C>metadata</C> : 20 clés.</li>
            <li>10 clés actives et 5 destinations de webhook par boutique et par mode.</li>
          </ul>

          <H2 id="absent">Ce qui n'existe pas encore</H2>
          <P>Pour éviter toute surprise : il n'y a pas, dans cette version, de remboursement par API, de retrait (payout) par API, d'expiration automatique des paiements de production (<C>payment.expired</C> n'y est pas émis), ni d'autre devise que le XOF. La clé secrète donne accès à une seule boutique.</P>

          <p className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-400">
            Spécification : <a className="underline" href="/openapi/ecomfy-pay.v1.yaml">OpenAPI 3.0</a>. Version de l'API : v1.
          </p>
        </main>
      </div>
    </div>
  );
}
