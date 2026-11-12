// Tests de invite-shop-collaborator (helpers purs) et des destinataires d'alertes fondateur (M7).
// Exécution : npx vitest run supabase/tests/invite-shop-collaborator.test.ts
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  escapeHtml,
  escapeLike,
  isValidEmail,
  resolveInviteOrigin,
} from "../functions/invite-shop-collaborator/helpers.ts";
import { getFounderEmails } from "../functions/_shared/founder-recipients.ts";

test("escapeHtml neutralise le HTML injecté dans le nom de boutique", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert(1)">&'`),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;",
  );
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeLike : % _ \\ ne sont plus des jokers", () => {
  assert.equal(escapeLike("a_b%c\\d@x.com"), "a\\_b\\%c\\\\d@x.com");
  assert.equal(escapeLike("simple@x.com"), "simple@x.com");
});

test("isValidEmail", () => {
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("a b@c.co"), false);
  assert.equal(isValidEmail("sans-arobase"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail(`${"x".repeat(250)}@b.co`), false);
});

test("resolveInviteOrigin : liste blanche (APP_URL + secret), jamais l'en-tête brut", () => {
  const app = "https://ecomfy.cloud";
  assert.equal(resolveInviteOrigin("https://ecomfy.cloud", app), "https://ecomfy.cloud");
  assert.equal(resolveInviteOrigin("https://evil.example", app), "https://ecomfy.cloud");
  assert.equal(resolveInviteOrigin("https://ecomfy.cloud.evil.example", app), "https://ecomfy.cloud");
  assert.equal(resolveInviteOrigin(null, app), "https://ecomfy.cloud");
  assert.equal(resolveInviteOrigin("pas une url", app), "https://ecomfy.cloud");
  assert.equal(resolveInviteOrigin("http://localhost:8080", app), "https://ecomfy.cloud");
  assert.equal(resolveInviteOrigin("http://localhost:8080", app, "http://localhost:8080, https://preview.ecomfy.cloud"), "http://localhost:8080");
  assert.equal(resolveInviteOrigin("https://preview.ecomfy.cloud/x?y=1", app, "http://localhost:8080,https://preview.ecomfy.cloud"), "https://preview.ecomfy.cloud");
  assert.equal(resolveInviteOrigin("https://evil.example", app, "http://localhost:8080"), "https://ecomfy.cloud");
  // APP_URL avec chemin ou barre finale : on garde l'origine
  assert.equal(resolveInviteOrigin(null, "https://ecomfy.cloud/"), "https://ecomfy.cloud");
});

// Faux client service_role : user_roles + auth.admin.getUserById
function fakeAdmin(roles: Array<{ user_id: string; role: string }>, emails: Record<string, string | null>, opts: { rolesError?: boolean; failFor?: string } = {}) {
  return {
    from(table: string) {
      assert.equal(table, "user_roles");
      return {
        select() {
          return {
            in(_col: string, values: string[]) {
              if (opts.rolesError) return Promise.resolve({ data: null, error: { message: "boom" } });
              return Promise.resolve({ data: roles.filter((r) => values.includes(r.role)).map((r) => ({ user_id: r.user_id })), error: null });
            },
          };
        },
      };
    },
    auth: {
      admin: {
        async getUserById(id: string) {
          if (id === opts.failFor) throw new Error("auth down");
          return { data: { user: id in emails ? { email: emails[id] } : null } };
        },
      },
    },
  };
}

test("getFounderEmails : founder et co_founder seulement, minuscules, sans doublon", async () => {
  const admin = fakeAdmin(
    [
      { user_id: "u1", role: "founder" },
      { user_id: "u2", role: "co_founder" },
      { user_id: "u2", role: "founder" }, // doublon d'utilisateur
      { user_id: "u3", role: "shareholder" }, // ignoré
      { user_id: "u4", role: "admin" }, // ignoré
    ],
    { u1: "Boss@Example.com", u2: "co@example.com", u3: "share@example.com", u4: "admin@example.com" },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- faux client Supabase de test
  assert.deepEqual((await getFounderEmails(admin as any)).sort(), ["boss@example.com", "co@example.com"]);
});

test("getFounderEmails : compte sans e-mail, compte illisible, erreur de lecture", async () => {
  const roles = [
    { user_id: "u1", role: "founder" },
    { user_id: "u2", role: "co_founder" },
    { user_id: "u3", role: "co_founder" },
  ];
  const emails = { u1: "boss@example.com", u2: null, u3: "x@example.com" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- faux client Supabase de test
  assert.deepEqual(await getFounderEmails(fakeAdmin(roles, emails, { failFor: "u3" }) as any), ["boss@example.com"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- faux client Supabase de test
  assert.deepEqual(await getFounderEmails(fakeAdmin(roles, emails, { rolesError: true }) as any), []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- faux client Supabase de test
  assert.deepEqual(await getFounderEmails(fakeAdmin([], {}) as any), []);
});

test("aucune adresse personnelle ne reste codée dans le moniteur ni dans la fonction d'invitation", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of [
    "supabase/functions/app-health-monitor/index.ts",
    "supabase/functions/invite-shop-collaborator/index.ts",
    "supabase/functions/_shared/founder-recipients.ts",
    "src/components/FounderRoute.tsx",
    "src/components/AppSidebar.tsx",
  ]) {
    const txt = readFileSync(f, "utf8");
    assert.doesNotMatch(txt, /djateulrich|regnis13/i, f);
  }
});
