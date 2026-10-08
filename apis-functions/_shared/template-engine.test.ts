import { assertEquals, assertThrows } from "jsr:@std/assert@1";
// template-engine.ts todavía no pasa el chequeo de tipos estricto (TS7006 en el
// callback de #if_gt dentro de #each). Importarlo con una ruta calculada evita
// que `deno test` lo chequee; volver a un import estático cuando se tipen esos
// parámetros.
type RenderTemplate = (template: string, data: Record<string, unknown>) => string;
const engineUrl = new URL("./template-engine.ts", import.meta.url).href;
const { renderTemplate } = (await import(engineUrl)) as { renderTemplate: RenderTemplate };

Deno.test("reemplaza variables simples", () => {
  assertEquals(renderTemplate("Hola {{nombre}}!", { nombre: "Ana" }), "Hola Ana!");
});

Deno.test("resuelve rutas anidadas con puntos", () => {
  const data = { cliente: { direccion: { ciudad: "Montevideo" } } };
  assertEquals(renderTemplate("{{cliente.direccion.ciudad}}", data), "Montevideo");
});

Deno.test("variables faltantes, null o con padre inexistente quedan vacías", () => {
  const data = { a: null, b: undefined, c: { d: null } };
  assertEquals(renderTemplate("[{{x}}][{{a}}][{{b}}][{{c.d}}][{{c.d.e}}][{{z.y.x}}]", data), "[][][][][][]");
});

Deno.test("convierte números, booleanos, arrays y objetos con String()", () => {
  const data = { n: 0, t: true, f: false, arr: [1, 2], obj: { a: 1 } };
  assertEquals(
    renderTemplate("{{n}}|{{t}}|{{f}}|{{arr}}|{{obj}}", data),
    "0|true|false|1,2|[object Object]",
  );
});

Deno.test("no escapa HTML: los valores se insertan tal cual", () => {
  assertEquals(
    renderTemplate("<p>{{msg}}</p>", { msg: '<b>"x" & y</b><script>alert(1)</script>' }),
    '<p><b>"x" & y</b><script>alert(1)</script></p>',
  );
});

Deno.test("los placeholders con espacios no se resuelven y se eliminan", () => {
  assertEquals(renderTemplate("a{{ nombre }}b", { nombre: "Ana" }), "ab");
});

Deno.test("los placeholders no reconocidos sobrantes se eliminan", () => {
  assertEquals(renderTemplate("a{{> partial}}b{{@index}}c{{this}}d", {}), "abcd");
});

Deno.test("el texto sin placeholders queda igual", () => {
  const html = "<html><body style=\"color:red\">Sin variables { } $& $1</body></html>";
  assertEquals(renderTemplate(html, {}), html);
});

Deno.test("los valores con $ en variables de primer nivel se insertan literalmente", () => {
  assertEquals(renderTemplate("{{precio}}", { precio: "$$5 $& $1" }), "$$5 $& $1");
});

// ---- {{#each}} ----

Deno.test("#each recorre objetos y reemplaza sus campos", () => {
  const data = { items: [{ nombre: "A", qty: 1 }, { nombre: "B", qty: 2 }] };
  assertEquals(
    renderTemplate("<ul>{{#each items}}<li>{{nombre}} x{{qty}}</li>{{/each}}</ul>", data),
    "<ul><li>A x1</li><li>B x2</li></ul>",
  );
});

Deno.test("#each con primitivos usa {{this}}, {{@index}} y {{@number}}", () => {
  assertEquals(
    renderTemplate("{{#each tags}}{{@index}}/{{@number}}:{{this}};{{/each}}", { tags: ["a", "b"] }),
    "0/1:a;1/2:b;",
  );
});

Deno.test("#each acepta una ruta anidada al array", () => {
  const data = { pedido: { lineas: [{ sku: "X" }, { sku: "Y" }] } };
  assertEquals(renderTemplate("{{#each pedido.lineas}}{{sku}}{{/each}}", data), "XY");
});

Deno.test("#each sobre algo que no es array o vacío no produce nada", () => {
  const tpl = "[{{#each items}}x{{/each}}]";
  assertEquals(renderTemplate(tpl, {}), "[]");
  assertEquals(renderTemplate(tpl, { items: "abc" }), "[]");
  assertEquals(renderTemplate(tpl, { items: { a: 1 } }), "[]");
  assertEquals(renderTemplate(tpl, { items: [] }), "[]");
});

Deno.test("#each: campos null del item quedan vacíos", () => {
  assertEquals(renderTemplate("{{#each items}}[{{a}}]{{/each}}", { items: [{ a: null }] }), "[]");
});

Deno.test("#each: un campo que el item no tiene se resuelve contra los datos raíz", () => {
  const data = { moneda: "UYU", items: [{ monto: 10 }] };
  assertEquals(renderTemplate("{{#each items}}{{monto}} {{moneda}}{{/each}}", data), "10 UYU");
});

Deno.test("#each: rutas anidadas dentro del item se resuelven contra la raíz (comportamiento actual)", () => {
  const data = { a: { b: "raiz" }, items: [{ a: { b: "item" } }] };
  assertEquals(renderTemplate("{{#each items}}{{a.b}}{{/each}}", data), "raiz");
});

