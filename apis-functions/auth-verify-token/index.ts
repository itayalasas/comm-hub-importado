import { forwardJsonAuthRequest } from "../_shared/auth-proxy.ts";

Deno.serve((req) => forwardJsonAuthRequest(req, "auth-verify-token", { allowGet: false }));
