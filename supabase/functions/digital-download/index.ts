// Livraison des produits digitaux : liste les fichiers d'une commande payée et signe un lien de téléchargement court.
//
// Aucune session : l'acheteur est un invité. Il prouve son droit avec le jeton secret de sa commande
// (digital_order_access.token), ou avec la référence de paiement ECM-PAY-… de son retour de paiement (action « resolve »,
// qui échange la référence contre le jeton, uniquement si la commande est payée).
//
// Le droit est recalculé à CHAQUE demande depuis orders.payment_status : un remboursement ou un échec le coupe sans
// qu'aucune fonction de paiement n'ait à intervenir. Le fichier lui-même n'est jamais public : lien signé de 60 secondes.
//
// Actions (POST JSON) :
//   { action: "resolve", payment_ref }        -> { success, token }
//   { action: "recover", order_number, email } -> { success } (renvoie le mail du lien ; ne renvoie jamais le jeton)
//   { action: "list",    token }              -> { success, paid, shop, items: [{ product_name, files: [...] }] }
//   { action: "link",    token, file_id }     -> { success, url, file_name, remaining }
import { serveCors, errorJson } from "../_shared/http.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { sendDigitalDeliveryEmail } from "../_shared/digital-delivery.ts";

const TOKEN_RE = /^[a-f0-9]{64}$/;
const PAYMENT_REF_RE = /^ECM-PAY-[A-F0-9]{12}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_SECONDS = 60;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- client Supabase de service sans types générés
type Db = any;

const isPaid = (status: unknown) => String(status ?? "").toLowerCase() === "paid";

async function tooManyRequests(db: Db, req: Request, bucket: string, max: number): Promise<boolean> {
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "").trim();
  if (!ip) return false;
  const { data } = await db.rpc("check_rate_limit", { _bucket: bucket, _key: ip.slice(0, 64), _max: max, _window_seconds: 600 });
  return data?.allowed === false;
}

