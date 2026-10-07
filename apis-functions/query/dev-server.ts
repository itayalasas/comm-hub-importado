// Servidor local para probar la función query.
//   deno run --allow-env --allow-net --allow-read --allow-sys apis-functions/query/dev-server.ts
import handler from "./index.ts";

const port = Number(Deno.env.get("PORT") || 8787);

Deno.serve({ port }, handler);
