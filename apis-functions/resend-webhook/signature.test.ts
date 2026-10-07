import { assertEquals } from "jsr:@std/assert@1";
import { verifySvixSignature } from "./signature.ts";

// Vector de prueba publicado por Svix.
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const PAYLOAD = '{"test": 2432232314}';
const TIMESTAMP = 1614265330;

function headers(signature: string, timestamp = String(TIMESTAMP)): Headers {
  return new Headers({
    "svix-id": "msg_p5jXN8AQM9LWM0D4loKWxJek",
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  });
}

Deno.test("accepts the reference Svix signature", async () => {
  const ok = await verifySvixSignature(
    PAYLOAD,
    headers("v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="),
    SECRET,
    TIMESTAMP,
  );
  assertEquals(ok, true);
});

Deno.test("accepts when one of several signatures matches", async () => {
  const ok = await verifySvixSignature(
    PAYLOAD,
    headers("v1,AAAA v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="),
    SECRET,
    TIMESTAMP,
  );
  assertEquals(ok, true);
});

Deno.test("rejects a tampered payload", async () => {
  const ok = await verifySvixSignature(
    '{"test": 1}',
    headers("v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="),
    SECRET,
    TIMESTAMP,
  );
  assertEquals(ok, false);
});

Deno.test("rejects old or future timestamps (replay)", async () => {
  const sig = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";
  assertEquals(await verifySvixSignature(PAYLOAD, headers(sig), SECRET, TIMESTAMP + 301), false);
  assertEquals(await verifySvixSignature(PAYLOAD, headers(sig), SECRET, TIMESTAMP - 301), false);
});

Deno.test("rejects missing headers", async () => {
  const ok = await verifySvixSignature(PAYLOAD, new Headers(), SECRET, TIMESTAMP);
  assertEquals(ok, false);
});
