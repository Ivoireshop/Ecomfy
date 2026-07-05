import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyShops from "./tools/list-my-shops";
import listShopProducts from "./tools/list-shop-products";
import listShopOrders from "./tools/list-shop-orders";

// The OAuth issuer MUST point at the direct Supabase host (see
// app-mcp-server-authoring). VITE_SUPABASE_PROJECT_ID is inlined by Vite at
// build time, keeping this module import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "visualpro-mcp",
  title: "VisualPro",
  version: "0.1.0",
  instructions:
    "Tools for VisualPro shop owners. Use `list_my_shops` first to discover the signed-in user's shops, then `list_shop_products` or `list_shop_orders` with the returned shop id. All tools are read-only.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyShops, listShopProducts, listShopOrders],
});