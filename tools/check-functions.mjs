#!/usr/bin/env node
// Corre `deno check` sobre cada función de apis-functions/.
//
// Algunas funciones ya tenían errores de tipos antes de que existiera el CI. Están
// en apis-functions/deno-check-known-failures.txt y no bloquean, pero cualquier otra
// función que falle sí bloquea. Si una función de la lista empieza a pasar, el
// script pide sacarla para que no vuelva a romperse.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_DIR = join(ROOT, "apis-functions");
const KNOWN_FAILURES_FILE = join(FUNCTIONS_DIR, "deno-check-known-failures.txt");

const knownFailures = new Set(
  existsSync(KNOWN_FAILURES_FILE)
    ? readFileSync(KNOWN_FAILURES_FILE, "utf8")
      .split("\n")
      .map((line) => line.replace(/#.*/, "").trim())
      .filter(Boolean)
    : [],
);

const functions = readdirSync(FUNCTIONS_DIR)
  .filter((name) => !name.startsWith("_") && !name.startsWith("."))
  .filter((name) => statSync(join(FUNCTIONS_DIR, name)).isDirectory())
  .filter((name) => existsSync(join(FUNCTIONS_DIR, name, "index.ts")))
  .sort();

const newFailures = [];
const nowPassing = [];

for (const name of functions) {
  const result = spawnSync(
    "deno",
    ["check", "--node-modules-dir=none", "--quiet", join("apis-functions", name, "index.ts")],
    { cwd: ROOT, encoding: "utf8" },
  );
  const ok = result.status === 0;
  const known = knownFailures.has(name);
  console.log(`${ok ? "ok  " : known ? "conocido" : "FALLA"} ${name}`);
  if (!ok && !known) {
    newFailures.push(name);
    process.stdout.write(result.stdout + result.stderr);
  }
  if (ok && known) nowPassing.push(name);
}

for (const name of knownFailures) {
  if (!functions.includes(name)) nowPassing.push(`${name} (ya no existe)`);
}

if (nowPassing.length) {
  console.error(
    `\nEstas funciones ya pasan; sácalas de apis-functions/deno-check-known-failures.txt:\n  ${nowPassing.join("\n  ")}`,
  );
}
if (newFailures.length) {
  console.error(`\nFunciones con errores de tipos nuevos:\n  ${newFailures.join("\n  ")}`);
}
process.exit(newFailures.length || nowPassing.length ? 1 : 0);
