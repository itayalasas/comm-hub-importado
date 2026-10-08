import { assertEquals } from "jsr:@std/assert@1";
import { type AutomationNotifySource, buildAutomationNotifyPayload } from "./automation-notify-payload.ts";

function source(overrides: Partial<AutomationNotifySource> = {}): AutomationNotifySource {
  return {
    id: "prog-1",
    channel: "email",
    template_name: "bienvenida",
    pdf_template_name: "factura",
    pdf_filename_pattern: "factura-{{numero}}.pdf",
    recipients: [{ email: "a@test", data: { nombre: "Ana" } }],
    shared_data: { empresa: "ACME", moneda: "UYU" },
    options: { track_opens: true },
    ...overrides,
  };
}

Deno.test("canal email: incluye template_name y no adjunto", () => {
  assertEquals(buildAutomationNotifyPayload(source()), {
    type: "email",
    program_id: "prog-1",
    recipients: [{ email: "a@test", data: { nombre: "Ana" } }],
    shared_data: { empresa: "ACME", moneda: "UYU" },
    options: { track_opens: true },
    template_name: "bienvenida",
  });
});

Deno.test("canal email_pdf: incluye template_name y adjunto", () => {
  const payload = buildAutomationNotifyPayload(source({ channel: "email_pdf" }));
  assertEquals(payload.type, "email_pdf");
  assertEquals(payload.template_name, "bienvenida");
  assertEquals(payload.attachment, { pdf_template_name: "factura", filename: "factura-{{numero}}.pdf" });
});

Deno.test("canal pdf: solo adjunto, sin template_name", () => {
  const payload = buildAutomationNotifyPayload(source({ channel: "pdf" }));
  assertEquals("template_name" in payload, false);
  assertEquals(payload.attachment, { pdf_template_name: "factura", filename: "factura-{{numero}}.pdf" });
});

Deno.test("sin patrón de nombre de PDF el filename queda undefined", () => {
  const payload = buildAutomationNotifyPayload(source({ channel: "pdf", pdf_filename_pattern: null }));
  assertEquals(payload.attachment, { pdf_template_name: "factura", filename: undefined });
});

Deno.test("overrides.recipients reemplaza a los destinatarios del programa, aunque esté vacío", () => {
  const recipients = [{ email: "b@test" }];
  assertEquals(buildAutomationNotifyPayload(source(), { recipients }).recipients, recipients);
  assertEquals(buildAutomationNotifyPayload(source(), { recipients: [] }).recipients, []);
});

Deno.test("recipient_email crea un único destinatario, con data solo si no está vacía", () => {
  assertEquals(
    buildAutomationNotifyPayload(source(), { recipient_email: "c@test", recipient_data: { x: 1 } }).recipients,
    [{ email: "c@test", data: { x: 1 } }],
  );
  assertEquals(
    buildAutomationNotifyPayload(source(), { recipient_email: "c@test", recipient_data: {} }).recipients,
    [{ email: "c@test" }],
  );
  assertEquals(
    buildAutomationNotifyPayload(source(), {
      recipient_email: "c@test",
      recipient_data: ["no", "objeto"] as unknown as Record<string, unknown>,
    }).recipients,
    [{ email: "c@test" }],
  );
});

Deno.test("recipients tiene prioridad sobre recipient_email", () => {
  const payload = buildAutomationNotifyPayload(source(), {
    recipients: [{ email: "lista@test" }],
    recipient_email: "solo@test",
  });
  assertEquals(payload.recipients, [{ email: "lista@test" }]);
});

Deno.test("recipient_email vacío usa los destinatarios del programa", () => {
  assertEquals(
    buildAutomationNotifyPayload(source(), { recipient_email: "" }).recipients,
    [{ email: "a@test", data: { nombre: "Ana" } }],
  );
});

Deno.test("shared_data y options se combinan y el override pisa claves", () => {
  const payload = buildAutomationNotifyPayload(source(), {
    shared_data: { moneda: "USD", extra: 1 },
    options: { track_opens: false },
  });
  assertEquals(payload.shared_data, { empresa: "ACME", moneda: "USD", extra: 1 });
  assertEquals(payload.options, { track_opens: false });
});

Deno.test("overrides de shared_data/options que no son objetos se ignoran", () => {
  const payload = buildAutomationNotifyPayload(source(), {
    shared_data: [1, 2] as unknown as Record<string, unknown>,
    options: null as unknown as Record<string, unknown>,
  });
  assertEquals(payload.shared_data, { empresa: "ACME", moneda: "UYU" });
  assertEquals(payload.options, { track_opens: true });
});

Deno.test("shared_data/options null en el programa se tratan como vacíos", () => {
  const payload = buildAutomationNotifyPayload(
    source({
      shared_data: null as unknown as Record<string, unknown>,
      options: null as unknown as Record<string, unknown>,
    }),
  );
  assertEquals(payload.shared_data, {});
  assertEquals(payload.options, {});
});

Deno.test("no muta los objetos del programa", () => {
  const src = source();
  buildAutomationNotifyPayload(src, { shared_data: { moneda: "USD" }, options: { x: 1 } });
  assertEquals(src.shared_data, { empresa: "ACME", moneda: "UYU" });
  assertEquals(src.options, { track_opens: true });
});

Deno.test("overrides de plantillas reemplazan a las del programa", () => {
  const payload = buildAutomationNotifyPayload(source({ channel: "email_pdf" }), {
    template_name: "otra",
    pdf_template_name: "otro-pdf",
    pdf_filename_pattern: "x.pdf",
  });
  assertEquals(payload.template_name, "otra");
  assertEquals(payload.attachment, { pdf_template_name: "otro-pdf", filename: "x.pdf" });
});

Deno.test("un override de plantilla en null no borra la del programa (usa ??)", () => {
  const payload = buildAutomationNotifyPayload(source({ channel: "email_pdf" }), {
    template_name: null,
    pdf_template_name: null,
    pdf_filename_pattern: null,
  });
  assertEquals(payload.template_name, "bienvenida");
  assertEquals(payload.attachment, { pdf_template_name: "factura", filename: "factura-{{numero}}.pdf" });
});
