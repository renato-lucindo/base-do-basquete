import { useEffect, useMemo, useState } from "react";

import {
  createAdminFormDraft,
  parseAdminFormDraft,
  sanitizeDraftEntries,
  type AdminFormDraft,
} from "./form-draft";

interface FormDraftNoticeProps {
  contextId: string;
  formId: string;
}

function controlsByName(form: HTMLFormElement, name: string): Element[] {
  return Array.from(form.elements).filter(
    (element) =>
      (element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement) &&
      element.name === name,
  );
}

function restoreFields(form: HTMLFormElement, draft: AdminFormDraft) {
  for (const [name, values] of Object.entries(draft.fields)) {
    for (const control of controlsByName(form, name)) {
      if (control instanceof HTMLInputElement) {
        if (control.type === "checkbox" || control.type === "radio") {
          control.checked = values.includes(control.value);
        } else if (control.type !== "file") {
          control.value = values[0] ?? "";
        }
      } else if (control instanceof HTMLSelectElement && control.multiple) {
        for (const option of control.options) option.selected = values.includes(option.value);
      } else {
        control.value = values[0] ?? "";
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

export function FormDraftNotice({ contextId, formId }: FormDraftNoticeProps) {
  const storageKey = useMemo(
    () => `bdb.admin.draft.${encodeURIComponent(contextId)}.${encodeURIComponent(formId)}`,
    [contextId, formId],
  );
  const [candidate, setCandidate] = useState<AdminFormDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const stored = parseAdminFormDraft(localStorage.getItem(storageKey), formId, contextId);
    if (stored) setCandidate(stored);
    else localStorage.removeItem(storageKey);

    let timer = 0;
    const persist = () => {
      window.clearTimeout(timer);
      setDirty(true);
      timer = window.setTimeout(() => {
        const fields = sanitizeDraftEntries(new FormData(form).entries());
        const draft = createAdminFormDraft(formId, contextId, fields);
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setSavedAt(draft.updatedAt);
      }, 300);
    };
    const submitted = () => setDirty(false);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };

    form.addEventListener("input", persist);
    form.addEventListener("change", persist);
    form.addEventListener("submit", submitted);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", persist);
      form.removeEventListener("change", persist);
      form.removeEventListener("submit", submitted);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [contextId, dirty, formId, storageKey]);

  return (
    <aside className="form-draft-notice" aria-live="polite">
      {candidate ? (
        <div>
          <strong>Rascunho local encontrado</strong>
          <p>Ele pertence a este formulário e expira automaticamente em até 24 horas.</p>
          <button
            className="button button-ghost"
            onClick={() => {
              const form = document.getElementById(formId);
              if (form instanceof HTMLFormElement) restoreFields(form, candidate);
              setCandidate(null);
              setDirty(true);
            }}
            type="button"
          >
            Restaurar
          </button>
          <button
            className="button button-ghost"
            onClick={() => {
              localStorage.removeItem(storageKey);
              setCandidate(null);
              setDirty(false);
            }}
            type="button"
          >
            Descartar
          </button>
        </div>
      ) : (
        <p>
          {savedAt
            ? "Rascunho salvo somente neste navegador."
            : "Alterações serão recuperáveis neste navegador por até 24 horas."}{" "}
          PDF, arquivo, token, sessão, segredo e credencial nunca são armazenados.
        </p>
      )}
    </aside>
  );
}
