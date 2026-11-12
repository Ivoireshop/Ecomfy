import { describe, expect, it, vi } from "vitest";
import { createResilientFetch } from "./resilientFetch";

const REST = "https://x.supabase.co/rest/v1";
const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
const down = (status = 521) => new Response("down", { status });

function setup(responses: Array<() => Response | Promise<Response>>) {
  let t = 1_000_000;
  const base = vi.fn(async () => {
    const next = responses.length > 1 ? responses.shift()! : responses[0];
    return next();
  });
  const rf = createResilientFetch(base, { now: () => t });
  return { rf, base, advance: (ms: number) => { t += ms; } };
}

describe("resilientFetch — disjoncteur", () => {
  it("laisse passer les lectures tant que tout va bien", async () => {
    const { rf, base } = setup([ok]);
    for (let i = 0; i < 5; i++) expect((await rf(`${REST}/shops?id=eq.${i}`)).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(5);
  });

  it("s'ouvre après 3 échecs transitoires et refuse les lectures sans appel réseau", async () => {
    const { rf, base } = setup([() => down(521)]);
    for (let i = 0; i < 3; i++) expect((await rf(`${REST}/shops?id=eq.${i}`)).status).toBe(521);
    expect(base).toHaveBeenCalledTimes(3);

    const res = await rf(`${REST}/profiles?id=eq.1`);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("CIRCUIT_OPEN");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(base).toHaveBeenCalledTimes(3); // pas d'appel de plus
  });

  it("ne compte pas les erreurs applicatives (400/401/404/406/500) comme une panne", async () => {
    const { rf, base } = setup([() => new Response("x", { status: 406 }), () => new Response("x", { status: 500 })]);
    for (let i = 0; i < 6; i++) await rf(`${REST}/subscriptions?i=${i}`);
    expect(base).toHaveBeenCalledTimes(6);
  });

  it("laisse passer une seule sonde après le délai, puis referme si elle réussit", async () => {
    const { rf, base, advance } = setup([() => down(), () => down(), () => down(), ok]);
    for (let i = 0; i < 3; i++) await rf(`${REST}/shops?i=${i}`);
    advance(1_000);
    expect((await rf(`${REST}/shops?i=9`)).status).toBe(503); // délai (2 s) pas écoulé
    advance(1_500);
    expect((await rf(`${REST}/shops?i=10`)).status).toBe(200); // sonde
    expect(base).toHaveBeenCalledTimes(4);
    expect((await rf(`${REST}/shops?i=11`)).status).toBe(200); // refermé
    expect(base).toHaveBeenCalledTimes(5);
  });

  it("double le délai quand la sonde échoue (plafonné)", async () => {
    const { rf, base, advance } = setup([() => down()]);
    for (let i = 0; i < 3; i++) await rf(`${REST}/shops?i=${i}`);
    advance(2_100);
    expect((await rf(`${REST}/shops?i=a`)).status).toBe(521); // sonde échouée → délai 4 s
    advance(3_000);
    expect((await rf(`${REST}/shops?i=b`)).status).toBe(503);
    advance(1_100);
    expect((await rf(`${REST}/shops?i=c`)).status).toBe(521); // nouvelle sonde
    expect(base).toHaveBeenCalledTimes(5);
  });

  it("ne bloque jamais les écritures, ni auth/storage/functions", async () => {
    const { rf, base } = setup([() => down()]);
    for (let i = 0; i < 3; i++) await rf(`${REST}/shops?i=${i}`);
    expect(base).toHaveBeenCalledTimes(3);

    await rf(`${REST}/orders`, { method: "POST", body: "{}" });
    await rf(`${REST}/orders?id=eq.1`, { method: "PATCH", body: "{}" });
    await rf(`${REST}/rpc/create_order`, { method: "POST", body: "{}" });
    await rf("https://x.supabase.co/auth/v1/token?grant_type=refresh_token", { method: "POST", body: "{}" });
    await rf("https://x.supabase.co/functions/v1/process-payment", { method: "POST", body: "{}" });
    expect(base).toHaveBeenCalledTimes(8);
  });

  it("traite les RPC get_* comme des lectures", async () => {
    const { rf, base } = setup([() => down()]);
    for (let i = 0; i < 3; i++) await rf(`${REST}/rpc/get_public_product_page`, { method: "POST", body: "{}" });
    expect((await rf(`${REST}/rpc/get_public_shop_by_slug`, { method: "POST", body: "{}" })).status).toBe(503);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("compte une coupure réseau mais pas une annulation volontaire", async () => {
    let n = 0;
    const base = vi.fn(async () => {
      n += 1;
      if (n <= 5) throw new DOMException("aborted", "AbortError");
      throw new TypeError("Failed to fetch");
    });
    const rf = createResilientFetch(base, { now: () => 0 });
    for (let i = 0; i < 5; i++) await expect(rf(`${REST}/shops?i=${i}`)).rejects.toThrow();
    // 5 annulations : disjoncteur toujours fermé
    for (let i = 0; i < 3; i++) await expect(rf(`${REST}/shops?j=${i}`)).rejects.toBeInstanceOf(TypeError);
    expect((await rf(`${REST}/shops?k=1`)).status).toBe(503);
  });
});

describe("resilientFetch — fusion des lectures identiques", () => {
  it("un seul appel réseau pour des lectures identiques simultanées, chacune lisant son corps", async () => {
    const { rf, base } = setup([ok]);
    const headers = { apikey: "k", authorization: "Bearer t" };
    const rs = await Promise.all([1, 2, 3, 4].map(() => rf(`${REST}/shops?id=eq.1`, { headers })));
    expect(base).toHaveBeenCalledTimes(1);
    for (const r of rs) expect(await r.json()).toEqual({ ok: true });
  });

  it("ne fusionne pas des lectures aux URL ou en-têtes différents", async () => {
    const { rf, base } = setup([ok]);
    await Promise.all([
      rf(`${REST}/shops?id=eq.1`, { headers: { authorization: "a" } }),
      rf(`${REST}/shops?id=eq.1`, { headers: { authorization: "b" } }),
      rf(`${REST}/shops?id=eq.2`, { headers: { authorization: "a" } }),
    ]);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("relance un vrai appel une fois la première lecture terminée", async () => {
    const { rf, base } = setup([ok]);
    await rf(`${REST}/shops?id=eq.1`);
    await rf(`${REST}/shops?id=eq.1`);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("ne fusionne pas les requêtes annulables", async () => {
    const { rf, base } = setup([ok]);
    const c = new AbortController();
    await Promise.all([rf(`${REST}/shops?id=eq.1`, { signal: c.signal }), rf(`${REST}/shops?id=eq.1`, { signal: c.signal })]);
    expect(base).toHaveBeenCalledTimes(2);
  });
});