Deno.test("#each: #if_gt dentro del item usa el campo del item", () => {
  const data = { items: [{ q: 2 }, { q: 1 }, { q: "n/a" }] };
  assertEquals(
    renderTemplate("{{#each items}}{{#if_gt q 1}}M{{else}}U{{/if_gt}}{{/each}}", data),
    "MUU",
  );
});

Deno.test("#each: #if dentro del item se evalúa contra la raíz, no contra el item (comportamiento actual)", () => {
  const tpl = "{{#each items}}{{#if on}}Y{{else}}N{{/if}}{{/each}}";
  assertEquals(renderTemplate(tpl, { items: [{ on: true }, { on: false }] }), "NN");
  assertEquals(renderTemplate(tpl, { on: true, items: [{ on: true }, { on: false }] }), "YY");
});

Deno.test("#each anidados no se soportan y el bloque se pierde (comportamiento actual)", () => {
  assertEquals(
    renderTemplate("a{{#each o}}{{#each i}}x{{/each}}{{/each}}b", { o: [{ i: [1, 2] }] }),
    "ab",
  );
});

Deno.test("#each: valores con $ en campos del item se interpretan como patrones de replace (comportamiento actual)", () => {
  const data = { items: [{ precio: "$$5" }, { precio: "a$&b" }] };
  // "$$" se colapsa a "$" y "$&" inserta el placeholder, que luego se elimina.
  assertEquals(renderTemplate("{{#each items}}[{{precio}}]{{/each}}", data), "[$5][ab]");
});

Deno.test("#each: una clave del item con caracteres de regex inválidos lanza (comportamiento actual)", () => {
  assertThrows(() => renderTemplate("{{#each items}}{{x}}{{/each}}", { items: [{ "(": 1 }] }), SyntaxError);
});

// ---- {{#if}} ----

Deno.test("#if muestra el contenido con valores verdaderos", () => {
  for (const value of [true, 1, "si", [], {}]) {
    assertEquals(renderTemplate("{{#if x}}Y{{/if}}", { x: value }), "Y", `valor ${JSON.stringify(value)}`);
  }
});

Deno.test("#if oculta el contenido con valores falsos, '0' y 'false'", () => {
  for (const value of [false, 0, "", null, undefined, "0", "false"]) {
    assertEquals(renderTemplate("[{{#if x}}Y{{/if}}]", { x: value }), "[]", `valor ${JSON.stringify(value)}`);
  }
});

Deno.test("#if con else elige la rama correcta", () => {
  const tpl = "{{#if vip}}Hola VIP {{nombre}}{{else}}Hola {{nombre}}{{/if}}";
  assertEquals(renderTemplate(tpl, { vip: true, nombre: "Ana" }), "Hola VIP Ana");
  assertEquals(renderTemplate(tpl, { vip: false, nombre: "Ana" }), "Hola Ana");
});

Deno.test("#if acepta rutas anidadas", () => {
  const tpl = "{{#if user.activo}}on{{else}}off{{/if}}";
  assertEquals(renderTemplate(tpl, { user: { activo: true } }), "on");
  assertEquals(renderTemplate(tpl, { user: null }), "off");
});

Deno.test("#if anidados se cierran con el primer {{/if}} (comportamiento actual)", () => {
  assertEquals(renderTemplate("{{#if a}}{{#if b}}X{{/if}}{{/if}}", { a: 1, b: 1 }), "");
  assertEquals(renderTemplate("{{#if a}}{{#if b}}X{{/if}}Z{{/if}}", { a: 0, b: 1 }), "Z");
});

Deno.test("#if sin cierre se deja y solo se borra el marcador", () => {
  assertEquals(renderTemplate("a{{#if x}}b", { x: true }), "ab");
});

// ---- {{#if_gt}} ----

Deno.test("#if_gt compara numéricamente contra el umbral", () => {
  const tpl = "{{#if_gt total 100}}grande{{else}}chico{{/if_gt}}";
  assertEquals(renderTemplate(tpl, { total: 150 }), "grande");
  assertEquals(renderTemplate(tpl, { total: 100 }), "chico");
  assertEquals(renderTemplate(tpl, { total: "100.5" }), "grande");
  assertEquals(renderTemplate(tpl, { total: "abc" }), "chico");
  assertEquals(renderTemplate(tpl, {}), "chico");
});

Deno.test("#if_gt sin else y con umbral decimal y ruta anidada", () => {
  const tpl = "[{{#if_gt pedido.descuento 0.5}}D{{/if_gt}}]";
  assertEquals(renderTemplate(tpl, { pedido: { descuento: 0.75 } }), "[D]");
  assertEquals(renderTemplate(tpl, { pedido: { descuento: 0.5 } }), "[]");
});

Deno.test("#if_gt con umbral negativo no se reconoce y el bloque se elimina (comportamiento actual)", () => {
  assertEquals(renderTemplate("[{{#if_gt n -1}}big{{/if_gt}}]", { n: 0 }), "[]");
});

Deno.test("#if_gt se procesa antes que #if, sin que #if lo confunda", () => {
  const tpl = "{{#if_gt n 1}}A{{/if_gt}}{{#if ok}}B{{/if}}";
  assertEquals(renderTemplate(tpl, { n: 2, ok: true }), "AB");
  assertEquals(renderTemplate(tpl, { n: 0, ok: false }), "");
});
