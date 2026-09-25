import { extractTextItems, getDocumentProxy } from "unpdf";

import { parseFibaGeniusBoxscore } from "./parser";
import { parseBasketballSiteBoxscore } from "./site-parser";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 4;

export interface ValidatedPdf {
  bytes: Uint8Array;
  filename: string;
  sha256: string;
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  return toHex(await crypto.subtle.digest("SHA-256", copy.buffer));
}

export function createPdfStorageBody(bytes: Uint8Array): Blob {
  return new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
}

export async function validatePdfUpload(file: File): Promise<ValidatedPdf> {
  if (file.size < 5 || file.size > MAX_PDF_BYTES) throw new Error("BDB_PDF_SIZE");
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("BDB_PDF_TYPE");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("BDB_PDF_SIGNATURE");
  }
  return { bytes, filename: file.name.slice(0, 160), sha256: await sha256Bytes(bytes) };
}

export async function extractSupportedBoxscore(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(Uint8Array.from(bytes), {
    maxImageSize: 16_777_216,
    stopAtErrors: true,
  });
  if (pdf.numPages < 1 || pdf.numPages > MAX_PDF_PAGES) throw new Error("BDB_PDF_PAGE_COUNT");
  const { items } = await extractTextItems(pdf);
  if (!items.some((page) => page.some((item) => item.str.trim()))) {
    throw new Error("BDB_PDF_NO_TEXT");
  }
  const completeText = items
    .flat()
    .map((item) => item.str)
    .join(" ");
  return completeText.includes("Ficha do Jogo")
    ? parseBasketballSiteBoxscore(items)
    : parseFibaGeniusBoxscore(items);
}

export const extractFibaGeniusBoxscore = extractSupportedBoxscore;
