import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "list_shop_orders",
  title: "List shop orders",
  description:
    "List recent orders for a shop owned by the signed-in user. Filter by payment_status or order_status.",
  inputSchema: {
    shop_id: z.string().uuid().describe("The shop id returned by list_my_shops."),
    limit: z.number().int().min(1).max(100).default(20),
    payment_status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
    order_status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ shop_id, limit, payment_status, order_status }, ctx) => {
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
    const { data: shop } = await sb
      .from("shops")
      .select("id")
      .eq("id", shop_id)
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (!shop) return { content: [{ type: "text", text: "Shop not found or not yours" }], isError: true };

    let q = sb
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, total, payment_method, payment_status, order_status, created_at, products_summary")
      .eq("shop_id", shop_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (payment_status) q = q.eq("payment_status", payment_status);
    if (order_status) q = q.eq("order_status", order_status);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});