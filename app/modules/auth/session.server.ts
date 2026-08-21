const sessionCookieName = "__Host-bdb_admin_session";
const sessionVersion = "v1";
const sessionMaxAgeSeconds = 8 * 60 * 60;

export interface AdminSessionPayload {
  accessToken: string;
  csrfToken: string;
  expiresAt: number;
  refreshToken: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function importSessionKey(secret: string): Promise<CryptoKey> {
  let secretBytes: Uint8Array;

  try {
    secretBytes = base64UrlToBytes(secret);
  } catch {
    throw new Error("SESSION_SECRET must be base64url encoded");
  }

  if (secretBytes.byteLength !== 32) {
    throw new Error("SESSION_SECRET must contain exactly 32 random bytes");
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(secretBytes), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export function createCsrfToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sealSession(payload: AdminSessionPayload, secret: string): Promise<string> {
  const key = await importSessionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const additionalData = new TextEncoder().encode(sessionCookieName);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    plaintext,
  );

  return `${sessionVersion}.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function unsealSession(
  value: string,
  secret: string,
): Promise<AdminSessionPayload | null> {
  const [version, encodedIv, encodedCiphertext, extra] = value.split(".");
  if (version !== sessionVersion || !encodedIv || !encodedCiphertext || extra) return null;

  try {
    const key = await importSessionKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(base64UrlToBytes(encodedIv)),
        additionalData: new TextEncoder().encode(sessionCookieName),
      },
      key,
      toArrayBuffer(base64UrlToBytes(encodedCiphertext)),
    );
    const candidate = JSON.parse(
      new TextDecoder().decode(plaintext),
    ) as Partial<AdminSessionPayload>;

    if (
      typeof candidate.accessToken !== "string" ||
      typeof candidate.refreshToken !== "string" ||
      typeof candidate.csrfToken !== "string" ||
      typeof candidate.expiresAt !== "number"
    ) {
      return null;
    }

    return candidate as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === sessionCookieName) return valueParts.join("=") || null;
  }

  return null;
}

export function createSessionCookie(value: string): string {
  return [
    `${sessionCookieName}=${value}`,
    "Path=/",
    `Max-Age=${sessionMaxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${sessionCookieName}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export function sessionFromSupabase(
  session: { access_token: string; expires_at?: number; refresh_token: string },
  csrfToken = createCsrfToken(),
): AdminSessionPayload {
  return {
    accessToken: session.access_token,
    csrfToken,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + 60 * 60,
    refreshToken: session.refresh_token,
  };
}
