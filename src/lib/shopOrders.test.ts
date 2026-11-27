import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const tables: Record<string, { data: unknown[] | null; error: { message: string } | null }> = {};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (table: string) => ({ select: () => ({ in: () => Promise.resolve(tables[table] ?? { data: [], error: null }) }) }),
  },
}));

import { attachDeliveries, fetchAllShopOrders, type ShopOrder } from "./shopOrders";

const order = (id: string) => ({ id, order_number: id }) as ShopOrder;
const page = (ids: string[], restricted = false) => ({
  data: { restricted, total: ids.length, shop_total: ids.length, counts: {}, rows: ids.map(order) },
  error: null,
});
const filter = { shopId: "s", search: "", delivery: "all" as const, today: "2026-11-27" };

beforeEach(() => {
  rpc.mockReset();
  Object.keys(tables).forEach((k) => delete tables[k]);
});

describe("fetchAllShopOrders", () => {
  const batch = (from: number, n: number) => Array.from({ length: n }, (_, i) => `o${from + i}`);

  it("lit tous les lots et ne garde qu'une fois une commande revenue deux fois", async () => {
    // Une commande arrivée pendant la lecture : o499 ouvre aussi le second lot.
    rpc.mockResolvedValueOnce(page(batch(0, 500))).mockResolvedValueOnce(page(batch(499, 3)));
    const orders = await fetchAllShopOrders(filter);
    expect(orders).toHaveLength(502);
    expect(rpc.mock.calls[1][1]).toMatchObject({ _limit: 500, _offset: 500, _delivery: "all" });
  });

  it("échoue plutôt que de rendre un export incomplet", async () => {
    rpc.mockResolvedValueOnce(page(batch(0, 500))).mockResolvedValueOnce({ data: null, error: { message: "coupure" } });
    await expect(fetchAllShopOrders(filter)).rejects.toEqual({ message: "coupure" });
  });

  it("échoue pour une boutique restreinte", async () => {
    rpc.mockResolvedValueOnce(page([], true));
    await expect(fetchAllShopOrders(filter)).rejects.toThrow("restreinte");
  });
});

describe("attachDeliveries", () => {
  it("joint prestataire, livreur et encaissement à la bonne commande", async () => {
    tables.order_deliveries = { data: [{ id: "d1", order_id: "a", status: "delivered", provider_id: "p", driver_id: "m" }], error: null };
    tables.delivery_providers_public = { data: [{ id: "p", company_name: "Express" }], error: null };
    tables.delivery_payments = { data: [{ delivery_id: "d1", amount_collected: 500, status: "remitted_to_shop" }], error: null };
    rpc.mockResolvedValueOnce({ data: [{ member_id: "m", full_name: "Awa", phone: "07" }], error: null });

    const [a, b] = await attachDeliveries([order("a"), order("b")]);
    expect(a.order_deliveries?.[0]).toMatchObject({
      provider: { company_name: "Express" }, driver: { name: "Awa", phone: "07" }, payment: { amount_collected: 500 },
    });
    expect(b.order_deliveries).toEqual([]);
  });

  it("rend les commandes sans suivi si la lecture des livraisons échoue", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    tables.order_deliveries = { data: null, error: { message: "refus" } };
    expect(await attachDeliveries([order("a")])).toEqual([order("a")]);
    log.mockRestore();
  });

  it("ne lit rien sans commande", async () => {
    expect(await attachDeliveries([])).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
