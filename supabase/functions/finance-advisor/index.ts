import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { geminiChat } from "../_shared/openrouter-chat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const __quota = await enforceAiQuota(req, "finance-advisor");
  if (!__quota.allowed) return __quota.response;


  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Non authentifié" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { stats: rawStats } = await req.json();

    // Le client envoie ses chiffres : on ne transmet au modèle que des nombres connus et un nom court, jamais un objet libre
    // (sinon n'importe quel texte arrive dans l'invite et le quota IA sert à autre chose qu'un bilan).
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const NUMERIC = ["ordersCount", "deliveredCount", "revenue", "cashIn", "totalExpenses", "platformFees", "profit", "margin", "adSpendTotal", "roas", "cac"];
    const stats: Record<string, unknown> = {};
    for (const k of NUMERIC) stats[k] = num(rawStats?.[k]);
    stats.expByCat = Object.fromEntries(
      ["ads", "stock", "shipping", "salary", "other"].map((c) => [c, num(rawStats?.expByCat?.[c])]),
    );
    stats.period = ["week", "month", "all"].includes(rawStats?.period) ? rawStats.period : "month";
    stats.shopName = String(rawStats?.shopName || "").slice(0, 80);

    const prompt = `Tu es un comptable expert pour e-commerçants africains (FCFA). Analyse ces chiffres et donne 4 conseils concrets, courts (1-2 phrases chacun), avec emojis. Sois direct, bienveillant, sans jargon.

Données boutique:
${JSON.stringify(stats, null, 2)}

Réponds en français, format markdown avec puces.`;

    try {
      const { content: advice, provider } = await geminiChat({
        messages: [{ role: "user", content: prompt }],
      });
      console.log(`[finance-advisor] provider=${provider}`);
      return new Response(JSON.stringify({ success: true, advice }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("finance-advisor AI error", e);
      return new Response(JSON.stringify({ success: false, error: "Service IA momentanément indisponible. Réessayez dans un instant." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});