import { forwardJsonAuthRequest } from "./_shared/auth-proxy.ts";

Deno.serve((req) => forwardJsonAuthRequest(req, "auth-impersonate", { allowGet: false }));
