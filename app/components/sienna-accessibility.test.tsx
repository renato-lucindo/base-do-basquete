import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiennaAccessibility } from "./sienna-accessibility";
import { ensureSiennaScript } from "./sienna-loader";

type Listener = () => void;

function fakeDocument() {
  const listeners = new Map<string, Listener>();
  const elements = new Map<string, HTMLScriptElement>();
  const script = {
    async: false,
    dataset: {},
    id: "",
    src: "",
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, listener);
    },
  } as unknown as HTMLScriptElement;
  const documentReference = {
    createElement: () => script,
    getElementById: (id: string) => elements.get(id) ?? null,
    head: {
      appendChild(element: HTMLScriptElement) {
        elements.set(element.id, element);
        return element;
      },
    },
    querySelector: () => null,
  } as unknown as Document;

  return { documentReference, listeners, script };
}

describe("SiennaAccessibility", () => {
  it("does not emit or execute the browser widget during SSR", () => {
    expect(renderToStaticMarkup(<SiennaAccessibility />)).toBe("");
    expect(ensureSiennaScript(undefined)).toBeNull();
  });

  it("loads the local Portuguese widget only once across navigations", () => {
    const { documentReference, script } = fakeDocument();

    const first = ensureSiennaScript(documentReference);
    const second = ensureSiennaScript(documentReference);

    expect(first).toBe(script);
    expect(second).toBe(first);
    expect(script.src).toBe("/vendor/sienna/sienna.min.js");
    expect(script.dataset.lang).toBe("pt");
    expect(script.dataset.position).toBe("center-right");
  });

  it("keeps failures isolated from the application", () => {
    const { documentReference, listeners, script } = fakeDocument();
    ensureSiennaScript(documentReference);

    expect(() => listeners.get("error")?.()).not.toThrow();
    expect(script.dataset.status).toBe("unavailable");
  });
});