serveCors("public", async (req) => {
  if (req.method !== "POST") return errorJson(405, "Méthode non autorisée.");

  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- corps JSON de la requête, validé champ par champ
  let body: any;
  try { body = await req.json(); } catch { return errorJson(400, "Requête invalide."); }
  const action = String(body?.action ?? "");

  const db: Db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- resolve : référence de paiement -> jeton ----------
  if (action === "resolve") {
    const ref = String(body?.payment_ref ?? "");
    if (!PAYMENT_REF_RE.test(ref)) return errorJson(400, "Référence de paiement invalide.");
    if (await tooManyRequests(db, req, "digital_resolve_ip", 30)) return errorJson(429, "Trop de demandes. Réessayez dans quelques minutes.");

    const { data: pay } = await db.from("ecomfy_payments").select("order_id").eq("internal_reference", ref).maybeSingle();
    if (!pay?.order_id) return json({ success: true, token: null, paid: false, digital: false });

    // `digital` dit seulement si la commande contient un produit digital : le front n'attend le paiement que dans ce cas.
    const { data: access } = await db.from("digital_order_access").select("token").eq("order_id", pay.order_id).maybeSingle();
    if (!access) return json({ success: true, token: null, paid: false, digital: false });

    const { data: order } = await db.from("orders").select("payment_status").eq("id", pay.order_id).maybeSingle();
    if (!order || !isPaid(order.payment_status)) return json({ success: true, token: null, paid: false, digital: true });

    return json({ success: true, token: access.token, paid: true, digital: true });
  }

  // ---------- recover : lien perdu -> nouveau mail à l'adresse enregistrée sur la commande ----------
  // La réponse est toujours la même (aucun indice sur l'existence d'une commande) et ne contient jamais le jeton :
  // seule la boîte mail de l'acheteur le reçoit.
  if (action === "recover") {
    const orderNumber = String(body?.order_number ?? "").trim().slice(0, 60);
    const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 254);
    const generic = json({ success: true, message: "Si une commande payée correspond, un e-mail contenant le lien vient d'être envoyé." });
    if (!orderNumber || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return errorJson(400, "Numéro de commande et e-mail requis.");
    if (await tooManyRequests(db, req, "digital_recover_ip", 5)) return errorJson(429, "Trop de demandes. Réessayez dans quelques minutes.");

    const { data: order } = await db.from("orders").select("id, customer_email").eq("order_number", orderNumber).maybeSingle();
    if (!order || String(order.customer_email ?? "").trim().toLowerCase() !== email) return generic;
    // Un renvoi par commande et par heure au plus (clé d'idempotence horodatée).
    await sendDigitalDeliveryEmail(db, order.id, `digital-recover-${order.id}-${Math.floor(Date.now() / 3_600_000)}`);
    return generic;
  }

  // ---------- list / link : jeton obligatoire ----------
  const token = String(body?.token ?? "");
  if (!TOKEN_RE.test(token)) return errorJson(400, "Lien de téléchargement invalide.");
  if (await tooManyRequests(db, req, "digital_download_ip", 60)) return errorJson(429, "Trop de demandes. Réessayez dans quelques minutes.");

  const { data: access } = await db.from("digital_order_access").select("order_id, shop_id").eq("token", token).maybeSingle();
  if (!access) return errorJson(404, "Lien de téléchargement introuvable.");

  const { data: order } = await db.from("orders").select("id, order_number, payment_status, shop_id").eq("id", access.order_id).maybeSingle();
  if (!order) return errorJson(404, "Commande introuvable.");

  const { data: shop } = await db.from("shops").select("business_name, slug, primary_color, phone_number, whatsapp_number").eq("id", access.shop_id).maybeSingle();
  const shopInfo = shop
    ? { name: shop.business_name, slug: shop.slug, primary_color: shop.primary_color, contact: shop.whatsapp_number || shop.phone_number || null }
    : null;

  if (!isPaid(order.payment_status)) {
    // Le paiement peut encore arriver (webhook) : le front réessaie. Aucun nom de fichier n'est révélé avant.
    return json({ success: true, paid: false, order_number: order.order_number, shop: shopInfo, items: [] });
  }

  // Lignes digitales de la commande, avec les fichiers de chaque produit.
  const { data: lines } = await db.from("order_items").select("product_id, product_name").eq("order_id", order.id);
  const productIds = Array.from(new Set((lines ?? []).map((l: { product_id: string }) => l.product_id)));
  if (productIds.length === 0) return json({ success: true, paid: true, order_number: order.order_number, shop: shopInfo, items: [] });

  const { data: products } = await db.from("products").select("id, is_digital, digital_download_limit").in("id", productIds).eq("is_digital", true);
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lignes lues avec un select libre
  const digital = new Map<string, any>((products ?? []).map((p: any) => [p.id, p]));
  const { data: files } = await db
    .from("product_digital_files")
    .select("id, product_id, file_name, file_size, mime_type, storage_path, display_order")
    .in("product_id", Array.from(digital.keys()))
    .order("display_order", { ascending: true });

  const { data: logs } = await db.from("digital_download_log").select("file_id").eq("order_id", order.id);
  const used = new Map<string, number>();
  for (const l of logs ?? []) used.set(l.file_id, (used.get(l.file_id) ?? 0) + 1);

  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lignes lues avec un select libre
  const fileById = new Map<string, any>((files ?? []).map((f: any) => [f.id, f]));
  const remainingFor = (fileId: string, productId: string): number | null => {
    const limit = digital.get(productId)?.digital_download_limit;
    if (limit === null || limit === undefined) return null;
    return Math.max(0, Number(limit) - (used.get(fileId) ?? 0));
  };

  if (action === "list") {
    const items = (lines ?? [])
      .filter((l: { product_id: string }) => digital.has(l.product_id))
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lignes lues avec un select libre
      .map((l: any) => ({
        product_name: l.product_name,
        files: (files ?? [])
          // deno-lint-ignore no-explicit-any
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lignes lues avec un select libre
          .filter((f: any) => f.product_id === l.product_id)
          // deno-lint-ignore no-explicit-any
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lignes lues avec un select libre
          .map((f: any) => ({ id: f.id, file_name: f.file_name, file_size: f.file_size, mime_type: f.mime_type, remaining: remainingFor(f.id, f.product_id) })),
      }));
    return json({ success: true, paid: true, order_number: order.order_number, shop: shopInfo, items });
  }

  if (action === "link") {
    const fileId = String(body?.file_id ?? "");
    if (!UUID_RE.test(fileId)) return errorJson(400, "Fichier invalide.");
    const file = fileById.get(fileId);
    // Le fichier doit appartenir à un produit digital de CETTE commande : un jeton n'ouvre rien d'autre.
    if (!file) return errorJson(404, "Fichier introuvable pour cette commande.");

    const limit = digital.get(file.product_id)?.digital_download_limit;
    // Journal d'abord, comptage ensuite : deux clics simultanés ne dépassent pas la limite.
    const { data: logRow, error: logErr } = await db.from("digital_download_log").insert({ order_id: order.id, file_id: file.id }).select("id").single();
    if (logErr || !logRow) return errorJson(500, "Téléchargement indisponible pour le moment.");
    if (limit !== null && limit !== undefined) {
      const { count } = await db.from("digital_download_log").select("id", { count: "exact", head: true }).eq("order_id", order.id).eq("file_id", file.id);
      if ((count ?? 0) > Number(limit)) {
        await db.from("digital_download_log").delete().eq("id", logRow.id);
        return errorJson(403, "Limite de téléchargements atteinte pour ce fichier. Contactez la boutique.", { contact: shopInfo?.contact ?? null });
      }
    }

    const { data: signed, error: signErr } = await db.storage.from("digital-products").createSignedUrl(file.storage_path, SIGNED_URL_SECONDS, { download: file.file_name });
    if (signErr || !signed?.signedUrl) {
      // Le lien n'a pas été remis : ce téléchargement ne doit pas compter.
      await db.from("digital_download_log").delete().eq("id", logRow.id);
      return errorJson(500, "Fichier momentanément indisponible. Réessayez ou contactez la boutique.");
    }
    const remaining = limit === null || limit === undefined ? null : Math.max(0, Number(limit) - (used.get(file.id) ?? 0) - 1);
    return json({ success: true, url: signed.signedUrl, file_name: file.file_name, remaining });
  }

  return errorJson(400, "Action inconnue.");
});
