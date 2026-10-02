import { describe, expect, it } from "vitest";

import { createPdfStorageBody, detectSupportedBoxscoreFormat, sha256Bytes } from "./extract.server";
import type { PositionedTextItem } from "./types";

function page(...parts: string[]): PositionedTextItem[][] {
  return [parts.map((str, index) => ({ str, x: index * 10, y: 100, width: 10, height: 10 }))];
}

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

describe("detectSupportedBoxscoreFormat", () => {
  it("recognizes only the complete FIBA/Genius signature", () => {
    expect(
      detectSupportedBoxscoreFormat(page("Box Score FIBA", "Arremessos", "Rebotes", "Não jogou")),
    ).toBe("FIBA_GENIUS_SPORTS");
  });

  it("recognizes only the complete Basketball Site signature", () => {
    expect(detectSupportedBoxscoreFormat(page("Ficha do Jogo", "Date / Time:"))).toBe(
      "BASKETBALL_SITE",
    );
  });

  it("rejects unknown and ambiguous text instead of falling back to FIBA", () => {
    expect(() => detectSupportedBoxscoreFormat(page("Súmula desconhecida"))).toThrow(
      "BDB_PDF_UNSUPPORTED_FORMAT",
    );
    expect(() =>
      detectSupportedBoxscoreFormat(
        page(
          "Box Score FIBA",
          "Arremessos",
          "Rebotes",
          "Não jogou",
          "Ficha do Jogo",
          "Date / Time:",
        ),
      ),
    ).toThrow("BDB_PDF_UNSUPPORTED_FORMAT");
  });
});
