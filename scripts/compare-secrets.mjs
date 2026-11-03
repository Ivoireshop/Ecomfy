// Compare les secrets des Edge Functions entre la production et dev.
// Usage : npm run secrets:compare
//
// La CLI Supabase ne renvoie jamais les valeurs, seulement un condensé SHA-256 :
// deux secrets au condensé identique ont la même valeur. Le script n'affiche que
// les noms et le verdict, jamais les condensés.
import { execFileSync } from 'node:child_process';

const PROD = 'yfggrceynzcwklbxhgix';
const DEV = 'xfpbpxncserliskrbaim';

// Secrets gérés par Supabase : différents d'un projet à l'autre par construction.
const BUILTIN = new Set([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'SUPABASE_JWKS',
  'SUPABASE_PUBLISHABLE_KEYS',
  'SUPABASE_SECRET_KEYS',
]);

function fetchSecrets(ref) {
  const out = execFileSync(
    'npx',
    ['--yes', 'supabase@latest', 'secrets', 'list', '--project-ref', ref, '-o', 'json'],
    { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const start = out.indexOf('[');
  return new Map(JSON.parse(out.slice(start)).map((s) => [s.name, s.value]));
}

let prod, dev;
try {
  prod = fetchSecrets(PROD);
  dev = fetchSecrets(DEV);
} catch (e) {
  console.error(`Échec de la récupération des secrets : ${e.message}`);
  console.error('Vérifier la connexion : npx supabase@latest login');
  process.exit(2);
}

const names = [...new Set([...prod.keys(), ...dev.keys()])].sort();
const rows = { prodOnly: [], devOnly: [], differ: [], same: [], builtin: [] };

for (const n of names) {
  if (BUILTIN.has(n)) rows.builtin.push(n);
  else if (!dev.has(n)) rows.prodOnly.push(n);
  else if (!prod.has(n)) rows.devOnly.push(n);
  else if (prod.get(n) !== dev.get(n)) rows.differ.push(n);
  else rows.same.push(n);
}

const show = (title, list) => {
  console.log(`\n${title} (${list.length})`);
  for (const n of list) console.log(`  - ${n}`);
};

console.log(`Prod : ${PROD} (${prod.size} secrets)  |  Dev : ${DEV} (${dev.size} secrets)`);
show('MANQUE EN DEV (présent en prod seulement)', rows.prodOnly);
show('MANQUE EN PROD (présent en dev seulement)', rows.devOnly);
show('VALEURS DIFFÉRENTES entre prod et dev', rows.differ);
show('Valeurs identiques', rows.same);
show('Gérés par Supabase (différents par construction)', rows.builtin);

// Code 1 si un secret manque en prod : c'est le cas qui casse un déploiement.
process.exit(rows.devOnly.length ? 1 : 0);
