
import { forwardAuthFunction } from "./_shared/forward-auth-function.ts";

Deno.serve((req) => forwardAuthFunction(req, "invitations-create"));

