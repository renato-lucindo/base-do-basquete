import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useFetcher } from "react-router";

import type { AdminPlayerSearchResult } from "../../modules/players/admin-domain";
import { InlineFieldError } from "./inline-field-error";

interface CreatePlayerResponse {
  error?: string;
  requiresConfirmation?: boolean;
  player?: AdminPlayerSearchResult;
}

interface InlinePlayerCreateDialogProps {
  csrfToken: string;
  initialName: string;
  open: boolean;
  onClose: () => void;
  onCreated: (player: AdminPlayerSearchResult) => void;
}

export function InlinePlayerCreateDialog({
  csrfToken,
  initialName,
  open,
  onClose,
  onCreated,
}: InlinePlayerCreateDialogProps) {
  const fetcher = useFetcher<CreatePlayerResponse>();
  const dialogRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const deliveredId = useRef<number | null>(null);
  const [allowSimilar, setAllowSimilar] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAllowSimilar(false);
    requestAnimationFrame(() => nameRef.current?.focus());
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  useEffect(() => {
    const player = fetcher.data?.player;
    if (!player || deliveredId.current === player.id) return;
    deliveredId.current = player.id;
    onCreated(player);
    onClose();
  }, [fetcher.data, onClose, onCreated]);

  useEffect(() => {
    if (fetcher.data?.requiresConfirmation) setAllowSimilar(true);
  }, [fetcher.data]);

  if (!open) return null;
  const pending = fetcher.state !== "idle";
  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return (
    <div className="admin-dialog-backdrop">
      <section
        ref={dialogRef}
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-player-title"
        onKeyDown={trapFocus}
      >
        <header>
          <div>
            <p className="eyebrow">Cadastro global</p>
            <h2 id="new-player-title">Criar novo atleta</h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <p>Revise os resultados da busca antes de criar. A camisa será definida no elenco.</p>
        <fetcher.Form method="post" action="/api/admin/players" className="inline-player-form">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="intent" value="create-player" />
          <input type="hidden" name="allowSimilar" value={String(allowSimilar)} />
          <label>
            Nome completo
            <input
              ref={nameRef}
              name="fullName"
              minLength={2}
              maxLength={160}
              required
              defaultValue={initialName}
              aria-describedby={fetcher.data?.error ? "new-player-error" : undefined}
            />
          </label>
          <label>
            Apelido <small>opcional</small>
            <input name="nickname" maxLength={80} />
          </label>
          <InlineFieldError id="new-player-error" message={fetcher.data?.error} />
          {fetcher.data?.requiresConfirmation ? (
            <p className="admin-warning">
              Confirme somente após verificar que não é o mesmo atleta já exibido na busca.
            </p>
          ) : null}
          <footer>
            <button className="button button-ghost" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={pending}>
              {pending
                ? "Criando…"
                : allowSimilar
                  ? "Confirmar novo cadastro"
                  : "Criar e selecionar"}
            </button>
          </footer>
        </fetcher.Form>
      </section>
    </div>
  );
}
