#!/usr/bin/env node
// Copia el código compartido de apis-functions/_shared/ a cada función que lo importa.
//
// Cada función se despliega sola, así que necesita su propia carpeta _shared/.
// La fuente de verdad es apis-functions/_shared/; las copias se generan con este
// script y no se editan a mano.
//
//   node tools/sync-function-shared.mjs          regenera las copias
//   node tools/sync-function-shared.mjs --check  falla si alguna copia está desactualizada

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_DIR = join(ROOT, "apis-functions");
const CANONICAL_DIR = join(FUNCTIONS_DIR, "_shared");
const IMPORT_RE = /(?:import|export)[^"']*?from\s*["']\.\/_shared\/([^"']+)["']|import\(\s*["']\.\/_shared\/([^"']+)["']\s*\)/g;
const SIBLING_RE = /(?:import|export)[^"']*?from\s*["']\.\/([^"'/]+)["']/g;

const header = (name) =>
  `// Generado desde apis-functions/_shared/${name} por tools/sync-function-shared.mjs. No editar a mano.\n`;

function listTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "_shared" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

function matches(source, re) {
  return [...source.matchAll(re)].map((m) => m[1] ?? m[2]);
}

function canonicalSource(name) {
  const path = join(CANONICAL_DIR, name);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function requiredSharedFiles(functionDir) {
  const needed = new Set();
  const queue = [];
  for (const file of listTsFiles(functionDir)) {
    for (const name of matches(readFileSync(file, "utf8"), IMPORT_RE)) queue.push(name);
  }
  while (queue.length) {
    const name = queue.pop();
    if (needed.has(name)) continue;
    const source = canonicalSource(name);
    if (source === null) {
      throw new Error(`${relative(ROOT, functionDir)} importa _shared/${name}, que no existe en apis-functions/_shared/`);
    }
    needed.add(name);
    for (const sibling of matches(source, SIBLING_RE)) queue.push(sibling);
  }
  return needed;
}

function expectedCopies() {
  const expected = new Map();
  for (const entry of readdirSync(FUNCTIONS_DIR).sort()) {
    const functionDir = join(FUNCTIONS_DIR, entry);
    if (entry === "_shared" || entry.startsWith(".") || !statSync(functionDir).isDirectory()) continue;
    for (const name of requiredSharedFiles(functionDir)) {
      expected.set(join(functionDir, "_shared", name), header(name) + canonicalSource(name));
    }
  }
  return expected;
}

function existingCopies() {
  const found = [];
  for (const entry of readdirSync(FUNCTIONS_DIR)) {
    const sharedDir = join(FUNCTIONS_DIR, entry, "_shared");
    if (entry === "_shared" || !existsSync(sharedDir)) continue;
    for (const file of readdirSync(sharedDir)) found.push(join(sharedDir, file));
  }
  return found;
}

const check = process.argv.includes("--check");
const expected = expectedCopies();
const problems = [];

for (const [path, content] of expected) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === content) continue;
  if (check) {
    problems.push(`${current === null ? "falta" : "desactualizada"}: ${relative(ROOT, path)}`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

for (const path of existingCopies()) {
  if (expected.has(path)) continue;
  if (check) {
    problems.push(`sobra (ninguna función la importa): ${relative(ROOT, path)}`);
  } else {
    rmSync(path);
    const dir = dirname(path);
    if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
  }
}

if (check && problems.length) {
  console.error("Las copias de apis-functions/_shared/ no coinciden con la fuente:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("Corre `npm run sync:functions` y sube los cambios.");
  process.exit(1);
}

console.log(check ? `OK: ${expected.size} copias al día.` : `Listo: ${expected.size} copias generadas.`);
