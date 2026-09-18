const SIENNA_SCRIPT_ID = "sienna-accessibility-script";
const SIENNA_SCRIPT_PATH = "/vendor/sienna/sienna.min.js";

type SiennaWindow = Window & {
  SiennaPlugin?: Promise<unknown>;
};

function improveTriggerKeyboardSupport(documentReference: Document) {
  const trigger = documentReference.querySelector<HTMLElement>(".asw-menu-btn");
  if (!trigger || trigger.dataset.bdbKeyboardReady === "true") return;

  const syncMenuState = () => {
    const menu = documentReference.querySelector(".asw-menu");
    const closeButton = documentReference.querySelector<HTMLElement>(".asw-menu-close");
    const isOpen = Boolean(menu && menu.parentElement?.style.display !== "none");
    trigger.setAttribute("aria-expanded", String(isOpen));
    closeButton?.setAttribute("aria-label", "Fechar menu de acessibilidade");
    closeButton?.setAttribute("title", "Fechar menu de acessibilidade");
  };

  trigger.dataset.bdbKeyboardReady = "true";
  trigger.setAttribute("aria-label", "Abrir menu de acessibilidade");
  trigger.setAttribute("title", "Abrir menu de acessibilidade");
  trigger.addEventListener("keydown", (event) => {
    if (event.key !== " ") return;
    event.preventDefault();
    trigger.click();
  });
  documentReference.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !documentReference.querySelector(".asw-menu")) return;
    documentReference.querySelector<HTMLElement>(".asw-menu-close")?.click();
    trigger.focus();
  });

  const MutationObserverConstructor = documentReference.defaultView?.MutationObserver;
  if (MutationObserverConstructor) {
    new MutationObserverConstructor(syncMenuState).observe(documentReference.body, {
      attributeFilter: ["style"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }
  syncMenuState();
}

export function ensureSiennaScript(documentReference?: Document) {
  const activeDocument =
    documentReference ?? (typeof document === "undefined" ? undefined : document);
  if (!activeDocument) return null;

  const existing = activeDocument.getElementById(SIENNA_SCRIPT_ID);
  if (existing) return existing as HTMLScriptElement;

  const script = activeDocument.createElement("script");
  script.id = SIENNA_SCRIPT_ID;
  script.src = SIENNA_SCRIPT_PATH;
  script.async = true;
  script.dataset.lang = "pt";
  script.dataset.position = "center-right";
  script.dataset.offset = "12,12";
  script.dataset.disableObserveLang = "true";
  script.addEventListener("load", () => {
    const pluginReady = (activeDocument.defaultView as SiennaWindow | null)?.SiennaPlugin;
    Promise.resolve(pluginReady)
      .then(() => {
        script.dataset.status = "ready";
        improveTriggerKeyboardSupport(activeDocument);
      })
      .catch(() => {
        script.dataset.status = "unavailable";
      });
  });
  script.addEventListener("error", () => {
    script.dataset.status = "unavailable";
  });
  activeDocument.head.appendChild(script);
  return script;
}
