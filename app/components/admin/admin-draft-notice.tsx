interface AdminDraftNoticeProps {
  savedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
}

export function AdminDraftNotice({ savedAt, onRestore, onDiscard }: AdminDraftNoticeProps) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(savedAt));
  return (
    <aside className="admin-draft-notice" aria-label="Rascunho recuperável">
      <div>
        <strong>Rascunho encontrado</strong>
        <span>Salvo em {label} neste navegador.</span>
      </div>
      <div>
        <button className="button button-primary" type="button" onClick={onRestore}>
          Restaurar
        </button>
        <button className="button button-ghost" type="button" onClick={onDiscard}>
          Descartar
        </button>
      </div>
    </aside>
  );
}
