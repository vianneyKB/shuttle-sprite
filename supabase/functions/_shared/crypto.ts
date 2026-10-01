/**
 * HMAC helpers shared by the provider adapters.
 *
 * Every provider authenticates its webhooks with an HMAC over the raw body —
 * Paystack with SHA-512 over the body alone, Stripe with SHA-256 over a
 * timestamped payload — so the hashing and the comparison live here and the
 * adapters only describe their own scheme.
 */

/** Lowercase hex HMAC of `message` under `secret`. */
export const hexHmac = async (
  hash: "SHA-256" | "SHA-512",
  secret: string,
  message: string,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/** Compare two hex digests without leaking where they diverge through timing. */
export const equalsConstantTime = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
