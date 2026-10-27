// Vérification TypeScript avec baseline : le projet traîne des erreurs de types historiques
// (types Supabase générés en retard, etc.). On les fige dans typecheck-baseline.txt ; la CI échoue
// uniquement sur les erreurs NOUVELLES, ce qui permet de ne plus en ajouter tout en les résorbant peu à peu.
//
//   npm run typecheck           compare à la baseline (échoue s'il y a une nouvelle erreur)
//   npm run typecheck:update    réécrit la baseline (après correction d'erreurs, ou pour en accepter une)
//
// Les numéros de ligne ne font pas partie de l'empreinte d'une erreur : déplacer du code ne la rend pas « nouvelle ».
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "typecheck-baseline.txt");
const projects = ["tsconfig.app.json", "tsconfig.node.json"];
const update = process.argv.includes("--update");

const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const ERROR_RE = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/;

const found = []; // { key, where }
for (const project of projects) {
  const run = spawnSync(process.execPath, [tsc, "-p", project, "--noEmit", "--pretty", "false"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error) throw run.error;
  const output = `${run.stdout}\n${run.stderr}`;
  let matched = 0;
  for (const line of output.split(/\r?\n/)) {
    const m = ERROR_RE.exec(line);
    if (!m) continue;
    matched++;
    const file = m[1].replaceAll("\\", "/");
    found.push({ key: `${file}\t${m[3]}\t${m[4].trim()}`, where: `${file}:${m[2]}` });
  }
  // tsc a échoué sans produire d'erreur lisible (config cassée, crash) : ne pas conclure que tout va bien.
  if (run.status !== 0 && matched === 0) {
    console.error(`tsc -p ${project} a échoué sans diagnostic exploitable :\n${output}`);
    process.exit(2);
  }
}

const sorted = (xs) => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

if (update) {
  writeFileSync(baselinePath, sorted(found.map((f) => f.key)).join("\n") + "\n");
  console.log(`Baseline réécrite : ${found.length} erreur(s) connue(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error("typecheck-baseline.txt introuvable : lancez `npm run typecheck:update`.");
  process.exit(2);
}

// Comparaison en multi-ensemble : deux erreurs identiques dans un même fichier comptent pour deux.
const remaining = new Map();
for (const key of readFileSync(baselinePath, "utf8").split(/\r?\n/).filter(Boolean)) {
  remaining.set(key, (remaining.get(key) ?? 0) + 1);
}
const added = [];
for (const f of found) {
  const left = remaining.get(f.key) ?? 0;
  if (left > 0) remaining.set(f.key, left - 1);
  else added.push(f);
}
const fixed = [...remaining.values()].reduce((a, b) => a + b, 0);

if (added.length) {
  console.error(`\n${added.length} nouvelle(s) erreur(s) TypeScript (hors baseline) :\n`);
  for (const f of added) console.error(`  ${f.where}  ${f.key.split("\t").slice(1).join("  ")}`);
  console.error("\nCorrigez-les. Si une erreur est légitime à accepter, lancez `npm run typecheck:update`.");
  process.exit(1);
}

console.log(`TypeScript : aucune nouvelle erreur (${found.length} connue(s) dans la baseline).`);
if (fixed > 0) {
  console.log(`${fixed} erreur(s) de la baseline ont disparu : lancez \`npm run typecheck:update\` pour verrouiller ce gain.`);
}
