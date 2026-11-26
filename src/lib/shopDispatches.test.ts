import { describe, expect, it } from "vitest";
import type { DeliveryDispatch } from "@/types/delivery";
import { activeDispatchByOrder } from "./shopDispatches";

const d = (order_id: string, status: string, id = status) => ({ id, order_id, status }) as unknown as DeliveryDispatch;

describe("activeDispatchByOrder", () => {
  it("garde la commande confiée tant que la course est en cours ou aboutie", () => {
    for (const status of ["transmitted", "accepted", "assigned", "in_transit", "delivered", "completed", "disputed"]) {
      expect(activeDispatchByOrder([d("o1", status)]).has("o1")).toBe(true);
    }
  });

  it("libère la commande après refus, annulation, échec ou retour", () => {
    for (const status of ["refused", "cancelled", "failed", "returned"]) {
      expect(activeDispatchByOrder([d("o1", status)]).has("o1")).toBe(false);
    }
  });

  it("retient la nouvelle course quand une ancienne a été refusée", () => {
    const map = activeDispatchByOrder([d("o1", "transmitted", "new"), d("o1", "refused", "old")]);
    expect(map.get("o1")?.id).toBe("new");
  });
});
