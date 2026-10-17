import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
export function AdminNavigation() {
  return (
    <nav className="public-nav" aria-label="Áreas administrativas">
      {(
        [
          ["/admin/competitions", "Competições"],
          ["/admin/teams", "Equipes"],
          ["/admin/players", "Atletas"],
          ["/admin/review-queues", "Pendências"],
          ["/admin/security", "Segurança"],
        ] as const
      ).map(([to, label]) => (
        <NavLink key={to} to={to}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
export function AdminArea({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to="/admin">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>Base do Basquete</span>
        </Link>
        <span className="environment-pill">Sessão administrativa</span>
      </header>
      <AdminNavigation />
      <section className="admin-welcome admin-dashboard">
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
