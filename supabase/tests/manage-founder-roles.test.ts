// Tests du correctif C7 : manage-founder-roles.
// Exécution (Node >= 22.6, aucun accès réseau ni base requis, client Supabase simulé en mémoire) :
//   node --experimental-strip-types --test supabase/tests/manage-founder-roles.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../functions/manage-founder-roles/handler.ts";

const MAIN = "11111111-1111-1111-1111-111111111111"; // rôle founder
const CO = "22222222-2222-2222-2222-222222222222"; // rôle co_founder
const SHARE = "33333333-3333-3333-3333-333333333333"; // rôle shareholder
const ADMIN = "44444444-4444-4444-4444-444444444444"; // rôle admin
const NOBODY = "55555555-5555-5555-5555-555555555555"; // aucun rôle
const LOOKALIKE = "66666666-6666-6666-6666-666666666666"; // e-mail contenant « djateulrich », aucun rôle
const NEWBIE = "77777777-7777-7777-7777-777777777777"; // inscrit, aucun rôle

const USERS: Record<string, string> = {
  [MAIN]: "djateulrich@gmail.com",
  [CO]: "co@example.com",
  [SHARE]: "share@example.com",
  [ADMIN]: "admin@example.com",
  [NOBODY]: "nobody@example.com",
  [LOOKALIKE]: "x.djateulrich@gmail.com",
  [NEWBIE]: "newbie@example.com",
};

type Row = { id: string; user_id: string; role: string; created_at: string };

// Client Supabase minimal : jetons « token-<uuid> », table user_roles en mémoire.
function fakeClient(initial: Row[]) {
  const roles = [...initial];
  let seq = 100;

  const query = (table: string) => {
    const filters: Array<(r: any) => boolean> = [];
    let op: "select" | "delete" = "select";
    const run = () => {
      if (table === "profiles") {
        return { data: Object.entries(USERS).map(([id, email]) => ({ id, email, full_name: null })).filter((p) => filters.every((f) => f(p))), error: null };
      }
      if (op === "delete") {
        const keep = roles.filter((r) => !filters.every((f) => f(r)));
        roles.splice(0, roles.length, ...keep);
        return { data: null, error: null };
      }
      return { data: roles.filter((r) => filters.every((f) => f(r))), error: null };
    };
    const q: any = {
      select: () => q,
      delete: () => { op = "delete"; return q; },
      eq: (col: string, val: unknown) => { filters.push((r) => r[col] === val); return q; },
      in: (col: string, vals: unknown[]) => { filters.push((r) => vals.includes(r[col])); return q; },
      upsert: (row: { user_id: string; role: string }) => {
        if (!roles.some((r) => r.user_id === row.user_id && r.role === row.role)) {
          roles.push({ id: `r${seq++}`, created_at: "2026-10-12T00:00:00Z", ...row });
        }
        return Promise.resolve({ error: null });
      },
      then: (resolve: (v: unknown) => unknown) => resolve(run()),
    };
    return q;
  };

  const client: any = {
    from: query,
    auth: {
      getUser: async (token: string) => {
        const id = token.replace("token-", "");
        return USERS[id] ? { data: { user: { id, email: USERS[id] } }, error: null } : { data: { user: null }, error: new Error("bad jwt") };
      },
      admin: {
        listUsers: async () => ({ data: { users: Object.entries(USERS).map(([id, email]) => ({ id, email, created_at: "2026-01-01" })) }, error: null }),
        getUserById: async (id: string) => ({ data: { user: USERS[id] ? { id, email: USERS[id] } : null }, error: null }),
      },
    },
  };
  return { client, roles };
}

const seed = (): Row[] => [
  { id: "r1", user_id: MAIN, role: "founder", created_at: "2026-01-01T00:00:00Z" },
  { id: "r2", user_id: CO, role: "co_founder", created_at: "2026-01-02T00:00:00Z" },
  { id: "r3", user_id: SHARE, role: "shareholder", created_at: "2026-01-03T00:00:00Z" },
  { id: "r4", user_id: ADMIN, role: "admin", created_at: "2026-01-04T00:00:00Z" },
];

