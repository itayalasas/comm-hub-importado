import { assertEquals } from "jsr:@std/assert@1";
import { getNextCronRunAt, isValidCronExpression, normalizeCronExpression } from "./cron-utils.ts";

const BASE = new Date("2026-03-10T12:00:00.000Z"); // martes

Deno.test("normalizeCronExpression recorta espacios", () => {
  assertEquals(normalizeCronExpression("  */5 * * * *  "), "*/5 * * * *");
});

Deno.test("normalizeCronExpression devuelve null para vacíos y no-strings", () => {
  for (const value of ["", "   ", null, undefined, 5, {}, ["* * * * *"]]) {
    assertEquals(normalizeCronExpression(value), null, `valor ${JSON.stringify(value)}`);
  }
});

Deno.test("isValidCronExpression acepta expresiones de 5 y 6 campos, alias y nombres", () => {
  for (const expr of ["*/5 * * * *", "0 9 * * 1", "0 9 * * MON-FRI", "30 * * * * *", "@daily", "@hourly"]) {
    assertEquals(isValidCronExpression(expr), true, expr);
  }
});

Deno.test("isValidCronExpression rechaza basura, rangos fuera de límite y fechas imposibles", () => {
  for (const expr of ["bogus", "61 * * * *", "* 25 * * *", "0 0 31 2 *"]) {
    assertEquals(isValidCronExpression(expr), false, expr);
  }
});

Deno.test("isValidCronExpression rechaza una zona horaria inexistente", () => {
  assertEquals(isValidCronExpression("0 9 * * *", "Not/AZone"), false);
  assertEquals(isValidCronExpression("0 9 * * *", "America/Montevideo"), true);
});

Deno.test("isValidCronExpression considera válida la cadena vacía (cada minuto); los llamadores deben normalizar antes", () => {
  assertEquals(isValidCronExpression(""), true);
  assertEquals(normalizeCronExpression(""), null);
});

Deno.test("getNextCronRunAt calcula la próxima ejecución en UTC", () => {
  assertEquals(getNextCronRunAt("*/5 * * * *", "UTC", BASE), "2026-03-10T12:05:00.000Z");
  assertEquals(getNextCronRunAt("0 9 * * 1", "UTC", BASE), "2026-03-16T09:00:00.000Z");
  assertEquals(getNextCronRunAt("0 9 * * MON-FRI", "UTC", BASE), "2026-03-11T09:00:00.000Z");
  assertEquals(getNextCronRunAt("@hourly", "UTC", BASE), "2026-03-10T13:00:00.000Z");
});

Deno.test("getNextCronRunAt es estrictamente posterior a la fecha actual", () => {
  assertEquals(getNextCronRunAt("0 12 * * *", "UTC", BASE), "2026-03-11T12:00:00.000Z");
  assertEquals(
    getNextCronRunAt("0 12 * * *", "UTC", new Date("2026-03-10T11:59:00.000Z")),
    "2026-03-10T12:00:00.000Z",
  );
});

Deno.test("getNextCronRunAt: a 1 ms del horario lo salta por el +1 ms interno (comportamiento actual)", () => {
  assertEquals(
    getNextCronRunAt("0 12 * * *", "UTC", new Date("2026-03-10T11:59:59.999Z")),
    "2026-03-11T12:00:00.000Z",
  );
});

Deno.test("getNextCronRunAt respeta la zona horaria", () => {
  // Montevideo es UTC-3 sin horario de verano.
  assertEquals(getNextCronRunAt("0 9 * * *", "America/Montevideo", BASE), "2026-03-11T12:00:00.000Z");
});

Deno.test("getNextCronRunAt maneja el salto de horario de verano", () => {
  // 2026-03-08 02:00 no existe en Nueva York; se ejecuta a las 03:00 EDT.
  assertEquals(
    getNextCronRunAt("0 2 * * *", "America/New_York", new Date("2026-03-08T00:00:00Z")),
    "2026-03-08T07:00:00.000Z",
  );
});

Deno.test("getNextCronRunAt usa UTC si la zona es vacía", () => {
  assertEquals(getNextCronRunAt("0 12 * * *", "", BASE), "2026-03-11T12:00:00.000Z");
});

Deno.test("getNextCronRunAt devuelve null con expresión o zona inválidas", () => {
  assertEquals(getNextCronRunAt("bogus", "UTC", BASE), null);
  assertEquals(getNextCronRunAt("0 0 31 2 *", "UTC", BASE), null);
  assertEquals(getNextCronRunAt("0 9 * * *", "Not/AZone", BASE), null);
});

Deno.test("getNextCronRunAt sin fecha usa el momento actual", () => {
  const before = Date.now();
  const next = getNextCronRunAt("* * * * *");
  assertEquals(typeof next, "string");
  const ms = Date.parse(next!);
  assertEquals(ms > before && ms <= before + 61_000, true);
});
