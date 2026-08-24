import { describe, expect, it } from "vitest";

import { createPdfStorageBody, sha256Bytes } from "./extract.server";

describe("createPdfStorageBody", () => {
  it("preserva integralmente os bytes binários enviados ao Storage", async () => {
    const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0x80, 0xff]);
    const body = createPdfStorageBody(bytes);
    const storedBytes = new Uint8Array(await body.arrayBuffer());

    expect(body.type).toBe("application/pdf");
    expect(body.size).toBe(bytes.byteLength);
    expect(storedBytes).toEqual(bytes);
    expect(await sha256Bytes(storedBytes)).toBe(await sha256Bytes(bytes));
  });
});