async function call(client: any, caller: string | null, body: unknown) {
  const req = new Request("http://localhost/manage-founder-roles", {
    method: "POST",
    headers: caller ? { Authorization: `Bearer token-${caller}` } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await handleRequest(req, client);
  return { status: res.status, body: await res.json() };
}

test("sans jeton valide : 401", async () => {
  const { client } = fakeClient(seed());
  assert.equal((await call(client, null, { action: "list" })).status, 401);
});

test("e-mail contenant « djateulrich » mais sans rôle : refusé (list, add, revoke)", async () => {
  const { client, roles } = fakeClient(seed());
  for (const body of [
    { action: "list" },
    { action: "add", email: "x.djateulrich@gmail.com", role: "co_founder" },
    { action: "add", email: "x.djateulrich@gmail.com", role: "founder" },
    { action: "revoke", target_user_id: CO, role: "co_founder" },
  ]) {
    assert.equal((await call(client, LOOKALIKE, body)).status, 403, JSON.stringify(body));
  }
  assert.equal(roles.length, 4);
});

test("utilisateur sans rôle, actionnaire et admin : refusés (ne passent plus le contrôle)", async () => {
  const { client } = fakeClient(seed());
  for (const who of [NOBODY, SHARE, ADMIN]) {
    assert.equal((await call(client, who, { action: "list" })).status, 403, who);
    assert.equal((await call(client, who, { action: "add", email: "newbie@example.com", role: "co_founder" })).status, 403, who);
  }
});

test("le fondateur principal est identifié par son rôle, quel que soit son e-mail", async () => {
  USERS[MAIN] = "autre.adresse@example.com";
  try {
    const { client } = fakeClient(seed());
    const res = await call(client, MAIN, { action: "list" });
    assert.equal(res.status, 200);
    assert.equal(res.body.isMainFounder, true);
  } finally {
    USERS[MAIN] = "djateulrich@gmail.com";
  }
});

test("co-fondateur : peut lister, ne peut ni nommer ni révoquer", async () => {
  const { client, roles } = fakeClient(seed());
  const list = await call(client, CO, { action: "list" });
  assert.equal(list.status, 200);
  assert.equal(list.body.isMainFounder, false);
  assert.equal((await call(client, CO, { action: "add", email: "newbie@example.com", role: "co_founder" })).status, 403);
  assert.equal((await call(client, CO, { action: "revoke", target_user_id: SHARE, role: "shareholder" })).status, 403);
  assert.equal(roles.length, 4);
});

test("list : renvoie les 4 rôles, is_main_founder seulement pour `founder`, pas d'entrée synthétique", async () => {
  const { client } = fakeClient(seed());
  const { body } = await call(client, MAIN, { action: "list" });
  assert.equal(body.founders.length, 4);
  assert.deepEqual(body.founders.filter((f: any) => f.is_main_founder).map((f: any) => f.user_id), [MAIN]);
  assert.ok(!body.founders.some((f: any) => f.id === "main-founder-id"));
  assert.equal(body.founders.find((f: any) => f.user_id === CO).email, "co@example.com");
});

test("add : liste blanche des rôles (founder, user, delivery, vide, non-chaîne refusés)", async () => {
  const { client, roles } = fakeClient(seed());
  for (const role of ["founder", "user", "delivery", "", null, 42, ["co_founder"], "co_founder "]) {
    const res = await call(client, MAIN, { action: "add", email: "newbie@example.com", role });
    assert.equal(res.status, 400, String(role));
  }
  assert.equal(roles.length, 4);
});

test("add : rôles autorisés accordés par le fondateur principal, e-mail insensible à la casse", async () => {
  const { client, roles } = fakeClient(seed());
  for (const role of ["co_founder", "shareholder", "admin"]) {
    const res = await call(client, MAIN, { action: "add", email: "  NewBie@Example.com ", role });
    assert.equal(res.status, 200, role);
  }
  assert.deepEqual(roles.filter((r) => r.user_id === NEWBIE).map((r) => r.role).sort(), ["admin", "co_founder", "shareholder"]);
});

test("add : e-mail inconnu ou invalide", async () => {
  const { client } = fakeClient(seed());
  assert.equal((await call(client, MAIN, { action: "add", email: "inconnu@example.com", role: "admin" })).status, 404);
  assert.equal((await call(client, MAIN, { action: "add", email: "", role: "admin" })).status, 400);
  assert.equal((await call(client, MAIN, { action: "add", role: "admin" })).status, 400);
  assert.equal((await call(client, MAIN, { action: "add", email: "djateulrich", role: "admin" })).status, 404);
});

test("revoke : supprime le rôle ciblé uniquement, les autres rôles de l'utilisateur restent", async () => {
  const rows = [...seed(), { id: "r5", user_id: CO, role: "shareholder", created_at: "2026-01-05T00:00:00Z" }];
  const { client, roles } = fakeClient(rows);
  const res = await call(client, MAIN, { action: "revoke", target_user_id: CO, role: "shareholder" });
  assert.equal(res.status, 200);
  assert.deepEqual(roles.filter((r) => r.user_id === CO).map((r) => r.role), ["co_founder"]);
  assert.equal(roles.length, 4);
});

test("revoke : le rôle founder n'est jamais révocable, ni le sien, ni celui d'un autre", async () => {
  const { client, roles } = fakeClient(seed());
  assert.equal((await call(client, MAIN, { action: "revoke", target_user_id: MAIN, role: "founder" })).status, 400);
  assert.equal((await call(client, MAIN, { action: "revoke", target_user_id: MAIN })).status, 400);
  assert.ok(roles.some((r) => r.user_id === MAIN && r.role === "founder"));
});

test("revoke : identifiant mal formé refusé", async () => {
  const { client } = fakeClient(seed());
  for (const target_user_id of ["", "abc", "*", undefined, 12]) {
    assert.equal((await call(client, MAIN, { action: "revoke", target_user_id, role: "admin" })).status, 400, String(target_user_id));
  }
});

test("corps invalide / action inconnue", async () => {
  const { client } = fakeClient(seed());
  assert.equal((await call(client, MAIN, "pas du json")).status, 400);
  assert.equal((await call(client, MAIN, { action: "drop" })).status, 400);
});

test("OPTIONS (CORS) sans authentification", async () => {
  const { client } = fakeClient(seed());
  const res = await handleRequest(new Request("http://localhost/x", { method: "OPTIONS" }), client);
  assert.equal(res.status, 200);
});
