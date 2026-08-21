import { describe, expect, it } from "vitest";

import {
  clearSessionCookie,
  createSessionCookie,
  sealSession,
  unsealSession,
  type AdminSessionPayload,
} from "./session.server";

const secret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const payload: AdminSessionPayload = {
  accessToken: "access-token",
  csrfToken: "csrf-token",
  expiresAt: 1_800_000_000,
  refreshToken: "refresh-token",
};

describe("encrypted administrator session", () => {
  it("round-trips and rejects tampering", async () => {
    const sealed = await sealSession(payload, secret);
    expect(sealed).not.toContain(payload.accessToken);
    await expect(unsealSession(sealed, secret)).resolves.toEqual(payload);

    const [version, encodedIv, encodedCiphertext] = sealed.split(".");
    if (!version || !encodedIv || !encodedCiphertext) throw new Error("Invalid sealed session");

    const tamperIndex = Math.floor(encodedCiphertext.length / 2);
    const replacement = encodedCiphertext[tamperIndex] === "A" ? "B" : "A";
    const tamperedCiphertext = `${encodedCiphertext.slice(0, tamperIndex)}${replacement}${encodedCiphertext.slice(tamperIndex + 1)}`;

    await expect(
      unsealSession(`${version}.${encodedIv}.${tamperedCiphertext}`, secret),
    ).resolves.toBeNull();
  });

  it("uses host-only secure cookie attributes", () => {
    expect(createSessionCookie("value")).toContain(
      "__Host-bdb_admin_session=value; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict",
    );
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });
});
