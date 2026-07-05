import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "list_shop_products",
  title: "List shop products",
  description:
    "List products for a given shop owned by the signed-in user. Returns name, price, stock and publication state.",
  inputSchema: {
    shop_id: z.string().uuid().describe("The shop id returned by list_my_shops."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ shop_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    // Ownership check via RLS-safe query on shops
    const { data: shop, error: shopErr } = await sb
      .from("shops")
      .select("id")
      .eq("id", shop_id)
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (shopErr) return { content: [{ type: "text", text: shopErr.message }], isError: true };
    if (!shop) return { content: [{ type: "text", text: "Shop not found or not yours" }], isError: true };

    const { data, error } = await sb
      .from("products")
      .select("id, name, slug, price, compare_at_price, stock_quantity, is_published, is_featured, category, created_at")
      .eq("shop_id", shop_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { products: data ?? [] },
    };
  },
});