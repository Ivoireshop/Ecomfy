import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllLoyalCustomers, fetchLoyalCustomersPage, loyalCustomersCsv, repeatRate, type CustomerLoyaltyProfile } from "./loyalCustomers";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const customer = (id: string, extra: Partial<CustomerLoyaltyProfile> = {}): CustomerLoyaltyProfile => ({
  id, customer_name: `Client ${id}`, customer_phone: "+2250700000000", customer_email: null, delivery_city: null,
  order_count: 2, total_spent: 1500, last_order_date: "2026-11-20T10:00:00Z", first_order_date: "2026-11-01T10:00:00Z",
  tier: "argent", ...extra,
});
const stats = { customers: 3, repeating: 1, platine: 0, or: 0, argent: 1, bronze: 2, repeat_revenue: 1500 };
const answer = (rows: CustomerLoyaltyProfile[], extra = {}) => ({ data: { restricted: false, total: rows.length, stats, rows, ...extra }, error: null });
const filter = { shopId: "s1", search: "kone", tier: "repeating" as const };

describe("clients fidèles", () => {
  beforeEach(() => rpc.mockReset());

  it("demande la page voulue avec la recherche et le niveau", async () => {
    rpc.mockResolvedValue(answer([customer("a")], { total: 45 }));
    const page = await fetchLoyalCustomersPage(filter, 3, 20);
    expect(rpc).toHaveBeenCalledWith("shop_loyal_customers", { _shop_id: "s1", _search: "kone", _tier: "repeating", _limit: 20, _offset: 40 });
    expect(page).toEqual({ rows: [customer("a")], total: 45, stats });
  });

  it("lève une erreur au lieu de rendre une liste vide", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "refusé" } });
    await expect(fetchLoyalCustomersPage(filter, 1, 20)).rejects.toEqual({ message: "refusé" });
    rpc.mockResolvedValue(answer([], { restricted: true }));
    await expect(fetchLoyalCustomersPage(filter, 1, 20)).rejects.toThrow("Boutique restreinte");
  });

  it("exporte tous les lots sans doublon", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => customer(String(i)));
    rpc.mockResolvedValueOnce(answer(first)).mockResolvedValueOnce(answer([customer("999"), customer("1000")]));
    const all = await fetchAllLoyalCustomers(filter);
    expect(all).toHaveLength(1001);
    expect(rpc).toHaveBeenLastCalledWith("shop_loyal_customers", expect.objectContaining({ _offset: 1000, _limit: 1000 }));
  });

  it("n'exporte rien de partiel si un lot échoue", async () => {
    rpc.mockResolvedValueOnce(answer(Array.from({ length: 1000 }, (_, i) => customer(String(i)))))
      .mockResolvedValueOnce({ data: null, error: { message: "coupure" } });
    await expect(fetchAllLoyalCustomers(filter)).rejects.toEqual({ message: "coupure" });
  });

  it("calcule le taux de fidélité à une décimale", () => {
    expect(repeatRate({ customers: 1105, repeating: 4 })).toBe(0.4);
    expect(repeatRate({ customers: 0, repeating: 0 })).toBe(0);
  });

  it("écrit un CSV lisible par Excel, sans formule exécutable", () => {
    const csv = loyalCustomersCsv([customer("a", { customer_name: '=HYPERLINK("x")', delivery_city: "Bouaké" })]);
    const [header, line] = csv.split("\r\n");
    expect(header.startsWith('﻿"Nom";"Telephone"')).toBe(true);
    expect(line).toBe('"\'=HYPERLINK(""x"")";"+2250700000000";"";"Bouaké";2;1500;"ARGENT";"20/11/2026"');
  });
});
