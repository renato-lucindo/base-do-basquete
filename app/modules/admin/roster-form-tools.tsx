import { useEffect, useState } from "react";

import { normalizePublicSearch } from "../search/public-search-domain";

export function RosterFormTools({ formId }: { formId: string }) {
  const [query, setQuery] = useState("");
  const [duplicates, setDuplicates] = useState(0);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const validate = () => {
      const jerseys = new Map<string, HTMLInputElement[]>();
      for (const label of form.querySelectorAll<HTMLElement>("[data-roster-player]")) {
        const selected = label.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked;
        const jersey = label.querySelector<HTMLInputElement>('input[name^="jersey-"]');
        if (!selected || !jersey?.value.trim()) {
          jersey?.removeAttribute("aria-invalid");
          continue;
        }
        const normalized = normalizePublicSearch(jersey.value);
        const inputs = jerseys.get(normalized) ?? [];
        inputs.push(jersey);
        jerseys.set(normalized, inputs);
      }
      const duplicateInputs = [...jerseys.values()].filter((inputs) => inputs.length > 1).flat();
      for (const jersey of form.querySelectorAll<HTMLInputElement>('input[name^="jersey-"]')) {
        if (duplicateInputs.includes(jersey)) jersey.setAttribute("aria-invalid", "true");
        else jersey.removeAttribute("aria-invalid");
      }
      setDuplicates(duplicateInputs.length);
      return duplicateInputs[0] ?? null;
    };
    const onSubmit = (event: SubmitEvent) => {
      const firstDuplicate = validate();
      if (firstDuplicate) {
        event.preventDefault();
        firstDuplicate.focus();
      }
    };
    form.addEventListener("input", validate);
    form.addEventListener("change", validate);
    form.addEventListener("submit", onSubmit);
    validate();
    return () => {
      form.removeEventListener("input", validate);
      form.removeEventListener("change", validate);
      form.removeEventListener("submit", onSubmit);
    };
  }, [formId]);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const normalized = normalizePublicSearch(query);
    for (const label of form.querySelectorAll<HTMLElement>("[data-roster-player]")) {
      label.hidden = Boolean(
        normalized && !normalizePublicSearch(label.dataset.rosterPlayer ?? "").includes(normalized),
      );
    }
  }, [formId, query]);

  return (
    <div className="roster-form-tools">
      <label>
        Buscar atleta no elenco
        <input
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Nome do atleta"
          type="search"
          value={query}
        />
      </label>
      <p aria-live="polite">
        {duplicates > 0
          ? `${duplicates} campo(s) com camisa duplicada. Corrija antes de salvar.`
          : "Nenhuma camisa duplicada entre os atletas selecionados."}
      </p>
    </div>
  );
}
